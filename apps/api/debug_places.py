
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def inspect_places():
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB_NAME", "spotary")
    
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    print(f"--- Inspecting Places in '{db_name}' ---")
    
    # regex find for bar/pub/cocktail
    query = {
        "$or": [
            {"categories": {"$regex": "bar|pub|cocktail|lounge|nightlife", "$options": "i"}},
            {"name": {"$regex": "bar|pub|cocktail|lounge", "$options": "i"}},
            {"vibes": {"$regex": "bar|pub|cocktail", "$options": "i"}}
        ]
    }
    
    places = await db.places.find(query).to_list(length=100)
    
    print(f"Found {len(places)} potential bars/pubs:")
    for p in places:
        print(f"Name: {p.get('name')}")
        print(f"  - Categories: {p.get('categories')}")
        print(f"  - Vibes: {p.get('vibes')}")
        print(f"  - Address: {p.get('address')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(inspect_places())
