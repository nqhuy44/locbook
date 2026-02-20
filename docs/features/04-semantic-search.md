# Feature: Semantic Search & Discovery

> **PRD Reference**: FR-08, FR-12  
> **Status**: ✅ Working (Hybrid Search — Semantic + Keyword)  
> **Source**: `src/modules/places/service.py`, `src/core/ai.py`, `src/modules/places/quality.py`

---

## Overview

Spotary uses **pgvector** for semantic (vector similarity) search, enabling users to find places by "vibe" and "mood" rather than exact keywords. When a user types "cozy cafe for working late at night," the system understands the intent and returns the most atmospherically relevant places.

---

## How It Works

### Embedding Pipeline

```
Place Data (name, vibes, mood, categories, address)
    ↓ Concatenated into text
Gemini Embedding API (text-embedding-004, 768 dimensions)
    ↓
Vector stored in Place.embedding (pgvector column)
```

### Search Pipeline (Hybrid — RRF)

```
User Query: "quiet place for coding"
    ↓ (parallel)
    ├── Gemini Embedding API → query_vector (3072d)
    │   └── pgvector: ORDER BY embedding <=> query_vector → semantic_rank
    │
    └── plainto_tsquery('simple', query)
        └── Postgres FTS: ts_rank(search_text, tsquery) → keyword_rank
    ↓
    Reciprocal Rank Fusion: score = 1/(60+semantic_rank) + 1/(60+keyword_rank)
    ↓
    Top N results returned
```

---

## Current Endpoints

### 1. Discovery (Authenticated)

**`GET /api/discovery/places`** — Personalized results based on user's vibe profile.

| Param    | Type | Default | Description      |
| :------- | :--- | :------ | :--------------- |
| `limit`  | int  | 20      | Results per page |
| `offset` | int  | 0       | Pagination       |

**Logic**:

1. Fetch user's `Profile.vibe_embedding`.
2. If embedding exists → sort by `Place.embedding.cosine_distance(user_embedding)`.
3. If no embedding → fallback to `ORDER BY created_at DESC`.

### 2. Text Search (Public)

**`GET /api/places?search=...`** — Keyword-based search across text fields.

Uses `ILIKE` matching on: `name`, `address`, `categories`, `vibes`.

### 3. Chat Search (Public)

**`POST /api/chat`** — Natural language search via Marin AI.

1. User message processed by Gemini with Function Calling.
2. Gemini autonomously decides to call `search_places` tool.
3. Hybrid search executed (Semantic + FTS + RRF).
4. `FunctionResponse` with results sent back to Gemini.
5. Marin synthesizes a friendly response with recommendations.

See [05-ai-chat-marin.md](./05-ai-chat-marin.md) for details.

---

## Technical Details

### pgvector Configuration

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector column (3072d for gemini-embedding-001)
embedding VECTOR(3072)

-- tsvector column for Full-Text Search
search_text TSVECTOR

-- Indexes
CREATE INDEX ON places USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON places USING gin(search_text);
```

### Embedding Generation (`src/core/ai.py`)

```python
def get_text_embedding(text: str) -> list[float]:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    result = client.models.embed_content(
        model="text-embedding-004",
        contents=text
    )
    return result.embeddings[0].values  # 768-dimensional vector
```

### Distance Operators

| Operator | Name            | Usage                    |
| :------- | :-------------- | :----------------------- |
| `<=>`    | Cosine Distance | Best for text embeddings |
| `<->`    | L2 (Euclidean)  | Alternative              |
| `<#>`    | Inner Product   | For normalized vectors   |

Spotary uses **cosine distance** (`<=>`) as the default.

---

## Personalization (Onboarding)

### Vibe Quiz Flow

**`POST /api/onboarding/submit`**

```json
{
  "selected_vibes": ["Quiet", "Cozy", "Jazz"],
  "selected_categories": ["Cafe", "Library"],
  "additional_context": "I like places where I can work on my laptop"
}
```

**Process**:

1. Concatenate selections into descriptive text.
2. Generate embedding via Gemini.
3. Store as `Profile.vibe_embedding`.
4. All future discovery results are re-ranked by this vector.

---

## Future Enhancements

### Hybrid Search Refinements

- [x] ~~Combine vector similarity with keyword matching~~ ✅ Implemented (RRF)
- [x] ~~Implement `ts_rank` full-text search alongside pgvector distance~~ ✅ Implemented
- [ ] Tune RRF k-constant based on real usage data
- [ ] Add weighted RRF (boost keyword for exact name matches)

### Sort Modes (Phase 3)

- [ ] "Best Match" — cosine distance to user vibe.
- [ ] "Most Popular" — `ORDER BY upvote_count DESC`.
- [ ] "Trending" — upvotes in last 7 days.
- [ ] "Nearest" — PostGIS distance from user location.

### AI Query Understanding

- [x] ~~Use tool calling for structured filter extraction~~ ✅ Implemented via Gemini Function Calling
- [ ] Multi-tool support (search + map + menu lookup)
