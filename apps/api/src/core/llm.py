from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import logging
import json
import base64
import requests
import httpx
from google import genai
from google.genai import types
from src.config import get_settings
import src.core.strings as strings
from src.core.utils import to_toon

logger = logging.getLogger(__name__)

class AIService(ABC):
    @abstractmethod
    async def analyze_image(self, image_data: bytes, prompt: str = None) -> Dict[str, Any]:
        pass
        
    async def analyze_text(self, text: str, prompt: str = None) -> Dict[str, Any]:
        # Default implementation or abstract
        pass

    @abstractmethod
    async def generate_response(self, place_data: Dict[str, Any]) -> str:
        pass

    @abstractmethod
    async def analyze_place_complex(self, text_data: str, images: List[tuple[bytes, str]]) -> Dict[str, Any]:
        """
        Combined analysis of text and images to produce both structured data and commentary.
        """
        pass

class GeminiService(AIService):
    def __init__(self, api_key: str, model_name: str):
        if not api_key:
            logger.warning("GEMINI_API_KEY is not set.")
            self.client = None
            self.model_name = None
        else:
            self.client = genai.Client(api_key=api_key)
            self.model_name = model_name

    async def analyze_image(self, image_data: bytes, prompt: str = None) -> Dict[str, Any]:
        if not self.client:
            return {"error": "Gemini API Key not set."}
            
        if not prompt:
            prompt = self._get_default_prompt()

        try:
            # Prepare contents
            # SDK v1 style: [prompt, image_blob]
            # SDK v2 style: contents=[...]
            
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=[
                    prompt, 
                    types.Part.from_bytes(data=image_data, mime_type="image/jpeg")
                ]
            )
            return self._parse_json(response.text)
        except Exception as e:
            return {"error": self._handle_gemini_error(e)}

    async def analyze_text(self, text: str, prompt: str = None) -> Dict[str, Any]:
        if not self.client: return {"error": "AI not available"}
        try:
            full_prompt = f"{prompt}\n\nInput Text: {text}"
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=full_prompt
            )
            if response.usage_metadata:
                logger.info(f"Gemini Token Usage (analyze_text): Prompt: {response.usage_metadata.prompt_token_count}, Output: {response.usage_metadata.candidates_token_count}, Total: {response.usage_metadata.total_token_count}")
            return self._parse_json(response.text)
        except Exception as e:
            return {"error": self._handle_gemini_error(e)}

    async def analyze_place_complex(self, text_data: str, images: List[tuple[bytes, str]]) -> Dict[str, Any]:
        if not self.client: return {"error": "AI not available"}
        
        prompt = strings.GEMINI_ANALYSIS_PROMPT
        
        try:
             # Define Schema
            schema = {
                "type": "OBJECT",
                "properties": {
                    "details": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "address": {"type": "STRING"},
                            "categories": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "meal_types": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "occasions": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "vibes": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "mood": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "aesthetic_score": {"type": "INTEGER"},
                            "lighting": {"type": "STRING"},
                            "rating": {"type": "NUMBER"},
                            "price_level": {"type": "STRING"},
                            "status": {"type": "STRING"},
                            "opening_hours": {"type": "STRING"},
                            "popular_times": {"type": "STRING"},
                            
                            # Rich Prompting Fields (Raw Only)
                            "noise_level": {"type": "STRING", "description": "Quiet, Moderate, Loud", "nullable": True},
                            "crowd_type": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Students, Office Workers, Couples, Tourists"},
                            "amenities": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Wifi, Parking, AC, Power Outlets"},
                            "best_time_to_visit": {"type": "STRING", "nullable": True}
                        },
                        "required": ["name"]
                    },
                    "marin_comment": {"type": "STRING"}
                },
                "required": ["details", "marin_comment"]
            }

            contents = [prompt, text_data]
            # Append images
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema
                )
            )
            
            if response.usage_metadata:
                 logger.info(f"Gemini Token Usage (complex): Prompt: {response.usage_metadata.prompt_token_count}, Output: {response.usage_metadata.candidates_token_count}, Total: {response.usage_metadata.total_token_count}")
            
            # Since we enforce JSON schema, we can trust json.loads
            return json.loads(response.text)
            
        except Exception as e:
            return {"error": self._handle_gemini_error(e)}

    def _get_default_prompt(self):
        return strings.VISION_PROMPT_FALLBACK

    async def generate_response(self, place_data: Dict[str, Any]) -> str:
        """
        Generate a cute Vietnamese response based on the place data.
        """
        if not self.client: return "Sorry, AI is sleeping..."
        
        # Optimize Token Usage: Only send relevant fields
        relevant_data = {
            "name": place_data.get("name"),
            "categories": place_data.get("categories"),
            "vibes": place_data.get("vibes"),
            "mood": place_data.get("mood"),
            "aesthetic_score": place_data.get("aesthetic_score"),
            "rating": place_data.get("rating"),
            "marin_comment": place_data.get("marin_comment")
        }

        prompt = f"""
        Role: You are Marin, a Gen Z Location Scout (Anime style, Cute, Vietnamese).
        Based on this data about a place, write a short, catchy, and cute introduction to the user.
        Focus on the 'vibes', 'mood', and 'aesthetic_score'.
        Don't just list data, make it sound like you are excited to show this place!
        
        Data (TOON):
        {to_toon(relevant_data)}
        
        Response in Vietnamese, using international and vietnamese slangs, trending words:
        """
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            if response.usage_metadata:
                logger.info(f"Gemini Token Usage (generate_response): Prompt: {response.usage_metadata.prompt_token_count}, Output: {response.usage_metadata.candidates_token_count}, Total: {response.usage_metadata.total_token_count}")
            return response.text.strip()
        except Exception as e:
            logger.error(f"Generate response failed: {e}")
            return self._handle_gemini_error(e)

    def _handle_gemini_error(self, e: Exception) -> str:
        """Map technical errors to friendly Marin messages."""
        error_str = str(e)
        logger.error(f"Gemini API Error: {error_str}") # Log full error
        
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            return strings.ERR_MSG_429
        if "500" in error_str or "502" in error_str or "503" in error_str:
            return strings.ERR_MSG_5XX
        if "404" in error_str:
            return strings.ERR_MSG_404
        if "400" in error_str:
            return strings.ERR_MSG_400
            
        return strings.ERR_MSG_UNKNOWN

    def _parse_json(self, text: str) -> Dict[str, Any]:
        try:
            # 1. Try standard markdown splitting
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            # strict=False allows control characters like newlines in strings
            return json.loads(text.strip(), strict=False)
        except Exception:
            # 2. Fallback: Regex extraction
            try:
                import re
                import ast
                # Look for { ... } structure
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    try:
                        return json.loads(json_str, strict=False)
                    except json.JSONDecodeError:
                        # 3. Fallback: Python literal_eval (handles single quotes)
                        return ast.literal_eval(json_str)
            except Exception as e:
                logger.error(f"JSON Parsing fully failed: {e}")
                pass
            
            logger.error(f"Failed JSON Raw content: {text}")
            return {"error": strings.ERR_MSG_JSON_PARSE_FAIL}

    async def analyze_search_query(self, query: str) -> Dict[str, Any]:
        """Extract search filters from user query."""
        if not self.client: return {"error": "AI not available"}
        
        prompt = strings.SEARCH_INTENT_PROMPT.format(query=query)
        try:
             # Define Schema
             schema = {
                "type": "OBJECT",
                "properties": {
                    "keywords": {"type": "STRING", "nullable": True},
                    "vibes": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "min_rating": {"type": "NUMBER"},
                    "city": {"type": "STRING", "nullable": True}
                }
             }
             response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema
                )
            )
             return json.loads(response.text)
        except Exception as e:
            return {"error": self._handle_gemini_error(e)}


class LocalLLMService(AIService):
    def __init__(self, url: str, model_name: str):
        self.url = url
        self.model_name = model_name

    async def analyze_image(self, image_data: bytes, prompt: str = None) -> Dict[str, Any]:
        # Ollama LLaVA/Llama 3.1 Vision support
        # Note: Standard Llama 3.1 is text-only. User implied LVA/Llama3.1. 
        # If user provides a text-only model for image, it will likely fail or hallucinate.
        # We assume they use a vision-capable local model (like llava or llama3.2-vision).
        
        if not prompt:
            prompt = "Analyze this image and return JSON with name, address, vibes, mood, aesthetic_score, lighting, marin_comment."

        # Convert image to base64
        b64_image = base64.b64encode(image_data).decode('utf-8')

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "images": [b64_image],
            "stream": False,
            "format": "json" # Ensure JSON output if supported
        }

        try:
            response = requests.post(self.url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return json.loads(data.get("response", "{}"))
        except Exception as e:
             logger.error(f"Local LLM analysis failed: {e}")
             return {"error": str(e)}

    async def analyze_text(self, text: str, prompt: str = None) -> Dict[str, Any]:
        if not prompt: prompt = "Analyze this text and return JSON."
        full_prompt = f"{prompt}\n\nInput: {text}"
        
        logger.debug(f"LocalLLM: Sending request to {self.model_name}...")
        
        payload = {
            "model": self.model_name,
            "prompt": full_prompt,
            "stream": False,
            "format": "json"
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(self.url, json=payload)
                response.raise_for_status()
                data = response.json()
                logger.debug("LocalLLM: Request successful.")
                return json.loads(data.get("response", "{}"))
        except Exception as e:
             logger.error(f"Local LLM analysis failed: {e}")
             return {"error": str(e)}

    async def generate_response(self, place_data: Dict[str, Any]) -> str:
        # Prompt ...
        prompt = f"""
        Role: You are Marin, a Gen Z Location Scout (Anime style, Cute, Vietnamese).
        
        Task: Write a short, catchy limit-1-paragraph comment about this place based on the data.
        
        Rules:
        1. NO self-introduction (Do NOT say "Xin chào", "Tôi là Marin"). Start directly with the feeling.
        2. Use Gen Z slang (keo ly, slay, chấn động, vibe, check-in, mlem).
        3. If 'vibes' or 'mood' are missing/generic ("Infer"), make a playful guess based on the Name and Category.
           (e.g., "Maltroom" -> speakeasy, chill, alcohol; "Cafe" -> deadline, sống ảo).
        4. Be subjective and opinionated. If it looks boring, say it needs a vibe check.
        
        Data: {json.dumps(place_data)}
        
        Response (Vietnamese):
        """
        logger.debug(f"LocalLLM: Generating response with {self.model_name}...")
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(self.url, json=payload)
                data = response.json()
                logger.debug("LocalLLM: Response generated.")
                return data.get("response", "").strip()
        except Exception as e:
             logger.error(f"Local LLM generation failed: {e}")
             return "Oa, chỗ này trông xịn xò nè! ✨ (Nhưng Marin đang lag xíu)"

    async def analyze_place_complex(self, text_data: str, images: List[tuple[bytes, str]]) -> Dict[str, Any]:
        # Fallback for Local LLM
        # Just use text analysis for now or first image
        if images:
            # Simple prompt for vision
            img_bytes, _ = images[0]
            return await self.analyze_image(img_bytes, prompt=f"Explain this place + Text: {text_data}")
        else:
            return await self.analyze_text(text_data)

def get_ai_service() -> AIService:
    settings = get_settings()
    
    if settings.AI_MODE.lower() == "local":
        logger.info(f"Using Local LLM: {settings.LOCAL_MODEL_NAME}")
        return LocalLLMService(settings.LOCAL_MODEL_URL, settings.LOCAL_MODEL_NAME)
    else:
        logger.info(f"Using Gemini: {settings.GEMINI_MODEL}")
        return GeminiService(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)

# Global Instance
ai_service = get_ai_service()
