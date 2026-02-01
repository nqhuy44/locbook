# LocBook Backend (Source)

This directory contains the Python/FastAPI source code for LocBook.

## Structure
- `api.py`: FastAPI application endpoints (`/api/places`, `/api/stats`).
- `main.py`: Entry point running both the Telegram Bot and FastAPI (via lifespan).
- `bot/`: Telegram bot handlers and logic.
- `core/`: Core settings, database logic, and LLM integration.
- `models/`: Beanie/MongoDB ODMs.

## Development

1.  **Environment**:
    Ensure you have a `.env` file in the root directory (see root README).

2.  **Run Locally**:
    Use the root Makefile:
    ```bash
    make run
    # OR directly
    python -m src.main
    ```

## Docker

The root `Dockerfile` builds this backend service:

```bash
docker build -t nqh44/locbook:latest ..
```
(Context is usually the project root).
