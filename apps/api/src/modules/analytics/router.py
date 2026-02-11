"""Analytics API router — admin-only endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database.postgres import get_db_session
from src.modules.analytics import service as analytics_service

router = APIRouter(prefix="/api/admin/analytics", tags=["Analytics"])


@router.get("")
async def get_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
):
    """Get system-wide analytics dashboard data."""
    return await analytics_service.get_system_stats(db, days=days)
