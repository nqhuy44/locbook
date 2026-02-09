
import os
import subprocess
from src.config import get_settings

def list_models_curl():
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("Error: GEMINI_API_KEY not found.")
        return

    cmd = [
        "curl", 
        f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    ]
    
    print("Executing curl to list models...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("Models available:")
        print(result.stdout)
    else:
        print(f"Error executing curl: {result.stderr}")

if __name__ == "__main__":
    list_models_curl()
