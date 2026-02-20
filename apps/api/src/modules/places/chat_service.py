import logging
import re
import os
import json
from typing import Dict, Any, List
from datetime import datetime
import uuid

from google.genai import types
from sqlmodel import select
from src.core.database.postgres import get_db_session
from src.core.database.sql_models import ChatSession, AppConfig, Place, PlaceRead, UserMemory
from src.core.llm import ai_service, _load_prompt
from src.core.ai import get_text_embedding
from src.core.config import get_settings
from src.core.utils import to_toon
from src.services.api import DEFAULT_APP_CONFIG

logger = logging.getLogger(__name__)

# --- Constants ---
SHORT_TERM_WINDOW = 10     # Number of recent raw messages to keep
CONDENSE_THRESHOLD = 20   # Trigger summary when messages exceed this count


class ChatService:
    def __init__(self):
        """Initialize ChatService with tool definitions and system prompt."""
        self.settings = get_settings()
        self._default_system_instruction = _load_prompt("chat_system.txt")
        self._tools = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="search_places",
                    description="Tìm kiếm địa điểm (quán cafe, nhà hàng, bar...) dựa trên query, vibe, và khu vực.",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "query": types.Schema(
                                type="STRING",
                                description="Từ khóa tìm kiếm bằng tiếng Việt (giữ nguyên từ user)."
                            ),
                            "query_en": types.Schema(
                                type="STRING",
                                description="Bản dịch tiếng Anh của query (VD: 'bar tâm sự' → 'intimate bar', 'quán cà phê yên tĩnh' → 'quiet cafe'). LUÔN LUÔN cung cấp."
                            ),
                            "vibes": types.Schema(
                                type="ARRAY",
                                items=types.Schema(type="STRING"),
                                description="Danh sách các vibe bằng tiếng Anh (VD: ['cozy', 'quiet', 'romantic']). Nếu user dùng từ đồng nghĩa, hãy liệt kê tất cả."
                            ),
                            "city": types.Schema(
                                type="STRING",
                                description="Thành phố (VD: 'Ho Chi Minh', 'Hanoi')."
                            ),
                            "district": types.Schema(
                                type="STRING",
                                description="Quận/Huyện (VD: 'District 1', 'Thảo Điền')."
                            ),
                            "categories": types.Schema(
                                type="ARRAY",
                                items=types.Schema(type="STRING"),
                                description="Danh sách các loại hình (từ vựng tiếng Anh). (VD: ['bar', 'restaurant', 'cafe', 'bakery']). Map từ khóa user sang các loại hình này."
                            ),
                        },
                        required=["query", "query_en"],
                    ),
                )
            ]
        )

    async def _get_or_create_session(self, session_id: str, db, user_id: Any = None) -> ChatSession:
        """Get existing chat session or create a new one."""
        stmt = select(ChatSession).where(ChatSession.session_id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            session = ChatSession(session_id=session_id, user_id=user_id)
            db.add(session)
            await db.commit()
            await db.refresh(session)

        return session

    def _guardrail_check(self, message: str) -> str | None:
        """Validate user message before processing."""
        if len(message) > 500:
            return "Tin nhắn dài quá, bạn tóm tắt lại giúp mình nhé!"
        if len(message) < 2:
            return "..."
        if re.search(r"http[s]?://\S+", message):
            return "Mình không xem được link, bạn gửi text thôi nhé!"
        return None

    async def _fetch_memories(self, db, user_id: Any) -> str:
        """Fetch user preference memories to inject into context.
        
        Returns a formatted string of user memory entries (preferences, dislikes, etc.)
        """
        if not user_id:
            return ""
        
        stmt = (
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
            .limit(10)
        )
        result = await db.execute(stmt)
        memories = result.scalars().all()
        
        if not memories:
            return ""
            
        memory_text = "\nUser Preferences (Memory):\n"
        for m in memories:
            memory_text += f"- [{m.category}] {m.memory_text}\n"
        return memory_text

    async def _maybe_condense_history(self, session: ChatSession, user_id: Any = None) -> None:
        """Condense old messages into a summary when history exceeds threshold.
        
        Strategy: Keep last SHORT_TERM_WINDOW messages as raw text.
        Summarize everything before that into session.summary.
        This saves tokens while preserving conversation context.
        """
        msgs = session.messages if isinstance(session.messages, list) else []
        
        if len(msgs) <= CONDENSE_THRESHOLD:
            return
        
        # Messages to summarize (everything except the recent window)
        old_msgs = msgs[:-SHORT_TERM_WINDOW]
        
        # Build text for summarization
        old_text = ""
        for msg in old_msgs:
            role = "User" if msg.get("role") == "user" else "Marin"
            old_text += f"{role}: {msg.get('content', '')}\n"
        
        # Prepend existing summary if present
        existing_summary = session.summary or ""
        
        summarize_prompt = f"""Summarize this conversation concisely. 
Focus on: user preferences, locations discussed, what they liked/disliked, any plans mentioned.
Keep it under 200 words. Write in Vietnamese.

{f'Previous summary: {existing_summary}' if existing_summary else ''}

New messages to incorporate:
{old_text}

Condensed Summary:"""
        
        try:
            new_summary = await ai_service.generate_text(summarize_prompt, user_id=user_id)
            session.summary = new_summary.strip()
            # Trim messages to only keep the recent window
            session.messages = msgs[-SHORT_TERM_WINDOW:]
            logger.info(f"Condensed {len(old_msgs)} messages into summary for session {session.session_id}")
        except Exception as e:
            logger.error(f"Failed to condense history: {e}")
            # Non-fatal: keep messages as-is

    def _build_context_prompt(
        self, 
        memory_context: str, 
        session_summary: str, 
        history_text: str, 
        message: str
    ) -> str:
        """Build the user prompt with all context layers.
        
        Context layers (from long-term to short-term):
        1. User Preferences (memory)
        2. Session Summary (condensed older conversation)
        3. Recent Chat History (raw last N messages)
        4. Current User Message
        """
        parts = []
        
        if memory_context:
            parts.append(memory_context.strip())
        
        if session_summary:
            parts.append(f"Conversation Summary (earlier):\n{session_summary}")
        
        if history_text:
            parts.append(f"Recent Chat:\n{history_text.strip()}")
        
        parts.append(f"User: {message}")
        
        parts.append(
            "Instructions:\n"
            "1. Analyze the user's request.\n"
            "2. If you need to find places, use the `search_places` tool.\n"
            "3. If the user asks about something else, just reply normally.\n"
            "4. When using tool results, synthesize them into a friendly, helpful response in Vietnamese.\n"
            "5. Always recommend places by name and mention their key vibes/features."
        )
        
        return "\n\n".join(parts)

    def _clean_response(self, text: str) -> str:
        """Remove diverse foreign characters (Thai, Cyrillic, Chinese) that might be hallucinated."""
        if not text:
            return ""
        # Regex to match Thai, Cyrillic, Chinese/Kanji/Hangeul
        # Thai: \u0E00-\u0E7F
        # Cyrillic: \u0400-\u04FF
        # CJK: \u4E00-\u9FFF
        # Hangeul: \uAC00-\uD7AF
        pattern = r"[\u0E00-\u0E7F\u0400-\u04FF\u4E00-\u9FFF\uAC00-\uD7AF]"
        cleaned = re.sub(pattern, "", text)
        return cleaned

    async def _reverse_geocode(self, lat: float, lon: float) -> str | None:
        """Reverse geocode lat/lon to City name using Google Maps API."""
        api_key = self.settings.GOOGLE_PLACES_API_KEY
        if not api_key:
            return None
            
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={api_key}&language=vi"
                resp = await client.get(url)
                data = resp.json()
                
                if data.get("status") == "OK" and data.get("results"):
                    # Finding the locality/city component
                    for result in data["results"]:
                        for component in result["address_components"]:
                            if "administrative_area_level_1" in component["types"] or "locality" in component["types"]:
                                # Prefer City/Province name (e.g. Ho Chi Minh City)
                                return component["long_name"]
        except Exception as e:
            logger.warning(f"Reverse geocode failed: {e}")
        return None

    async def handle_message(self, session_id: str, message: str, user_id: Any = None, user_location: Any = None) -> Dict[str, Any]:
        """Handle incoming chat message with One-Pass Tool Use.
        
        Flow:
        1. Load config, session, and context
        2. Build multi-turn contents for Gemini
        3. Call Gemini with function calling (One-Shot)
        4. If function_call returned → execute tool → feed FunctionResponse back → get final answer
        5. If no function_call → use direct text response
        6. Condense history if needed, save session
        """
        async for db in get_db_session():
            # ... (Config Loading) ...
            stmt = select(AppConfig).where(AppConfig.key == "global")
            result = await db.execute(stmt)
            app_config = result.scalar_one_or_none()

            marin_config = app_config.data.get("MARIN", DEFAULT_APP_CONFIG["MARIN"]) if app_config else DEFAULT_APP_CONFIG["MARIN"]
            system_instruction = marin_config.get("SYSTEM_INSTRUCTION", self._default_system_instruction)
            avatar_name = marin_config.get("AVATAR_NAME", "Marin 🎀")

            if not session_id:
                session_id = str(uuid.uuid4())

            session = await self._get_or_create_session(session_id, db, user_id=user_id)

            # --- Guardrail ---
            block_reason = self._guardrail_check(message)
            if block_reason:
                return {"reply": block_reason, "session_id": session_id, "suggested_places": []}

            # --- LOCATION CONTEXT ---
            location_context = ""
            if user_location and isinstance(user_location, dict):
                lat = user_location.get("lat")
                lon = user_location.get("lon")
                if lat and lon:
                    city_name = await self._reverse_geocode(lat, lon)
                    if city_name:
                        location_context = f"User is currently located in: {city_name}. If the user request implies 'nearby' or doesn't specify a city, assume they mean {city_name}."

            # --- PREPARE CONTEXT ---
            # Short-term: Recent raw messages
            history_text = ""
            msgs = session.messages if isinstance(session.messages, list) else []
            for msg in msgs[-SHORT_TERM_WINDOW:]:
                role = "User" if msg.get("role") == "user" else "Marin"
                history_text += f"{role}: {msg.get('content')}\n"

            # Long-term: User memories + session summary
            memory_context = await self._fetch_memories(db, user_id)
            session_summary = session.summary or ""
            
            # Build the full system instruction with avatar name and dynamic config
            category_mappings = marin_config.get("CATEGORY_MAPPINGS", [])
            
            dynamic_rules = ""
            if category_mappings:
                dynamic_rules += "\n\n[Prompt Category Mapping]\n"
                dynamic_rules += "CRITICAL: When user input matches any keywords below, map their intent to the EXACT English value for `query_en` and `categories` parameters:\n"
                for m in category_mappings:
                    vn = m.get("vietnamese", "")
                    en = m.get("english", "")
                    kws = ", ".join(m.get("keywords", []))
                    dynamic_rules += f"- \"{en}\" ({vn}): {kws}\n"

            full_system_instruction = f"You are {avatar_name}, Spotary's AI Scout.\n{system_instruction}\n{dynamic_rules}\n\n{location_context}"
            
            # Build user prompt (with all context layers)
            user_prompt = self._build_context_prompt(
                memory_context=memory_context,
                session_summary=session_summary,
                history_text=history_text,
                message=message,
            )

            # --- ONE-PASS TOOL USE (Gemini Native Function Calling) ---
            suggested_places = []
            final_reply = ""
            
            try:
                # Build initial contents as proper Gemini Content objects
                contents = [
                    types.Content(
                        role="user", 
                        parts=[types.Part.from_text(text=user_prompt)]
                    ),
                ]
                
                # Call 1: Reason & potentially call tool
                response = await ai_service.generate_with_tools(
                    contents=contents,
                    system_instruction=full_system_instruction,
                    tools=[self._tools],
                    user_id=user_id,
                )
                
                # Check for function calls (Iterate all parts for Parallel Calling)
                tool_response_parts = []
                
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if part.function_call:
                            fn_call = part.function_call
                            if fn_call.name == "search_places":
                                # --- TOOL EXECUTION ---
                                args = fn_call.args
                                logger.info(f"Marin executing tool: search_places({args})")
                                
                                # Log search keyword for analytics trending
                                from src.modules.analytics.service import log_event
                                categories = args.get("categories")
                                if categories and isinstance(categories, str):
                                     categories = [categories]
                                
                                # Log event
                                import asyncio
                                asyncio.create_task(log_event(
                                    event_type="CHAT_SEARCH",
                                    user_id=str(user_id) if user_id else None,
                                    payload={
                                        "query": str(args.get("query", "")),
                                        "query_en": str(args.get("query_en", "")),
                                        "vibes": args.get("vibes"),
                                        "categories": categories,
                                        "city": args.get("city"),
                                        "district": args.get("district"),
                                        "user_location": user_location,
                                    },
                                ))
                                
                                from src.modules.places.service import search_places
                                # Convert tool args to kwargs
                                call_args = {
                                    "query": str(args.get("query", "")),
                                    "query_en": args.get("query_en"),
                                    "vibes": args.get("vibes"),
                                    "city": args.get("city"),
                                    "district": args.get("district"),
                                    "categories": categories,
                                }
                                
                                places = await search_places(db=db, **call_args)
                                
                                # Build suggested_places for frontend
                                # Deduplicate implementation needed if multiple calls return same place?
                                # For now, append all
                                for p in places:
                                    place_dict = PlaceRead.model_validate(p).model_dump(mode="json", by_alias=True)
                                    place_dict["id"] = str(p.id)
                                    suggested_places.append(place_dict)
                                    
                                # Format results for FunctionResponse using TOON
                                if places:
                                    tool_results = []
                                    for p in places:
                                        tool_results.append({
                                            "name": p.name,
                                            "address": p.address or "",
                                            "district": p.district or "",
                                            "city": p.city or "",
                                            "vibes": p.vibes or [],
                                            "categories": p.categories or [],
                                            "rating": f"{p.rating}/5.0" if p.rating else "N/A",
                                            "price_level": p.price_level or "N/A",
                                        })
                                    
                                    # Convert to TOON string to compress tokens
                                    toon_str = to_toon({"results": tool_results})
                                    tool_response_data = {"toon_payload": toon_str}
                                else:
                                    tool_response_data = {
                                        "toon_payload": f"No places found for query: {args.get('query')}"
                                    }
                                
                                tool_response_parts.append(
                                    types.Part.from_function_response(
                                        name="search_places",
                                        response=tool_response_data,
                                    )
                                )
                
                if tool_response_parts:
                    # --- PROPER MULTI-TURN: FunctionResponse protocol ---
                    # Append model's function_call turn (contains all calls)
                    contents.append(response.candidates[0].content)
                    
                    # Append FunctionResponse turn (contains all responses)
                    contents.append(
                        types.Content(
                            role="user",
                            parts=tool_response_parts
                        )
                    )
                    
                    # Call 2: Get final synthesized response
                    response2 = await ai_service.generate_with_tools(
                        contents=contents,
                        system_instruction=full_system_instruction,
                        tools=[self._tools],
                        user_id=user_id,
                    )
                    final_reply = self._clean_response(response2.text)
                    # Check if final_reply is empty (recursion case)
                    if not final_reply or not final_reply.strip():
                        if suggested_places:
                            final_reply = "Đây là một số gợi ý mình tìm thấy nè! 👇"
                        else:
                            final_reply = "Mình chưa tìm thấy địa điểm nào phù hợp."
                    
                else:
                    # No tool called — direct text response
                    final_reply = self._clean_response(response.text)
                    if not final_reply:
                         final_reply = "Marin đang suy nghĩ..."

            except Exception as e:
                logger.error(f"Chat handle_message failed: {e}")
                final_reply = "Marin đang bị loạn não chút, bạn hỏi lại sau nhé 🤯"
                suggested_places = []

            # --- SAVE HISTORY ---
            now = datetime.now().isoformat()
            current_msgs = list(session.messages) if session.messages else []
            current_msgs.append({"role": "user", "content": message, "timestamp": now})
            current_msgs.append({"role": "assistant", "content": final_reply, "timestamp": now})
            session.messages = current_msgs

            if suggested_places:
                current_seen = list(session.seen_place_ids) if session.seen_place_ids else []
                current_seen.extend([p["id"] for p in suggested_places])
                session.seen_place_ids = list(set(current_seen))

            # --- CONDENSE if needed ---
            await self._maybe_condense_history(session, user_id)

            session.updated_at = datetime.now()
            db.add(session)
            await db.commit()

            return {
                "session_id": session_id,
                "reply": final_reply,
                "suggested_places": suggested_places,
            }


chat_service = ChatService()
