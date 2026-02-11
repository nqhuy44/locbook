from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.database.postgres import get_db_session
from src.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])

class GoogleLoginRequest(BaseModel):
    access_token: str

@router.post("/google", status_code=status.HTTP_200_OK)
async def login_google(
    payload: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    service = AuthService(db)
    
    # 1. Verify token with Google
    try:
        # We can implement verification here or just fetch user info
        # If we trust the client passed token, we should verify it against Google content.
        # Ideally, we exchange code for token, but if client sends access_token, we check it.
        google_user = await service.get_google_user(payload.access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Auth Failed: {str(e)}")
        
    # 2. Login or Register
    auth_data = await service.login_or_register_google(google_user)
    return auth_data
