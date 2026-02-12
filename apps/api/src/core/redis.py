"""Redis connection helper for ARQ task queue."""
import logging
from arq.connections import RedisSettings, ArqRedis, create_pool
from src.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: ArqRedis | None = None


def get_redis_settings() -> RedisSettings:
    """Parse REDIS_URL into ARQ RedisSettings."""
    settings = get_settings()
    return RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT, database=0)


async def get_arq_pool() -> ArqRedis:
    """Get or create ARQ redis connection pool."""
    global _pool
    if _pool is None:
        _pool = await create_pool(get_redis_settings())
    return _pool


async def enqueue_task(task_name: str, *args, _expires: int = 60, **kwargs):
    """Enqueue a task to the ARQ worker.
    
    Args:
        _expires: Seconds before the job expires if not picked up (default: 60s).
    """
    pool = await get_arq_pool()
    job = await pool.enqueue_job(task_name, *args, _expires=_expires, **kwargs)
    logger.info(f"Enqueued task: {task_name} (job_id={job.job_id}, expires={_expires}s)")
    return job
