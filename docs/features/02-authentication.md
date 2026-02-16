# Feature: Authentication & User Management

> **PRD Reference**: FR-05, FR-07
> **Status**: ✅ Working
> **Source**: `src/routers/auth.py`, `src/services/auth_service.py`, `src/core/security.py`

---

## Overview

Spotary uses **passwordless authentication** via Google OAuth 2.0. Users sign in with their Google account — no email/password registration. Sessions are managed with JWT tokens. The system supports user roles (`user`, `admin`) and automatically creates a Profile on first login.

---

## Architecture

```
Frontend (Google Sign-In SDK)
    ↓ access_token
POST /auth/google
    ↓
AuthService.get_google_user(access_token)
    ↓ Verify with Google API
AuthService.login_or_register_google()
    ↓
    ├── Existing User → Login
    └── New User → Register + Create Profile
    ↓
JWT Token ← create_access_token()
    ↓
Response: { access_token, user }
```

### Key Files

| File | Purpose |
| :--- | :--- |
| `src/routers/auth.py` | `POST /auth/google` endpoint |
| `src/services/auth_service.py` | Google verification, login/register logic |
| `src/core/security.py` | JWT creation and verification |
| `src/routers/dependencies.py` | `get_current_user` dependency injection |

---

## Feature Details

### 1. Google OAuth Flow

**Endpoint**: `POST /auth/google`

**Request**:
```json
{ "access_token": "ya29.a0..." }
```

**Process**:
1. Client obtains Google `access_token` via Google Sign-In SDK.
2. Backend calls `https://www.googleapis.com/oauth2/v3/userinfo` to verify and fetch user data.
3. Checks if `OAuthAccount` exists with `(provider=google, provider_user_id=sub)`.
4. If exists → login (return existing user).
5. If not → check if email already registered (link account) or create new user.
6. On new user:
   - Create `User` record.
   - Create default `Profile` (display_name, avatar from Google).
   - Create `OAuthAccount` link.
7. Generate JWT token with payload: `{ sub: user_id, email, role }`.

**Response**:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "role": "user",
    "display_name": "Huy Nguyen",
    "avatar_url": "https://lh3.google..."
  }
}
```

### 2. JWT Sessions

| Setting | Default | Description |
| :--- | :--- | :--- |
| `SECRET_KEY` | `your-secret-key-change-me` | **Must change in production!** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Token expiry |

**Token Payload**: `{ "sub": "user_uuid", "email": "...", "role": "user|admin", "exp": ... }`

### 3. Protected Routes

Use `Depends(get_current_user)` to protect endpoints:

```python
from src.routers.dependencies import get_current_user

@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    ...
```

### 4. Admin Authentication

Admin endpoints use a simpler API key mechanism:
- Header: `x-admin-token`
- Verified against `ADMIN_SECRET` env var.
- Used for: Place CRUD, Config editing, Reindex, Avatar upload.

---

## Database Models

### User
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `email` | String | Unique, indexed |
| `role` | Enum (`user`, `admin`) | Default: `user` |
| `is_active` | Boolean | Default: `true` |
| `created_at` | DateTime | Auto |
| `last_login` | DateTime | Nullable |

### OAuthAccount
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users | CASCADE delete |
| `provider` | String | `"google"` |
| `provider_user_id` | String | Google `sub` |
| `access_token` | Text | Optional (for offline access) |

---

## Future Enhancements (PRD 2.0)

- [ ] **Token Refresh**: Implement refresh token flow for seamless re-auth.
- [ ] **Role-based Middleware**: Centralized decorator for `admin`-only routes.
- [ ] **Account Linking**: Support multiple OAuth providers (Apple, Facebook).
- [ ] **Account Deactivation**: Soft-delete with `is_active = false`.
