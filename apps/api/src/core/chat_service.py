import logging
import re
from typing import Dict, Any, List
from datetime import datetime
import uuid
from beanie import PydanticObjectId

from src.database.models import ChatSession, AppConfig
from src.core.vector_store import vector_store
from src.core.llm import ai_service
from src.config import get_settings
from src.api import DEFAULT_APP_CONFIG # Fallback

import json
from google.genai import types

# Import AppConfig to fetch dynamic settings
from src.database.models import AppConfig
from src.api import DEFAULT_APP_CONFIG

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        self.settings = get_settings()

    async def _get_or_create_session(self, session_id: str) -> ChatSession:
        session = await ChatSession.find_one(ChatSession.session_id == session_id)
        if not session:
            session = ChatSession(session_id=session_id)
            await session.insert()
        return session

    def _guardrail_check(self, message: str) -> str | None:
        """
        Layer 1: Simple filters
        Returns error message if blocked, None if clean.
        """
        if len(message) > 500:
            return "Tin nhắn dài quá, bạn tóm tắt lại giúp mình nhé!"
        
        if len(message) < 2:
            return "..."

        # Basic Spam / Profanity Filter (Regex)
        # Block links primarily
        if re.search(r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", message):
            return "Mình không xem được link, bạn gửi ảnh hoặc text thôi nhé!"

        return None

    async def _extract_search_intent(self, history: List[Dict], new_message: str) -> Dict[str, Any]:
        """
        Combine history and new message to form a search query with filters.
        Returns: { "query": str, "filters": Dict }
        """
        # Default
        default_intent = {"query": new_message, "filters": {}}

        # LLM Call to extract intent and filters
        prompt = f"""
        Analyze the chat history and the last user message to extract search intent for a place database.
        
        History:
        {[m['content'] for m in history[-3:]]}
        
        Last User Message: {new_message}
        
        Task:
        1. Identify the core intent from **BOTH** Chat History and Last Message.
           - **Context Retention**: If the user is refining a request, KEEP the vibe/mood/location.
           - **Merge Logic**: New Category + Old Vibe.
        2. Translate into **Search Query** (English keywords).
           - "nhậu" -> "nhậu, beer, drinking".
           - "tụ tập" -> "group".
           - "quẩy" -> "lively, pub".
           - "bình dân" -> "bình dân, casual".
           - "gia đình" -> "family, home".
           - "nhóm" -> "group".
           - "gia đình" -> "home, family".
           - "ăn xế" -> "snack"
           - "tâm sự" -> "quiet, cozy, intimate, speakeasy".
           - "cà phê" -> "cafe, coffee, café, tea"
        3. Extract **Standardized Category Filter** (CRITICAL):
           - Map Vietnamese terms to these standard DB keys: "Cafe", "Bar", "Pub", "Restaurant".
           - "nhậu" -> "Nhậu"
           - "ăn tối" -> "Dinner".
           - "bình dân" -> "Casual"
           - "quẩy" -> "Pub" + "Lively"
           - "gia đình" -> "Family"
        
        Output valid JSON only:
        {{
            "query": "keywords string",
            "filters": {{
                "district": "District X" (or null),
                "city": "City Name" (or null),
                "category": "Standardized Category (e.g. 'Bar', 'Pub', 'Cafe')"
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
                 return json.loads(response.text)
             else:
                 return default_intent

        except Exception:
            return default_intent

    async def handle_message(self, session_id: str, message: str) -> Dict[str, Any]:
        # 0. Load Dynamic Config (Marin Settings)
        # Try to get from DB, fallback to DEFAULT
        app_config = await AppConfig.find_one(AppConfig.key == "global")
        if app_config:
            # We need to apply same merge logic as API? 
            # Ideally yes, but for now let's just assume if it exists in DB, it has what we need
            # Or better, just use .get with fallbacks to DEFAULT
            marin_config = app_config.data.get("MARIN", DEFAULT_APP_CONFIG["MARIN"])
        else:
            marin_config = DEFAULT_APP_CONFIG["MARIN"]

        category_synonyms = marin_config.get("CATEGORY_SYNONYMS", DEFAULT_APP_CONFIG["MARIN"]["CATEGORY_SYNONYMS"])
        system_instruction = marin_config.get("SYSTEM_INSTRUCTION", DEFAULT_APP_CONFIG["MARIN"]["SYSTEM_INSTRUCTION"])
        avatar_name = marin_config.get("AVATAR_NAME", "Marin 🎀")

        if not session_id:
            session_id = str(uuid.uuid4())
        
        session = await self._get_or_create_session(session_id)

        # 1. Layer 1 Guardrail
        block_reason = self._guardrail_check(message)
        if block_reason:
            return {"reply": block_reason, "session_id": session_id, "suggested_places": []}

        # 2. Extract Search Intent
        intent = await self._extract_search_intent(session.messages, message)
        search_query = intent.get("query", message)
        filters = intent.get("filters", {})
        logger.info(f"Contextual Search Query: {search_query}, Filters: {filters}")

        # 3. Vector Search (Hybrid-ish)
        relevant_docs = []
        try:
            # Construct ChromaDB 'where' clause
            where_clause = {}
            conditions = []
            
            if filters.get("category"):
                # Chroma uses 'categories_list' in metadata, we can try partial match via $contains if strict match fails?
                # Chroma metadata filtering is strict. We used "categories_list" string in reindex.
                # Let's rely on simple match for now or just skip if too complex.
                # Actually reindex used: "categories_list": ",".join(p.categories) via string.
                # We can't do partial match easily in basic Chroma without persistent client features?
                # Let's perform case-insensitive strict match if possible or just use what we have.
                # For MVP, let's map "category": "Bar" -> "categories_list": { "$contains": "Bar" } if supported?
                # Chroma doesn't support $contains on string val easily in all versions.
                # Let's just filter by CITY and DISTRICT which are single values.
                pass

            if filters.get("city"):
                where_clause["city"] = filters["city"]
            
            # District is often "District 1", "Quan 1". Metadata might be "Quan 1".
            # This is fragile without normalization. Let's try flexible approach:
            if filters.get("district"):
                 # Simple normalization: "District 1" -> "Quận 1" ?
                 # Reindex logic uses: p.address.split(",")[1].strip()
                 # Let's just trust LLM provided a reasonable string or ignore for now to avoid zero results.
                 # Better to show *some* results than none due to strict filter mismatch.
                 # Let's ONLY filter if we are 100% sure. 
                 # For now, let's apply NO filter first, relying on semantic search is safer for "vibe".
                 # Semantic search "Quan 1" usually finds Quan 1 places.
                 pass
            
            # Refined decision: To solve "irrelevant results" SCALABLY, use Metadata Filtering at DB level.
            
            # Post-processing normalization
            # Extract filters
            target_district = (filters.get("district") or "").strip().lower()
            
            where_clause = {}
            
            if target_district:
                # Use same normalization logic as reindex
                # Regex for "Quận 1", "District 1", "Q.1", "Q1"
                normalized_dist = None
                
                # Check Numeric
                match_num = re.search(r'(?:quận|district|q\.?)\s*([0-9]+)', target_district)
                if match_num:
                    normalized_dist = match_num.group(1)
                else:
                     # Check Named Districts
                     named_districts = ["bình thạnh", "phú nhuận", "gò vấp", "tân bình", "tân phú", "thủ đức", "bình tân", "bình chánh", "hóc môn", "củ chi", "nhà bè", "cần giờ"]
                     for d in named_districts:
                         if d in target_district:
                             normalized_dist = d
                             break
                
                # If we normalized it successfully, apply filter
                if normalized_dist:
                    where_clause["district"] = normalized_dist
                    logger.info(f"Applying strict DB filter: district='{normalized_dist}'")
                else:
                    # Fallback: User said "binh thanh" without quan? or input is messy. 
                    # If we can't normalize, maybe don't filter? Or try exact match?
                    # Let's try exact match of what user provided if regex failed (unlikely if user passes "quận 3")
                    pass
            
            # Scalable Search Strategy v2 (Hybrid) with Pagination (Seen IDs):
            # 1. DB Filter (Chroma WHERE): Strict on Location (District)
            # 2. Vector Search: Fetch more result (60) to allow for filtering seen items.
            # 3. Post-Filter: Remove items already in session.seen_place_ids
            # 4. Memory Filter (Python): Strict on Category
            # 5. Limit: Take top 3 of the remaining
            
            raw_results = vector_store.search(search_query, limit=60, where=where_clause if where_clause else None)
            
            # Post-Retrieval Filtering (Category + Seen)
            filtered_results = []
            rejected_names = []
            target_category = (filters.get("category") or "").strip().lower()
            
            # Synonyms Logic
            valid_categories = {target_category}
            if target_category in category_synonyms:
                valid_categories.update(category_synonyms[target_category])
            
            seen_ids = set(session.seen_place_ids)
            
            if target_category:
                logger.info(f"Applying Memory Filter - Category: '{target_category}' (Synonyms: {valid_categories})")
                for doc in raw_results:
                    meta = doc['metadata']
                    pid = meta.get('place_id')
                    
                    # Skip if already seen
                    if pid in seen_ids:
                        continue

                    # Category Check
                    cats = str(meta.get('categories_list', '')).lower()
                    vibes = str(meta.get('vibes', '')).lower()
                    name = str(meta.get('name', '')).lower()
                    
                    match_cat = False
                    # Check against ALL valid synonyms
                    for cat_syn in valid_categories:
                        if cat_syn in cats: match_cat = True
                        if cat_syn in vibes: match_cat = True
                        if cat_syn in name: match_cat = True
                        if match_cat: break
                    
                    if match_cat:
                        filtered_results.append(doc)
            else:
                # No category filter, just filter seen
                for doc in raw_results:
                     pid = doc['metadata'].get('place_id')
                     if pid not in seen_ids:
                         filtered_results.append(doc)
                
            # Take top 3 of the filtered
            relevant_docs = filtered_results[:3]
            results = relevant_docs
            
            # Update Seen IDs in Session
            new_seen = [d['metadata']['place_id'] for d in relevant_docs if 'place_id' in d['metadata']]
            if new_seen:
                session.seen_place_ids.extend(new_seen)
                await session.save()
                
        except Exception as e:
            logger.error(f"Vector search warning: {e}")
            relevant_docs = []

        # 4. Hydrate & Build Prompt
        history_text = ""
        for msg in session.messages[-5:]:
            role = "User" if msg['role'] == 'user' else "Marin"
            history_text += f"{role}: {msg['content']}\n"

        rag_text = ""
        suggested_places = []
        
        if relevant_docs:
            rag_text = "Here are the best matches from LocBook Database:\n"
            
            # Extract IDs
            place_ids = [doc['metadata']['place_id'] for doc in relevant_docs if 'place_id' in doc['metadata']]
            
            # Fetch full places from MongoDB
            from src.database.models import Place
            from beanie.operators import In
            
            try:
                # Beanie find using raw query to avoid import issues
                if place_ids:
                    # Ensure IDs are PydanticObjectId
                    try:
                        ids = [PydanticObjectId(pid) for pid in place_ids]
                    except Exception as e:
                        logger.error(f"Error converting PydanticObjectId: {e}")
                        ids = []

                    if ids:
                        # Use raw Mongo query for $in
                        db_places = await Place.find({"_id": {"$in": ids}}).to_list()
                    else:
                        db_places = []
                else: 
                    db_places = []
            except Exception as e:
                 logger.error(f"Error hydrating places from DB: {e}", exc_info=True)
                 db_places = []
            
            # Create a map for easy lookup to maintain order if needed, or just list them
            # Let's map db_places back to the relevant_docs order or just use db_places
            # Add ONLY exact hits
            for p in db_places:
                # Add to context
                vibes_str = ", ".join(p.vibes)
                # Ensure we use Marin's take if available
                desc_source = "AI Analysis"
                desc_str = ""
                if p.raw_ai_response and isinstance(p.raw_ai_response, dict) and p.raw_ai_response.get('marin_comment'):
                     desc_str = p.raw_ai_response['marin_comment']
                     desc_source = "Marin's Vibe Check"
                else:
                     desc_str = f"Categories: {', '.join(p.categories)}. Vibes: {', '.join(p.vibes)}."
                
                # Make RAG text richer
                rag_text += (
                    f"--- PLACE MATCH ---\n"
                    f"Name: {p.name}\n"
                    f"Address: {p.address}\n"
                    f"Vibes: {vibes_str}\n"
                    f"Rating: {p.rating}/5.0\n"
                    f"{desc_source}: {desc_str}\n"
                    f"-------------------\n"
                )
                
                # Add to suggestion list for Frontend (Hydrated)
                place_dict = p.model_dump()
                place_dict['_id'] = str(p.id)
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
        Target District: "{filters.get('district', 'Any')}"
        
        Context from History:
        {history_text}
        
        LocBook Database Matches (High Priority):
        {rag_text}
        
        Instructions:
        
        **SECTION 1: 📍 Có sẵn trên LocBook**
        - List the places found in [LocBook Database Matches].
        - Format: "**[Name]** ({filters.get('district') or 'Address'}): [Use 'Marin's Vibe Check' content here to describe the place properly and showing expertise. Do not truncate it too much]."
        - If no DB matches, state: "Hix, Marin chưa tìm thấy quán nào trong hệ thống LocBook đúng ý bạn."
        
        **SECTION 2: ✨ Gợi ý thêm từ Marin**
        - If you found fewer than 3 places in Section 1, suggest external famous places to reach exactly 3 recommendations total.
        - **CRITICAL CONSTRAINT**: External suggestions MUST match the **Target District** ("{filters.get('district', 'Any')}") and **Target Category** ("{filters.get('category', 'Any')}").
          - If User asks for "District 3", DO NOT suggest "District 1" places unless you explicitly say "Q3 hết quán rồi, mình ghé Q1 đỡ nha".
          - If User asks for "Bar", DO NOT suggest "Cafe".
        - Format: "**[Name]** (External/Address): [Brief vibe check]. *Chỗ này chưa có trên LocBook, nhưng đáng thử!*"
        
        **General Rules**:
        - Tone: Helpful, knowledgeable "tho địa" (local expert).
        - Separation: Use a blank line between sections.
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

        # 6. Save History & Return
        new_messages = [
            {"role": "user", "content": message, "timestamp": datetime.now()},
            {"role": "assistant", "content": reply_text, "timestamp": datetime.now()}
        ]
        
        session.messages.extend(new_messages)
        session.updated_at = datetime.now()
        await session.save()
        
        return {
            "session_id": session_id,
            "reply": reply_text,
            "suggested_places": suggested_places
        }
chat_service = ChatService()
