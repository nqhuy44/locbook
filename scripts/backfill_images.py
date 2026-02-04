
import asyncio
import logging
from src.config import get_settings
from src.main import init_db
from src.database.models import Place
from src.core.parser import link_parser
from src.core.image_manager import image_manager

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill():
    settings = get_settings()
    logger.info("Initializing DB...")
    await init_db(settings)
    
    # query = Place.find({"local_image_path": None, "google_maps_url": {"$ne": None}})
    # Beanie query syntax
    places = await Place.find(
        Place.local_image_path == None,
        Place.google_maps_url != None
    ).to_list()
    
    logger.info(f"Found {len(places)} places to backfill.")
    
    for place in places:
        logger.info(f"Processing: {place.name} ({place.google_maps_url})")
        
        try:
            # Fetch Info (includes og:image scaping and API fallback)
            info = await link_parser.fetch_place_info(place.google_maps_url)
            
            if info.get("images"):
                img_bytes, mime_type = info["images"][0]
                
                # Save Image (User ID 0 for System/Backfill)
                rel_path, abs_path = await image_manager.save_screenshot(img_bytes, user_id=0)
                
                place.local_image_path = rel_path
                await place.save()
                logger.info(f"SUCCESS: Saved image to {rel_path}")
            else:
                logger.warning("No images found.")
                
        except Exception as e:
            logger.error(f"FAILED: {e}")
            
    logger.info("Backfill complete.")

if __name__ == "__main__":
    asyncio.run(backfill())
