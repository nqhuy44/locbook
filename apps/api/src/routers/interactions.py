from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
import uuid

from src.database.postgres import get_db_session
from src.database.sql_models import User, Interaction, Place
from src.routers.dependencies import get_current_user

router = APIRouter(prefix="/api/interactions", tags=["Interactions"])

class InteractionRequest(BaseModel):
    place_id: str
    type: str # upvote, view

@router.post("")
async def create_interaction(
    payload: InteractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Verify Place exists
    try:
        place_uuid = uuid.UUID(payload.place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(Place).where(Place.id == place_uuid)
    result = await db.execute(stmt)
    place = result.scalar_one_or_none()
    
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    # Check if interaction exists (for upvotes, we might toggle or strict unique)
    stmt_exist = select(Interaction).where(
        Interaction.user_id == current_user.id,
        Interaction.place_id == place_uuid,
        Interaction.type == payload.type
    )
    result_exist = await db.execute(stmt_exist)
    existing = result_exist.scalar_one_or_none()
    
    if existing:
        if payload.type == "upvote":
             # Toggle off? Or just return existing?
             # Let's say we just return it. Delete endpoint for removing upvote.
             return existing
        # For views, we might just update timestamp or ignore if recent?
        # Let's just return existing for now.
        return existing

    interaction = Interaction(
        user_id=current_user.id,
        place_id=place_uuid,
        type=payload.type
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    
    # TODO: Trigger background task to update User Vibe Profile (Phase 4)
    
    return interaction

@router.delete("")
async def delete_interaction(
    payload: InteractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    try:
        place_uuid = uuid.UUID(payload.place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(Interaction).where(
        Interaction.user_id == current_user.id,
        Interaction.place_id == place_uuid,
        Interaction.type == payload.type
    )
    result = await db.execute(stmt)
    interaction = result.scalar_one_or_none()
    
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
        
    await db.delete(interaction)
    await db.commit()
    
    return {"status": "deleted"}
