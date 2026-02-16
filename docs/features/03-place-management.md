# Feature: Place Management

> **PRD Reference**: FR-08, FR-09, FR-10
> **Status**: ✅ Working (Core CRUD), 🆕 Menu & Filters planned
> **Source**: `src/api.py`, `src/database/sql_models.py`

---

## Overview

Places are the **core entity** of Spotary. Each Place represents a physical location (cafe, bar, restaurant) with rich metadata: vibes, mood, categories, images, geographic coordinates, and an AI-generated vector embedding for semantic search.

---

## Current API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/places` | Public | List places (paginated, searchable) |
| GET | `/api/places/{id}` | Public | Place detail |
| PUT | `/api/places/{id}` | Admin | Update place |
| DELETE | `/api/places/{id}` | Admin | Delete place |
| GET | `/api/stats` | Public | Place count statistics |

### GET `/api/places`

**Query Parameters**:
| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | int | 20 | Page size |
| `offset` | int | 0 | Pagination offset |
| `search` | string | null | Text search (name, address, categories, vibes) |

**Search Logic**: Uses PostgreSQL `ILIKE` across multiple fields:
```sql
WHERE name ILIKE '%query%'
   OR address ILIKE '%query%'
   OR 'query' = ANY(categories)
   OR 'query' = ANY(vibes)
```

---

## Data Model: `Place`

### Base Fields (PlaceBase)
| Column | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Place name (required) |
| `address` | Text | Full address |
| `categories` | Array[String] | `["Cafe", "Bar", "Restaurant"]` |
| `vibes` | Array[String] | `["Cozy", "Quiet", "Jazz"]` |
| `mood` | Array[String] | `["Date", "Work", "Chill"]` |
| `price_level` | String | `$`, `$$`, `$$$` |
| `menu` | JSONB | List of `MenuItem` objects (new) |
| `rating` | Numeric(2,1) | Google rating (1.0-5.0) |
| `aesthetic_score` | Integer | AI/Admin beauty score (0-10) |
| `upvote_count` | Integer | Denormalized upvote count (indexed) |
| `memo_count` | Integer | Denormalized memo count |
| `images` | Array[String] | Image URLs/paths |
| `local_image_path` | String | Primary local image |
| `google_maps_url` | String | Source URL |
| `opening_hours` | Text | Structured hours text |
| `latitude` | Float | For frontend map rendering |
| `longitude` | Float | For frontend map rendering |

### Table-Only Fields (Place)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `location` | PostGIS POINT(4326) | For spatial queries |
| `embedding` | Vector(768) | Gemini embedding for semantic search |
| `created_at` | DateTime | Auto timestamp |
| `updated_at` | DateTime | Auto timestamp with onupdate |

### MenuItem Schema (JSONB)
```json
{
  "name": "Egg Coffee",
  "description": "Signature Vietnamese egg coffee",
  "price": 45000,
  "display_price": "45k",
  "image_url": "/images/egg-coffee.jpg",
  "is_signature": true,
  "category": "Drinks"
}
```

---

## Place Creation Flow

Places are created via the **Telegram Bot**, not through a direct API endpoint:

```
Bot (handle_photo / handle_message)
  → AI Analysis (llm.py)
  → Geocoding (parser.py)
  → Save to PostgreSQL
  → Generate Embedding (ai.py)
  → Store Image (image_manager.py)
```

The Admin Dashboard provides editing capabilities via `PUT /api/places/{id}`.

---

## Future Enhancements (PRD 2.0)

### Menu Intelligence (Phase 2.1)
- [ ] `PUT /api/places/{id}/menu` — Admin/Bot can add menu items.
- [ ] `GET /api/places/{id}/menu` — Return structured menu.
- [ ] Gemini Vision OCR for menu screenshot extraction.
- [ ] `is_signature` flag for "Must Try" items.

### Smart Filters (Phase 4)
- [ ] Filter by `price_level` ($, $$, $$$).
- [ ] Filter by "Open Now" (parse `opening_hours` + current time).
- [ ] Filter by `vibes` array intersection.
- [ ] Sort by `upvote_count`, `rating`, or vector similarity.

### Data Quality (Phase 2.3)
- [ ] Auto-sync `latitude/longitude` ↔ PostGIS `location` on save.
- [ ] Re-generate embedding when place data changes significantly.
- [ ] `aesthetic_score` auto-computed via AI image analysis.
