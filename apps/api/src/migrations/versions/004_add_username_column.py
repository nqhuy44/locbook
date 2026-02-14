from sqlalchemy import text

async def upgrade(conn):
    # Add username column
    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);"))
    await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);"))
