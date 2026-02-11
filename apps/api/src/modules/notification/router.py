"""Notification API router — user-facing endpoints (JWT-protected)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User
from src.modules.auth.dependencies import get_current_user
from src.modules.notification import service as notification_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Get paginated notifications for the current user."""
    return await notification_service.get_notifications(
        db, user_id=current_user.id, limit=limit, offset=offset, unread_only=unread_only
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Mark a single notification as read."""
    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    success = await notification_service.mark_read(db, notif_uuid, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Mark all notifications as read for the current user."""
    count = await notification_service.mark_all_read(db, current_user.id)
    return {"status": "ok", "updated": count}
