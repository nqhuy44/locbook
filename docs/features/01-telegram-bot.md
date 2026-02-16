# Feature: Telegram Bot (Intelligence Acquisition)

> **PRD Reference**: FR-01, FR-02, FR-03
> **Status**: ✅ Working
> **Source**: `apps/api/src/bot/`

---

## Overview

The Telegram Bot is the **primary data acquisition channel** for Spotary. Users interact with Marin (the AI agent) to capture, search, and explore places without leaving Telegram. The bot handles three core workflows: Screenshot Analysis, Link Parsing, and Geo-Search.

---

## Architecture

```
User (Telegram) → python-telegram-bot → handlers.py → Core Services → PostgreSQL
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                    │
                              llm.py (Gemini)     parser.py (Google Maps)
```

### Key Files

| File | Purpose |
| :--- | :--- |
| `src/bot/handlers.py` | All bot command/message handlers |
| `src/bot/context.py` | User context store (in-memory state) |
| `src/core/llm.py` | AI Service (Gemini / Local LLM) |
| `src/core/parser.py` | Google Maps link parsing + Places API |
| `src/core/image_manager.py` | Local image storage |
| `src/core/strings.py` | All Vietnamese response strings |
| `src/core/rate_limiter.py` | Per-user rate limiting |

---

## Feature Details

### 1. Screenshot Analysis (`handle_photo`)

**Flow**:
1. User sends a photo (screenshot from TikTok, Instagram, Google Maps).
2. Bot acknowledges with a "processing" message.
3. Image is sent to Gemini Vision with a structured extraction prompt.
4. AI returns JSON: `name`, `address`, `categories`, `vibes`, `mood`, `opening_hours`, `rating`.
5. Bot checks for duplicate (by name similarity).
6. Place is saved to PostgreSQL.
7. Image is stored locally via `image_manager`.
8. Bot responds with a formatted Place Card.

**AI Prompt Strategy** (in `llm.py`):
- Default prompt asks Gemini to extract structured data from the image.
- `analyze_place_complex()` handles combined text + image analysis for richer results.
- Response is parsed from JSON with fallback error handling.

**Config Flags**:
- `FEAT_SCREENSHOT_ANALYSIS`: Toggle feature on/off.
- `FEAT_IMAGE_ANALYSIS`: Toggle image analysis specifically.

### 2. Google Maps Link Parsing (`handle_message`)

**Flow**:
1. User sends a text message containing a Google Maps URL.
2. `parser.py` extracts and validates the URL.
3. `fetch_place_info()` is called:
   - Resolves short URLs (goo.gl, maps.app.goo.gl).
   - Calls **Google Places API (New)** via Text Search.
   - Fetches up to 5 photos via Places Media API.
   - Falls back to web scraping if API fails.
4. Combined data (API + scraped) is sent to `analyze_place_complex()`.
5. AI produces structured Place data + a "Marin commentary" in Vietnamese.
6. Place is saved to PostgreSQL with geocoded coordinates.
7. Bot returns Place Card + AI commentary.

**Google Places API Integration** (`parser.py`):
- Uses `places.googleapis.com/v1/places:searchText` (New API).
- Field mask: `displayName`, `formattedAddress`, `location`, `rating`, `regularOpeningHours`, `photos`, `reviews`.
- Reviews are limited to `MAX_REVIEWS_FOR_AI` (default 5) to save tokens.
- Photos are fetched as bytes via `_fetch_photo_bytes()`.

**Duplicate Detection**:
- Checks if `google_maps_url` already exists in DB before saving.
- Prevents wasting AI tokens on already-captured places.

### 3. Geo-Search (`handle_location`)

**Flow**:
1. User shares live location via Telegram.
2. Bot queries PostGIS: `ST_DWithin(location, user_point, 2000)` (2km radius).
3. Results sorted by distance.
4. Returns top 5 places with distance labels.

**PostGIS Query**:
```sql
SELECT *, ST_Distance(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326)) as dist
FROM places
WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326), 0.018) -- ~2km
ORDER BY dist
LIMIT 5;
```

### 4. View Command (`handle_view_command`)

- `/view_{id}` — Shows full details of a saved place.
- Renders: Name, Address, Rating, Vibes, Categories, Opening Hours, Images.

---

## Configuration

| Setting | Default | Description |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Required | Bot authentication |
| `ENABLE_BOT` | `true` | Toggle bot on/off |
| `FEAT_SCREENSHOT_ANALYSIS` | `false` | Screenshot capture |
| `FEAT_IMAGE_ANALYSIS` | `false` | Image analysis |
| `FEAT_PLACE_SEARCH` | `true` | Local DB search |
| `FEAT_GEO_SEARCH` | `true` | Location-based search |
| `MAX_REVIEWS_FOR_AI` | `5` | Limit reviews sent to LLM |
| `RATE_LIMIT_PER_MINUTE` | `5` | Max requests/min/user |
| `MAX_MESSAGE_AGE_SECONDS` | `60` | Ignore stale messages |

---

## Future Enhancements (PRD 2.0)

- [ ] **Menu Screenshot Detection**: Differentiate menu photos from place photos → extract `MenuItem` list.
- [ ] **Richer Google Maps Data**: Extract popular times, price level from API.
- [ ] **User-linked Saves**: Associate captured places with the Telegram user's Spotary account.
