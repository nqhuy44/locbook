# Feature: Semantic Search & Discovery

> **PRD Reference**: FR-08, FR-12
> **Status**: ✅ Working (Basic), 🔧 Enhancements planned
> **Source**: `src/routers/discovery.py`, `src/core/ai.py`, `src/core/vector_store.py`

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

### Search Pipeline

```
User Query: "quiet place for coding"
    ↓
Gemini Embedding API → query_vector (768d)
    ↓
PostgreSQL: ORDER BY embedding <=> query_vector (cosine distance)
    ↓
Top N results returned
```

---

## Current Endpoints

### 1. Discovery (Authenticated)

**`GET /api/discovery/places`** — Personalized results based on user's vibe profile.

| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | int | 20 | Results per page |
| `offset` | int | 0 | Pagination |

**Logic**:
1. Fetch user's `Profile.vibe_embedding`.
2. If embedding exists → sort by `Place.embedding.cosine_distance(user_embedding)`.
3. If no embedding → fallback to `ORDER BY created_at DESC`.

### 2. Text Search (Public)

**`GET /api/places?search=...`** — Keyword-based search across text fields.

Uses `ILIKE` matching on: `name`, `address`, `categories`, `vibes`.

### 3. Chat Search (Public)

**`POST /api/chat`** — Natural language search via Marin AI.

1. User message goes through intent extraction (LLM).
2. Query embedding generated.
3. pgvector cosine distance search.
4. Results fed to LLM as RAG context.
5. Marin responds with recommendations.

---

## Technical Details

### pgvector Configuration

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Column definition
embedding VECTOR(768)

-- Index (recommended for > 1000 rows)
CREATE INDEX ON places USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
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

| Operator | Name | Usage |
| :--- | :--- | :--- |
| `<=>` | Cosine Distance | Best for text embeddings |
| `<->` | L2 (Euclidean) | Alternative |
| `<#>` | Inner Product | For normalized vectors |

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

## Future Enhancements (PRD 2.0)

### Hybrid Search (Phase 2)
- [ ] Combine vector similarity with keyword matching (menu items, specific names).
- [ ] Implement `ts_rank` full-text search alongside pgvector distance.

### Sort Modes (Phase 3)
- [ ] "Best Match" — cosine distance to user vibe.
- [ ] "Most Popular" — `ORDER BY upvote_count DESC`.
- [ ] "Trending" — upvotes in last 7 days.
- [ ] "Nearest" — PostGIS distance from user location.

### AI Query Understanding (Phase 2)
- [ ] Use `analyze_search_query()` in `llm.py` to extract structured filters from natural language.
- [ ] Example: "cheap pub near District 1" → `{ category: "Pub", price: "$", district: "District 1" }`.
