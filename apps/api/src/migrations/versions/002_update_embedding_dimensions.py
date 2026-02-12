"""Migration 002: Update embedding dimensions from 768 to 3072.

The gemini-embedding-001 model outputs 3072-dimensional embeddings,
but the DB schema was created with Vector(768).
"""
from sqlalchemy import text


async def upgrade(conn):
    # Alter places.embedding from vector(768) to vector(3072)
    await conn.execute(text(
        "ALTER TABLE places ALTER COLUMN embedding TYPE vector(3072)"
    ))
    
    # Alter profiles.vibe_embedding from vector(768) to vector(3072)
    await conn.execute(text(
        "ALTER TABLE profiles ALTER COLUMN vibe_embedding TYPE vector(3072)"
    ))
