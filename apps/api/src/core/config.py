from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str
    GEMINI_API_KEY: str | None = None
    GOOGLE_PLACES_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # App Version
    APP_VERSION: str = "0.4.4"

    # Feature Flags
    FEAT_IMAGE_ANALYSIS: bool = False  # Fetch Google Places photos for AI analysis
    MAX_REVIEWS_FOR_AI: int = 5        # Limit reviews sent to AI to save tokens
    MAX_IMAGES_FOR_AI: int = 5         # Limit photos sent to AI for analysis + menu OCR
    ENABLE_BOT: bool = True            # Enable/Disable Telegram Bot Logic
    FEAT_AI_MATCHMAKE: bool = True     # Enable/Disable AI Matchmaker (web chat)

    POSTGRES_URL: str | None = "postgresql+asyncpg://postgres:postgres@localhost:5432/locbook"
    REDIS_URL: str = "redis://localhost:6379"
    ADMIN_SECRET: str | None = None
    
    # Auth
    SECRET_KEY: str = "your-secret-key-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # OAuth
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    MAX_MESSAGE_AGE_SECONDS: int = 60
    RATE_LIMIT_PER_MINUTE: int = 5

    # Storage
    STORAGE_MODE: str = "local"  # "local" or "s3"
    S3_BUCKET: str | None = None
    S3_ENDPOINT: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_PUBLIC_URL: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, env_file_encoding="utf-8", extra='ignore')

@lru_cache
def get_settings():
    return Settings()
