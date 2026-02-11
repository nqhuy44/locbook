# Feature: Interactions & Upvoting

> **PRD Reference**: FR-11, FR-12, FR-13
> **Status**: ✅ Basic CRUD Working, 🔧 Ranking enhancements planned
> **Source**: `src/routers/interactions.py`, `src/database/sql_models.py`

---

## Overview

Interactions track how users engage with places. The primary interaction types are **Upvote**, **View**, and **Bookmark**. The upvote system is designed around **fairness**: 1 User = 1 Vote per Place, enforced at the database level with a `UniqueConstraint`.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/interactions` | JWT | Create interaction |
| DELETE | `/api/interactions` | JWT | Remove interaction |

### `POST /api/interactions`

**Request**:
```json
{
  "place_id": "uuid-string",
  "type": "upvote"
}
```

**Logic**:
1. Validate `place_id` exists.
2. Check if `(user_id, place_id, type)` already exists.
3. If exists → return existing (idempotent for upvotes).
4. If not → create new interaction.

### `DELETE /api/interactions`

**Request**: Same body as POST.
**Logic**: Find and delete the matching interaction.

---

## Data Model

### Interaction
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users | Indexed, CASCADE delete |
| `place_id` | UUID FK → places | Indexed, CASCADE delete |
| `type` | Enum | `upvote`, `view`, `bookmark` |
| `score` | Float | Default 1.0 (for future weighted ranking) |
| `created_at` | DateTime | Auto |

### Constraints
```sql
UNIQUE (user_id, place_id, type)  -- "unique_user_place_interaction"
```
This ensures a user can only upvote a place **once**. Attempting to create a duplicate returns the existing record.

### InteractionType Enum
```python
class InteractionType(str, Enum):
    UPVOTE = "upvote"
    VIEW = "view"
    BOOKMARK = "bookmark"
```

---

## Denormalization

`Place.upvote_count` is a denormalized counter for fast reads. It avoids `COUNT(*)` queries on the interactions table.

**Update Strategy** (planned):
- On `POST /api/interactions` (upvote) → `Place.upvote_count += 1`
- On `DELETE /api/interactions` (upvote) → `Place.upvote_count -= 1`
- Alternatively: PostgreSQL trigger on `interactions` table.

---

## Future Enhancements (PRD 2.0 — Phase 3)

### Upvote Toggle
- [ ] Change `POST` behavior: if interaction exists → **delete it** (toggle off), return `{ status: "removed" }`.
- [ ] Update `Place.upvote_count` atomically on toggle.

### Ranking Algorithm
- [ ] **Most Popular**: `ORDER BY upvote_count DESC`.
- [ ] **Best Match**: `ORDER BY embedding <=> user_vibe ASC`.
- [ ] **Trending**: Upvotes where `created_at > NOW() - interval '7 days'`, counted.
- [ ] Add `sort` query param to `GET /api/places`.

### Spam Prevention
- [ ] Hard limit: 1 upvote per user per place (already enforced by `UniqueConstraint`).
- [ ] API rate limiting: max 10 interactions/minute per user.

### Bookmark Feature
- [ ] Save places without upvoting (private, only visible to the user).
- [ ] `GET /api/users/me/bookmarks` — list bookmarked places.
