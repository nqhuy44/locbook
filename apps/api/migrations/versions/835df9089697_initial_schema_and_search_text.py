"""initial_schema_and_search_text

Revision ID: 835df9089697
Revises: 
Create Date: 2026-02-19 03:06:09.363102

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '835df9089697'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add search_text column (Idempotent)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'places' AND column_name = 'search_text'
            ) THEN
                ALTER TABLE places ADD COLUMN search_text tsvector;
            END IF;
        END $$;
    """)

    # 2. Create GIN index
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_places_search_text_gin 
        ON places USING gin(search_text);
    """)

    # 3. Add summary column to chat_sessions
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'chat_sessions' AND column_name = 'summary'
            ) THEN
                ALTER TABLE chat_sessions ADD COLUMN summary text;
            END IF;
        END $$;
    """)

    # 4. Backfill data
    op.execute("""
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
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('chat_sessions', 'summary')
    op.execute("DROP INDEX IF EXISTS idx_places_search_text_gin")
    op.drop_column('places', 'search_text')

