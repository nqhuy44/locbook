import logging
import uuid
from typing import Tuple, Dict, Any, Optional
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
    marin_comment = analysis.get("marin_comment", "").replace("\\n", "\n")
    
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

async def search_places(db: AsyncSession, query: str, vibe: Optional[str] = None, district: Optional[str] = None, limit: int = 5) -> List[Place]:
    """
    Search for places using vector similarity and metadata filters.
    """
    from src.core.ai import get_text_embedding
    
    # 1. Generate embedding for query
    query_embedding = await get_text_embedding(query)
    
    # 2. Build query
    stmt = select(Place)
    
    # Filter by district if provided
    if district and district.lower() != "null":
        # Simple case-insensitive match
        stmt = stmt.where(Place.district.ilike(f"%{district}%"))
        
    # Filter by vibe if provided (using array containment or overlap)
    if vibe and vibe.lower() != "null":
        # Assumes vibes is ARRAY(String). 
        # For strict match: Place.vibes.contains([vibe])
        # For fuzzy, we might rely solely on vector search, but let's try a text filter if meaningful
        stmt = stmt.where(Place.vibes.any(vibe))
        
    # 3. Vector Search
    if query_embedding:
        stmt = stmt.order_by(Place.embedding.cosine_distance(query_embedding))
        
    stmt = stmt.limit(limit)
    
    try:
        result = await db.execute(stmt)
        places = result.scalars().all()
        return places
    except Exception as e:
        logger.error(f"Search places failed: {e}")
        return []
