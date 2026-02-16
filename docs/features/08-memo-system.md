# Feature: Memo System (Personal Journal)

> **PRD Reference**: FR-15
> **Status**: 🆕 Schema defined, API not yet implemented
> **Source**: `src/database/sql_models.py` (model only)

---

## Overview

The **Memo System** replaces traditional reviews with a personal journal concept. A Memo is a user's memory entry about a place — what they ate, how they felt, photos from the visit. Unlike public reviews (which can be toxic or spammy), Memos have **three visibility levels** to balance privacy with social sharing.

---

## Concept

| Traditional Review | Spotary Memo |
| :--- | :--- |
| Public, anonymous | Personal, authored |
| Star rating focused | Vibe + memory focused |
| Often negative | Journal/diary tone |
| Spam-prone | Visibility-controlled |

---

## Data Model

### Memo
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `user_id` | UUID FK → users | Author (CASCADE delete) |
| `place_id` | UUID FK → places | Linked place (CASCADE delete) |
| `content` | Text | Journal entry text |
| `images` | Array[String] | Photo URLs |
| `visit_date` | DateTime | When the user visited |
| `visibility` | Enum | `PUBLIC`, `FOLLOWERS`, `PRIVATE` |
| `rating` | Integer (1-5) | **Hidden** rating for AI personalization |
| `created_at` | DateTime | Auto |
| `updated_at` | DateTime | Auto |

### MemoVisibility Enum
```python
class MemoVisibility(str, Enum):
    PUBLIC = "public"       # Visible on Place Detail, anyone can see
    FOLLOWERS = "followers" # Only followers see on their feed
    PRIVATE = "private"     # Only the author sees (Diary mode)
```

---

## Planned API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/memos` | JWT | Create memo |
| GET | `/api/places/{id}/memos` | Public | Public memos for a place |
| GET | `/api/users/me/memos` | JWT | User's own memos (all visibility) |
| GET | `/api/feed/memos` | JWT | Memos from followed users |
| PUT | `/api/memos/{id}` | JWT (owner) | Edit memo |
| DELETE | `/api/memos/{id}` | JWT (owner) | Delete memo |

### `POST /api/memos`

```json
{
  "place_id": "uuid",
  "content": "Lần đầu tới đây, cà phê ngon, view đẹp, nhạc jazz nhẹ nhàng. Must-try: Egg coffee.",
  "images": ["uploaded-image-url"],
  "visit_date": "2026-02-10",
  "visibility": "public",
  "rating": 4
}
```

### `GET /api/places/{id}/memos`

Returns only `PUBLIC` memos:
```sql
WHERE place_id = :id AND visibility = 'public'
ORDER BY created_at DESC
```

### `GET /api/feed/memos`

Returns memos from followed users (visibility = `PUBLIC` or `FOLLOWERS`):
```sql
WHERE user_id IN (SELECT following_id FROM user_follows WHERE follower_id = :current_user)
  AND visibility IN ('public', 'followers')
ORDER BY created_at DESC
```

---

## Privacy Logic

Privacy is enforced at the **API query level** (not PostgreSQL RLS):

| Query Context | Visibility Filter |
| :--- | :--- |
| Place Detail Page | `visibility = 'public'` |
| Own Profile | All (no filter on visibility) |
| Follower Feed | `visibility IN ('public', 'followers')` |
| Other User's Profile | `visibility = 'public'` |

---

## Denormalization

`Place.memo_count` is updated on memo create/delete:
- `POST /api/memos` → `Place.memo_count += 1`
- `DELETE /api/memos/{id}` → `Place.memo_count -= 1`

This avoids `COUNT(*)` on the memos table for display.

---

## AI Integration

The hidden `rating` field (1-5) is used for AI personalization:
- When a user gives high ratings to "quiet, jazz" places, their `vibe_embedding` can be re-computed.
- Future: Background job that adjusts `Profile.vibe_embedding` based on memo ratings.

---

## Implementation Tasks (Phase 5.1)

- [ ] Create `src/routers/memos.py` with CRUD endpoints.
- [ ] Image upload handling for memo photos.
- [ ] Visibility filtering middleware/helper.
- [ ] Update `Place.memo_count` on create/delete.
- [ ] Feed query with follow-based filtering.
- [ ] Mount router in `api.py`.
