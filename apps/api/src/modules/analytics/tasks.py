"""Analytics worker tasks — nightly roll-up and auto-purge."""
import logging
from datetime import datetime, timezone, timedelta

from sqlmodel import select, func
from sqlalchemy import text, delete

from src.core.database.sql_models import (
    AnalyticsEvent, UserMonthlyStat, SystemDailyStat, Place, User
)
from src.core.database.postgres import get_db_session

logger = logging.getLogger(__name__)


async def analytics_rollup(ctx: dict):
    """
    Nightly task: aggregate analytics_events into monthly/daily stats.
    Run via ARQ cron schedule.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logger.info(f"Running analytics rollup for {yesterday}...")

    async for db in get_db_session():
        # --- System Daily Stats ---
        stmt = text("""
            SELECT 
                COUNT(*) FILTER (WHERE event_type = 'SEARCH') as total_searches,
                COUNT(*) FILTER (WHERE event_type = 'VIEW_DETAIL') as total_views,
                COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as active_users
            FROM analytics_events
            WHERE DATE(created_at) = :date
        """)
        result = await db.execute(stmt, {"date": yesterday})
        row = result.one_or_none()

        if row:
            # New places/users for the day
            new_places_stmt = text(
                "SELECT COUNT(*) FROM places WHERE DATE(created_at) = :date"
            )
            new_places = (await db.execute(new_places_stmt, {"date": yesterday})).scalar_one()

            new_users_stmt = text(
                "SELECT COUNT(*) FROM users WHERE DATE(created_at) = :date"
            )
            new_users = (await db.execute(new_users_stmt, {"date": yesterday})).scalar_one()

            daily_stat = SystemDailyStat(
                date=yesterday,
                total_searches=row[0] or 0,
                total_views=row[1] or 0,
                total_active_users=row[2] or 0,
                total_new_places=new_places,
                total_new_users=new_users,
            )

            # Upsert
            existing = await db.get(SystemDailyStat, yesterday)
            if existing:
                existing.total_searches = daily_stat.total_searches
                existing.total_views = daily_stat.total_views
                existing.total_active_users = daily_stat.total_active_users
                existing.total_new_places = daily_stat.total_new_places
                existing.total_new_users = daily_stat.total_new_users
            else:
                db.add(daily_stat)

        # --- User Monthly Stats ---
        user_stats_stmt = text("""
            SELECT 
                user_id,
                COUNT(*) FILTER (WHERE event_type = 'SEARCH') as searches,
                COUNT(*) FILTER (WHERE event_type = 'VIEW_DETAIL') as views,
                COUNT(*) FILTER (WHERE event_type = 'BOOKMARK') as bookmarks
            FROM analytics_events
            WHERE user_id IS NOT NULL 
              AND TO_CHAR(created_at, 'YYYY-MM') = :month
            GROUP BY user_id
        """)
        user_results = await db.execute(user_stats_stmt, {"month": month})

        for u_row in user_results.all():
            user_id, searches, views, bookmarks = u_row

            existing_stat = (
                await db.execute(
                    select(UserMonthlyStat).where(
                        UserMonthlyStat.user_id == user_id,
                        UserMonthlyStat.month == month,
                    )
                )
            ).scalar_one_or_none()

            if existing_stat:
                existing_stat.total_searches = searches
                existing_stat.total_views = views
                existing_stat.total_bookmarks = bookmarks
            else:
                db.add(
                    UserMonthlyStat(
                        user_id=user_id,
                        month=month,
                        total_searches=searches,
                        total_views=views,
                        total_bookmarks=bookmarks,
                    )
                )

        await db.commit()
        logger.info(f"Rollup complete for {yesterday}")


async def analytics_purge(ctx: dict, retention_days: int = 30):
    """
    Nightly task: delete analytics_events older than retention_days.
    Keeps the system lean — stats are already rolled up.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    logger.info(f"Purging analytics events older than {cutoff.isoformat()}...")

    async for db in get_db_session():
        stmt = delete(AnalyticsEvent).where(AnalyticsEvent.created_at < cutoff)
        result = await db.execute(stmt)
        await db.commit()
        logger.info(f"Purged {result.rowcount} old analytics events")
