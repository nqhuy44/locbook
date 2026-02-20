from sqlalchemy import text


async def upgrade(conn):
    """Add search_text tsvector to places + summary to chat_sessions.
    
    Part of Marin v2 enhancement:
    - search_text: enables Hybrid Search (Semantic + Keyword via FTS)
    - summary: enables Condensed Memory (LLM-summarized older messages)
    """
    # 1. Add search_text tsvector column to places
    await conn.execute(text("""
        ALTER TABLE places 
        ADD COLUMN IF NOT EXISTS search_text tsvector;
    """))

    # 2. Create GIN index for fast FTS queries
    await conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_places_search_text_gin 
        ON places USING gin(search_text);
    """))

    # 3. Backfill existing rows with concatenated text
    await conn.execute(text("""
        UPDATE places 
        SET search_text = to_tsvector(
            'simple',
            coalesce(name, '') || ' ' ||
            coalesce(address, '') || ' ' ||
            coalesce(district, '') || ' ' ||
            coalesce(ward, '') || ' ' ||
            coalesce(street, '') || ' ' ||
            coalesce(array_to_string(categories, ' '), '') || ' ' ||
            coalesce(array_to_string(vibes, ' '), '') || ' ' ||
            coalesce(array_to_string(mood, ' '), '')
        )
        WHERE search_text IS NULL;
    """))

    # 4. Add summary column to chat_sessions
    await conn.execute(text("""
        ALTER TABLE chat_sessions 
        ADD COLUMN IF NOT EXISTS summary text;
    """))
