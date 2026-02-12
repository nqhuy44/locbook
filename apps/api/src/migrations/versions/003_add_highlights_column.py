"""Migration 003: Add highlights column to places table."""
from sqlalchemy import text


async def upgrade(conn):
    await conn.execute(text(
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS highlights VARCHAR[]"
    ))
