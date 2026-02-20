import asyncio
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'apps', 'api'))

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import Place
from sqlmodel import select, distinct

async def main():
    async for db in get_db_session():
        stmt = select(distinct(Place.city))
        result = await db.execute(stmt)
        cities = result.scalars().all()
        print(f"Cities in DB: {cities}")
        
        # Check specifically for Bien Hoa
        stmt2 = select(Place).where(Place.city.ilike("%bien hoa%")).limit(5)
        res2 = await db.execute(stmt2)
        bh_places = res2.scalars().all()
        print(f"Places in Bien Hoa: {len(bh_places)}")
        if bh_places:
            print([p.name for p in bh_places])

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
