# Feature: Collections (Curated Lists)

> **PRD Reference**: FR-16
> **Status**: 🆕 Schema defined, API not yet implemented
> **Source**: `src/database/sql_models.py` (model only)

---

## Overview

**Collections** let users curate themed lists of places — "Date Night Spots", "Best Coffee in D1", "Hidden Gems". Collections can be **public** (shareable via URL) or **private**. Each item in a collection can have a personal note.

---

## Data Model

### Collection
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users | Owner (CASCADE delete) |
| `name` | String | List name (required) |
| `description` | String | Optional description |
| `is_public` | Boolean | Default `true` |
| `created_at` | DateTime | Auto |

### CollectionItem (Link Table)
| Column | Type | Description |
| :--- | :--- | :--- |
| `collection_id` | UUID PK, FK → collections | CASCADE delete |
| `place_id` | UUID PK, FK → places | Part of composite PK |
| `added_at` | DateTime | Auto |
| `note` | String | Personal note ("Try the matcha latte here") |

**Relationships**:
- `Collection` → has many `CollectionItem` (cascade delete-orphan).
- `CollectionItem` ↔ `Place` (many-to-many through link table).

---

## Planned API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/collections` | JWT | Create collection |
| GET | `/api/collections` | JWT | List user's collections |
| GET | `/api/collections/{id}` | Mixed | View collection (public or owner) |
| PUT | `/api/collections/{id}` | JWT (owner) | Update name/description |
| DELETE | `/api/collections/{id}` | JWT (owner) | Delete collection |
| POST | `/api/collections/{id}/items` | JWT (owner) | Add place to collection |
| DELETE | `/api/collections/{id}/items/{place_id}` | JWT (owner) | Remove place |

### `POST /api/collections`

```json
{
  "name": "Date Night Spots 🌙",
  "description": "Romantic places in Saigon",
  "is_public": true
}
```

### `POST /api/collections/{id}/items`

```json
{
  "place_id": "uuid",
  "note": "Book the rooftop table"
}
```

### `GET /api/collections/{id}`

**Access Rules**:
- If `is_public = true` → anyone can view.
- If `is_public = false` → only owner can view.
- Returns collection metadata + list of places with notes.

```json
{
  "id": "uuid",
  "name": "Date Night Spots",
  "user": { "display_name": "Huy", "avatar_url": "..." },
  "items": [
    {
      "place": { "id": "...", "name": "Chill Skybar", "vibes": ["Romantic"] },
      "note": "Book the rooftop table",
      "added_at": "2026-02-10T..."
    }
  ]
}
```

---

## Sharing

Public collections get a shareable URL:
```
https://locbook.app/collections/{collection_id}
```

Frontend renders the collection as a styled list with place cards.

---

## Implementation Tasks (Phase 5.2)

- [ ] Create `src/routers/collections.py` with full CRUD.
- [ ] Implement ownership check middleware (only owner can modify).
- [ ] Public vs private access logic on GET.
- [ ] Mount router in `api.py`.
- [ ] Frontend: "Save to Collection" dropdown on Place Detail.
- [ ] Frontend: Collection page with shareable URL rendering.
