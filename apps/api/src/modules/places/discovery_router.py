from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col
from sqlalchemy import text
from typing import List, Optional
from enum import Enum

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import Place, User, Profile, PlaceRead, Interaction
from src.modules.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/discovery", tags=["Discovery"])


class SortMode(str, Enum):
    POPULAR = "popular"      # Most upvotes
    BEST_MATCH = "best_match"  # Vector cosine distance (personalized)
    TRENDING = "trending"    # Most upvotes in last 7 days
    NEWEST = "newest"        # Most recently added


@router.get("/places", response_model=List[PlaceRead])
async def discover_places(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: SortMode = Query(SortMode.POPULAR),
    category: Optional[str] = Query(None),
    vibe: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Discover places with multiple sort modes.
    
    Sort modes:
    - popular: by upvote_count DESC
    - best_match: by vector cosine distance to user's vibe embedding
    - trending: by upvotes received in last 7 days
    - newest: by created_at DESC
    """

    # --- BEST MATCH: Vector similarity (personalized) ---
    if sort == SortMode.BEST_MATCH:
        stmt = select(Profile).where(Profile.user_id == current_user.id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile and profile.vibe_embedding is not None:
            query = select(Place)
            query = _apply_filters(query, category, vibe, min_rating)
            query = query.order_by(
                Place.embedding.cosine_distance(profile.vibe_embedding)
            ).offset(offset).limit(limit)

            result = await db.execute(query)
            places = result.scalars().all()
            return [PlaceRead.model_validate(p) for p in places]
        
        # Fallback to popular if no vibe embedding
        sort = SortMode.POPULAR

    # --- TRENDING: Upvotes in last 7 days ---
    if sort == SortMode.TRENDING:
        # Subquery: count upvotes per place in last 7 days
        trending_stmt = text("""
            SELECT p.*, COALESCE(t.recent_upvotes, 0) as recent_upvotes
            FROM places p
            LEFT JOIN (
                SELECT place_id, COUNT(*) as recent_upvotes
                FROM interactions
                WHERE type = 'upvote' AND created_at >= NOW() - INTERVAL '7 days'
                GROUP BY place_id
            ) t ON p.id = t.place_id
        """)
        
        # Build with filters if needed
        conditions = []
        params = {}
        if category:
            conditions.append(":category = ANY(p.categories)")
            params["category"] = category
        if vibe:
            conditions.append(":vibe = ANY(p.vibes)")
            params["vibe"] = vibe
        if min_rating:
            conditions.append("p.rating >= :min_rating")
            params["min_rating"] = min_rating

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        full_sql = text(f"""
            SELECT p.*
            FROM places p
            LEFT JOIN (
                SELECT place_id, COUNT(*) as recent_upvotes
                FROM interactions
                WHERE type = 'upvote' AND created_at >= NOW() - INTERVAL '7 days'
                GROUP BY place_id
            ) t ON p.id = t.place_id
            {where_clause}
            ORDER BY COALESCE(t.recent_upvotes, 0) DESC, p.upvote_count DESC
            OFFSET :offset LIMIT :limit
        """)
        params["offset"] = offset
        params["limit"] = limit

        result = await db.execute(full_sql, params)
        rows = result.mappings().all()
        
        # Manual mapping from row dict to PlaceRead
        places = []
        for row in rows:
            try:
                place = await db.get(Place, row["id"])
                if place:
                    places.append(PlaceRead.model_validate(place))
            except Exception:
                continue
        return places

    # --- POPULAR: by upvote_count DESC ---
    if sort == SortMode.POPULAR:
        query = select(Place)
        query = _apply_filters(query, category, vibe, min_rating)
        query = query.order_by(
            Place.upvote_count.desc(), Place.created_at.desc()
        ).offset(offset).limit(limit)

        result = await db.execute(query)
        places = result.scalars().all()
        return [PlaceRead.model_validate(p) for p in places]

    # --- NEWEST: by created_at DESC ---
    query = select(Place)
    query = _apply_filters(query, category, vibe, min_rating)
    query = query.order_by(Place.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    places = result.scalars().all()
    return [PlaceRead.model_validate(p) for p in places]


def _apply_filters(query, category: Optional[str], vibe: Optional[str], min_rating: Optional[float]):
    """Apply common filters to a Place query."""
    if category:
        query = query.where(col(Place.categories).any(category))
    if vibe:
        query = query.where(col(Place.vibes).any(vibe))
    if min_rating:
        query = query.where(Place.rating >= min_rating)
    return query
