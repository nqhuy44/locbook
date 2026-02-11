import asyncio
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from geoalchemy2.elements import WKTElement
from google import genai
from google.genai import types

from src.database.sql_models import Place
from src.config import get_settings

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    settings = get_settings()
    
    # 1. Connect to Mongo
    logger.info("Connecting to MongoDB...")
    mongo_client = AsyncIOMotorClient(settings.MONGO_URI)
    mongo_db = mongo_client[settings.MONGO_DB_NAME]
    mongo_collection = mongo_db["places"]
    
    # 2. Connect to Postgres
    logger.info("Connecting to PostgreSQL...")
    engine = create_async_engine(settings.POSTGRES_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    # 3. Setup AI Client
    ai_client = None
    if settings.GEMINI_API_KEY:
        ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
    # 4. Fetch Places
    cursor = mongo_collection.find({})
    places_to_insert = []
    
    logger.info("Fetching places from MongoDB...")
    async for doc in cursor:
        try:
            # Extract basic fields
            name = doc.get("name")
            if not name: continue
            
            address = doc.get("address")
            categories = doc.get("categories", [])
            vibes = doc.get("vibes", [])
            price_level = doc.get("price_level")
            rating = float(doc.get("rating", 0.0))
            images = doc.get("images", [])
            opening_hours = doc.get("opening_hours")
            
            # Location (Lat/Lon) -> PostGIS Point
            location = None
            # Assuming Mongo might have 'lat' 'lng' or similar fields?
            # Looking at Place model in pymongo (implied), it might just be address.
            # If we don't have lat/lon in Mongo, we can't create GEOMETRY easily without geocoding.
            # Let's check api.py or Place model... 
            # Place model in previous `api.py` didn't show fields explicitely, it used Beanie/Pydantic.
            # Let's assume for now we might leave it NULL if not found, or try to geocode later.
            # But wait, if we want "geo search", we need it.
            # For now, let's proceed with migration and leave location NULL if missing.
            
            # Embedding
            embedding = None
            if ai_client:
                # Construct text for embedding
                text_content = (
                    f"Name: {name}. "
                    f"Categories: {', '.join(categories)}. "
                    f"Vibes: {', '.join(vibes)}. "
                    f"Price: {price_level}. "
                    f"Address: {address}. "
                    f"Hours: {opening_hours}"
                )
                try:
                    res = ai_client.models.embed_content(
                        model="models/gemini-embedding-001",
                        contents=text_content,
                        config=types.EmbedContentConfig(
                            task_type="RETRIEVAL_DOCUMENT",
                            title="Place Embedding"
                        )
                    )
                    embedding = res.embeddings[0].values
                except Exception as e:
                    logger.error(f"Failed to generate embedding for {name}: {e}")

            place = Place(
                name=name,
                address=address,
                categories=categories,
                vibes=vibes,
                price_level=price_level,
                rating=rating,
                images=images,
                opening_hours=opening_hours,
                embedding=embedding,
                # location=... # TODO: If available
            )
            places_to_insert.append(place)
            
        except Exception as e:
            logger.error(f"Error processing doc {doc.get('_id')}: {e}")
            
    # 5. Insert to Postgres
    if places_to_insert:
        logger.info(f"Inserting {len(places_to_insert)} places to PostgreSQL...")
        async with async_session() as session:
            session.add_all(places_to_insert)
            await session.commit()
        logger.info("Migration completed successfully.")
    else:
        logger.info("No places found to migrate.")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
