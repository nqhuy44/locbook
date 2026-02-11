from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select
from pydantic import BaseModel
from typing import Optional, Dict

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Profile
from src.modules.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Dict] = None

@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Eager load profile
    stmt = select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one()

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "profile": user.profile
    }

@router.put("/me/profile")
async def update_my_profile(
    update_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Fetch profile
    stmt = select(Profile).where(Profile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)
    
    if update_data.display_name is not None:
        profile.display_name = update_data.display_name
    if update_data.bio is not None:
        profile.bio = update_data.bio
    if update_data.preferences is not None:
        if profile.preferences is None:
             profile.preferences = {}
        profile.preferences.update(update_data.preferences) # Merge
        
    await db.commit()
    await db.refresh(profile)
    return profile
