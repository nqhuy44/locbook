from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy import text
from typing import List, Optional

from src.database.postgres import get_db_session
from src.database.sql_models import Place, User, Profile, PlaceRead
from src.routers.dependencies import get_current_user

router = APIRouter(prefix="/api/discovery", tags=["Discovery"])

@router.get("/places", response_model=List[PlaceRead])
async def discover_places(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Fetch User Profile with Vibe
    stmt = select(Profile).where(Profile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile or profile.vibe_embedding is None:
        # Fallback to recent places or popular
        # For now, just return latest
        stmt = select(Place).order_by(Place.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(stmt)
        places = result.scalars().all()
    else:
        # Vector Similarity Search
        user_embedding = profile.vibe_embedding
        
        # SQLAlchemy with pgvector
        # order_by(Place.embedding.l2_distance(user_embedding))
        # strictly speaking, cosine distance is better for embeddings usually: <=>
        
        stmt = select(Place).order_by(
            Place.embedding.cosine_distance(user_embedding)
        ).offset(offset).limit(limit)
        
        result = await db.execute(stmt)
        places = result.scalars().all()

    # Convert to Pydantic models
    return [PlaceRead.model_validate(p) for p in places]
