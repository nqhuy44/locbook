# Feature: AI Chat — Marin 🎀

> **PRD Reference**: FR-08 (Search), Section 4.1 (Chat)
> **Status**: ✅ Working
> **Source**: `src/core/chat_service.py`, `src/core/llm.py`

---

## Overview

**Marin** is LocBook's AI conversational agent — a friendly, knowledgeable local guide for Ho Chi Minh City. Users chat naturally in Vietnamese, and Marin responds with place recommendations drawn from the LocBook database (RAG — Retrieval Augmented Generation).

---

## Architecture

```
User Message
    ↓
ChatService.handle_message()
    ├── 1. Guardrail Check (length, links, spam)
    ├── 2. Load Dynamic Config (AppConfig.MARIN)
    ├── 3. Extract Search Intent (LLM → JSON)
    ├── 4. Vector Search (pgvector)
    ├── 5. Build RAG Prompt (history + results + system instruction)
    ├── 6. Call LLM (Gemini)
    └── 7. Save to ChatSession
    ↓
Response: { reply, session_id, suggested_places[] }
```

---

## API Endpoint

### `POST /api/chat`

**Request**:
```json
{
  "session_id": "abc-123",  // null for new session
  "message": "Có quán nào view đẹp không?"
}
```

**Response**:
```json
{
  "session_id": "abc-123",
  "reply": "Marin biết mấy quán view chill lắm nè! 🌃\n\n📍 **Có sẵn trên LocBook**:\n1. **Chill Skybar** — Rooftop view...",
  "suggested_places": [
    { "id": "uuid", "name": "Chill Skybar", "address": "...", ... }
  ]
}
```

---

## Feature Details

### 1. Guardrail System

Before processing, messages are checked:

| Check | Threshold | Response |
| :--- | :--- | :--- |
| Too long | > 500 chars | "Tin nhắn dài quá, tóm tắt giúp mình nhé!" |
| Too short | < 2 chars | "..." |
| Contains URL | Any URL | "Mình không xem được link, gửi text thôi nhé!" |

### 2. Intent Extraction

Marin uses LLM to understand user intent from chat history + new message:

**Input**: Last 3 messages + current message.
**Output** (JSON):
```json
{
  "query": "rooftop bar with city view",
  "filters": {
    "district": "District 1",
    "city": "Ho Chi Minh City",
    "category": "Bar"
  }
}
```

### 3. RAG Search

1. Query embedding generated from extracted `query`.
2. pgvector cosine distance search on `Place.embedding`.
3. Top 5 results returned with: Name, Address, Vibes, Rating.

### 4. Response Generation

LLM prompt structure:
```
You are {avatar_name}, LocBook's AI Scout.
{system_instruction}
Language: Vietnamese.

Search Intent: "{user_message}"
Target Category: "{extracted_category}"

Context from History: ...
LocBook Database Matches: ...

Instructions:
- SECTION 1: 📍 Có sẵn trên LocBook (matched places)
- SECTION 2: ✨ Gợi ý thêm từ Marin (external suggestions)
- Tone: Friendly, local expert.
```

### 5. Session Management

- Sessions stored in `chat_sessions` table (PostgreSQL).
- `session_id` — string identifier (cookie/public ID).
- `messages` — JSONB array of `{ role, content, timestamp }`.
- `seen_place_ids` — tracks which places have been shown to avoid repetition.

---

## Dynamic Configuration

Marin's behavior is controlled via `AppConfig` (key: `"global"`, field: `MARIN`):

```json
{
  "AVATAR_NAME": "Marin 🎀",
  "AVATAR_IMAGE": "",
  "SYSTEM_INSTRUCTION": "You are Marin, an AI local guide for HCMC...",
  "CATEGORY_SYNONYMS": {
    "Restaurant": ["nhà hàng", "quán ăn"],
    "Bar": ["bar", "cocktail", "lounge"],
    "Cafe & Coffee": ["cafe", "coffee", "tea"],
    "Casual": ["casual", "street", "local"]
  },
  "PROMPT_CATEGORY_MAPPING": {
    "nhậu": "Pub",
    "ăn tối": "Restaurant",
    "cafe": "Cafe"
  }
}
```

Admins can update this config via `PUT /api/config` to tune Marin's personality, category logic, and prompt without code changes.

---

## LLM Service (`src/core/llm.py`)

### Supported Backends

| Service | Class | Config |
| :--- | :--- | :--- |
| Google Gemini | `GeminiService` | `AI_MODE=gemini`, `GEMINI_API_KEY` |
| Local LLM (Ollama) | `LocalLLMService` | `AI_MODE=local`, `LOCAL_MODEL_URL` |

### Key Methods

| Method | Purpose |
| :--- | :--- |
| `analyze_image(image_data, prompt)` | Screenshot analysis |
| `analyze_text(text, prompt)` | Text-based analysis |
| `analyze_place_complex(text, images)` | Combined analysis (link parsing) |
| `generate_response(place_data)` | Generate Marin commentary |
| `analyze_search_query(query)` | Extract structured filters |

---

## Future Enhancements (PRD 2.0)

- [ ] **User-linked Sessions**: Associate `ChatSession.user_id` with authenticated user.
- [ ] **Access Control**: Require login to use "Ask Marin" (FR-18).
- [ ] **Richer RAG**: Include menu items in search context.
- [ ] **Conversation Title**: Auto-generate `ChatSession.title` from first message.
