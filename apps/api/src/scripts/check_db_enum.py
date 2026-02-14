import asyncio
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database.postgres import get_engine

async def check_enum():
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check pg_enum
        stmt = text("""
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'listprivacy';
        """)
        result = await session.execute(stmt)
        labels = result.scalars().all()
        print(f"Database Enum Labels: {labels}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(check_enum())
