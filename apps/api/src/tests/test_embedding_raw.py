
import json
import os
import urllib.request
import urllib.error
from src.core.config import get_settings

def test_raw_embedding():
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("No API Key")
        return

    models = ["text-embedding-004", "embedding-001"]
    
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
        data = {
            "content": {
                "parts": [{"text": "Hello world"}]
            },
            "model": f"models/{model}"
        }
        
        print(f"Testing {model} at {url}...")
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                print(f"SUCCESS: {model}")
                print("Response keys:", result.keys())
                break
        except urllib.error.HTTPError as e:
            print(f"FAILED: {model}")
            print(f"HTTP Error: {e.code} {e.reason}")
            print(e.read().decode('utf-8'))
        except Exception as e:
            print(f"FAILED: {model}")
            print(f"Error: {e}")

if __name__ == "__main__":
    test_raw_embedding()
