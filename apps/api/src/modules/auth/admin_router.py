from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select, func, desc, col
from typing import List, Optional
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Profile, Role
from src.modules.auth.dependencies import verify_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(verify_admin)])

@router.get("/users")
async def get_users(
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    query = select(User).options(selectinload(User.profile))
    
    if search:
        query = query.where(
            (col(User.email).ilike(f"%{search}%")) | 
            (col(User.username).ilike(f"%{search}%"))
        )
        
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()
    
    # Paginate
    query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)
    users = (await db.execute(query)).scalars().all()
    
    return {
        "data": [
            {
                "id": str(u.id),
                "email": u.email,
                "username": u.username,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at,
                "avatar_url": u.profile.avatar_url if u.profile else None,
                "display_name": u.profile.display_name if u.profile else None
            } for u in users
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    is_active: bool,
    db: AsyncSession = Depends(get_db_session)
):
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID")
        
    user = await db.get(User, u_uuid)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
         
    user.is_active = is_active
    db.add(user)
    await db.commit()
    return {"status": "updated", "is_active": user.is_active}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User UUID")
        
    user = await db.get(User, u_uuid)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
    
    # Check if this is the only admin? Maybe not needed for now.
    
    await db.delete(user)
    await db.commit()
    return {"status": "deleted"}
