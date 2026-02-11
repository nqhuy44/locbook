from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import List

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Profile
from src.modules.auth.dependencies import get_current_user
from src.core.ai import get_text_embedding

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])

class OnboardingQuiz(BaseModel):
    selected_vibes: List[str] # e.g. ["Quiet", "Cozy", "Jazz"]
    selected_categories: List[str] # e.g. ["Cafe", "Library"]
    additional_context: str | None = None

@router.post("/submit")
async def submit_onboarding(
    payload: OnboardingQuiz,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Construct Vibe Description
    vibe_text = (
        f"User likes vibes: {', '.join(payload.selected_vibes)}. "
        f"Preferred categories: {', '.join(payload.selected_categories)}. "
    )
    if payload.additional_context:
        vibe_text += f"Context: {payload.additional_context}"
        
    # Generate Embedding
    embedding = get_text_embedding(vibe_text)
    
    # Update Profile
    stmt = select(Profile).where(Profile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)
        
    if embedding:
        profile.vibe_embedding = embedding
        
    # Store quiz result in preferences for reference
    if profile.preferences is None:
        profile.preferences = {}
    
    profile.preferences["onboarding_quiz"] = payload.model_dump()
    
    await db.commit()
    
    return {"status": "success", "message": "Profile initialized"}
