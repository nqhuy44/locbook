import logging
import os
import asyncio
from telegram.ext import ApplicationBuilder
from src.config import get_settings
from src.bot.handlers import get_handlers
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from src.database.models import Place, UserLog

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

async def post_init(application):
    settings = get_settings()
    try:
        await init_db(settings)
    except Exception as e:
        logger.critical(f"Database initialization failed: {e}")
        # Stop the application if DB fails
        import sys
        sys.exit(1)

def main():
    settings = get_settings()
    
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("No TELEGRAM_BOT_TOKEN found. Please check your .env file.")
        return
    
    logger.info("Starting LocBook Bot (Marin)...")
    
    application = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).post_init(post_init).build()
    
    # Add handlers
    for handler in get_handlers():
        application.add_handler(handler)
        
    logger.info("Polling started...")
    application.run_polling()

if __name__ == "__main__":
    main()
