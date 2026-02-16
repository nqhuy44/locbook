# Database Architecture & Migration System

> **Status**: Custom SQLModel-based Migration System (No Alembic)
> **Driver**: `asyncpg` via `SQLModel` / `SQLAlchemy`
> **Extension**: `pgvector` (Vectors), `postgis` (Location)

---

## Overview

Spotary uses a hybrid approach to database management:
1.  **SQLModel** defines the current schema (Python-first).
2.  **`create_all()`** is used for initial setup (Development/Testing).
3.  **Custom Migrations** (`src/scripts/run_migrations.py`) are used for incremental updates (Production/Staging).

## ORM Strategy (SQLModel)

We use **SQLModel** because it combines Pydantic validation with SQLAlchemy's ORM capabilities.

-   **Models**: Defined in `src/core/database/sql_models.py`.
-   **Async**: All DB operations are async using `AsyncSession`.
-   **Advanced Types**:
    -   `Vector(768)`: For embeddings (via `pgvector`).
    -   `Geometry("POINT")`: For geospatial queries (via `geoalchemy2` / PostGIS).
    -   `JSONB`: For flexible data (`menu`, `preferences`).
    -   `ARRAY`: For tags (`vibes`, `categories`).

## Migration System

We opted for a lightweight, custom migration runner instead of Alembic to reduce complexity and dependency overhead, reusing the existing `SQLModel` connection.

### Components

1.  **Migration Runner**: `src/scripts/run_migrations.py`
    -   Scans `src/migrations/versions/*.py`.
    -   Checks `migration_history` table in DB.
    -   RUNS `upgrade(conn)` function in a transaction.
    -   UPDATES `migration_history` if successful.

2.  **Migration Files**: `src/migrations/versions/`
    -   Format: `{version}_{description}.py` (e.g., `001_add_mood_column.py`).
    -   Must contain `async def upgrade(conn):`.
    -   Should use `IF NOT EXISTS` for safety.

### Workflow

1.  **Development**:
    -   Modify `sql_models.py`.
    -   If new table: `manage_db.py --init` (or app restart) handles it.
    -   If altering column: Create a new migration file in `versions/`.

2.  **Production**:
    -   Run `nx run api:migrate` before deploying new code.
    -   Start the application.

### Example Migration

```python
# 002_add_new_column.py
from sqlalchemy import text

async def upgrade(conn):
    # Safe alteration
    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;"))
```

## Schema Management Policy

-   **Atomicity**: Migrations run in a single transaction. If the script fails, the DB rolls back.
-   **Idempotency**: Scripts should be written to be idempotent (e.g., check for existence) where possible, though the runner also tracks versions to prevent double-execution.
-   **Backup**: Always backup `postgresdb` volume before running migrations in production.

---

## Why this approach?

-   **Simplicity**: No need to manage Alembic's `env.py`, `versions/` auto-generation, or revision ID clashes.
-   **Control**: Full control over the raw SQL/DDL executed during migration.
-   **Async Native**: Built from the ground up to work with our `asyncpg` engine.
