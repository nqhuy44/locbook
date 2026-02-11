"""Analytics service — fire-and-forget event logging + stats queries."""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from sqlmodel import select, func
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database.sql_models import AnalyticsEvent, UserMonthlyStat, SystemDailyStat
from src.core.database.postgres import get_db_session

logger = logging.getLogger(__name__)


async def log_event(
    event_type: str,
    user_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
):
    """Fire-and-forget event logging. Call from BackgroundTasks."""
    try:
        async for db in get_db_session():
            event = AnalyticsEvent(
                event_type=event_type,
                user_id=user_id,
                entity_id=entity_id,
                payload=payload or {},
            )
            db.add(event)
            await db.commit()
            logger.debug(f"Logged event: {event_type}")
    except Exception as e:
        logger.error(f"Failed to log analytics event: {e}")


async def get_system_stats(
    db: AsyncSession,
    days: int = 30,
) -> Dict[str, Any]:
    """Get system-wide analytics for admin dashboard."""
    # Total events by type (last N days)
    stmt = text("""
        SELECT event_type, COUNT(*) as count
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL :days
        GROUP BY event_type
        ORDER BY count DESC
    """)
    result = await db.execute(stmt, {"days": f"{days} days"})
    event_counts = {row[0]: row[1] for row in result.all()}

    # Daily active users (last N days)
    stmt_dau = text("""
        SELECT DATE(created_at) as day, COUNT(DISTINCT user_id) as dau
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL :days AND user_id IS NOT NULL
        GROUP BY DATE(created_at)
        ORDER BY day DESC
        LIMIT :days
    """)
    result_dau = await db.execute(stmt_dau, {"days": f"{days} days"})
    daily_active = [{"date": str(row[0]), "dau": row[1]} for row in result_dau.all()]

    # Recent daily stats
    stmt_daily = select(SystemDailyStat).order_by(SystemDailyStat.date.desc()).limit(days)
    result_daily = await db.execute(stmt_daily)
    daily_stats = result_daily.scalars().all()

    return {
        "event_counts": event_counts,
        "daily_active_users": daily_active,
        "daily_stats": [
            {
                "date": s.date,
                "searches": s.total_searches,
                "views": s.total_views,
                "new_places": s.total_new_places,
                "new_users": s.total_new_users,
                "active_users": s.total_active_users,
            }
            for s in daily_stats
        ],
    }


async def get_user_stats(
    db: AsyncSession,
    user_id: str,
    months: int = 6,
) -> List[Dict[str, Any]]:
    """Get monthly stats for a specific user."""
    stmt = (
        select(UserMonthlyStat)
        .where(UserMonthlyStat.user_id == user_id)
        .order_by(UserMonthlyStat.month.desc())
        .limit(months)
    )
    result = await db.execute(stmt)
    stats = result.scalars().all()

    return [
        {
            "month": s.month,
            "searches": s.total_searches,
            "views": s.total_views,
            "shares": s.total_shares,
            "bookmarks": s.total_bookmarks,
            "top_vibe": s.top_vibe,
            "top_category": s.top_category,
        }
        for s in stats
    ]
