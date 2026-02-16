from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Memo, Place, MemoVisibility
from src.modules.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/memos", tags=["Memos"])

class MemoCreate(BaseModel):
    place_id: str
    content: str
    visibility: MemoVisibility = MemoVisibility.PUBLIC
    rating: Optional[int] = None

class MemoRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    place_id: uuid.UUID
    content: str
    visibility: MemoVisibility
    rating: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("", response_model=MemoRead)
async def create_memo(
    payload: MemoCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    try:
        place_uuid = uuid.UUID(payload.place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Place UUID")

    # Verify place exists
    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    memo = Memo(
        user_id=current_user.id,
        place_id=place_uuid,
        content=payload.content,
        visibility=payload.visibility,
        rating=payload.rating
    )
    
    # Sync memo_count on place
    place.memo_count = (place.memo_count or 0) + 1
    
    db.add(memo)
    db.add(place)
    await db.commit()
    await db.refresh(memo)
    return memo

@router.get("/place/{place_id}", response_model=List[MemoRead])
async def get_place_memos(
    place_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Place UUID")

    stmt = select(Memo).where(
        Memo.place_id == place_uuid,
        Memo.visibility == MemoVisibility.PUBLIC
    ).order_by(desc(Memo.created_at))
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/{memo_id}")
async def delete_memo(
    memo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    memo = await db.get(Memo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
        
    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this memo")
        
    # Sync memo_count
    place = await db.get(Place, memo.place_id)
    if place:
        place.memo_count = max(0, (place.memo_count or 1) - 1)
        db.add(place)

    await db.delete(memo)
    await db.commit()
    return {"status": "deleted"}
