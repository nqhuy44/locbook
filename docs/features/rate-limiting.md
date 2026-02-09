# Technique: Rate Limiting

## 1. Overview
To protect the LLM and Database from abuse (and to manage API costs), LocBook implements a sliding window rate limiter.

## 2. Architecture
- **Module**: `apps/api/src/core/rate_limiter.py`
- **Storage**: In-memory `collections.deque` (for MVP).

## 3. Logic (`Sliding Window`)
- **Key**: User ID (from Telegram or IP).
- **Window**: 60 seconds.
- **Limit**: 5 requests per minute.

1. **Request**: User sends a specific message/command.
2. **Check**:
    - Retrieve timestamps of user's recent requests.
    - Remove timestamps older than 60s.
    - If count < limit: **ALLOW** and record new timestamp.
    - Else: **BLOCK**.
3. **Response**: If blocked, the request is ignored or rejected with a warning log.

## 4. Scalability 
Current in-memory solution is single-instance only. For multi-worker deployment, this should be migrated to Redis.
