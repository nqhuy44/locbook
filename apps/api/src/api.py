import logging
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Header, Depends, Security, File, UploadFile, BackgroundTasks
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from telegram.ext import ApplicationBuilder, Application

from src.config import get_settings
from src.bot.handlers import get_handlers
from src.database.models import Place, PlaceSummary, PlaceUpdate, AppConfig
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

    # 2. Auto-Index Vector DB (Async Background Task)
    # 2. Auto-Index Vector DB (Async Background Task) - DISABLED
    # if settings.FEAT_AI_MATCHMAKE:
    #     import asyncio
    #     from src.scripts.reindex_vectors import reindex
    #     # Run in background to not block startup
    #     asyncio.create_task(reindex())
    
    # 3. Init Bot
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
import shutil
import uuid

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

@app.get("/api/versions")
async def get_versions():
    settings = get_settings()
    
    # Helper to read package.json version
    return {
        "backend": settings.APP_VERSION,
    }

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
        "data": [p.model_dump(mode='json', by_alias=True) for p in places],
        "total": total,
        "limit": limit,
        "offset": offset
    }

# Auth
API_KEY_HEADER = APIKeyHeader(name="x-admin-token", auto_error=False)

async def verify_admin(token: str = Security(API_KEY_HEADER)):
    settings = get_settings()
    # If no secret set, fail secure or allow dev? Fail secure.
    secret = settings.ADMIN_SECRET
    if not secret:
        # If env var not set, log warning and deny
        logger.warning("ADMIN_SECRET not set in env. Denying admin access.")
        raise HTTPException(status_code=403, detail="Admin access not configured")
    
    if not token or token != secret:
        raise HTTPException(status_code=403, detail="Invalid Admin Token")
    return True

@app.get("/api/places/{place_id}")
async def get_place_detail(place_id: str):
    place = await Place.get(place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place

@app.put("/api/places/{place_id}", dependencies=[Depends(verify_admin)])
async def update_place(place_id: str, place_update: PlaceUpdate):
    place = await Place.get(place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    
    update_data = place_update.model_dump(exclude_unset=True)
    await place.set(update_data)
    
    # Sync to Vector DB
    try:
        from src.core.vector_store import vector_store
        # We need to construct the text representation again.
        # This is duplication of logic in reindex_vectors.py.
        # Ideally, we should have a helper function "place_to_vector_doc(place)".
        # For now, let's just do a quick re-fetch and add.
        
        # We need the full object with new values
        updated_place = await Place.get(place_id)
        if updated_place:
             # Logic from reindex_vectors.py (simplified)
             p = updated_place
             vibes_str = ", ".join(p.vibes) if p.vibes else ""
             cats_str = ", ".join(p.categories) if p.categories else ""
             mood_str = ", ".join(p.mood) if p.mood else ""
             meal_str = ", ".join(p.meal_types) if p.meal_types else ""
             occasion_str = ", ".join(p.occasions) if p.occasions else ""
             price = p.price_level if p.price_level else "Unknown"
             status = p.status if p.status else "Unknown"
             hours = p.opening_hours if p.opening_hours else ""
             
             text = (
                f"Name: {p.name}. "
                f"Categories: {cats_str}. "
                f"Vibes: {vibes_str}. "
                f"Mood: {mood_str}. "
                f"Meal Types: {meal_str}. "
                f"Occasions: {occasion_str}. "
                f"Price: {price}. "
                f"Address: {p.address}. "
                f"Status: {status}. "
                f"Hours: {hours}"
             )
             
             metadata = {
                "name": p.name,
                "address": p.address or "",
                "vibes": vibes_str,
                "categories_list": ",".join(p.categories),
                "rating": float(p.rating) if p.rating else 0.0,
                "place_id": str(p.id),
                "city": "Hồ Chí Minh",
                "district": p.address.split(",")[1].strip() if p.address and len(p.address.split(",")) > 1 else "Unknown"
             }
             
             vector_store.add_place({
                "id": str(p.id),
                "text": text,
                "metadata": metadata
             })
    except Exception as e:
        logger.error(f"Failed to sync update to Vector DB: {e}")

    return place

@app.delete("/api/places/{place_id}", dependencies=[Depends(verify_admin)])
async def delete_place(place_id: str):
    place = await Place.get(place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    await place.delete()
    
    # Sync to Vector DB
    try:
        from src.core.vector_store import vector_store
        vector_store.delete_place(place_id)
    except Exception as e:
        logger.error(f"Failed to sync delete to Vector DB: {e}")
        
    return {"status": "deleted"}

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

# Default Config
DEFAULT_APP_CONFIG = {
  "FEATURES": {
    "ENABLE_BUY_ME_COFFEE": True,
    "ENABLE_FOOTER": True,
    "ENABLE_AUTHOR_CREDITS": True,
    "ENABLE_DISCOVER": True,
    "ENABLE_MAP": False,
    "FEAT_AI_MATCHMAKE": get_settings().FEAT_AI_MATCHMAKE,
  },
  "HOME_CATEGORIES": ["Casual", "Cafe & Coffee", "Special Occasion", "Bar"],
  "LINKS": {
    "BUY_ME_COFFEE": "https://buymeacoffee.com/nqhuy",
    "GITHUB": "https://locbook.firstdraft.sh",
    "AUTHOR_WEBSITE": "https://locbook.firstdraft.sh",
    "LOC_REQUEST": "https://forms.gle/2w4efcfECzXwpnvo7",
    "FEEDBACK": "https://forms.gle/2ntCQmgKNrEbN3DX9",
    "DASHBOARD_URL": "http://localhost:5173",
  },
  "CATEGORY_KEYWORDS": {
    "Nhậu": ["nhậu", "beer"],
    "Special Occasion": [
      "romantic", "fine dining", "fancy", "wine", "anniversary", "celebration", "special occasion"
    ],
    "Bar": ["bar", "cocktail", "lounge", "speakeasy", "wine"],
    "Cafe & Coffee": ["cafe", "coffee", "tea"],
    "Casual": ["casual", "street", "local", "snack", "quick"],
  },
  "MARIN": {
    "AVATAR_NAME": "Marin 🎀",
    "AVATAR_IMAGE": "",
    "SYSTEM_INSTRUCTION": "You are Marin, an AI local guide for Ho Chi Minh City. You are helpful, friendly, and knowledgeable about Saigon's nightlife and cafes.",
    "CATEGORY_SYNONYMS": {
        "bar": ["pub", "lounge", "club", "speakeasy", "nightlife", "cocktail"],
        "pub": ["bar", "gastropub", "izakaya", "beer", "brewery", "nightlife"],
        "cafe": ["coffee", "tea", "bakery", "dessert", "bistro", "brunch"],
        "restaurant": ["dining", "eatery", "bistro", "food", "dinner", "lunch"],
        "casual": ["bình dân", "street food", "vỉa hè", "local"]
    },
    "PROMPT_CATEGORY_MAPPING": {
        "nhậu": "Pub",
        "ăn tối": "Restaurant",
        "tâm sự": "Bar",
        "quẩy": "Bar",
        "bình dân": "Casual",
        "cafe": "Cafe"
    }
  }
}

@app.get("/api/config")
async def get_config():
    config = await AppConfig.find_one(AppConfig.key == "global")
    if not config:
        return DEFAULT_APP_CONFIG
    
    # Merge DB config over Default config to ensure new keys (like DASHBOARD_URL) exist
    # deeply merging is better but shallow merge of top keys might suffice if structure is flat-ish
    # Here we do a careful merge manually or just simple dict merge if adequate.
    # We want keys in DEFAULT that are NOT in config.data to be present.
    merged = DEFAULT_APP_CONFIG.copy()
    
    # Deep merge helper or simple specific merge
    # For now, let's just ensure LINKS exists and has DASHBOARD_URL
    db_data = config.data
    
    # Simple recursive merge for LINKS, FEATURES, and MARIN
    for key in ["LINKS", "FEATURES", "MARIN"]:
        if key in db_data and isinstance(db_data[key], dict):
             # Ensure sub-keys from default exist in db_data result
             for sub_key, sub_val in merged[key].items():
                 if sub_key not in db_data[key]:
                     db_data[key][sub_key] = sub_val
    
    # Update top level
    for key, val in db_data.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(val, dict):
             merged[key].update(val)
        else:
             merged[key] = val
             
    return merged

@app.put("/api/config", dependencies=[Depends(verify_admin)])
async def update_config(payload: Dict[str, Any]):
    config = await AppConfig.find_one(AppConfig.key == "global")
    if not config:
        config = AppConfig(key="global", data=payload)
        await config.insert()
    else:
        config.data = payload
        await config.save()
    return config.data

# Chat API
from pydantic import BaseModel
class ChatMessage(BaseModel):
    session_id: str | None = None
    message: str

@app.post("/api/chat/message")
async def chat_message(payload: ChatMessage):
    if not DEFAULT_APP_CONFIG["FEATURES"]["FEAT_AI_MATCHMAKE"]:
        return {"error": "Feature disabled"}
    
    from src.core.chat_service import chat_service
    response = await chat_service.handle_message(payload.session_id, payload.message)
    return response


@app.post("/api/upload/avatar")
async def upload_avatar(file: UploadFile = File(...), token: str = Depends(verify_admin)):
    """
    Upload an avatar image.
    Returns: { "url": "/images/filename.ext" }
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create directory if not exists
    os.makedirs("data/images", exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = f"data/images/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/images/{filename}"}


# Reindex Logic
from src.scripts.reindex_vectors import reindex as run_reindex_script

is_reindexing = False

async def reindex_background_task():
    global is_reindexing
    try:
        logger.info("Starting background reindexing task...")
        is_reindexing = True
        await run_reindex_script()
    except Exception as e:
        logger.error(f"Reindexing failed: {e}")
    finally:
        is_reindexing = False
        logger.info("Background reindexing task finished.")

@app.post("/api/admin/reindex")
async def trigger_reindex(background_tasks: BackgroundTasks, token: str = Depends(verify_admin)):
    global is_reindexing
    if is_reindexing:
        raise HTTPException(status_code=409, detail="Reindexing already in progress")
    
    background_tasks.add_task(reindex_background_task)
    return {"status": "started", "message": "Reindexing started in background. Check logs for progress."}

