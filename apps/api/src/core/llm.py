from typing import Dict, Any, List
import logging
import json
import os

from google import genai
from google.genai import types
from src.core.config import get_settings
from src.core.database.sql_models import LLMUsageLog
from src.core.database.postgres import get_db_session
import src.modules.bot.strings as strings
import uuid

logger = logging.getLogger(__name__)

# --- Prompt Loading ---

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")


def _load_prompt(filename: str) -> str:
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _load_json(filename: str) -> dict:
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# --- Gemini Service ---

class GeminiService:
    def __init__(self, api_key: str, model_name: str):
        if not api_key:
            logger.warning("GEMINI_API_KEY is not set.")
            self.client = None
            self.model_name = None
        else:
            self.client = genai.Client(api_key=api_key)
            self.model_name = model_name

    async def _log_usage(self, request_type: str, usage: Any, user_id: Any = None):
        """Helper to log usage metadata to DB."""
        if not usage:
            return

        try:
            # We need an async session but this is called from within AI methods
            # We'll use a local session for logging to keep it simple and isolated
            async for db in get_db_session():
                log = LLMUsageLog(
                    user_id=uuid.UUID(str(user_id)) if user_id else None,
                    request_type=request_type,
                    model_name=self.model_name,
                    prompt_tokens=usage.prompt_token_count or 0,
                    output_tokens=usage.candidates_token_count or 0,
                    total_tokens=usage.total_token_count or 0,
                )
                db.add(log)
                await db.commit()
                break # Only need one session
        except Exception as e:
            logger.error(f"Failed to log LLM usage: {e}")

    async def analyze_place(self, text_data: str, images: List[tuple[bytes, str]], user_id: str = None) -> Dict[str, Any]:
        """Analyze place from text + images. Returns structured data + marin_comment."""
        if not self.client:
            return {"error": "AI not available"}

        prompt = _load_prompt("place_analysis.txt")
        schema = _load_json("place_schema.json")

        try:
            contents = [prompt, text_data]
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )

            if response.usage_metadata:
                await self._log_usage("analysis", response.usage_metadata, user_id)

            return json.loads(response.text)

        except Exception as e:
            return {"error": self._handle_error(e)}

    async def generate_text(self, prompt: str, user_id: str = None) -> str:
        """Generic text generation — used by chat_service."""
        if not self.client:
            return "AI Service not ready."

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(max_output_tokens=500),
            )
            if response.usage_metadata:
                await self._log_usage("chat", response.usage_metadata, user_id)
            return response.text
        except Exception as e:
            logger.error(f"Text generation failed: {e}")
            return self._handle_error(e)

    async def generate_with_tools(
        self, 
        contents: List[Any],
        system_instruction: str = None,
        tools: List[Dict[str, Any]] = None,
        user_id: str = None
    ) -> Any:
        """Generate content with tool support and optional system instruction.
        
        Uses Gemini's native function calling protocol with proper multi-turn support.
        System instruction is passed via config to avoid duplicating in prompt.
        Returns the raw response object (including function calls).
        """
        if not self.client:
            raise ValueError("AI Service not ready.")

        try:
            config_kwargs = {"max_output_tokens": 500}
            if tools:
                config_kwargs["tools"] = tools
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction
                
            config = types.GenerateContentConfig(**config_kwargs)

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config,
            )
            
            if response.usage_metadata:
                await self._log_usage("chat_tool", response.usage_metadata, user_id)
                
            return response
            
        except Exception as e:
            logger.error(f"Generate with tools failed: {e}")
            raise e

    async def generate_json(self, prompt: str, schema: dict = None) -> Dict[str, Any]:
        """Generate JSON response with optional schema enforcement."""
        if not self.client:
            return {"error": "AI not available"}

        try:
            config = types.GenerateContentConfig(response_mime_type="application/json")
            if schema:
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                )

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )
            return json.loads(response.text)
        except Exception as e:
            return {"error": self._handle_error(e)}

    async def extract_menu(self, images: List[tuple[bytes, str]]) -> Dict[str, Any]:
        """Extract menu items from menu image(s) via Gemini Vision OCR."""
        if not self.client:
            return {"error": "AI not available", "items": []}
        if not images:
            return {"error": "No images provided", "items": []}

        prompt = _load_prompt("menu_ocr.txt")
        schema = _load_json("menu_schema.json")

        try:
            contents = [prompt]
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )

            if response.usage_metadata:
                await self._log_usage("ocr", response.usage_metadata)

            return json.loads(response.text)

        except Exception as e:
            return {"error": self._handle_error(e), "items": []}

    async def analyze_aesthetic(self, images: List[tuple[bytes, str]]) -> Dict[str, Any]:
        """Analyze venue aesthetic quality from images. Returns score 1-10 + reasoning."""
        if not self.client:
            return {"error": "AI not available", "aesthetic_score": 5, "reasoning": ""}
        if not images:
            return {"aesthetic_score": 5, "reasoning": "No images to analyze"}

        prompt = _load_prompt("aesthetic_analysis.txt")
        schema = _load_json("aesthetic_schema.json")

        try:
            contents = [prompt]
            for img_bytes, mime_type in images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )

            if response.usage_metadata:
                await self._log_usage("aesthetic", response.usage_metadata)

            result = json.loads(response.text)
            # Clamp score to 1-10
            score = max(1, min(10, result.get("aesthetic_score", 5)))
            return {"aesthetic_score": score, "reasoning": result.get("reasoning", "")}

        except Exception as e:
            return {"error": self._handle_error(e), "aesthetic_score": 5, "reasoning": ""}

    def _handle_error(self, e: Exception) -> str:
        """Map technical errors to friendly messages."""
        error_str = str(e)
        logger.error(f"Gemini API Error: {error_str}")

        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            return strings.ERR_MSG_429
        if any(code in error_str for code in ("500", "502", "503")):
            return strings.ERR_MSG_5XX
        if "404" in error_str:
            return strings.ERR_MSG_404
        if "400" in error_str:
            return strings.ERR_MSG_400

        return strings.ERR_MSG_UNKNOWN


# --- Factory & Singleton ---

def get_ai_service() -> GeminiService:
    settings = get_settings()
    logger.info(f"Using Gemini: {settings.GEMINI_MODEL}")
    return GeminiService(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)


ai_service = get_ai_service()
