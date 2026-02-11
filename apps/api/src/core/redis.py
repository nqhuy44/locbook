"""Redis connection helper for ARQ task queue."""
import logging
from arq.connections import RedisSettings, ArqRedis, create_pool
from src.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: ArqRedis | None = None


def get_redis_settings() -> RedisSettings:
    """Parse REDIS_URL into ARQ RedisSettings."""
    settings = get_settings()
    url = settings.REDIS_URL
    # redis://host:port or redis://host:port/db
    url = url.replace("redis://", "")
    parts = url.split("/")
    host_port = parts[0]
    database = int(parts[1]) if len(parts) > 1 else 0

    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host = host_port
        port = 6379

    return RedisSettings(host=host, port=port, database=database)


async def get_arq_pool() -> ArqRedis:
    """Get or create ARQ redis connection pool."""
    global _pool
    if _pool is None:
        _pool = await create_pool(get_redis_settings())
    return _pool


async def enqueue_task(task_name: str, *args, **kwargs):
    """Enqueue a task to the ARQ worker."""
    pool = await get_arq_pool()
    job = await pool.enqueue_job(task_name, *args, **kwargs)
    logger.info(f"Enqueued task: {task_name} (job_id={job.job_id})")
    return job
