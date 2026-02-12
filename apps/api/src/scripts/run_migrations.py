import asyncio
import os
import sys
import importlib.util
from datetime import datetime
from sqlmodel import select
from src.core.database.postgres import create_async_engine, get_settings
from src.core.database.migration_model import MigrationHistory
from src.core.database.sql_models import SQLModel

# Add project root
sys.path.append(os.getcwd())

async def run_migrations():
    settings = get_settings()
    db_url = (
        f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    engine = create_async_engine(db_url, echo=True)

    # 1. Ensure MigrationHistory table exists
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # 2. Get applied migrations
    applied_versions = set()
    async with engine.connect() as conn:
        # Check if table exists first (create_all might have just created it)
        # But we can just query it.
        try:
             # simple query using text or sqlmodel
             from sqlalchemy import text
             result = await conn.execute(text("SELECT version FROM migration_history"))
             applied_versions = {row[0] for row in result.fetchall()}
        except Exception:
             # Table might not exist if create_all failed or logic weirdness?
             # Actually create_all above guarantees it exists.
             pass

    # 3. List migration files in src/migrations/versions
    migrations_dir = "src/migrations/versions"
    if not os.path.exists(migrations_dir):
        os.makedirs(migrations_dir)
        # Create a sample/init migration if empty?
        # No, just pass
    
    files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".py") and f != "__init__.py"])
    
    logger = logging.getLogger("migration")
    logging.basicConfig(level=logging.INFO)

    for filename in files:
        version = filename.split("_")[0] # assume format 001_description.py
        if version in applied_versions:
            continue
            
        logger.info(f"Applying migration: {filename}...")
        
        # Load module
        file_path = os.path.join(migrations_dir, filename)
        spec = importlib.util.spec_from_file_location("migration_module", file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        if not hasattr(module, 'upgrade'):
            logger.warning(f"Skipping {filename}: No 'upgrade' function found.")
            continue
            
        # Run upgrade
        try:
            async with engine.begin() as conn:
                await module.upgrade(conn)
            
                # Record success
                # We need to insert into MigrationHistory
                # We need to insert into MigrationHistory
                # using raw sql properly or Session
                from sqlalchemy import text
                await conn.execute(
                    text("INSERT INTO migration_history (id, version, applied_at) VALUES (:id, :version, :now)"),
                    {"id": uuid.uuid4(), "version": version, "now": datetime.utcnow()}
                )
                
            logger.info(f"✅ Applied {filename}")
            
        except Exception as e:
            logger.error(f"❌ Failed to apply {filename}: {e}")
            sys.exit(1)

    logger.info("All migrations up to date.")
    await engine.dispose()

import logging
import uuid
if __name__ == "__main__":
    asyncio.run(run_migrations())
