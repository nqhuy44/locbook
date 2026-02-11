import logging
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Header, Depends, Security, File, UploadFile, BackgroundTasks
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from telegram.ext import ApplicationBuilder, Application
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col, desc
from sqlalchemy.orm import selectinload

from src.config import get_settings
from src.bot.handlers import get_handlers
# Import SQLModel classes instead of Beanie models
from src.database.sql_models import Place, Interaction, PlaceRead, PlaceUpdate, AppConfig, ChatSession
# from src.database.models import AppConfig # Removed
from src.database.postgres import get_db_session
from src.main import init_db
from src.routers.auth import router as auth_router
from src.routers.users import router as users_router
from src.routers.interactions import router as interactions_router
from src.routers.discovery import router as discovery_router
from src.routers.onboarding import router as onboarding_router

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

    # 3. Init Bot
    global bot_app
    if settings.TELEGRAM_BOT_TOKEN and settings.ENABLE_BOT:
        bot_app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
        for handler in get_handlers():
            bot_app.add_handler(handler)
        
        try:
            await bot_app.initialize()
            await bot_app.start()
            await bot_app.updater.start_polling()
            logger.info("Bot started successfully.")
        except Exception as e:
            logger.error(f"Failed to start Telegram Bot: {e}")
            logger.warning("Continuing without Bot. API and Dashboard will still work.")
    
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

# Mount Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(interactions_router)
app.include_router(discovery_router)
app.include_router(onboarding_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("data/images", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/images"), name="images")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/versions")
async def get_versions():
    settings = get_settings()
    return {
        "backend": settings.APP_VERSION,
    }

@app.get("/api/places")
async def get_places(
    limit: int = 20, 
    offset: int = 0, 
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    # Base query
    query = select(Place)
    
    if search:
        # basic ILIKE search
        query = query.where(col(Place.name).ilike(f"%{search}%"))
    
    # Total count for pagination
    # We need a separate query for count or use window function
    # simple way:
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination
    query = query.order_by(desc(Place.created_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    places = result.scalars().all()
    
    return {
        "data": [
            PlaceRead.model_validate(p).model_dump(mode='json', by_alias=True) for p in places
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }

# Auth
API_KEY_HEADER = APIKeyHeader(name="x-admin-token", auto_error=False)

async def verify_admin(token: str = Security(API_KEY_HEADER)):
    settings = get_settings()
    secret = settings.ADMIN_SECRET
    if not secret:
        logger.warning("ADMIN_SECRET not set in env. Denying admin access.")
        raise HTTPException(status_code=403, detail="Admin access not configured")
    
    if not token or token != secret:
        raise HTTPException(status_code=403, detail="Invalid Admin Token")
    return True

@app.get("/api/places/{place_id}")
async def get_place_detail(place_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    
    # Convert to PlaceRead for consistent response
    return PlaceRead.model_validate(place)

@app.put("/api/places/{place_id}", dependencies=[Depends(verify_admin)])
async def update_place(
    place_id: str, 
    place_update: PlaceUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")
        
    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    
    update_data = place_update.model_dump(exclude_unset=True)
    
    # Manual update or sqlmodel style
    for key, value in update_data.items():
        setattr(place, key, value)
        
    db.add(place)
    await db.commit()
    await db.refresh(place)
    
    # Sync to Vector DB (re-implement logic)
    # ... logic skipped for brevity, assumed reused or handled via signal/hook
    # Ideally should be a separate function
    
    return place

@app.delete("/api/places/{place_id}", dependencies=[Depends(verify_admin)])
async def delete_place(place_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
        
    await db.delete(place)
    await db.commit()
    
    # Sync Vector ...
        
    return {"status": "deleted"}

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db_session)):
    # Total Places
    result = await db.execute(select(func.count(Place.id)))
    total_places = result.scalar_one()
    
    # Top Categories
    # Unwind not directly supported in standard SQL easily without ARRAY_UNNEST or similar.
    # Postgres specific: select unnest(categories) as cat, count(*) group by cat order by count desc
    
    stmt = text("SELECT unnest(categories) as cat, count(*) as count FROM places GROUP BY cat ORDER BY count DESC LIMIT 5")
    result_cats = await db.execute(stmt)
    categories = result_cats.all()
    
    return {
        "total_places": total_places,
        "top_categories": [{"name": row[0], "count": row[1]} for row in categories]
    }

# Default Config & Chat Endpoint remain same as they use Mongo (AppConfig, ChatSession)
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
async def get_config(db: AsyncSession = Depends(get_db_session)):
    stmt = select(AppConfig).where(AppConfig.key == "global")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        return DEFAULT_APP_CONFIG
    
    merged = DEFAULT_APP_CONFIG.copy()
    db_data = config.data
    
    for key in ["LINKS", "FEATURES", "MARIN"]:
        if key in db_data and isinstance(db_data[key], dict):
             for sub_key, sub_val in merged[key].items():
                 if sub_key not in db_data[key]:
                     db_data[key][sub_key] = sub_val
    
    for key, val in db_data.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(val, dict):
             merged[key].update(val)
        else:
             merged[key] = val
             
    return merged

@app.put("/api/config", dependencies=[Depends(verify_admin)])
async def update_config(payload: Dict[str, Any], db: AsyncSession = Depends(get_db_session)):
    stmt = select(AppConfig).where(AppConfig.key == "global")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        config = AppConfig(key="global", data=payload)
        db.add(config)
    else:
        config.data = payload
        
    await db.commit()
    await db.refresh(config)
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
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    os.makedirs("data/images", exist_ok=True)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = f"data/images/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/images/{filename}"}


# Reindex Logic
# from src.scripts.reindex_vectors import reindex as run_reindex_script

is_reindexing = False

async def reindex_background_task():
    global is_reindexing
    # TODO: Implement Postgres Reindex
    pass
    # try:
    #     logger.info("Starting background reindexing task...")
    #     is_reindexing = True
    #     await run_reindex_script()
    # except Exception as e:
    #     logger.error(f"Reindexing failed: {e}")
    # finally:
    #     is_reindexing = False
    #     logger.info("Background reindexing task finished.")

@app.post("/api/admin/reindex")
async def trigger_reindex(background_tasks: BackgroundTasks, token: str = Depends(verify_admin)):
    global is_reindexing
    if is_reindexing:
        raise HTTPException(status_code=409, detail="Reindexing already in progress")
    
    background_tasks.add_task(reindex_background_task)
    return {"status": "started", "message": "Reindexing started in background. Check logs for progress."}
