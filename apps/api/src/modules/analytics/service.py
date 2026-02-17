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
    """Get system-wide analytics for admin dashboard with advanced metrics."""
    import datetime
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)

    # 1. Total events by type
    stmt = text("""
        SELECT event_type, COUNT(*) as count
        FROM analytics_events
        WHERE created_at >= :cutoff
        GROUP BY event_type
        ORDER BY count DESC
    """)
    result = await db.execute(stmt, {"cutoff": cutoff})
    event_counts = {row[0]: row[1] for row in result.all()}

    # 2. Daily active users (DAU) & Total Active Users
    stmt_dau = text("""
        SELECT DATE(created_at) as day, COUNT(DISTINCT user_id) as dau
        FROM analytics_events
        WHERE created_at >= :cutoff AND user_id IS NOT NULL
        GROUP BY DATE(created_at)
        ORDER BY day DESC
    """)
    result_dau = await db.execute(stmt_dau, {"cutoff": cutoff})
    daily_active = [{"date": str(row[0]), "dau": row[1]} for row in result_dau.all()]

    stmt_total_active = text("""
        SELECT COUNT(DISTINCT user_id) 
        FROM analytics_events 
        WHERE created_at >= :cutoff AND user_id IS NOT NULL
    """)
    res_total_active = await db.execute(stmt_total_active, {"cutoff": cutoff})
    total_active_users = res_total_active.scalar() or 0

    # 3. LLM Usage Stats
    stmt_llm = text("""
        SELECT 
            COUNT(*) as total_requests,
            SUM(prompt_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(total_tokens) as total_tokens,
            AVG(total_tokens) as avg_tokens
        FROM llm_usage_logs
        WHERE created_at >= :cutoff
    """)
    res_llm = await db.execute(stmt_llm, {"cutoff": cutoff})
    llm_row = res_llm.first()
    llm_stats = {
        "total_requests": llm_row[0] or 0,
        "input_tokens": int(llm_row[1] or 0),
        "output_tokens": int(llm_row[2] or 0),
        "total_tokens": int(llm_row[3] or 0),
        "avg_tokens": float(llm_row[4] or 0),
    }

    # 4. LLM usage by type
    stmt_llm_type = text("""
        SELECT request_type, COUNT(*), AVG(total_tokens)
        FROM llm_usage_logs
        WHERE created_at >= :cutoff
        GROUP BY request_type
    """)
    res_llm_type = await db.execute(stmt_llm_type, {"cutoff": cutoff})
    llm_by_type = {row[0]: {"requests": row[1], "avg_tokens": float(row[2] or 0)} for row in res_llm_type.all()}

    # 5. Chat efficiency (Avg messages per user)
    # Filter for Chat SEARCH events
    stmt_chat_stats = text("""
        WITH chat_users AS (
            SELECT user_id, COUNT(*) as msg_count
            FROM analytics_events
            WHERE created_at >= :cutoff 
              AND event_type = 'SEARCH' 
              AND payload->>'path' = '/api/chat/message'
              AND user_id IS NOT NULL
            GROUP BY user_id
        )
        SELECT COUNT(*), AVG(msg_count) FROM chat_users
    """)
    res_chat = await db.execute(stmt_chat_stats, {"cutoff": cutoff})
    chat_row = res_chat.first()
    chat_stats = {
        "active_chat_users": chat_row[0] or 0,
        "avg_messages_per_user": float(chat_row[1] or 0),
    }

    # 6. LLM Daily Trend
    stmt_llm_trend = text("""
        SELECT DATE(created_at) as day, SUM(total_tokens) as tokens, COUNT(*) as requests
        FROM llm_usage_logs
        WHERE created_at >= :cutoff
        GROUP BY DATE(created_at)
        ORDER BY day DESC
    """)
    res_trend = await db.execute(stmt_llm_trend, {"cutoff": cutoff})
    llm_trend = [{"date": str(row[0]), "tokens": row[1] or 0, "requests": row[2] or 0} for row in res_trend.all()]

    # 7. Top 5 Viewed Places
    stmt_top_places = text("""
        SELECT p.name, count(*) as views
        FROM analytics_events a
        JOIN places p ON a.entity_id = CAST(p.id AS VARCHAR)
        WHERE a.created_at >= :cutoff 
          AND a.event_type = 'VIEW_DETAIL' 
          AND a.entity_id IS NOT NULL
        GROUP BY p.name
        ORDER BY views DESC
        LIMIT 5
    """)
    res_top = await db.execute(stmt_top_places, {"cutoff": cutoff})
    top_places = [{"name": row[0], "views": row[1]} for row in res_top.all()]

    # 8. Recent daily stats (rolled up)
    stmt_daily = select(SystemDailyStat).order_by(SystemDailyStat.date.desc()).limit(days)
    result_daily = await db.execute(stmt_daily)
    daily_stats = result_daily.scalars().all()

    return {
        "summary": {
            "total_interactions": sum(event_counts.values()),
            "active_users": total_active_users,
            "event_counts": event_counts,
        },
        "llm": {
            "overall": llm_stats,
            "by_type": llm_by_type,
            "trend": llm_trend,
        },
        "chat": chat_stats,
        "top_places": top_places,
        "daily_active_graph": daily_active,
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
