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
    APP_VERSION: str = "0.3.3"

    # AI Config
    AI_MODE: str = "gemini" # gemini or local
    LOCAL_MODEL_URL: str = "http://localhost:11434/api/generate" # Ollama default
    LOCAL_MODEL_NAME: str = "llama3.2-vision"
    
    # Feature Flags
    FEAT_SCREENSHOT_ANALYSIS: bool = False # Enable/Disable Screenshot Analysis
    FEAT_IMAGE_ANALYSIS: bool = False
    FEAT_PLACE_SEARCH: bool = True # Enable/Disable Local DB Search
    FEAT_GEO_SEARCH: bool = True # Enable/Disable Contextual Geo-Search
    MAX_REVIEWS_FOR_AI: int = 5 # Limit reviews to save tokens
    ENABLE_BOT: bool = True # Enable/Disable Telegram Bot Logic
    
    MONGO_URI: str = "mongodb://localhost:27018"
    MONGO_DB_NAME: str = "locbook"
    ADMIN_SECRET: str | None = None

    MAX_MESSAGE_AGE_SECONDS: int = 60 # Ignore messages older than 2 minutes by default
    RATE_LIMIT_PER_MINUTE: int = 5 # Max 5 requests per minute per user

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, env_file_encoding="utf-8")

@lru_cache
def get_settings():
    return Settings()
