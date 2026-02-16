from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import uuid
from typing import Optional
from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, Profile
from src.core.security import verify_token
from src.core.config import get_settings

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

from fastapi import Request

async def get_optional_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        payload = verify_token(token)
        if payload is None:
            return None
            
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
            
        # Fetch User
        stmt = select(User).where(User.id == uuid.UUID(user_id))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        return user
    except Exception:
        return None

# Admin Auth
from fastapi import Security
from fastapi.security import APIKeyHeader
import logging

logger = logging.getLogger(__name__)

API_KEY_HEADER = APIKeyHeader(name="x-admin-token", auto_error=False)

async def verify_admin(token: str = Security(API_KEY_HEADER)):
    settings = get_settings()
    secret = settings.ADMIN_SECRET
    if not secret:
        logger.warning("ADMIN_SECRET not set in env. Denying admin access.")
        raise HTTPException(status_code=403, detail="Admin access not configured")
    
    if not token or token != secret:
        raise HTTPException(status_code=403, detail="Invalid Admin Token")
    return True
