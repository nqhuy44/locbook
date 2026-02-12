import logging
from arq import run_worker
from telegram import Bot

from src.core.redis import get_redis_settings
from src.core.config import get_settings
from src.core.logger import setup_logging
from src.modules.worker.tasks import process_google_maps_link

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

async def startup(ctx):
    """
    Initialize resources for the worker.
    We need to provide the 'bot' instance to the context so tasks can reply.
    """
    settings = get_settings()
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set. Worker cannot send Telegram messages.")
        ctx["bot"] = None
    else:
        logger.info("Initializing Telegram Bot for Worker...")
        # Check if we need Application for some reason, usually Bot is enough for sending messages.
        # However, handlers might use context.bot which is often from Application.
        # But here we are just sending messages.
        bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        ctx["bot"] = bot
    
    logger.info("Worker started.")

async def shutdown(ctx):
    logger.info("Worker shutting down.")

class WorkerSettings:
    functions = [process_google_maps_link]
    redis_settings = get_redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 120       # Max 2 min per job
    max_tries = 1           # Don't retry failed jobs

if __name__ == "__main__":
    logger.info("Starting ARQ Worker...")
    run_worker(WorkerSettings)
