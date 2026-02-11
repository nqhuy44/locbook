from google import genai
from google.genai import types
from typing import List, Optional
import logging

from src.core.config import get_settings

logger = logging.getLogger(__name__)

def get_ai_client():
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        return None
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def get_text_embedding(text: str) -> Optional[List[float]]:
    client = get_ai_client()
    if not client:
        logger.warning("Gemini API Key not set. Cannot generate embedding.")
        return None
        
    try:
        result = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                title="User Vibe or Place Embedding"
            )
        )
        return result.embeddings[0].values
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return None
