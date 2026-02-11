
# Legacy ChromaDB re-indexing script.
# TODO: Rewrite for PostgreSQL + pgvector if needed.
# Currently, embeddings are generated on insert/update in the app.

import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reindex")

async def reindex():
    logger.info("Re-indexing is now handled by the application or migration scripts.")

if __name__ == "__main__":
    asyncio.run(reindex())
