import asyncio
import sys
import os
from sqlalchemy import text
from src.core.database.postgres import create_async_engine, get_settings

# Add project root
sys.path.append(os.getcwd())

async def debug_enum():
    settings = get_settings()
    db_url = (
        f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    engine = create_async_engine(db_url, echo=True)

    async with engine.connect() as conn:
        print("--- Checking pg_type ---")
        result = await conn.execute(text("SELECT oid, typname FROM pg_type WHERE typname = 'listprivacy'"))
        rows = result.fetchall()
        print(f"Types found: {rows}")
        
        if rows:
            oid = rows[0][0]
            print(f"--- Checking pg_enum for oid {oid} ---")
            result_enum = await conn.execute(text(f"SELECT enumlabel FROM pg_enum WHERE enumtypid = {oid}"))
            labels = result_enum.fetchall()
            print(f"Labels: {[row[0] for row in labels]}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(debug_enum())
