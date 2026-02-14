import asyncio
import uuid
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from src.core.database.postgres import get_engine
from src.core.database.sql_models import UserList, ListPrivacy

async def debug_get_list():
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("Querying one list...")
        stmt = select(UserList).limit(1)
        try:
            result = await session.execute(stmt)
            user_list = result.scalar_one_or_none()
            
            if user_list:
                print(f"Found list: {user_list.name}")
                print(f"Privacy raw raw: {user_list.privacy}")
                print(f"Privacy type: {type(user_list.privacy)}")
                
                # Try validation
                from src.modules.lists.router import UserListRead
                dto = UserListRead(
                    id=user_list.id,
                    name=user_list.name,
                    description=user_list.description,
                    privacy=user_list.privacy,
                    item_count=len(user_list.items)
                )
                print(f"Pydantic DTO: {dto}")
            else:
                print("No lists found.")
                
        except Exception as e:
            print(f"Error querying list: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_get_list())
