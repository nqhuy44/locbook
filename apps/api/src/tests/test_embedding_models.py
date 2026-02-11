
import asyncio
import os
from google import genai
from google.genai import types
from src.core.config import get_settings

async def test_models():
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        print("No API Key found")
        return

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    candidates = [
        "text-embedding-004",
        "models/text-embedding-004",
        "embedding-001",
        "models/embedding-001",
        "text-embedding-004-v1", # Just guessing
        "models/text-embedding-004-v1"
    ]
    
    print(f"Testing models with API Key: {settings.GEMINI_API_KEY[:5]}...")

    for model in candidates:
        print(f"\n--- Testing model: {model} ---")
        try:
            result = client.models.embed_content(
                model=model,
                contents="Hello world",
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    title="Test"
                )
            )
            print(f"SUCCESS: {model}")
            print(f"Embedding length: {len(result.embeddings[0].values)}")
            return # Found a working one!
        except Exception as e:
            print(f"FAILED: {model}")
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_models())
