import logging
import re
import os
import json
from typing import Dict, Any, List
from datetime import datetime
import uuid

from sqlmodel import select
from src.core.database.postgres import get_db_session
from src.core.database.sql_models import ChatSession, AppConfig, Place, PlaceRead
from src.core.llm import ai_service, _load_prompt
from src.core.ai import get_text_embedding
from src.core.config import get_settings
from src.core.utils import to_toon
from src.services.api import DEFAULT_APP_CONFIG

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self):
        self.settings = get_settings()
        self._default_system_instruction = _load_prompt("chat_system.txt")

    async def _get_or_create_session(self, session_id: str, db) -> ChatSession:
        stmt = select(ChatSession).where(ChatSession.session_id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            session = ChatSession(session_id=session_id)
            db.add(session)
            await db.commit()
            await db.refresh(session)

        return session

    def _guardrail_check(self, message: str) -> str | None:
        if len(message) > 500:
            return "Tin nhắn dài quá, bạn tóm tắt lại giúp mình nhé!"
        if len(message) < 2:
            return "..."
        if re.search(r"http[s]?://\S+", message):
            return "Mình không xem được link, bạn gửi text thôi nhé!"
        return None

    async def _extract_search_intent(self, history: List[Dict], new_message: str) -> Dict[str, Any]:
        default_intent = {"query": new_message, "filters": {}}

        prompt = f"""Analyze chat history and extract place search intent.
History: {[m['content'] for m in history[-3:]] if history else []}
Message: {new_message}

Extract:
1. Core search query (English keywords)
2. Category filter (Vietnamese -> Standard: "Cafe", "Bar", "Pub", "Restaurant")
3. District/city if mentioned

Output JSON: {{"query": "...", "filters": {{"district": null, "city": null, "category": "..."}}}}"""

        try:
            result = await ai_service.generate_json(prompt)
            return result if "error" not in result else default_intent
        except Exception as e:
            logger.error(f"Intent extraction failed: {e}")
            return default_intent

    async def handle_message(self, session_id: str, message: str) -> Dict[str, Any]:
        async for db in get_db_session():
            # Load dynamic config
            stmt = select(AppConfig).where(AppConfig.key == "global")
            result = await db.execute(stmt)
            app_config = result.scalar_one_or_none()

            if app_config:
                marin_config = app_config.data.get("MARIN", DEFAULT_APP_CONFIG["MARIN"])
            else:
                marin_config = DEFAULT_APP_CONFIG["MARIN"]

            system_instruction = marin_config.get("SYSTEM_INSTRUCTION", self._default_system_instruction)
            avatar_name = marin_config.get("AVATAR_NAME", "Marin 🎀")

            if not session_id:
                session_id = str(uuid.uuid4())

            session = await self._get_or_create_session(session_id, db)

            # Guardrail
            block_reason = self._guardrail_check(message)
            if block_reason:
                return {"reply": block_reason, "session_id": session_id, "suggested_places": []}

            # Extract intent
            intent = await self._extract_search_intent(session.messages, message)
            search_query = intent.get("query", message)
            filters = intent.get("filters", {})

            # Vector search
            query_embedding = get_text_embedding(search_query)
            db_places = []

            try:
                stmt_places = select(Place)

                if query_embedding:
                    stmt_places = stmt_places.order_by(Place.embedding.cosine_distance(query_embedding))

                stmt_places = stmt_places.limit(5)
                result_places = await db.execute(stmt_places)
                db_places = result_places.scalars().all()
            except Exception as e:
                logger.error(f"Search failed: {e}")

            # Build prompt with TOON
            history_text = ""
            msgs = session.messages if isinstance(session.messages, list) else []
            for msg in msgs[-5:]:
                role = "User" if msg.get("role") == "user" else "Marin"
                history_text += f"{role}: {msg.get('content')}\n"

            suggested_places = []
            if db_places:
                rag_entries = []
                for p in db_places:
                    rag_entries.append(to_toon({
                        "name": p.name,
                        "address": p.address or "",
                        "vibes": p.vibes or [],
                        "rating": f"{p.rating}/5.0" if p.rating else "N/A",
                    }))
                    place_dict = PlaceRead.model_validate(p).model_dump(mode="json", by_alias=True)
                    place_dict["id"] = str(p.id)
                    suggested_places.append(place_dict)
                rag_text = "Spotary matches:\n" + "\n---\n".join(rag_entries)
            else:
                rag_text = "No matches in Spotary."

            prompt = f"""You are {avatar_name}, Spotary's AI Scout.
{system_instruction}

Search: "{message}"
Category: "{filters.get('category', 'Any')}"

History:
{history_text}

{rag_text}

Reply with:
- 📍 Có sẵn trên Spotary: list matched places
- ✨ Gợi ý thêm: external suggestions if needed"""

            # Call LLM
            try:
                reply_text = await ai_service.generate_text(prompt)
            except Exception as e:
                logger.error(f"LLM failed: {e}")
                reply_text = "Marin đang bị loạn não chút, bạn hỏi lại sau nhé 🤯"
                suggested_places = []

            # Save history
            now = datetime.now().isoformat()
            current_msgs = list(session.messages) if session.messages else []
            current_msgs.append({"role": "user", "content": message, "timestamp": now})
            current_msgs.append({"role": "assistant", "content": reply_text, "timestamp": now})
            session.messages = current_msgs

            if suggested_places:
                current_seen = list(session.seen_place_ids) if session.seen_place_ids else []
                current_seen.extend([p["id"] for p in suggested_places])
                session.seen_place_ids = list(set(current_seen))

            session.updated_at = datetime.now()
            db.add(session)
            await db.commit()

            return {
                "session_id": session_id,
                "reply": reply_text,
                "suggested_places": suggested_places,
            }


chat_service = ChatService()
