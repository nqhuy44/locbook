import logging
import uuid
from typing import Tuple, Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.core.database.sql_models import Place
from src.modules.places.parser import link_parser
from src.core.llm import ai_service
from src.core.storage import get_storage

logger = logging.getLogger(__name__)

async def get_or_create_place_from_url(db: AsyncSession, url: str, user_id: Optional[Any] = None) -> Tuple[Place, bool, Optional[str]]:
    """
    Get existing place or create new one from Google Maps URL.
    Returns: (place, created, marin_comment)
    """
    # 1. Check duplicate
    stmt = select(Place).where(Place.google_maps_url == url)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        return existing, False, None
        
    # 2. Fetch place info
    raw_info = await link_parser.fetch_place_info(url)
    if "error" in raw_info:
        raise ValueError(f"Failed to fetch place info: {raw_info['error']}")

    # --- DEDUPLICATION LOGIC ---
    # Check for existing place within 50m with similar name
    if raw_info.get("raw_api") and "location" in raw_info["raw_api"]:
        try:
            loc_api = raw_info["raw_api"]["location"]
            lat_check = loc_api["latitude"]
            lon_check = loc_api["longitude"]
            print(f"DEBUG: Checking duplicates at {lat_check}, {lon_check}")
            
            # PostGIS ST_DWithin check (50 meters)
            # Geography type uses meters for distance
            # PostGIS ST_DWithin check (50 meters)
            # Geography type uses meters for distance
            from sqlalchemy import func
            from geoalchemy2 import Geography
            
            # Use WKT string directly with ST_GeogFromText for geography distance
            # Or cast standard geometry 
            
            stmt_dup = select(Place).where(
                func.ST_DWithin(
                    Place.location.cast(Geography("POINT", srid=4326)),
                    func.ST_GeogFromText(f"SRID=4326;POINT({lon_check} {lat_check})"), 
                    50 # meters
                )
            )
            result_dup = await db.execute(stmt_dup)
            candidates = result_dup.scalars().all()
            print(f"DEBUG: Found {len(candidates)} candidates within 50m")
            
            if candidates:
                import difflib
                
                def normalize(s):
                    import re
                    return re.sub(r'[^a-z0-9]', '', s.lower()) if s else ""
                
                target_name = raw_info.get("inferred_name", "")
                raw_api_name = raw_info["raw_api"].get("displayName", {}).get("text", "")
                # Prefer API name for checking
                check_name = raw_api_name if raw_api_name else target_name
                
                check_norm = normalize(check_name)
                print(f"DEBUG: Checking name '{check_name}' (norm: {check_norm})")
                
                for cand in candidates:
                    cand_norm = normalize(cand.name)
                    print(f"DEBUG: Comparing with '{cand.name}' (norm: {cand_norm})")
                    
                    # 1. Exact match (normalized)
                    if check_norm == cand_norm:
                        logger.info(f"Deduplication: Exact match found: {cand.name}")
                        print(f"DEBUG: Exact match!")
                        return cand, False, None
                        
                    # 2. Containment
                    if check_norm and cand_norm and (check_norm in cand_norm or cand_norm in check_norm):
                        logger.info(f"Deduplication: Containment match found: {cand.name} vs {check_name}")
                        print(f"DEBUG: Containment match!")
                        return cand, False, None
                        
                    # 3. Fuzzy match
                    # Quick ratio
                    ratio = difflib.SequenceMatcher(None, check_norm, cand_norm).ratio()
                    print(f"DEBUG: Ratio: {ratio}")
                    if ratio > 0.8:
                        logger.info(f"Deduplication: Fuzzy match ({ratio:.2f}) found: {cand.name} vs {check_name}")
                        print(f"DEBUG: Fuzzy match!")
                        return cand, False, None

        except Exception as e:
            logger.warning(f"Deduplication check failed: {e}")
            import traceback
            traceback.print_exc()
            # Continue to create new if check fails
    else:
        print("DEBUG: No raw_api or location in raw_info, skipping deduplication")

    # 3. AI analysis
    analysis = await ai_service.analyze_place(
        text_data=raw_info.get("text_data", ""),
        images=raw_info.get("images", []),
        user_id=user_id,
    )
    if "error" in analysis:
        raise ValueError(f"AI analysis failed: {analysis['error']}")
        
    details = analysis.get("details", {})
    marin_comment_data = analysis.get("marin_comment", "")
    if isinstance(marin_comment_data, dict):
        marin_comment = {
            "vi": marin_comment_data.get("vi", "").replace("\\n", "\n"),
            "en": marin_comment_data.get("en", "").replace("\\n", "\n")
        }
        # Overwrite in analysis so raw_ai_response gets the cleaned up dict
        analysis["marin_comment"] = marin_comment
    else:
        marin_comment = str(marin_comment_data).replace("\\n", "\n")
        analysis["marin_comment"] = {"vi": marin_comment, "en": marin_comment}
    
    # 4. Build Place
    categories = details.get("categories", [])
    latitude = None
    longitude = None
    location_geom = None

    if raw_info.get("raw_api") and "location" in raw_info["raw_api"]:
        loc_api = raw_info["raw_api"]["location"]
        latitude = loc_api["latitude"]
        longitude = loc_api["longitude"]
        location_geom = f"SRID=4326;POINT({longitude} {latitude})"

    # Use API values directly for accuracy (override AI-inferred ones)
    api_rating = None
    api_price_level = details.get("price_level")
    if raw_info.get("raw_api"):
        raw_api = raw_info["raw_api"]
        api_rating = raw_api.get("rating")
        api_price_level = raw_api.get("priceLevel", api_price_level)

    # Extract menu items from AI analysis
    menu_items = []
    for dish in analysis.get("signature_dishes", []):
        if dish.get("name"):
            menu_items.append({
                "name": dish["name"],
                "display_price": dish.get("price", ""),
                "is_signature": True,
            })

    place = Place(
        name=details.get("name", raw_info.get("inferred_name", "Unknown Spot")),
        address=details.get("address"),
        location=location_geom,
        categories=categories,
        vibes=details.get("vibes", []),
        mood=details.get("mood", []),
        aesthetic_score=details.get("aesthetic_score"),
        google_maps_url=url,
        rating=api_rating or details.get("rating"),
        price_level=api_price_level,
        opening_hours=details.get("opening_hours"),
        menu=menu_items,
        latitude=latitude,
        longitude=longitude,
        # Address Components
        city=raw_info.get("address_components", {}).get("city") or details.get("city"),
        district=raw_info.get("address_components", {}).get("district") or details.get("district"),
        ward=raw_info.get("address_components", {}).get("ward") or details.get("ward"),
        street=raw_info.get("address_components", {}).get("street") or details.get("street"),
        country=raw_info.get("address_components", {}).get("country", "Vietnam") or details.get("country"),
        raw_ai_response=analysis, # Save full AI response including marin_comment
    )
    
    # 4b. Download and save thumbnail
    thumbnail_photo_name = raw_info.get("thumbnail_photo_name")
    if thumbnail_photo_name:
        try:
            img_data = await link_parser._fetch_photo_bytes(thumbnail_photo_name)
            if img_data:
                img_bytes, content_type = img_data
                ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
                
                storage = get_storage()
                filename = f"{place.id}.{ext}"
                # Save to 'images' folder
                public_path = await storage.save_file(img_bytes, filename, content_type, folder="images")
                
                place.images = [public_path] 
                place.local_image_path = public_path 
                logger.info(f"Saved thumbnail: {public_path}")
        except Exception as e:
            logger.warning(f"Failed to save thumbnail: {e}")

    # 5. Save (with quality hooks: sync location + embed)
    from src.modules.places.quality import on_place_save
    place = await on_place_save(db, place)
    
    db.add(place)
    await db.commit()
    await db.refresh(place)
    
    return place, True, marin_comment

async def search_places(
    db: AsyncSession, 
    query: str, 
    query_en: Optional[str] = None,
    vibes: Optional[List[str]] = None, 
    city: Optional[str] = None,
    district: Optional[str] = None,
    ward: Optional[str] = None,
    categories: Optional[List[str]] = None,  # List[str]
    limit: int = 5
) -> List[Place]:
    """Search for places using Hybrid Search (Semantic + Keyword) with RRF scoring.
    
    Combines pgvector cosine similarity (semantic) with Postgres FTS ts_rank (keyword)
    using Reciprocal Rank Fusion (RRF) to produce a blended ranking.
    """
    from src.core.ai import get_text_embedding
    from sqlalchemy import func as sa_func, text as sa_text, String
    
    RRF_K = 60  # RRF constant — higher values flatten rank differences
    CANDIDATE_POOL = limit * 4  # Fetch more candidates for better RRF fusion
    
    try:
        print(f"DEBUG: search_places called with city={city}, vibes={vibes}, mood_check=True")
        # --- Build shared filter conditions ---
        filters = []
        if city and city.lower() != "null":
            # Flexible Unaccent filtering (Handle aliases via Prompt, handle accents via DB extension)
            # Must specify type_=String to enable .ilike() method on function result
            filters.append(sa_func.unaccent(Place.city, type_=String).ilike(sa_func.unaccent(f"%{city}%", type_=String)))

        if district and district.lower() != "null":
             # Same for district
             filters.append(sa_func.unaccent(Place.district, type_=String).ilike(sa_func.unaccent(f"%{district}%", type_=String)))
             
        if ward and ward.lower() != "null":
             # Same for ward
             filters.append(sa_func.unaccent(Place.ward, type_=String).ilike(sa_func.unaccent(f"%{ward}%", type_=String)))
        from sqlalchemy import or_
        
        # Vibes: Filter if ANY match (Case-Insensitive) in EITHER vibes OR mood
        if vibes and len(vibes) > 0:
            # OR(vibe ILIKE vibes_col, vibe ILIKE mood_col)
            vibe_conditions = []
            for v in vibes:
                vibe_conditions.append(sa_func.array_to_string(Place.vibes, ",").ilike(f"%{v}%"))
                vibe_conditions.append(sa_func.array_to_string(Place.mood, ",").ilike(f"%{v}%"))
            
            filters.append(or_(*vibe_conditions))
            
        if categories and len(categories) > 0:
            # Categories: Filter if ANY match (Case-Insensitive Regex Word Boundary)
            # \m = Start of word, \M = End of word (Postgres specific)
            cat_conditions = [
                sa_func.array_to_string(Place.categories, ",").op("~*")(f"\\m{c}\\M") for c in categories
            ]
            filters.append(or_(*cat_conditions))
        
        # --- Leg 1: Semantic Search (pgvector cosine distance) ---
        # Use English query for embedding when available (better alignment with English DB embeddings)
        semantic_results = []
        embedding_query = query_en if query_en else query
        query_embedding = await get_text_embedding(embedding_query)
        
        if query_embedding:
            stmt_semantic = select(Place)
            for f in filters:
                stmt_semantic = stmt_semantic.where(f)
            stmt_semantic = stmt_semantic.order_by(
                Place.embedding.cosine_distance(query_embedding)
            ).limit(CANDIDATE_POOL)
            
            result = await db.execute(stmt_semantic)
            semantic_results = list(result.scalars().all())
        
        # --- Leg 2: Keyword Search (Postgres FTS ts_rank) ---
        # Combine Vietnamese + English queries for bilingual matching
        keyword_results = []
        combined_query = query
        if query_en and query_en.strip():
            combined_query = f"{query} {query_en}"
        tsquery = sa_func.plainto_tsquery('simple', combined_query)
        
        stmt_keyword = select(Place).where(
            Place.search_text.isnot(None),
            Place.search_text.op('@@')(tsquery)
        )
        for f in filters:
            stmt_keyword = stmt_keyword.where(f)
        stmt_keyword = stmt_keyword.order_by(
            sa_func.ts_rank(Place.search_text, tsquery).desc()
        ).limit(CANDIDATE_POOL)
        
        result = await db.execute(stmt_keyword)
        keyword_results = list(result.scalars().all())
        
        # --- Reciprocal Rank Fusion ---
        # Build rank maps (1-indexed rank)
        semantic_rank = {p.id: rank + 1 for rank, p in enumerate(semantic_results)}
        keyword_rank = {p.id: rank + 1 for rank, p in enumerate(keyword_results)}
        
        # Collect all unique place IDs and their objects
        all_places = {}
        for p in semantic_results + keyword_results:
            all_places[p.id] = p
        
        # Calculate RRF score for each place
        rrf_scores = {}
        for pid in all_places:
            score = 0.0
            if pid in semantic_rank:
                score += 1.0 / (RRF_K + semantic_rank[pid])
            if pid in keyword_rank:
                score += 1.0 / (RRF_K + keyword_rank[pid])
            rrf_scores[pid] = score
        
        # Sort by RRF score descending and return top N
        sorted_ids = sorted(rrf_scores, key=lambda pid: rrf_scores[pid], reverse=True)[:limit]
        return [all_places[pid] for pid in sorted_ids]
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        # Fallback: simple semantic-only search
        try:
            query_embedding = await get_text_embedding(query)
            if query_embedding:
                stmt = select(Place)
                for f in filters:
                    stmt = stmt.where(f)
                stmt = stmt.order_by(
                    Place.embedding.cosine_distance(query_embedding)
                ).limit(limit)
                result = await db.execute(stmt)
                return list(result.scalars().all())
        except Exception:
            pass
        return []
