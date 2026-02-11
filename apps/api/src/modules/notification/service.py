"""Notification service — create and manage in-app notifications."""
import logging
from typing import Optional, List, Dict, Any
import uuid

from sqlmodel import select, func, col
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database.sql_models import Notification, NotificationType

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    type: NotificationType,
    actor_id: Optional[uuid.UUID] = None,
    entity_id: Optional[str] = None,
    message: Optional[str] = None,
) -> Notification:
    """Create a new notification for a user."""
    notification = Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        type=type,
        entity_id=entity_id,
        message=message,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    logger.debug(f"Created notification: {type} for user {recipient_id}")
    return notification


async def get_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> Dict[str, Any]:
    """Get paginated notifications for a user."""
    query = select(Notification).where(Notification.recipient_id == user_id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Count unread
    unread_query = select(func.count()).where(
        Notification.recipient_id == user_id,
        Notification.is_read == False,
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar_one()

    # Fetch page
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return {
        "data": [
            {
                "id": str(n.id),
                "type": n.type,
                "actor_id": str(n.actor_id) if n.actor_id else None,
                "entity_id": n.entity_id,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        "total": total,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset,
    }


async def mark_read(db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Mark a notification as read. Returns True if found and updated."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.recipient_id == user_id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if not notification:
        return False

    notification.is_read = True
    await db.commit()
    return True


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all notifications as read for a user. Returns count updated."""
    from sqlalchemy import update
    
    stmt = (
        update(Notification)
        .where(Notification.recipient_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
