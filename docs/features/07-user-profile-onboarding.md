# Feature: User Profile & Onboarding

> **PRD Reference**: FR-06, FR-07
> **Status**: ✅ Working
> **Source**: `src/routers/users.py`, `src/routers/onboarding.py`

---

## Overview

Every user has a **Profile** containing their identity info (display name, avatar, bio) and their **Vibe Embedding** — a 768-dimensional vector that represents their taste preferences. This embedding powers personalized search results via pgvector cosine similarity.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/users/me` | JWT | Get current user + profile |
| PUT | `/api/users/me/profile` | JWT | Update profile |
| POST | `/api/onboarding/submit` | JWT | Submit vibe quiz |

### `GET /api/users/me`

Returns user info with eager-loaded profile:
```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "role": "user",
  "profile": {
    "display_name": "Huy",
    "avatar_url": "https://...",
    "bio": "Coffee lover",
    "preferences": { "tags": ["quiet", "jazz"] }
  }
}
```

### `PUT /api/users/me/profile`

**Request**:
```json
{
  "display_name": "Huy Nguyen",
  "bio": "Saigon cafe explorer"
}
```

Creates profile if it doesn't exist, then updates fields.

### `POST /api/onboarding/submit`

**Request**:
```json
{
  "selected_vibes": ["Quiet", "Cozy", "Jazz", "Vintage"],
  "selected_categories": ["Cafe", "Library", "Bookstore"],
  "additional_context": "I like places where I can read and work"
}
```

**Process**:
1. Concatenate selections into descriptive text.
2. Generate 768d embedding via Gemini `text-embedding-004`.
3. Store in `Profile.vibe_embedding`.
4. Save quiz results in `Profile.preferences`.

---

## Data Model

### Profile
| Column | Type | Description |
| :--- | :--- | :--- |
| `user_id` | UUID PK, FK → users | One-to-one with User |
| `display_name` | String | Nullable |
| `avatar_url` | String | From Google or uploaded |
| `bio` | Text | Free-form bio |
| `vibe_embedding` | Vector(768) | Personalization vector |
| `preferences` | JSONB | Tags, quiz results, settings |

### Preferences Schema (JSONB)
```json
{
  "tags": ["quiet", "jazz", "vintage"],
  "onboarding_quiz": {
    "selected_vibes": ["Quiet", "Cozy"],
    "selected_categories": ["Cafe"],
    "additional_context": "..."
  }
}
```

---

## Personalization Flow

```
User → Onboarding Quiz → Vibe Embedding generated
                              ↓
                    Profile.vibe_embedding stored
                              ↓
Discovery API → cosine_distance(Place.embedding, user_embedding)
                              ↓
                    Personalized results ranked
```

---

## Future Enhancements (PRD 2.0)

### Phase 1.3 — Profile Polish
- [ ] **Preferences Update API**: Dedicated endpoint to update `preferences.tags` (favorite vibes).
- [ ] **Re-generate Embedding**: When preferences change, re-compute `vibe_embedding`.
- [ ] **Avatar Upload**: Allow users to upload custom avatar (not just Google's).

### Phase 4 — UX
- [ ] **Profile Page UI**: Display name, bio, stats (memos written, upvotes given).
- [ ] **Public Profile**: `/users/{id}` — view another user's public profile and memos.
