
import asyncio
import logging
from src.config import get_settings
from src.main import init_db
from src.database.models import Place
import datetime

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def reset_images():
    settings = get_settings()
    logger.info("Initializing DB...")
    await init_db(settings)
    
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    path_partial = f"screenshots/{today_str}"
    
    logger.info(f"Resetting images containing: {path_partial}")
    
    # Beanie RegEx query
    # places = await Place.find({"local_image_path": {"$regex": path_partial}}).to_list()
    places = await Place.find(Place.local_image_path != None).to_list()
    
    count = 0
    for p in places:
        if p.local_image_path and path_partial in p.local_image_path:
            p.local_image_path = None
            await p.save()
            count += 1
            
    logger.info(f"Reset {count} places.")

if __name__ == "__main__":
    asyncio.run(reset_images())
