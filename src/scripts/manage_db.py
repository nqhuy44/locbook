import asyncio
import argparse
import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from src.database.models import Place, UserLog
from src.core.llm import ai_service
from src.config import get_settings

async def init_db():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    await init_beanie(database=client[settings.MONGO_DB_NAME], document_models=[Place, UserLog])
    print("✅ DB Initialized")

async def show_stats():
    """Show database statistics."""
    count = await Place.count()
    raw_count = await Place.find(Place.raw_ai_response != None).count()
    print(f"📊 Total Places: {count}")
    print(f"💾 Places with Raw Data: {raw_count}")
    print(f"📉 Legacy Data (No Raw): {count - raw_count}")

async def reparse_raw_data():
    """
    Iterate over all places with raw_ai_response,
    re-extract fields, and update the document.
    Useful when Schema changes or extraction logic improves.
    """
    print("🔄 Starting Reparse...")
    places = await Place.find(Place.raw_ai_response != None).to_list()
    
    updated_count = 0
    for p in places:
        raw = p.raw_ai_response
        details = raw.get("details", {})
        
        # --- LOGIC UPDATE HERE ---
        # Example: if we added a new field 'noise_level' to schema
        # p.noise_level = details.get("noise_level")
        
        # Example: Update merged categories
        categories = details.get('categories', [])
        meal_types = details.get('meal_types', [])
        occasions = details.get('occasions', [])
        full_categories = list(set(categories + meal_types + occasions))
        p.categories = full_categories
        
        # Update Schema Version
        p.schema_version = 1 
        
        await p.save()
        updated_count += 1
        print(f"✅ Updated {p.name}")

    print(f"✨ Reparsed {updated_count} places.")

async def main():
    parser = argparse.ArgumentParser(description="LocBook Database Manager")
    parser.add_argument("--stats", action="store_true", help="Show database stats")
    parser.add_argument("--reparse", action="store_true", help="Reparse fields from raw_ai_response")
    
    args = parser.parse_args()
    
    await init_db()
    
    if args.stats:
        await show_stats()
    elif args.reparse:
        await reparse_raw_data()
    else:
        parser.print_help()

if __name__ == "__main__":
    asyncio.run(main())
