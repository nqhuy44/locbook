import logging
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Header, Depends, Security, File, UploadFile, BackgroundTasks
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col, desc
from sqlalchemy.orm import selectinload

from src.core.config import get_settings
from src.core.database.sql_models import Place, Interaction, PlaceRead, PlaceUpdate, AppConfig, ChatSession, User
from src.core.database.postgres import get_db_session
from src.services.main import init_db
from src.modules.auth.router import router as auth_router
from src.modules.auth.users_router import router as users_router
from src.modules.auth.dependencies import get_current_user
from src.modules.places.interactions_router import router as interactions_router
from src.modules.places.discovery_router import router as discovery_router
from src.modules.auth.onboarding_router import router as onboarding_router
from src.modules.analytics.router import router as analytics_router
from src.modules.notification.router import router as notifications_router
from src.modules.places.menu_router import router as menu_router
from src.modules.lists.router import router as lists_router
from src.modules.places.memo_router import router as memo_router

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """API lifecycle — DB init only. Bot runs as separate service."""
    logger.info("Starting up API...")
    settings = get_settings()
    await init_db(settings)
    
    yield
    
    logger.info("API shutting down.")

from fastapi.staticfiles import StaticFiles
import os
import shutil
import uuid
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from starlette.requests import Request
from src.core.rate_limiter import limiter

app = FastAPI(title="Spotary API", lifespan=lifespan)

async def rate_limit_custom_handler(request: Request, exc: RateLimitExceeded):
    if request.url.path == "/api/chat/message":
        # Return a structured soft-error for the frontend to localize
        return JSONResponse(
            status_code=200,
            content={
                "is_rate_limited": True,
                "reply": None,
                "session_id": None,
                "suggested_places": []
            }
        )
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"}
    )

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, rate_limit_custom_handler)

# Mount Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(interactions_router)
app.include_router(discovery_router)
app.include_router(onboarding_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(menu_router)
app.include_router(lists_router)
app.include_router(memo_router)

from src.modules.auth.admin_router import router as admin_router
app.include_router(admin_router)

# CORS
origins = get_settings().CORS_ORIGINS
print(f"DEBUG: Loaded CORS Origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("data/images", exist_ok=True)
os.makedirs("data/uploads", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/images"), name="images")
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")


# Analytics Middleware — auto-log API requests
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from src.core.security import verify_token
from src.modules.analytics.service import log_event
import asyncio

class AnalyticsMiddleware(BaseHTTPMiddleware):
    """Auto-log VIEW_DETAIL and SEARCH events."""
    TRACKED_PATTERNS = {
        "/api/places/": "VIEW_DETAIL",
        "/api/discovery/places/": "VIEW_DETAIL",
        "/api/discovery/places": "SEARCH",
        "/api/chat/message": "SEARCH",
    }

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Only log successful GET/POST requests
        if response.status_code < 400:
            path = request.url.path
            for pattern, event_type in self.TRACKED_PATTERNS.items():
                if path.startswith(pattern):
                    # Try to get user_id from token for logged-in users
                    user_id = None
                    auth_header = request.headers.get("Authorization")
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header.split(" ")[1]
                        payload = verify_token(token)
                        if payload:
                            user_id = payload.get("sub")

                    # Fire-and-forget: don't block the response
                    asyncio.create_task(
                        log_event(
                            event_type=event_type,
                            user_id=user_id,
                            payload={"path": path, "method": request.method},
                        )
                    )
                    break
        
        return response


app.add_middleware(AnalyticsMiddleware)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

import httpx

@app.get("/api/versions")
async def get_versions(db: AsyncSession = Depends(get_db_session)):
    settings = get_settings()
    versions = {"backend": settings.APP_VERSION, "dashboard": "unknown"}
    
    try:
        # Get Dashboard URL
        stmt = select(AppConfig).where(AppConfig.key == "global")
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()
        
        dashboard_url = DEFAULT_APP_CONFIG["LINKS"]["DASHBOARD_URL"]
        if config and config.data and "LINKS" in config.data:
            dashboard_url = config.data["LINKS"].get("DASHBOARD_URL", dashboard_url)
            
        # Proxy fetch
        if dashboard_url:
            async with httpx.AsyncClient(timeout=3.0) as client:
                url = f"{dashboard_url.rstrip('/')}/version.json"
                resp = await client.get(url)
                if resp.status_code == 200:
                    versions["dashboard"] = resp.json().get("version", "unknown")
    except Exception as e:
        logger.warning(f"Failed to fetch dashboard version: {e}")

    return versions

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
# verify_admin is now in src.modules.auth.dependencies
from src.modules.auth.dependencies import verify_admin

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
    
    # Data quality hooks: sync location + regenerate embedding
    from src.modules.places.quality import on_place_save
    place = await on_place_save(db, place)
        
    db.add(place)
    await db.commit()
    await db.refresh(place)
    
    return PlaceRead.model_validate(place)

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

# Default Config & Chat Endpoint
DEFAULT_APP_CONFIG = {
  "FEATURES": {
    "ENABLE_BUY_ME_COFFEE": True,
    "ENABLE_MAP": False,
    "ASK_MARIN": True, # Previously FEAT_AI_MATCHMAKE
  },
  "HOME_CATEGORIES": ["Casual", "Cafe & Coffee", "Special Occasion", "Bar"],
  "LINKS": {
    "BUY_ME_COFFEE": "https://buymeacoffee.com/nqhuy",
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
    "Bakery": ["bakery", "pastry", "cake", "dessert"],
  },
  "MARIN": {
    "AVATAR_NAME": "Marin 🎀",
    "AVATAR_IMAGE": "",
    "SYSTEM_INSTRUCTION": "You are Marin, an AI local guide for Ho Chi Minh City. You are helpful, friendly, and knowledgeable about Saigon's nightlife and cafes.",
    "CATEGORY_MAPPINGS": [
        {
            "vietnamese": "Quán Nhậu / Bia",
            "english": "nhậu",
            "keywords": ["nhậu", "beer", "bia", "quán nhậu", "mồi"]
        },
        {
            "vietnamese": "Club / Bar xập xình",
            "english": "club",
            "keywords": ["quẩy", "club", "nightclub", "lên đồ", "dj"]
        },
        {
            "vietnamese": "Bar Tâm Sự",
            "english": "bar",
            "keywords": ["tâm sự", "lounge", "speakeasy", "cocktail", "intimate", "quiet"]
        },
        {
            "vietnamese": "Cà Phê / Trà",
            "english": "cafe",
            "keywords": ["cafe", "coffee", "tea", "bistro", "brunch", "trà sữa", "milktea"]
        },
        {
            "vietnamese": "Bánh / Tráng Miệng",
            "english": "bakery",
            "keywords": ["bánh", "bakery", "dessert", "cake", "ngọt", "tráng miệng"]
        },
        {
            "vietnamese": "Nhà Hàng",
            "english": "restaurant",
            "keywords": ["dining", "eatery", "food", "dinner", "lunch", "cuisine", "nhà hàng", "ăn tối"]
        },
        {
            "vietnamese": "Quán Trảo / Đồ Nướng",
            "english": "restaurant",
            "keywords": ["nướng", "bbq", "grill", "lẩu"]
        },
        {
            "vietnamese": "Bình Dân / Vỉa Hè",
            "english": "casual",
            "keywords": ["bình dân", "street food", "vỉa hè", "local", "ăn vặt", "ăn xế", "snack"]
        },
        {
            "vietnamese": "Đặc Sản",
            "english": "restaurant",
            "keywords": ["đặc sản", "specialty", "local cuisine", "địa phương"]
        }
    ]
  }
}

@app.get("/api/config")
async def get_config(db: AsyncSession = Depends(get_db_session)):
    stmt = select(AppConfig).where(AppConfig.key == "global")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        return DEFAULT_APP_CONFIG
    
    # Merge Logic:
    # 1. FEATURES & LINKS: Strict Schema (Only allow keys present in DEFAULT_APP_CONFIG)
    #    This ensures obsolete keys (like old links) are removed even if they exist in DB.
    # 2. CATEGORY_KEYWORDS: DB Override (Use DB value if exists, else Default)
    # 3. MARIN: Recursive Merge (Update nested keys)
    
    # Start with a deep copy of default to ensure structure
    merged = DEFAULT_APP_CONFIG.copy()
    db_data = config.data
    
    if "FEATURES" in db_data and isinstance(db_data["FEATURES"], dict):
        for k, v in merged["FEATURES"].items():
            if k in db_data["FEATURES"]:
                merged["FEATURES"][k] = db_data["FEATURES"][k]

    if "LINKS" in db_data and isinstance(db_data["LINKS"], dict):
        for k, v in merged["LINKS"].items():
            if k in db_data["LINKS"]:
                merged["LINKS"][k] = db_data["LINKS"][k]

    if "CATEGORY_KEYWORDS" in db_data:
        merged["CATEGORY_KEYWORDS"] = db_data["CATEGORY_KEYWORDS"]

    if "HOME_CATEGORIES" in db_data:
        merged["HOME_CATEGORIES"] = db_data["HOME_CATEGORIES"]

    if "MARIN" in db_data and isinstance(db_data["MARIN"], dict):
         for k, v in db_data["MARIN"].items():
             if k in merged["MARIN"] and isinstance(merged["MARIN"][k], dict) and isinstance(v, dict):
                 merged["MARIN"][k].update(v)
             else:
                 merged["MARIN"][k] = v
                 
    # Copy any other top-level keys that might be dynamic, if we want to allow extensibility
    # or strictly stick to the sections we know. 
    # For now, let's allow other top-level keys from DB to pass through if they are new features not in default yet?
    # No, strict cleanup requested. Stick to the above.
             
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
    location: Optional[Dict[str, float]] = None # {lat: float, lon: float}

@app.get("/api/chat/latest")
async def get_latest_chat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Return the most recent chat session for the logged-in user."""
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        return {"session_id": None, "messages": []}
    
    return {
        "session_id": session.session_id,
        "messages": session.messages or [],
    }

from fastapi import Request

@app.post("/api/chat/message")
@limiter.limit("10/minute")
async def chat_message(request: Request, payload: ChatMessage, current_user: User = Depends(get_current_user)):
    if not DEFAULT_APP_CONFIG["FEATURES"]["ASK_MARIN"]:
         return {"error": "Feature disabled"}
    
    from src.modules.places.chat_service import chat_service
    
    user_location = payload.location
    response = await chat_service.handle_message(
        payload.session_id, 
        payload.message, 
        user_id=current_user.id,
        user_location=user_location
    )
    return response


@app.post("/api/upload/avatar")
async def upload_avatar(file: UploadFile = File(...), token: str = Depends(verify_admin)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    from src.core.storage import get_storage
    storage = get_storage()
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
    
    public_url = await storage.save_upload_file(file, filename, folder="images")
        
    return {"url": public_url}


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
