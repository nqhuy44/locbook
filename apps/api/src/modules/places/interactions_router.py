from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Interaction, Place, InteractionType
from src.modules.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/interactions", tags=["Interactions"])


class InteractionRequest(BaseModel):
    place_id: str
    type: str  # upvote, view, bookmark


@router.post("")
async def toggle_interaction(
    payload: InteractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Create or toggle an interaction.
    
    - upvote/bookmark: toggles (create if not exists, delete if exists)
    - view: always creates (no toggle)
    
    Automatically syncs Place.upvote_count on upvote toggle.
    """
    try:
        place_uuid = uuid.UUID(payload.place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    # Verify Place exists
    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    # Check existing interaction
    stmt = select(Interaction).where(
        Interaction.user_id == current_user.id,
        Interaction.place_id == place_uuid,
        Interaction.type == payload.type,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    # --- Toggle logic for upvote/bookmark ---
    if payload.type in ("upvote", "bookmark"):
        if existing:
            # Toggle OFF: remove interaction
            await db.delete(existing)
            
            # Sync upvote_count
            if payload.type == "upvote":
                place.upvote_count = max(0, place.upvote_count - 1)
            
            await db.commit()
            return {
                "status": "removed",
                "type": payload.type,
                "place_id": str(place_uuid),
                "upvote_count": place.upvote_count,
            }
        else:
            # Toggle ON: create interaction
            interaction = Interaction(
                user_id=current_user.id,
                place_id=place_uuid,
                type=payload.type,
            )
            db.add(interaction)
            
            # Sync upvote_count
            if payload.type == "upvote":
                place.upvote_count += 1
            
            await db.commit()
            await db.refresh(interaction)
            return {
                "status": "created",
                "type": payload.type,
                "place_id": str(place_uuid),
                "interaction_id": str(interaction.id),
                "upvote_count": place.upvote_count,
            }

    # --- View: always create (idempotent, no toggle) ---
    if existing:
        return {"status": "exists", "type": payload.type, "place_id": str(place_uuid)}

    interaction = Interaction(
        user_id=current_user.id,
        place_id=place_uuid,
        type=payload.type,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    return {
        "status": "created",
        "type": payload.type,
        "place_id": str(place_uuid),
        "interaction_id": str(interaction.id),
    }


@router.get("/status/{place_id}")
async def get_interaction_status(
    place_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Check if current user has upvoted/bookmarked a place."""
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(Interaction).where(
        Interaction.user_id == current_user.id,
        Interaction.place_id == place_uuid,
    )
    result = await db.execute(stmt)
    interactions = result.scalars().all()

    return {
        "place_id": place_id,
        "upvoted": any(i.type == "upvote" for i in interactions),
        "bookmarked": any(i.type == "bookmark" for i in interactions),
        "viewed": any(i.type == "view" for i in interactions),
    }


@router.delete("")
async def delete_interaction(
    payload: InteractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Explicitly delete an interaction (alternative to toggle)."""
    try:
        place_uuid = uuid.UUID(payload.place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(Interaction).where(
        Interaction.user_id == current_user.id,
        Interaction.place_id == place_uuid,
        Interaction.type == payload.type,
    )
    result = await db.execute(stmt)
    interaction = result.scalar_one_or_none()

    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    await db.delete(interaction)

    # Sync upvote_count
    if payload.type == "upvote":
        place = await db.get(Place, place_uuid)
        if place:
            place.upvote_count = max(0, place.upvote_count - 1)

    await db.commit()
    return {"status": "deleted"}
