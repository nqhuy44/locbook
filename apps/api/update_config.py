import asyncio
from sqlmodel import select
from src.core.database.postgres import get_db_session, async_engine
from src.core.database.sql_models import AppConfig
from src.services.api import DEFAULT_APP_CONFIG

async def update():
    async for db in get_db_session():
        stmt = select(AppConfig).where(AppConfig.key == "global")
        res = await db.execute(stmt)
        config = res.scalar()
        if config and "MARIN" in config.data:
            marin = config.data["MARIN"]
            # Clean up old keys
            if "CATEGORY_SYNONYMS" in marin:
                del marin["CATEGORY_SYNONYMS"]
            if "PROMPT_CATEGORY_MAPPING" in marin:
                del marin["PROMPT_CATEGORY_MAPPING"]
            
            # Apply new defaults if missing
            if "CATEGORY_MAPPINGS" not in marin:
                marin["CATEGORY_MAPPINGS"] = DEFAULT_APP_CONFIG["MARIN"]["CATEGORY_MAPPINGS"]
                
            config.data["MARIN"] = marin
            # Trigger SQLAlchemy JSON mutation detection
            config.data = dict(config.data)
            await db.commit()
            print("Config updated successfully.")
            return

asyncio.run(update())
