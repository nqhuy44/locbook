
import os
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("No GEMINI_API_KEY found")
    exit(1)

client = genai.Client(api_key=api_key)

print("Listing models...")
try:
    for m in client.models.list():
        # SDK v2: m.name, m.supported_generation_methods (might differ in structure)
        # Just printing basic info for now as v2 model objects are different
        print(f"Name: {m.name}")
        print(f"Display Name: {m.display_name}")
        print("-" * 20)
except Exception as e:
    print(f"Error listing models: {e}")
