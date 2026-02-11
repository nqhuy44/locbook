"""ARQ Worker entrypoint.

Run with: arq src.services.worker.WorkerSettings
"""
import logging
from telegram import Bot
from arq.cron import cron

from src.core.redis import get_redis_settings
from src.core.config import get_settings
from src.modules.worker.tasks import process_google_maps_link
from src.modules.analytics.tasks import analytics_rollup, analytics_purge

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def startup(ctx: dict):
    """Initialize resources when worker starts."""
    settings = get_settings()
    ctx["bot"] = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    logger.info("Worker started — Telegram Bot initialized.")


async def shutdown(ctx: dict):
    """Cleanup when worker stops."""
    bot = ctx.get("bot")
    if bot:
        await bot.close()
    logger.info("Worker shutdown complete.")


class WorkerSettings:
    """ARQ worker configuration."""
    redis_settings = get_redis_settings()
    functions = [process_google_maps_link]
    cron_jobs = [
        cron(analytics_rollup, hour=3, minute=0),   # 3:00 AM daily
        cron(analytics_purge, hour=4, minute=0),     # 4:00 AM daily
    ]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 120  # 2 minutes per job
    keep_result = 3600  # Keep results for 1 hour

