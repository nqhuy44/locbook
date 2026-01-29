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
import datetime
from src.config import get_settings

# async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     """Handle photo uploads (Temporarily Disabled)."""
#     await update.message.reply_text("📸 Dừng chút! Marin đang tập trung vào Link Google Maps nha. Gửi link cho mình đi!")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages (Check for Links)."""
    text = update.message.text
    user = update.effective_user
    
    # Check for URL
    url = link_parser.extract_url(text)
    
    
    if url and link_parser.is_google_maps_url(url):
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
            
            place = Place(
                name=details.get('name', raw_info.get('inferred_name', 'Unknown Spot')),
                address=details.get('address'),
                categories=full_categories, # Merged list
                meal_types=meal_types,      # Stored separately too
                occasions=occasions,        # Stored separately too
                vibes=details.get('vibes', []),
                mood=details.get('mood', []), # List[str]
                aesthetic_score=details.get('aesthetic_score'),
                lighting=details.get('lighting'),
                google_maps_url=url,
                rating=details.get('rating'),
                price_level=details.get('price_level'),
                status=details.get('status'),
                opening_hours=details.get('opening_hours'),
                popular_times=details.get('popular_times'),
                created_at=datetime.datetime.now()
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

        status_msg = await update.message.reply_text("🔎 Marin đang lục lọi trí nhớ xem có quán nào hợp không nhe... (Đợi xíu)")
        
        try:
            # 1. Extract Intent
            intent = await ai_service.analyze_search_query(text)
            
            if "error" in intent:
                 await status_msg.edit_text(strings.ERROR_GENERIC.format(error="Marin không hiểu ý bạn rồi 🥺"))
                 return

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
                    id=str(p.id)
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
            comment="<i>(Xem lại từ LocBook)</i>" 
        )
        
        await update.message.reply_text(caption, parse_mode="HTML")
        
    except Exception as e:
        logger.error(f"View place failed: {e}")
        await update.message.reply_text(strings.ERROR_GENERIC.format(error="Không tìm thấy quán này."))

def get_handlers():
    """Return a list of handlers to add to the application."""
    return [
        CommandHandler("start", start_command),
        CommandHandler("help", help_command),
        MessageHandler(filters.Regex(r"^/view_"), handle_view_command),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message),
    ]
