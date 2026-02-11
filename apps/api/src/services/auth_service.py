import httpx
from typing import Optional, Dict, Any
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.database.sql_models import User, OAuthAccount, Profile
from src.core.security import create_access_token
from src.config import get_settings

settings = get_settings()

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_google_user(self, access_token: str) -> Dict[str, Any]:
        """Fetch user data from Google API"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Google Token")
            return resp.json()

    async def login_or_register_google(self, google_data: Dict[str, Any]) -> Dict[str, Any]:
        email = google_data.get("email")
        sub = google_data.get("sub")
        picture = google_data.get("picture")
        name = google_data.get("name")
        
        if not email or not sub:
             raise HTTPException(status_code=400, detail="Invalid Google Data")

        # Check if OAuth account exists
        # SQLModel select is compatible with SQLAlchemy select
        stmt = select(OAuthAccount).where(
            OAuthAccount.provider == "google",
            OAuthAccount.provider_user_id == sub
        ).options(selectinload(OAuthAccount.user))
        
        result = await self.db.execute(stmt)
        oauth_account = result.scalar_one_or_none()
        
        user = None
        
        if oauth_account:
            # Login
            user = oauth_account.user
        else:
            # Check if user exists with email (link account)
            stmt_user = select(User).where(User.email == email)
            result_user = await self.db.execute(stmt_user)
            existing_user = result_user.scalar_one_or_none()
            
            if existing_user:
                user = existing_user
            else:
                # Register new user
                user = User(email=email)
                self.db.add(user)
                await self.db.flush() # Get ID
                
                # Create default Profile
                profile = Profile(
                    user_id=user.id,
                    display_name=name,
                    avatar_url=picture,
                    metadata_={}
                )
                self.db.add(profile)
            
            # Create OAuth Account link
            new_oauth = OAuthAccount(
                user_id=user.id,
                provider="google",
                provider_user_id=sub,
                # access_token=... # we might want to store it if offline access
            )
            self.db.add(new_oauth)
            await self.db.commit()
            
        # Create Session Token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "display_name": name,
                "avatar_url": picture
            }
        }
