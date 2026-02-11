import os
import asyncio
from google import genai
from src.core.config import get_settings

async def list_models():
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    print("Listing models...")
    # The client might differ in how to list models depending on version
    # The client might differ depending on SDK version (google-genai vs google-generativeai)
    
    # If it is the google-genai package:
    try:
        # Pager object
        pager = client.models.list() 
        for model in pager:
            print(f"Model: {model.name}")
            print(f"  Supported methods: {model.supported_generation_methods}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
