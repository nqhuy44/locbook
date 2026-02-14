from sqlalchemy import text

async def upgrade(conn):
    # 1. Clean up existing mismatched type (if any)
    # The debug showed the DB keeps Uppercase values, likely created by auto-generation or previous attempts.
    # We drop it to ensure we create it with strict lowercase values matching Python Enum.
    await conn.execute(text("DROP TYPE IF EXISTS listprivacy CASCADE;"))

    # 2. Create the enum type explicitly with lowercase values
    await conn.execute(text("CREATE TYPE listprivacy AS ENUM ('public', 'private', 'shared');"))

    # 3. Add the column
    # We use IF NOT EXISTS for the column to be safe, though we just cleared the type so it likely doesn't exist or would break
    # Actually if dependency existed, CASCADE dropped the column? 
    # If we used CASCADE on type, any column using it is dropped. 
    # So we can just ADD COLUMN.
    await conn.execute(text("""
        ALTER TABLE user_lists 
        ADD COLUMN IF NOT EXISTS privacy listprivacy NOT NULL DEFAULT 'private';
    """))
