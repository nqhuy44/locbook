# LocBook

**LocBook** is a personal location bookmarking assistant powered by AI (Gemini) and Telegram. It allows you to save locations, extract metadata automatically, and view them in a beautiful dashboard.

## Project Architecture
- **Backend**: Python, FastAPI, Aiogram (Telegram Bot), Beanie (MongoDB ODM).
- **Frontend**: React, Vite, Vanilla CSS.
- **Database**: MongoDB.
- **AI**: Google Gemini Flash.

## Quick Start (Local)

1.  **Prerequisites**: Python 3.10+, Node.js 18+, Docker.

2.  **Environment Setup**:
    Copy `.env.example` to `.env` (if available) or create one with:
    - `API_ID`, `API_HASH`, `BOT_TOKEN` (Telegram)
    - `GEMINI_API_KEY`
    - `MONGO_URI` (default: `mongodb://localhost:27017`)
    - `OWNER_ID` (Your Telegram ID)

3.  **Makefile Commands**:
    The project uses a `Makefile` for common operations.

    | Command | Description |
    | :--- | :--- |
    | `make setup` | Create venv and install Python reqs |
    | `make db-up` | Start MongoDB via Docker |
    | `make run` | Run Backend (Bot + API) locally |
    | `make fe-setup` | Install Frontend dependencies |
    | `make fe-run` | Run Frontend dev server |
    | `make clean` | Clean up venv and cache |

4.  **Running Full Stack**:
    Terminal 1:
    ```bash
    make db-up
    make run
    ```
    Terminal 2:
    ```bash
    make fe-run
    ```

## Operations & Deployment

### Building Docker Images
Use the included script query to build and push images (Docker Hub).

```bash
# Syntax: ./build_push.sh <target> <tag>

# Build Backend only
./build_push.sh be v1.0

# Build Frontend only
./build_push.sh fe v1.0
```

### Database Operations
Scripts are provided for database management in the root directory.

- **Backup**:
  ```bash
  ./backup_db.sh
  # Creates a timestamped dump in ./backups/
  ```

- **Restore**:
  ```bash
  ./restore_db.sh <backup_file_path>
  # Restores a specific dump to the MongoDB container
  ```

### Docker Compose
To run the full stack (including compiled Frontend behind Nginx) via Docker:

```bash
docker compose up -d
```
*Make sure to uncomment the dashboard service in `docker-compose.yml` if you want to run the FE container.*
