import asyncio
import argparse
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from sqlmodel import select, func
from src.core.database.postgres import get_db_session, init_postgres
from src.core.database.sql_models import Place, User, Interaction, Memo, Collection
from src.core.config import get_settings

async def init_db():
    await init_postgres()
    print("✅ DB Initialized (PostgreSQL)")

async def show_stats():
    """Show database statistics."""
    async for db in get_db_session():
        # Total Places
        result = await db.execute(select(func.count(Place.id)))
        total_places = result.scalar_one()
        
        # Total Users
        result = await db.execute(select(func.count(User.id)))
        total_users = result.scalar_one()
        
        # Total Interactions
        result = await db.execute(select(func.count(Interaction.id)))
        total_interactions = result.scalar_one()
        
        print(f"📊 Total Places: {total_places}")
        print(f"👤 Total Users: {total_users}")
        print(f"🤝 Total Interactions: {total_interactions}")

async def main():
    parser = argparse.ArgumentParser(description="LocBook Database Manager")
    parser.add_argument("--stats", action="store_true", help="Show database stats")
    parser.add_argument("--init", action="store_true", help="Initialize/create all tables")
    
    args = parser.parse_args()
    
    if args.init:
        await init_db()
    elif args.stats:
        await show_stats()
    else:
        parser.print_help()

if __name__ == "__main__":
    asyncio.run(main())
