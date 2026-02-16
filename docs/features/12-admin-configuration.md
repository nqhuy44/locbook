# Feature: Admin Dashboard & App Configuration

> **PRD Reference**: Section 4.2 (Current System)
> **Status**: ✅ Working
> **Source**: `apps/admin/`, `src/api.py` (config endpoints)

---

## Overview

The **Admin Dashboard** is a separate React+Vite application for managing Spotary's data and configuration. Admins authenticate via a shared secret (`ADMIN_SECRET`) and can manage places, update the dynamic config, and upload assets.

---

## Admin Authentication

| Mechanism | Header | Value |
| :--- | :--- | :--- |
| API Key | `x-admin-token` | Matches `ADMIN_SECRET` env var |

All admin endpoints use `Depends(verify_admin)`.

---

## Admin API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| PUT | `/api/places/{id}` | Update place data |
| DELETE | `/api/places/{id}` | Delete place |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/config` | Get current config |
| PUT | `/api/config` | Update config |
| POST | `/api/upload-avatar` | Upload Marin avatar image |
| POST | `/api/admin/reindex` | Trigger re-index (currently disabled) |

---

## Dynamic App Configuration

Configuration is stored in `app_config` table with key `"global"` and value as JSONB. This allows runtime changes without redeploying.

### Config Structure

```json
{
  "FEATURES": {
    "ENABLE_BUY_ME_COFFEE": true,
    "ENABLE_FOOTER": true,
    "ENABLE_AUTHOR_CREDITS": true,
    "ENABLE_DISCOVER": true,
    "ENABLE_MAP": false,
    "FEAT_AI_MATCHMAKE": true
  },
  "CATEGORY_SYNONYMS": {
    "Pub": ["pub", "beer", "bia"],
    "Bar": ["bar", "cocktail", "lounge"],
    "Cafe & Coffee": ["cafe", "coffee", "tea"],
    "Casual": ["casual", "street", "local"]
  },
  "MARIN": {
    "AVATAR_NAME": "Marin 🎀",
    "SYSTEM_INSTRUCTION": "You are Marin, an AI local guide...",
    "CATEGORY_SYNONYMS": { ... },
    "PROMPT_CATEGORY_MAPPING": {
      "nhậu": "Pub",
      "cafe": "Cafe"
    }
  }
}
```

### Config Endpoints

**`GET /api/config`** — Returns merged config (DB values override defaults).

**`PUT /api/config`** — Admin replaces config. Creates if not exists.

### Data Model: AppConfig

| Column | Type | Description |
| :--- | :--- | :--- |
| `key` | String PK | Config identifier (`"global"`) |
| `value` | JSONB | Config data |
| `updated_at` | DateTime | Auto |

---

## Statistics (`GET /api/stats`)

```json
{
  "total_places": 156,
  "by_category": {
    "Cafe": 45,
    "Bar": 32,
    "Restaurant": 28
  },
  "newest_place": "Chill Skybar",
  "total_images": 312
}
```

---

## Image Management

### Static File Serving
- Images stored in `data/images/`.
- Served at `/images/{filename}` via FastAPI `StaticFiles`.

### Avatar Upload (`POST /api/upload-avatar`)
- Accepts file upload.
- Saves to `data/images/` with UUID filename.
- Returns URL path.

---

## Rate Limiting (`src/core/rate_limiter.py`)

Basic per-user rate limiting:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `RATE_LIMIT_PER_MINUTE` | `5` | Max requests/min/user (bot) |

Currently implemented for bot handlers. API-level rate limiting is planned for Phase 3.

---

## Future Enhancements (PRD 2.0)

### Admin Improvements
- [ ] Place creation form (currently bot-only).
- [ ] Bulk import/export (CSV/JSON).
- [ ] Menu editor (structured `MenuItem` form).
- [ ] User management panel (view users, change roles).

### Rate Limiting (Phase 3)
- [ ] Per-endpoint API rate limiting middleware.
- [ ] Redis-backed counters for distributed deployments.
- [ ] Different limits for authenticated vs anonymous users.
