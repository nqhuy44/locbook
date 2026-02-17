from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.core.database.postgres import get_db_session
from src.modules.auth.service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class GoogleLoginRequest(BaseModel):
    access_token: Optional[str] = None
    code: Optional[str] = None
    redirect_uri: Optional[str] = None

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/google", status_code=status.HTTP_200_OK)
async def login_google(
    payload: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    service = AuthService(db)
    
    # login_or_register_google now handles code exchange or direct access_token
    try:
        auth_data = await service.login_or_register_google(payload.model_dump())
        return auth_data
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login Logic Failed: {str(e)}")

@router.post("/refresh")
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db_session)
):
    service = AuthService(db)
    return await service.refresh_session(payload.refresh_token)
