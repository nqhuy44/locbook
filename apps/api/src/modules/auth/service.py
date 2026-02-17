import httpx
from typing import Optional, Dict, Any
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.core.database.sql_models import User, OAuthAccount, Profile, RefreshToken
from src.core.security import create_access_token
from src.core.config import get_settings
from datetime import datetime, timedelta, timezone
import secrets

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

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> str:
        """Exchange Google Auth Code for Access Token"""
        async with httpx.AsyncClient() as client:
            data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            resp = await client.post("https://oauth2.googleapis.com/token", data=data)
            if resp.status_code != 200:
                print(f"Code Exchange Error: {resp.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
            tokens = resp.json()
            return tokens.get("access_token")

    async def _generate_unique_username(self, email: str) -> str:
        """Generate a unique username from email."""
        base_name = email.split("@")[0]
        # Sanitize: remove special chars if needed, keep it simple for now
        import re
        base_name = re.sub(r'[^a-zA-Z0-9_\.]', '', base_name).lower()
        if not base_name: 
            base_name = "user"

        username = base_name
        counter = 1
        
        while True:
            # Check if exists
            stmt = select(User).where(User.username == username)
            result = await self.db.execute(stmt)
            if not result.scalar_one_or_none():
                return username
            
            # If exists, append counter
            username = f"{base_name}_{counter}"
            counter += 1

    async def login_or_register_google(self, google_data: Dict[str, Any]) -> Dict[str, Any]:
        # google_data can be user info or contains 'code'
        code = google_data.get("code")
        redirect_uri = google_data.get("redirect_uri")
        access_token_param = google_data.get("access_token")

        actual_access_token = None
        if code:
            if not redirect_uri:
                raise HTTPException(status_code=400, detail="redirect_uri required for code flow")
            actual_access_token = await self.exchange_code_for_token(code, redirect_uri)
        else:
            actual_access_token = access_token_param

        if not actual_access_token:
            raise HTTPException(status_code=400, detail="access_token or code required")

        # Now get user info with the token
        user_info = await self.get_google_user(actual_access_token)
        
        email = user_info.get("email")
        # 'sub' is the Google user ID
        sub = user_info.get("sub")
        picture = user_info.get("picture")
        name = user_info.get("name")
        
        if not email or not sub:
             raise HTTPException(status_code=400, detail="Invalid Google Data from userInfo")

        # Check if OAuth account exists
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
                # Generate unique username
                username = await self._generate_unique_username(email)
                
                user = User(email=email, username=username)
                self.db.add(user)
                await self.db.flush() # Get ID
                
                # Create default Profile
                profile = Profile(
                    user_id=user.id,
                    display_name=name,
                    avatar_url=picture,
                    preferences={}
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

        # Determine if new (heuristic)
        is_new = False
        if not oauth_account and not existing_user:
             is_new = True
            
        # Create Session Tokens
        # Access Token (1 hour)
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
        
        # Refresh Token (30 days)
        refresh_token_str = secrets.token_urlsafe(32)
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        db_refresh_token = RefreshToken(
            user_id=user.id,
            token=refresh_token_str,
            expires_at=refresh_expires
        )
        self.db.add(db_refresh_token)
        await self.db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token_str,
            "token_type": "bearer",
            "is_new": is_new,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "role": user.role,
                "display_name": name,
                "avatar_url": picture
            }
        }

    async def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        """Validate refresh token and issue a new access token"""
        stmt = select(RefreshToken).where(
            RefreshToken.token == refresh_token,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc)
        ).options(selectinload(RefreshToken.user))
        
        result = await self.db.execute(stmt)
        db_token = result.scalar_one_or_none()
        
        if not db_token:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
            
        user = db_token.user
        
        # Issue new access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
