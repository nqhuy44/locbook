from sqlalchemy import text

async def upgrade(conn):
    # 1. Add ward and street columns to places if they don't exist
    # (Handling potential existing columns from previous manual attempts)
    await conn.execute(text("""
        ALTER TABLE places 
        ADD COLUMN IF NOT EXISTS ward VARCHAR,
        ADD COLUMN IF NOT EXISTS street VARCHAR;
    """))

    # 2. Create llm_usage_logs table
    # Based on src.core.database.sql_models.LLMUsageLog
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS llm_usage_logs (
            id UUID PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            request_type VARCHAR NOT NULL,
            model_name VARCHAR NOT NULL,
            prompt_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))

    # 3. Create indexes for LLM logs
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_llm_logs_user_id ON llm_usage_logs(user_id);"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_llm_logs_request_type ON llm_usage_logs(request_type);"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_llm_logs_created_at ON llm_usage_logs(created_at);"))
