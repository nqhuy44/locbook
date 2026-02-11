from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator
from sqlmodel import SQLModel

from src.config import get_settings

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    settings = get_settings()
    
    # Construct Async Database URL
    db_url = settings.POSTGRES_URL
    if not db_url:
        db_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/locbook"
        
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        yield session

async def init_postgres():
    settings = get_settings()
    db_url = settings.POSTGRES_URL
    if not db_url:
         db_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/locbook"
         
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(SQLModel.metadata.create_all)
    
    await engine.dispose()
