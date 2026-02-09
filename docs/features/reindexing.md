# Feature: Vector Re-indexing

## 1. Overview
Re-indexing is the process of synchronizing the primary MongoDB database with the ChromaDB vector store. This ensures that new or updated places are discoverable via semantic search.

## 2. Architecture
- **Script**: `apps/api/src/scripts/reindex_vectors.py`
- **Trigger**: 
    - Manual API call: `POST /api/reindex`
    - CLI Command: `npm run release ...` (optional step) or direct `python` execution.

## 3. Logic Flow
1. **Fetch**: Retrieve ALL places from MongoDB.
2. **Process**: For each place:
    - Construct a text representation (Name + Description + Vibe + Category).
    - Checks if embedding already exists (optimization).
3. **Embed**: Send text to Google Gemini Embedding API (`models/gemini-embedding-001`).
4. **Store**: Save vector + metadata (ID, Name) to ChromaDB.
5. **Collection Swap**: (Optional) Use a temporary collection and swap for zero downtime (currently direct update).

## 4. Considerations
- **Cost**: Embedding generation costs tokens.
- **Latency**: Can take minutes for large datasets.
- **Consistency**: Search results may be stale until re-indexing completes.
