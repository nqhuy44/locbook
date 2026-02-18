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
        self._tools_schema = [
            {
                "name": "search_places",
                "description": "Tìm kiếm địa điểm (quán cafe, nhà hàng, bar...) dựa trên query, vibe, và khu vực.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "Từ khóa tìm kiếm chính (VD: 'cafe làm việc', 'pub chill'). Dịch sang tiếng Anh nếu cần thiết."
                        },
                        "vibe": {
                            "type": "STRING",
                            "description": "Vibe của quán (VD: 'cozy', 'quiet', 'lively', 'romantic')."
                        },
                        "district": {
                            "type": "STRING",
                            "description": "Quận/Huyện (VD: 'District 1', 'Thảo Điền')."
                        }
                    },
                    "required": ["query"]
                }
            }
        ]

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

    async def _fetch_memories(self, db, user_id: Any) -> str:
        if not user_id:
            return ""
        
        # Fetch up to 10 most recent/relevant memories
        # For now, simple recent fetch. Later: vector search on memories.
        stmt = select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.created_at.desc()).limit(10)
        result = await db.execute(stmt)
        memories = result.scalars().all()
        
        if not memories:
            return ""
            
        memory_text = "\nUser Context (Memory):\n"
        for m in memories:
            memory_text += f"- [{m.category}] {m.memory_text}\n"
        return memory_text

    async def handle_message(self, session_id: str, message: str, user_id: Any = None) -> Dict[str, Any]:
        async for db in get_db_session():
            # Load dynamic config
            stmt = select(AppConfig).where(AppConfig.key == "global")
            result = await db.execute(stmt)
            app_config = result.scalar_one_or_none()

            marin_config = app_config.data.get("MARIN", DEFAULT_APP_CONFIG["MARIN"]) if app_config else DEFAULT_APP_CONFIG["MARIN"]
            system_instruction = marin_config.get("SYSTEM_INSTRUCTION", self._default_system_instruction)
            avatar_name = marin_config.get("AVATAR_NAME", "Marin 🎀")

            if not session_id:
                session_id = str(uuid.uuid4())

            session = await self._get_or_create_session(session_id, db)

            # Guardrail
            block_reason = self._guardrail_check(message)
            if block_reason:
                return {"reply": block_reason, "session_id": session_id, "suggested_places": []}

            # --- PREPARE CONTEXT ---
            history_text = ""
            msgs = session.messages if isinstance(session.messages, list) else []
            for msg in msgs[-5:]:
                role = "User" if msg.get("role") == "user" else "Marin"
                history_text += f"{role}: {msg.get('content')}\n"

            memory_context = await self._fetch_memories(db, user_id)
            
            # --- REACT LOOP ---
            
            prompt = f"""You are {avatar_name}, Spotary's AI Scout.
{system_instruction}

User Context:
{memory_context}

Chat History:
{history_text}

User: {message}

Instructions:
1. Analyze the user's request.
2. If you need to find places, use the `search_places` tool.
3. If the user asks about something else, just reply normally.
4. When using tool results, synthesize them into a friendly, helpful response in Vietnamese.
"""
            
            suggested_places = []
            final_reply = ""
            
            # Call 1: Reason & Tool Call
            try:
                # We use generate_with_tools to get raw response
                response = await ai_service.generate_with_tools(
                    contents=prompt,
                    tools=self._tools_schema,
                    user_id=user_id
                )
                
                # Check for function call
                function_call = None
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if part.function_call:
                            function_call = part.function_call
                            break
                
                if function_call and function_call.name == "search_places":
                    # --- TOOL EXECUTION ---
                    args = function_call.args
                    logger.info(f"Marin executing tool: search_places({args})")
                    
                    from src.modules.places.service import search_places
                    places = await search_places(
                        db=db,
                        query=str(args.get("query")),
                        vibe=args.get("vibe"),
                        district=args.get("district")
                    )
                    
                    # Store for frontend
                    for p in places:
                        place_dict = PlaceRead.model_validate(p).model_dump(mode="json", by_alias=True)
                        place_dict["id"] = str(p.id)
                        suggested_places.append(place_dict)
                        
                    # Format observation for AI
                    if places:
                        rag_entries = []
                        for p in places:
                            rag_entries.append(to_toon({
                                "name": p.name,
                                "address": p.address or "",
                                "vibes": p.vibes or [],
                                "rating": f"{p.rating}/5.0" if p.rating else "N/A",
                            }))
                        observation = "Observation (Search Results):\n" + "\n---\n".join(rag_entries)
                    else:
                        observation = "Observation: No places found matching the criteria."
                        
                    # --- FINAL RESPONSE GENERATION ---
                    # Feed observation back to Gemini
                    # Note: Ideally we append the conversation structure (User -> Model(FC) -> User(FunctionResponse) -> Model)
                    # But for simplicity in this turn-based api, we can just extend the prompt.
                    
                    follow_up_prompt = f"{prompt}\n\nRunning Tool: search_places({args})\n{observation}\n\nMarin (Final Reply):"
                    final_reply = await ai_service.generate_text(follow_up_prompt, user_id=user_id)
                    
                else:
                    # No tool called, just text
                    final_reply = response.text

            except Exception as e:
                logger.error(f"ReAct loop failed: {e}")
                final_reply = "Marin đang bị loạn não chút, bạn hỏi lại sau nhé 🤯"
                suggested_places = []

            # Save history
            now = datetime.now().isoformat()
            current_msgs = list(session.messages) if session.messages else []
            current_msgs.append({"role": "user", "content": message, "timestamp": now})
            current_msgs.append({"role": "assistant", "content": final_reply, "timestamp": now})
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
                "reply": final_reply,
                "suggested_places": suggested_places,
            }


chat_service = ChatService()
