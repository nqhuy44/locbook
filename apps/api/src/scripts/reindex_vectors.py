
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from src.config import get_settings
from src.database.models import Place, UserLog, AppConfig, ChatSession
from src.core.vector_store import vector_store

# Setup simple logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reindex")

async def init_db():
    settings = get_settings()
    # logger.info(f"Connecting to MongoDB: {settings.MONGO_URI} ...")
    client = AsyncIOMotorClient(settings.MONGO_URI)
    await init_beanie(database=client[settings.MONGO_DB_NAME], document_models=[Place, UserLog, AppConfig, ChatSession])
    # logger.info("DB Initialized.")

import re

def extract_district(address: str) -> str:
    if not address: return "Unknown"
    # Normalize
    addr_lower = address.lower()
    
    # Regex for "Quận 1", "District 1", "Q.1", "Q1"
    # Handle Numeric Districts
    match_num = re.search(r'(?:quận|district|q\.?)\s*([0-9]+)', addr_lower)
    if match_num:
        return match_num.group(1) # Returns "1", "3", "10"
        
    # Handle Named Districts (Bình Thạnh, Phú Nhuận, etc.)
    # List of known named districts in HCM to be safe
    named_districts = ["bình thạnh", "phú nhuận", "gò vấp", "tân bình", "tân phú", "thủ đức", "bình tân", "bình chánh", "hóc môn", "củ chi", "nhà bè", "cần giờ"]
    for d in named_districts:
        if d in addr_lower:
            return d
            
    # Fallback to simple comma split strategy if regex fails (heuristic: 3rd from last?)
    # usually: street, ward, district, city, country
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 3:
         # Check parts for "Quận"
         for p in parts:
             p_lower = p.lower()
             if "quận" in p_lower or "district" in p_lower:
                 # Clean it
                 clean = re.sub(r'(quận|district|q\.?)', '', p_lower).strip()
                 return clean
    
    return "Unknown"

async def reindex():
    # Only init DB if not already initialized (checking Place.get_motor_collection() might work, but safe to re-init or assume init if called from app)
    # If run as script, we need init_db. If run from app, DB is already init.
    try:
        await Place.find_one()
    except:
        await init_db()
    
    logger.info("Fetching all places for re-indexing...")
    places = await Place.find_all().to_list()
    logger.info(f"Found {len(places)} places.")
    
    batch = []
    count = 0
    
    for p in places:
        # Construct text representation for embedding
        vibes_str = ", ".join(p.vibes) if p.vibes else ""
        cats_str = ", ".join(p.categories) if p.categories else ""
        mood_str = ", ".join(p.mood) if p.mood else ""
        meal_str = ", ".join(p.meal_types) if p.meal_types else ""
        occasion_str = ", ".join(p.occasions) if p.occasions else ""
        price = p.price_level if p.price_level else "Unknown"
        status = p.status if p.status else "Unknown"
        hours = p.opening_hours if p.opening_hours else ""
        
        # User requested to EXCLUDE marin_comment from search index to avoid pollution.
        # Only use objective attributes.
        
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
        
        # Extract normalized district
        district_val = extract_district(p.address)
        
        metadata = {
            "name": p.name,
            "address": p.address or "",
            "vibes": vibes_str,
            "categories_list": ",".join(p.categories), # Store as string for simple filtering or just retrieval
            "rating": float(p.rating) if p.rating else 0.0,
            "place_id": str(p.id),
            "city": "Hồ Chí Minh", # Hardcode for MVP, or extract?
            "district": district_val
        }
        
        batch.append({
            "id": str(p.id),
            "text": text,
            "metadata": metadata
        })
        
        if len(batch) >= 20:
            logger.info(f"Indexing batch of {len(batch)}...")
            vector_store.add_places(batch)
            count += len(batch)
            batch = []
            
    if batch:
        vector_store.add_places(batch)
        count += len(batch)
        
    logger.info(f"Re-indexing complete. Processed {count} places.")

if __name__ == "__main__":
    import sys
    import os
    # Disable ChromaDB Telemetry to prevent hanging
    os.environ["ANONYMIZED_TELEMETRY"] = "False"
    
    try:
        asyncio.run(reindex())
    except KeyboardInterrupt:
        logger.info("Re-indexing interrupted.")
    finally:
        logger.info("Exiting script...")
        # Force exit to kill any hanging threads (like PostHog)
        sys.exit(0)
