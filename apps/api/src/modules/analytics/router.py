"""Analytics API router — admin-only endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database.postgres import get_db_session
from src.modules.auth.dependencies import verify_admin
from src.modules.analytics import service as analytics_service

router = APIRouter(prefix="/api/admin/analytics", tags=["Analytics"])

@router.get("")
async def get_admin_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    is_admin: bool = Depends(verify_admin),
):
    stats = await analytics_service.get_system_stats(db, days=days)
    return stats
