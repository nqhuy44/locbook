import asyncio
import os
import sys

# Allow import from src
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from src.core.database.sql_models import Place
from src.core.config import get_settings
from google import genai

settings = get_settings()

if settings.GEMINI_API_KEY:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
else:
    client = None

async def translate_comment(text_vi: str) -> str:
    """Uses Gemini to translate the comment."""
    if not client:
        print("No GEMINI_API_KEY. Returning same text.")
        return text_vi
        
    try:
        prompt = f"""
Translate the following Gen Z / TikToker style food/place review from Vietnamese to English. 
Keep the exact same emojis and bullet point format. Keep it trendy and Gen Z style in English.

Input:
{text_vi}

Output ONLY the English translation.
"""
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        print(f"Translation failed: {e}")
        
    return text_vi

async def run_migration():
    print("Starting Marin's Take DB Migration...")
    
    # Construct postgres url if not in settings easily (config uses asyncpg)
    postgres_url = f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    
    engine = create_async_engine(postgres_url)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Fetch all
        stmt = select(Place)
        result = await session.execute(stmt)
        places = result.scalars().all()
        
        migrated_count = 0
        total = len(places)
        
        for i, place in enumerate(places):
            if not place.raw_ai_response:
                continue
                
            raw_ai = place.raw_ai_response
            marin_comment = raw_ai.get("marin_comment")
            
            # Check if it's already a dict
            if isinstance(marin_comment, dict) and "vi" in marin_comment and "en" in marin_comment:
                print(f"[{i+1}/{total}] Skip (Already migrated): {place.name}")
                continue
                
            if not marin_comment or not isinstance(marin_comment, str):
                continue
                
            print(f"[{i+1}/{total}] Migrating: {place.name}")
            en_translation = await translate_comment(marin_comment)
            
            # Update
            # Make a copy of the dict to ensure SQLAlchemy detects the change
            updated_raw = dict(raw_ai)
            updated_raw["marin_comment"] = {
                "vi": marin_comment,
                "en": en_translation
            }
            
            place.raw_ai_response = updated_raw
            if place.search_text is None:
                # Force SQLAlchemy to update jsonb
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(place, "raw_ai_response")
            
            session.add(place)
            migrated_count += 1
            
            # Optional: Sleep to prevent rate limits on Gemini
            await asyncio.sleep(1)

        print(f"Committing {migrated_count} changes...")
        await session.commit()
        print("Migration complete!")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
