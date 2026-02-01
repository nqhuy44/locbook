import logging
import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from src.database.models import Place, UserLog
import uvicorn
import os

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def init_db(settings):
    max_retries = 5
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
            # Verify connection
            await client.admin.command('ping')
            
            await init_beanie(database=client[settings.MONGO_DB_NAME], document_models=[Place, UserLog])
            logger.info("MongoDB Initialized.")
            return
        except Exception as e:
            logger.warning(f"Failed to connect to MongoDB (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"Critical: Could not connect to MongoDB after {max_retries} attempts.")
                raise e

def main():
    """Entry point: Runs Uvicorn."""
    # Run uvicorn programmatically or use command line. 
    # For Docker compat, command line is better, but here we provide a script entry.
    uvicorn.run("src.api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
