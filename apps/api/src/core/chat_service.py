import logging
import re
from typing import Dict, Any, List
from datetime import datetime
import uuid
import json

from sqlmodel import select
from src.database.postgres import get_db_session
from src.database.sql_models import ChatSession, AppConfig, Place
from src.core.llm import ai_service
from src.config import get_settings
from src.api import DEFAULT_APP_CONFIG # Fallback
from google.genai import types

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        self.settings = get_settings()

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
        if re.search(r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", message):
            return "Mình không xem được link, bạn gửi ảnh hoặc text thôi nhé!"
        return None

    async def _extract_search_intent(self, history: List[Dict], new_message: str) -> Dict[str, Any]:
        default_intent = {"query": new_message, "filters": {}}
        prompt = f"""
        Analyze the chat history and the last user message to extract search intent for a place database.
        History: {[m['content'] for m in history[-3:]] if history else []}
        Last User Message: {new_message}
        
        Task:
        1. Identify the core intent (Context Retention + Merge Logic).
        2. Translate into **Search Query** (English keywords).
        3. Extract **Standardized Category Filter** (Vietnamese -> Standard DB keys: "Cafe", "Bar", "Pub", "Restaurant").
        
        Output valid JSON only:
        {{
            "query": "keywords string",
            "filters": {{
                "district": "District X" (or null),
                "city": "City Name" (or null),
                "category": "Standardized Category"
            }}
        }}
        """
        try:
             if hasattr(ai_service, 'client') and ai_service.client:
                 response = await ai_service.client.aio.models.generate_content(
                    model=ai_service.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                 )
                 # Clean response if markdown code block
                 text = response.text.replace("```json", "").replace("```", "").strip()
                 return json.loads(text)
             else:
                 return default_intent
        except Exception as e:
            logger.error(f"Intent extraction failed: {e}")
            return default_intent

    async def handle_message(self, session_id: str, message: str) -> Dict[str, Any]:
        # We need a DB session here. Since this is a service called from API, 
        # normally we'd dependency inject it. But for quick refactor, let's grab a new session context.
        # Ideally, pass the session from the router.
        
        async for db in get_db_session():
            # 0. Load Dynamic Config
            stmt = select(AppConfig).where(AppConfig.key == "global")
            result = await db.execute(stmt)
            app_config = result.scalar_one_or_none()
            
            if app_config:
                marin_config = app_config.data.get("MARIN", DEFAULT_APP_CONFIG["MARIN"])
            else:
                marin_config = DEFAULT_APP_CONFIG["MARIN"]

            category_synonyms = marin_config.get("CATEGORY_SYNONYMS", DEFAULT_APP_CONFIG["MARIN"]["CATEGORY_SYNONYMS"])
            system_instruction = marin_config.get("SYSTEM_INSTRUCTION", DEFAULT_APP_CONFIG["MARIN"]["SYSTEM_INSTRUCTION"])
            avatar_name = marin_config.get("AVATAR_NAME", "Marin 🎀")

            if not session_id:
                session_id = str(uuid.uuid4())
            
            session = await self._get_or_create_session(session_id, db)

            # 1. Guardrail
            block_reason = self._guardrail_check(message)
            if block_reason:
                return {"reply": block_reason, "session_id": session_id, "suggested_places": []}

            # 2. Extract Intent
            intent = await self._extract_search_intent(session.messages, message)
            search_query = intent.get("query", message)
            filters = intent.get("filters", {})
            
            # 3. Vector Search (Postgres)
            relevant_docs = []
            # TODO: Implement pgvector search here similar to discovery router
            # For now, simplistic fallback or strict DB search
            
            # Scalable Search Strategy:
            # - If district/category filtered, use SQL filter + embedding sort
            # - Else just embedding sort
            
            # Embedding generation for query
            from src.core.ai import get_text_embedding
            query_embedding = get_text_embedding(search_query)
            
            try:
                stmt_places = select(Place)
                
                # Filters
                if filters.get("category"):
                    target_cat = filters["category"]
                    # Simple ILIKE or array check?
                    # array_to_string(categories, ',') ILIKE %cat%
                    # For now, let's skip strict category filter to avoid zero results if not exact match
                    pass

                if query_embedding:
                     stmt_places = stmt_places.order_by(Place.embedding.cosine_distance(query_embedding))
                
                stmt_places = stmt_places.limit(5)
                
                result_places = await db.execute(stmt_places)
                db_places = result_places.scalars().all()
                
            except Exception as e:
                logger.error(f"Search failed: {e}")
                db_places = []

            # 4. Build Prompt
            history_text = ""
            # Ensure messages is list
            msgs = session.messages if isinstance(session.messages, list) else []
            for msg in msgs[-5:]:
                role = "User" if msg.get('role') == 'user' else "Marin"
                history_text += f"{role}: {msg.get('content')}\n"

            rag_text = ""
            suggested_places = []
            
            if db_places:
                rag_text = "Here are the best matches from LocBook Database:\n"
                for p in db_places:
                    vibes_str = ", ".join(p.vibes) if p.vibes else ""
                    rag_text += (
                        f"--- PLACE MATCH ---\n"
                        f"Name: {p.name}\n"
                        f"Address: {p.address}\n"
                        f"Vibes: {vibes_str}\n"
                        f"Rating: {p.rating}/5.0\n"
                        f"-------------------\n"
                    )
                    
                    place_dict = PlaceRead.model_validate(p).model_dump(mode='json', by_alias=True)
                    place_dict['id'] = str(p.id)
                    suggested_places.append(place_dict)
            else:
                rag_text = "No direct matches in LocBook Database."

            prompt = f"""
            You are {avatar_name}, LocBook's AI Scout.
            {system_instruction}
            Language: Vietnamese.
            
            Search Intent: "{message}"
            Target Category: "{filters.get('category', 'Any')}"
            
            Context from History:
            {history_text}
            
            LocBook Database Matches:
            {rag_text}
            
            Instructions:
            - **SECTION 1: 📍 Có sẵn trên LocBook**: List matched places.
            - **SECTION 2: ✨ Gợi ý thêm từ Marin**: External suggestions if needed.
            - Tone: Friendly, local expert.
            """

            # 5. Call LLM
            try:
                if hasattr(ai_service, 'client') and ai_service.client:
                     response = await ai_service.client.aio.models.generate_content(
                        model=ai_service.model_name,
                        contents=prompt
                     )
                     reply_text = response.text
                else:
                     reply_text = "AI Service not ready."
            except Exception as e:
                logger.error(f"LLM Call failed: {e}")
                reply_text = "Marin đang bị loạn não chút, bạn hỏi lại sau nhé 🤯"
                suggested_places = []

            # 6. Save History
            new_user_msg = {"role": "user", "content": message, "timestamp": datetime.now().isoformat()}
            new_assistant_msg = {"role": "assistant", "content": reply_text, "timestamp": datetime.now().isoformat()}
            
            # Append to session messages (SQLModel JSONB)
            # We need to re-assign the list to trigger update if mutable tracking issue, usually fine
            current_msgs = list(session.messages) if session.messages else []
            current_msgs.append(new_user_msg)
            current_msgs.append(new_assistant_msg)
            session.messages = current_msgs
            
            # Update seen IDs
            if suggested_places:
                 current_seen = list(session.seen_place_ids) if session.seen_place_ids else []
                 current_seen.extend([p['id'] for p in suggested_places])
                 session.seen_place_ids = list(set(current_seen)) # uniq

            # Update timestamp
            session.updated_at = datetime.now()
            
            db.add(session)
            await db.commit()
            
            return {
                "session_id": session_id,
                "reply": reply_text,
                "suggested_places": suggested_places
            }
            
chat_service = ChatService()
