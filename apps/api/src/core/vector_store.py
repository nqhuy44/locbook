import logging
from typing import List
from google import genai
from google.genai import types
from src.config import get_settings

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        self.settings = get_settings()
        if self.settings.GEMINI_API_KEY:
            self.genai_client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
        else:
            self.genai_client = None

    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding using Gemini"""
        if not self.genai_client: return []
        
        try:
            result = self.genai_client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    title="Place Embedding"
                )
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

    # Other methods (add_place, search) - REMOVED as we use Postgres now.

vector_store = VectorStore()

