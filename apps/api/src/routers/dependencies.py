from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import uuid

from src.database.postgres import get_db_session
from src.database.sql_models import User, Profile
from src.core.security import verify_token
from src.config import get_settings

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    # Fetch User
    try:
        stmt = select(User).where(User.id == uuid.UUID(user_id))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception:
         raise credentials_exception

    if user is None:
        raise credentials_exception
        
    return user
