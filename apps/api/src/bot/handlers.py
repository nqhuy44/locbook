from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, MessageHandler, filters
import logging

logger = logging.getLogger(__name__)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a welcome message when the command /start is issued."""
    user = update.effective_user
    await update.message.reply_html(
        rf"Moshi Moshi! {user.mention_html()}! Mình là Marin, AI Location Scout. 📸"
        "\nGửi ảnh hay link Google Maps để mình lưu vào LocBook nè!",
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a message when the command /help is issued."""
    await update.message.reply_text("Gửi ảnh hoặc link Google Maps đi, Marin sẽ làm hết nè.")

from src.core.parser import link_parser
from src.core.llm import ai_service
from src.database.models import Place
import src.core.strings as strings
import src.core.strings as strings
from datetime import datetime, timezone
from src.config import get_settings
from src.core.rate_limiter import rate_limiter
from src.config import get_settings
from src.core.rate_limiter import rate_limiter
from src.core.rate_limiter import rate_limiter
from src.bot.context import user_context_store
from src.core.image_manager import image_manager

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle location messages for Geo-Search."""
    
    settings = get_settings()
    if not settings.FEAT_GEO_SEARCH:
        await update.message.reply_text(strings.MSG_GEO_SEARCH_DISABLED)
        return

    user = update.effective_user
    location = update.message.location
    if not location: return

    # Check for pending search
    pending_search = user_context_store.get_pending_search(user.id)
    
    query_filter = {}
    
    # Base Geo Query ($near)
    query_filter["location"] = {
        "$near": {
            "$geometry": {
                "type": "Point",
                "coordinates": [location.longitude, location.latitude]
            },
            "$maxDistance": 2000 # 2km default
        }
    }
    
    reply_prefix = strings.MSG_GEO_RESULT_HEADER

    if pending_search:
        # Contextual Search
        keywords = pending_search.get("keywords")
        # vibes = pending_search.get("vibes") # TODO: Implement Vibe filtering if needed
        
        if keywords:
            query_filter["$text"] = {"$search": keywords}
            reply_prefix = strings.MSG_GEO_RESULT_CONTEXT_HEADER.format(keywords=keywords)
            
        # Clean up context
        user_context_store.clear(user.id)
    else:
        # General "Around Me" Search (No keywords)
        # Just return nearest places
        pass

    try:
        places = await Place.find(query_filter).limit(5).to_list()
        
        if not places:
            await update.message.reply_text(strings.MSG_NO_RESULT_AROUND)
            return
            
        response_text = reply_prefix
        for p in places:
            # Calculate distance if possible (requires Haversine or just trust MongoDB order)
            # For MVP just list them
            response_text += strings.SEARCH_RESULT_ITEM.format(
                name=p.name,
                rating=p.rating or "N/A",
                address=p.address or "Unknown",
                vibes=", ".join(p.vibes[:3]),
                map_url=p.google_maps_url
            )
            
        await update.message.reply_html(response_text)
        
    except Exception as e:
        logger.error(f"Geo search failed: {e}")
        await update.message.reply_text(strings.ERR_GEO_FAILED)
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo uploads for Place Extraction."""
    settings = get_settings()
    user = update.effective_user
    
    # Check for old messages to prevent thundering herd
    if update.message.date:
        message_age = (datetime.now(timezone.utc) - update.message.date).total_seconds()
        if message_age > settings.MAX_MESSAGE_AGE_SECONDS:
            logger.warning(f"Ignored old photo from {update.effective_user.id} (Age: {message_age:.2f}s)")
            return

    # Rate Limit
    if not rate_limiter.check_limit(update.effective_user.id, settings.RATE_LIMIT_PER_MINUTE):
        logger.warning(f"Rate limit exceeded for {update.effective_user.id}")
        # Optional: Reply once or just ignore?
        # await update.message.reply_text("Marin đang bận xíu, bạn chờ 1 phút nhé!")
        return

    if not settings.FEAT_SCREENSHOT_ANALYSIS:
        await update.message.reply_text(strings.MSG_MAINTENANCE_SCREENSHOT)
        return

    status_msg = await update.message.reply_text(strings.MSG_ANALYZING_PHOTO)
    
    try:
        # Get highest res photo
        photo = update.message.photo[-1]
        file = await context.bot.get_file(photo.file_id)
        
        # Download to memory
        import io
        f = io.BytesIO()
        await file.download_to_memory(f)
        f.seek(0)
        image_bytes = f.read()

        image_bytes = f.read()

        # Save Image Locally
        try:
            rel_path, abs_path = await image_manager.save_screenshot(image_bytes, user.id)
            logger.info(f"Saved image to {abs_path}")
        except Exception as e:
            logger.error(f"Failed to save image: {e}")
            rel_path = None

        # Optimize Image
        from src.core.utils import resize_image
        image_bytes = resize_image(image_bytes)
        
        # Call AI
        # Reuse analyze_place_complex with empty text
        analysis = await ai_service.analyze_place_complex(
            text_data="Analyze this screenshot to extract place information.", 
            images=[(image_bytes, "image/jpeg")]
        )
        
        if "error" in analysis:
            await status_msg.edit_text(strings.ERROR_AI_FAIL.format(error=analysis['error']))
            return

        details = analysis.get("details", {})
        marin_comment = analysis.get("marin_comment", strings.MARIN_BUSY)

        # Create DB Object (Similar logic to link handler)
        # Note: We might need to handle missing data more gracefully here since screenshots vary
        
        # ... (Reuse saving logic? Or just show result?)
        # For now, let's just Show Result to verify logic, then Save if valid.
        
        if not details.get("name"):
             await status_msg.edit_text(strings.MSG_NAME_NOT_FOUND)
             return

            # Prepare for saving
        categories = details.get('categories', [])
        meal_types = details.get('meal_types', [])
        occasions = details.get('occasions', [])
        full_categories = list(set(categories + meal_types + occasions))
        
        # Geocode if location is missing
        location_data = None
        if details.get('name'):
             # start_time = datetime.now()
             geo_res = await link_parser.geocode_place(details.get('name'), details.get('address'))
             if geo_res:
                 loc_api = geo_res["location"]
                 location_data = {
                     "type": "Point",
                     "coordinates": [loc_api['longitude'], loc_api['latitude']]
                 }
                 # Update address with official one if available
                 if geo_res.get("address"):
                     details['address'] = geo_res.get("address")
        
        place = Place(
            name=details.get('name', 'Unknown Spot'),
            address=details.get('address'),
            location=location_data,
            categories=full_categories,
            meal_types=meal_types,
            occasions=occasions,
            vibes=details.get('vibes', []),
            mood=details.get('mood', []),
            aesthetic_score=details.get('aesthetic_score'),
            lighting=details.get('lighting'),
            source_img_id=photo.file_id, # Save file_id for reference
            local_image_path=rel_path,   # Save local path
            rating=details.get('rating'),
            price_level=details.get('price_level'),
            status=details.get('status'),
            opening_hours=details.get('opening_hours'),
            popular_times=details.get('popular_times'),
            # Future-proofing
            raw_ai_response=analysis,
            schema_version=1,
            created_at=datetime.now()
        )
        
        await place.save()
        
        # Reply
        hours_section = ""
        if place.opening_hours:
            hours_section = f"🕒 <b>Hours:</b> {place.opening_hours}\n"
        
        caption = strings.PLACE_CARD_TEMPLATE.format(
            name=place.name,
            address=place.address,
            categories=', '.join(place.categories) if place.categories else 'Secret Spot',
            rating=place.rating or 'N/A',
            price_level=place.price_level or 'N/A',
            vibes=', '.join(place.vibes),
            aesthetic_score=place.aesthetic_score or 'N/A',
            hours_section=hours_section,
            comment=marin_comment
        )
        
        await status_msg.edit_text(caption, parse_mode="HTML")

    except Exception as e:
        logger.error(f"Photo handling error: {e}")
        await status_msg.edit_text(strings.ERROR_GENERIC.format(error="Marin bị hoa mắt rồi..."))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages (Check for Links)."""
    text = update.message.text
    user = update.effective_user
    settings = get_settings()

    # Check for old messages to prevent thundering herd
    if update.message.date:
        message_age = (datetime.now(timezone.utc) - update.message.date).total_seconds()
        if message_age > settings.MAX_MESSAGE_AGE_SECONDS:
            logger.warning(f"Ignored old message from {user.id} (Age: {message_age:.2f}s)")
            return
            
    # Rate Limit
    if not rate_limiter.check_limit(user.id, settings.RATE_LIMIT_PER_MINUTE):
         logger.warning(f"Rate limit exceeded for {user.id}")
         return
    
    # Check for URL
    url = link_parser.extract_url(text)
    
    
    if url and link_parser.is_google_maps_url(url):
        # 0. Check for Duplicate
        existing_place = await Place.find_one(Place.google_maps_url == url)
        if existing_place:
            # Re-use the view logic display
            hours_section = ""
            if existing_place.opening_hours:
                hours_section = f"🕒 <b>Hours:</b> {existing_place.opening_hours}\n"
            
            caption = strings.PLACE_CARD_TEMPLATE.format(
                name=existing_place.name,
                address=existing_place.address,
                categories=', '.join(existing_place.categories) if existing_place.categories else 'Secret Spot',
                rating=existing_place.rating or 'N/A',
                price_level=existing_place.price_level or 'N/A',
                vibes=', '.join(existing_place.vibes),
                aesthetic_score=existing_place.aesthetic_score or 'N/A',
                hours_section=hours_section,
                comment=strings.MSG_ALREADY_SAVED.format(id=existing_place.id)
            )
            await update.message.reply_html(caption)
            return

        status_msg = await update.message.reply_text(strings.SEARCHING_MSG.format(url=url))
        
        try:
            # 1. Fetch Info via Parser (Simulate Search/Analysis)
            raw_info = await link_parser.fetch_place_info(url)
            
            if "error" in raw_info:
                await status_msg.edit_text(strings.ERROR_FETCH_FAIL.format(error=raw_info['error']))
                return

            # 2. Get AI Commentary & Structured Data (Combined)
            # raw_info contains: text_data, images (bytes)
            analysis = await ai_service.analyze_place_complex(
                text_data=raw_info.get("text_data", ""), 
                images=raw_info.get("images", [])
            )
            
            if "error" in analysis:
                await status_msg.edit_text(strings.ERROR_AI_FAIL.format(error=analysis['error']))
                return

            details = analysis.get("details", {})
            marin_comment = analysis.get("marin_comment", strings.MARIN_BUSY)

            # 3. Create DB Object
            categories = details.get('categories', [])
            meal_types = details.get('meal_types', [])
            occasions = details.get('occasions', [])
            
            # Merge for search/display as requested ("put into category")
            full_categories = list(set(categories + meal_types + occasions))
            
            # Extract Location from Raw API if available
            location_data = None
            if raw_info.get("raw_api") and "location" in raw_info["raw_api"]:
                loc_api = raw_info["raw_api"]["location"]
                location_data = {
                    "type": "Point",
                    "coordinates": [loc_api['longitude'], loc_api['latitude']]
                }

            # Save Thumbnail (from Scraper or API)
            local_image_path = None
            if raw_info.get("images"):
                try:
                    # raw_info['images'] contains (bytes, mime_type) tuples
                    img_bytes, _ = raw_info["images"][0]
                    rel_path, abs_path = await image_manager.save_screenshot(img_bytes, user.id)
                    local_image_path = rel_path
                    logger.info(f"Saved thumbnail to {abs_path}")
                except Exception as e:
                    logger.error(f"Failed to save thumbnail: {e}")
            
            place = Place(
                name=details.get('name', raw_info.get('inferred_name', 'Unknown Spot')),
                address=details.get('address'),
                location=location_data,
                categories=full_categories, # Merged list
                meal_types=meal_types,      # Stored separately too
                occasions=occasions,        # Stored separately too
                vibes=details.get('vibes', []),
                mood=details.get('mood', []), # List[str]
                aesthetic_score=details.get('aesthetic_score'),
                lighting=details.get('lighting'),
                google_maps_url=url,
                local_image_path=local_image_path, # Image Path
                rating=details.get('rating'),
                price_level=details.get('price_level'),
                status=details.get('status'),
                opening_hours=details.get('opening_hours'),
                popular_times=details.get('popular_times'),
                # Future-proofing
                raw_ai_response=analysis,
                schema_version=1,
                created_at=datetime.now()
            )
            
            # 4. Save
            await place.save()
            
            # 5. Reply
            hours_section = ""
            if place.opening_hours:
                hours_section = f"🕒 <b>Hours:</b> {place.opening_hours}\n"
            
            caption = strings.PLACE_CARD_TEMPLATE.format(
                name=place.name,
                address=place.address,
                categories=', '.join(place.categories) if place.categories else 'Secret Spot',
                rating=place.rating or 'N/A',
                price_level=place.price_level or 'N/A',
                vibes=', '.join(place.vibes),
                aesthetic_score=place.aesthetic_score or 'N/A',
                hours_section=hours_section,
                comment=marin_comment
            )
            
            await status_msg.edit_text(caption, parse_mode="HTML")
            
        except Exception as e:
            logger.error(f"Link handling error: {e}")
            await status_msg.edit_text(strings.ERROR_GENERIC.format(error=e))
    else:
        # Search Intent Handling
        settings = get_settings()
        
        if not settings.FEAT_PLACE_SEARCH:
             await update.message.reply_text(strings.DEFAULT_RESPONSE)
             return

        # --- Spam Prevention / Token Saving ---
        # Only call AI if message looks like a legitimate search query
        # Heuristics:
        # 1. Length check (> 3 chars)
        # 2. Keywords check (must contain at least one search-related word)
        
        search_keywords = [
            "tìm", "kiếm", "quán", "cafe", "cà phê", "bar", "pub", "ăn", "uống", 
            "review", "chill", "view", "đẹp", "ngon", "rẻ", "đâu", "chỗ", "vibe",
            "work", "date", "hẹn", "hò", "nhậu", "coffee", "restaurant"
        ]
        
        is_search_intent = False
        text_lower = text.lower()
        
        if len(text) > 3:
            if any(k in text_lower for k in search_keywords):
                is_search_intent = True
            # Allow explicit prefixes if you want
            if text.startswith("?") or text.lower().startswith("find"):
                is_search_intent = True
                
        if not is_search_intent:
            # Just ignore or random reply without AI
            # Random helpful message to guide user
            await update.message.reply_text(strings.MSG_HELP_SPAM_FILTER)
            return
            
        status_msg = await update.message.reply_text(strings.MSG_SEARCHING_MEMORY)
        
        try:
            # 1. Extract Intent
            intent = await ai_service.analyze_search_query(text)
            
            if "error" in intent:
                 await status_msg.edit_text(strings.ERROR_GENERIC.format(error="Marin không hiểu ý bạn rồi 🥺"))
                 return

            # Check for Location Requirement
            if intent.get("location_needed"):
                if settings.FEAT_GEO_SEARCH:
                    user_context_store.set_pending_search(user.id, intent)
                    await status_msg.edit_text(strings.MSG_SEND_LOCATION, parse_mode="HTML")
                    return
                # If feature disabled, proceed to normal text search (fall through)

            # 2. Build MongoDB Query
            query_filter = {}
            
            # Text Search (Name or Category) - Requires Text Index
            if intent.get("keywords"):
                query_filter["$text"] = {"$search": intent["keywords"]}
            
            # Vibes (All vibes must match, case insensitive logic handled by $text usually or regex if needed)
            # For simplicity using $all for vibes list if provided
            if intent.get("vibes"):
                 # Case-insensitive Regex for each vibe? MongoDB $text is better but let's try strict first
                 # Or just relying on text search for vibes if indexed?
                 # Let's use $in or $all if exact match, but vibes are unstructured.
                 # BETTER STRATEGY: Use keywords for text search.
                 pass

            # Rating
            min_rating = intent.get("min_rating", 0)
            if min_rating > 0:
                query_filter["rating"] = {"$gte": min_rating}

            # 3. Execute Query
            # If no keywords, finding by rating/recency
            if not intent.get("keywords") and not intent.get("vibes"):
                # Just random/latest if query was vague? Or fail?
                # Let's search latest
                places = await Place.find(query_filter).sort("-created_at").limit(3).to_list()
            else:
                # With text search
                places = await Place.find(query_filter).limit(3).to_list()
            
            if not places:
                await status_msg.edit_text(strings.SEARCH_NO_RESULT)
                return
            
            # 4. Format Results
            response_text = strings.SEARCH_RESULT_HEADER.format(count=len(places))
            for p in places:
                response_text += strings.SEARCH_RESULT_ITEM.format(
                    name=p.name,
                    rating=p.rating or "N/A",
                    address=p.address or "Unknown",
                    vibes=", ".join(p.vibes[:3]),
                    map_url=p.google_maps_url
                )
            
            await status_msg.edit_text(response_text, parse_mode="HTML")

        except Exception as e:
            logger.error(f"Search failed: {e}")
            await status_msg.edit_text(strings.ERROR_GENERIC.format(error=e))

async def handle_view_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /view_{id} command to show full place details."""
    try:
        query = update.message.text
        # Extract ID (format /view_OBJECTID)
        place_id = query.replace("/view_", "").strip()
        
        place = await Place.get(place_id)
        if not place:
            await update.message.reply_text(strings.ERR_MSG_404)
            return

        hours_section = ""
        if place.opening_hours:
            hours_section = f"🕒 <b>Hours:</b> {place.opening_hours}\n"
            
        categories_display = ', '.join(place.categories) if place.categories else 'Secret Spot'
        vibes_display = ', '.join(place.vibes)
        
        caption = strings.PLACE_CARD_TEMPLATE.format(
            name=place.name,
            address=place.address,
            categories=categories_display,
            rating=place.rating or 'N/A',
            price_level=place.price_level or 'N/A',
            vibes=vibes_display,
            aesthetic_score=place.aesthetic_score or 'N/A',
            hours_section=hours_section,
            comment=strings.MSG_VIEW_FROM_LOCBOOK 
        )
        
        await update.message.reply_text(caption, parse_mode="HTML")
        
    except Exception as e:
        logger.error(f"View place failed: {e}")
        await update.message.reply_text(strings.ERROR_GENERIC.format(error=strings.MSG_PLACE_NOT_FOUND))

def get_handlers():
    """Return a list of handlers to add to the application."""
    return [
        CommandHandler("start", start_command),
        CommandHandler("help", help_command),
        MessageHandler(filters.Regex(r"^/view_"), handle_view_command),
        MessageHandler(filters.PHOTO, handle_photo),
        MessageHandler(filters.LOCATION, handle_location),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message),
    ]
