import logging
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from telegram.ext import ApplicationBuilder, Application

from src.config import get_settings
from src.bot.handlers import get_handlers
from src.database.models import Place, PlaceSummary
from src.main import init_db

logger = logging.getLogger(__name__)

# Global Telegram App
bot_app: Optional[Application] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up API & Bot...")
    settings = get_settings()
    
    # 1. Init DB
    await init_db(settings)
    
    # 2. Init Bot
    global bot_app
    if settings.TELEGRAM_BOT_TOKEN and settings.ENABLE_BOT:
        bot_app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
        for handler in get_handlers():
            bot_app.add_handler(handler)
        
        # Start Bot (Polling Mode)
        # Note: Running polling inside FastAPI lifespan is tricky because run_polling is blocking.
        # We need to use initialize(), start(), and updater.start_polling() manually for async.
        try:
            await bot_app.initialize()
            await bot_app.start()
            await bot_app.updater.start_polling()
            logger.info("Bot started successfully.")
        except Exception as e:
            logger.error(f"Failed to start Telegram Bot: {e}")
            logger.warning("Continuing without Bot. API and Dashboard will still work.")
    else:
        if not settings.ENABLE_BOT:
            logger.info("Bot disabled via config (ENABLE_BOT=False). Only API is running.")
        else:
            logger.warning("No TELEGRAM_BOT_TOKEN found. Bot will not start.")

    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if bot_app:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()

from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="LocBook API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow dashboard dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (Images)
# Ensure directory exists first
os.makedirs("data/images", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/images"), name="images")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/places")
async def get_places(
    limit: int = 20, 
    offset: int = 0, 
    search: Optional[str] = None
):
    query = Place.find_all()
    if search:
        # Simple text search if search provided
        query = Place.find({"$text": {"$search": search}})
    
    # Optimize: Exclude raw_ai_response using Pydantic Projection
    # This returns instances of PlaceSummary, which are lighter.
    places = await query.sort("-created_at") \
        .skip(offset) \
        .limit(limit) \
        .project(PlaceSummary) \
        .to_list()
        
    total = await query.count()
    
    return {
        "data": places,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/places/{place_id}")
async def get_place_detail(place_id: str):
    place = await Place.get(place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place

@app.get("/api/stats")
async def get_stats():
    total_places = await Place.count()
    
    # Aggregation for top categories
    pipeline = [
        {"$unwind": "$categories"},
        {"$group": {"_id": "$categories", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    # Direct Motor usage to avoid Beanie version issues
    collection = Place.get_pymongo_collection()
    categories = await collection.aggregate(pipeline).to_list(length=5)
    
    return {
        "total_places": total_places,
        "top_categories": [{"name": c["_id"], "count": c["count"]} for c in categories]
    }
