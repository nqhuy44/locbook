# System Flows

> **Last Updated**: 2026-02-19

---

## 1. Marin Chat Flow (One-Pass Tool Use)

```mermaid
sequenceDiagram
    participant U as User
    participant CS as ChatService
    participant G as Gemini API
    participant DB as PostgreSQL

    U->>CS: POST /api/chat { message }

    Note over CS: Load config + session
    CS->>DB: Fetch ChatSession, AppConfig
    DB-->>CS: session (messages, summary)

    CS->>DB: Fetch UserMemory
    DB-->>CS: preference memories

    Note over CS: Build context layers
    CS->>CS: _build_context_prompt()
    Note right of CS: 1. User Preferences (memory)<br/>2. Session Summary (condensed)<br/>3. Recent 5 messages (raw)<br/>4. Current message

    CS->>G: Turn 1: contents + tools + system_instruction

    alt Tool Call Required
        G-->>CS: function_call: search_places({query, vibe, district})
        CS->>DB: Hybrid Search (Semantic + FTS + RRF)
        DB-->>CS: Ranked places
        CS->>G: Turn 2: FunctionResponse(results)
        G-->>CS: Final synthesized reply
    else No Tool Needed
        G-->>CS: Direct text reply
    end

    Note over CS: Post-processing
    CS->>CS: _maybe_condense_history()
    CS->>DB: Save messages + summary
    CS-->>U: { reply, suggested_places }
```

---

## 2. Hybrid Search Flow

```mermaid
flowchart TB
    Q["User Query"] --> EMB["Generate Embedding (Gemini)"]
    Q --> TSQ["plainto_tsquery('simple', query)"]

    EMB --> SEM["Semantic Search<br/>pgvector cosine distance<br/>Top 20 candidates"]
    TSQ --> KW["Keyword Search<br/>ts_rank(search_text, tsquery)<br/>Top 20 candidates"]

    SEM --> RRF["Reciprocal Rank Fusion<br/>score = 1/(60+rank_sem) + 1/(60+rank_kw)"]
    KW --> RRF

    RRF --> TOP["Top 5 Results"]

    style RRF fill:#2d5a3d,stroke:#4ade80
    style SEM fill:#1e3a5f,stroke:#60a5fa
    style KW fill:#5a2d2d,stroke:#f87171
```

---

## 3. Place Ingestion Flow

```mermaid
sequenceDiagram
    participant U as User (Telegram)
    participant W as ARQ Worker
    participant P as Parser
    participant AI as Gemini API
    participant Q as Quality Pipeline
    participant DB as PostgreSQL

    U->>W: Google Maps URL
    W->>P: fetch_place_info(url)
    P-->>W: raw_info (text, images, API data)

    Note over W: Deduplication check
    W->>DB: ST_DWithin(50m) + name fuzzy match

    alt New Place
        W->>AI: analyze_place(text, images)
        AI-->>W: structured data + marin_comment
        W->>Q: on_place_save(place)
        Note over Q: 1. sync_location()<br/>2. regenerate_embedding()<br/>3. sync_search_text()
        Q-->>W: enriched place
        W->>DB: INSERT place
    else Duplicate Found
        DB-->>W: existing place
    end

    W-->>U: Place card response
```

---

## 4. Memory Condensation Flow

```mermaid
flowchart LR
    MSG["Session Messages > 10"] --> SPLIT["Split"]
    SPLIT --> OLD["Old messages (before last 5)"]
    SPLIT --> RECENT["Recent 5 messages"]

    OLD --> SUM["LLM Summarize"]
    SUM --> SAVE["Store as session.summary"]

    RECENT --> KEEP["Keep as raw messages"]

    SAVE --> CTX["Next request context"]
    KEEP --> CTX

    style SUM fill:#2d5a3d,stroke:#4ade80
```
