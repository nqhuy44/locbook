# Feature: Social Graph (Follow System)

> **PRD Reference**: FR-17
> **Status**: 🆕 Schema defined, API not yet implemented
> **Source**: `src/database/sql_models.py` (model only)

---

## Overview

The **Social Graph** enables users to follow each other, creating a network of trusted connections. This powers social features like "Friends who've been here" on Place Detail pages and the follower-based Memo feed.

---

## Data Model

### UserFollow (Link Table)
| Column | Type | Description |
| :--- | :--- | :--- |
| `follower_id` | UUID PK, FK → users | The user who follows |
| `following_id` | UUID PK, FK → users | The user being followed |
| `created_at` | DateTime | Auto |

**Composite Primary Key**: `(follower_id, following_id)` — prevents duplicate follows.

---

## Planned API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/users/{id}/follow` | JWT | Follow a user |
| DELETE | `/api/users/{id}/follow` | JWT | Unfollow a user |
| GET | `/api/users/{id}/followers` | Public | List followers |
| GET | `/api/users/{id}/following` | Public | List following |
| GET | `/api/users/me/feed` | JWT | Activity feed |

### `POST /api/users/{id}/follow`

- Validates target user exists.
- Prevents self-follow.
- Idempotent (if already following, return success).

### `GET /api/users/{id}/followers`

```json
{
  "count": 12,
  "users": [
    { "id": "uuid", "display_name": "Huy", "avatar_url": "..." }
  ]
}
```

---

## Social Features Powered by Graph

### 1. "Friends who've been here"

On Place Detail page, show avatars of followed users who have written a public Memo for this place:

```sql
SELECT DISTINCT u.id, p.display_name, p.avatar_url
FROM memos m
JOIN users u ON m.user_id = u.id
JOIN profiles p ON p.user_id = u.id
WHERE m.place_id = :place_id
  AND m.visibility = 'public'
  AND m.user_id IN (
    SELECT following_id FROM user_follows WHERE follower_id = :current_user
  )
```

### 2. Activity Feed

Show recent actions from followed users:
- "X upvoted Y"
- "X wrote a memo for Z"
- "X added Y to collection W"

```sql
-- Recent interactions from followed users
SELECT i.*, u.display_name, pl.name as place_name
FROM interactions i
JOIN users u ON i.user_id = u.id
JOIN places pl ON i.place_id = pl.id
WHERE i.user_id IN (
    SELECT following_id FROM user_follows WHERE follower_id = :current_user
)
ORDER BY i.created_at DESC
LIMIT 20
```

### 3. Memo Feed

See Memos from followed users (visibility = `public` or `followers`):
- Covered in [08-memo-system.md](./08-memo-system.md).

---

## Implementation Tasks (Phase 5.3)

- [ ] Create `src/routers/social.py` with follow/unfollow/list endpoints.
- [ ] "Friends who've been here" query helper.
- [ ] Activity feed aggregation query.
- [ ] Mount router in `api.py`.
- [ ] Frontend: Follow button on user profiles.
- [ ] Frontend: "Friends" avatars on Place Detail.
- [ ] Frontend: Feed page showing social activity.
