from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator
from sqlmodel import SQLModel

from src.core.config import get_settings


_engine = None

def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        
        db_url = (
            f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
            f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
        )
        
        _engine = create_async_engine(db_url, echo=False)
    return _engine

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        yield session

async def init_postgres():
    settings = get_settings()
    db_url = (
        f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
         
    engine = create_async_engine(db_url, echo=False)
    
    async with engine.begin() as conn:
        # Create extensions
        from sqlalchemy import text
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        
        # Create tables
        await conn.run_sync(SQLModel.metadata.create_all)
    
    await engine.dispose()
