# Feature: AI Matchmaker (RAG)

## 1. Overview
The core of LocBook is its AI-powered matchmaker, which allows users to find places using natural language. It uses a Retrieval-Augmented Generation (RAG) pipeline to combine the semantic understanding of LLMs with a structured database of local places.

## 2. Architecture
- **Service**: `apps/api/src/core/chat_service.py`
- **LLM**: Google Gemini (via `google-genai` SDK)
- **Vector DB**: ChromaDB
- **Embedding Model**: `models/gemini-embedding-001`

## 3. Logic Flow
1. **User Input**: User sends a message (e.g., "Find a quiet cafe for working").
2. **Guardrails**: Basic text filters check for inappropriate content.
3. **Intent Extraction**:
    - The LLM analyzes the user's message + conversation history.
    - Extracts a structured search intent:
      ```json
      {
        "query": "quiet cafe work",
        "filters": { "category": "Cafe", "vibe": "Quiet" }
      }
      ```
4. **Vector Search**:
    - The extracted query is embedded using `gemini-embedding-001`.
    - ChromaDB finds the nearest neighbors (places) based on vector similarity.
5. **Context Construction**:
    - The top matching places are formatted into a text context.
6. **Response Generation**:
    - The LLM generates a friendly response using the retrieved context, citing specific places.
7. **Response**: The final text and structured place data are sent back to the user.

## 4. Key Components
- **`ChatService`**: Main orchestrator.
- **`_extract_search_intent`**: LLM prompt to convert text to search parameters.
- **`vector_store.search`**: Interface to ChromaDB.
