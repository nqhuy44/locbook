from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select
from pydantic import BaseModel
from typing import Optional, Dict, List

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Profile, UserList, ListPrivacy
from src.modules.auth.dependencies import get_current_user, get_optional_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
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

    profile = user.profile
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "display_name": profile.display_name if profile else None,
        "avatar_url": profile.avatar_url if profile else None,
        "bio": profile.bio if profile else None,
        "preferences": profile.preferences if profile else {}
    }

@router.put("/me/update")
async def update_my_profile(
    update_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    print(f"Update Profile Request: {update_data}")
    # Update User fields (username)
    if update_data.username is not None:
        # Check uniqueness if changed
        if update_data.username != current_user.username:
            # Simple validation regex
            import re
            if not re.match(r'^[a-zA-Z0-9_\.]+$', update_data.username):
                 raise HTTPException(status_code=400, detail="Username contains invalid characters")
            
            # Check DB
            stmt = select(User).where(User.username == update_data.username)
            result = await db.execute(stmt)
            if result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username already taken")
            
            current_user.username = update_data.username
            db.add(current_user)

    # Fetch profile
    stmt = select(Profile).where(Profile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)
    
    if update_data.display_name is not None:
        profile.display_name = update_data.display_name
    if update_data.avatar_url is not None:
        print(f"Setting avatar_url to: {update_data.avatar_url}")
        profile.avatar_url = update_data.avatar_url
    if update_data.bio is not None:
        profile.bio = update_data.bio
    if update_data.preferences is not None:
        # Force new dict reference for JSONB tracking
        current_prefs = dict(profile.preferences) if profile.preferences else {}
        current_prefs.update(update_data.preferences)
        profile.preferences = current_prefs
        print(f"Updated preferences: {profile.preferences}")
        
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    
    # Return matched structure
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "display_name": profile.display_name,
        "avatar_url": profile.avatar_url,
        "bio": profile.bio,
        "preferences": profile.preferences
    }

@router.get("/{username}")
async def get_public_profile(
    username: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get public profile info and public lists."""
    stmt = select(User).options(selectinload(User.profile)).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
         
    profile = user.profile
    
    # Fetch public lists
    stmt_lists = select(UserList).where(
        UserList.user_id == user.id, 
        UserList.privacy == ListPrivacy.PUBLIC
    ).order_by(UserList.updated_at.desc())
    
    result_lists = await db.execute(stmt_lists)
    public_lists = result_lists.scalars().all()
    
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": profile.display_name if profile else None,
        "avatar_url": profile.avatar_url if profile else None,
        "bio": profile.bio if profile else None,
        "public_lists": [
            {
                "id": str(l.id),
                "name": l.name,
                "description": l.description,
                "item_count": len(l.items)
            } for l in public_lists
        ]
    }
