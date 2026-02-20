-- Migration: Add search_text tsvector column + GIN index to places table
-- Purpose: Enable Postgres Full-Text Search alongside pgvector semantic search
-- Run: psql -U $DB_USER -d $DB_NAME -f scripts/migrate_search_text.sql

-- 1. Add tsvector column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'places' AND column_name = 'search_text'
    ) THEN
        ALTER TABLE places ADD COLUMN search_text tsvector;
    END IF;
END $$;

-- 2. Create GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_places_search_text_gin 
ON places USING gin(search_text);

-- 3. Backfill existing rows with concatenated text
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

-- Verify
SELECT count(*) AS total_places, 
       count(search_text) AS with_search_text 
FROM places;

-- =====================================================
-- Part B: Add summary column to chat_sessions table
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'summary'
    ) THEN
        ALTER TABLE chat_sessions ADD COLUMN summary text;
    END IF;
END $$;
