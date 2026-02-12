"""ARQ Worker tasks for background processing.

These tasks are executed by the ARQ worker service, not by the Bot or API.
The Bot enqueues tasks here; the Worker processes them and sends replies via Telegram.
"""
import logging
import os
import httpx
from sqlmodel import select

from src.modules.places.parser import link_parser
from src.core.llm import ai_service
from src.core.database.sql_models import Place
from src.core.database.postgres import get_db_session
from src.core.config import get_settings
import src.modules.bot.strings as strings

logger = logging.getLogger(__name__)


async def process_google_maps_link(ctx: dict, chat_id: int, status_message_id: int, url: str):
    """
    Worker task: fetch Google Maps info, analyze with AI, save to DB, reply via Telegram.
    
    Args:
        ctx: ARQ context (contains 'bot' for Telegram access)
        chat_id: Telegram chat ID to reply to
        status_message_id: Message ID of the "Searching..." status message to edit
        url: Google Maps URL to process
    """
    bot = ctx.get("bot")
    if not bot:
        logger.error("Telegram bot not available in worker context")
        return

    try:
        async for db in get_db_session():
            # 1. Check duplicate (race condition guard)
            stmt = select(Place).where(Place.google_maps_url == url)
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                caption = strings.PLACE_CARD_TEMPLATE.format(
                    name=existing.name,
                    address=existing.address or "N/A",
                    categories=", ".join(existing.categories) if existing.categories else "N/A",
                    rating=existing.rating or "N/A",
                    price_level=existing.price_level or "N/A",
                    vibes=", ".join(existing.vibes) if existing.vibes else "",
                    aesthetic_score=existing.aesthetic_score or "N/A",
                    hours_section=f"🕒 <b>Hours:</b> {existing.opening_hours}\n" if existing.opening_hours else "",
                    comment=strings.MSG_ALREADY_SAVED.format(id=existing.id),
                )
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_message_id,
                    text=caption,
                    parse_mode="HTML",
                )
                return

            # 2. Fetch place info
            raw_info = await link_parser.fetch_place_info(url)
            if "error" in raw_info:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_message_id,
                    text=strings.ERROR_FETCH_FAIL.format(error=raw_info["error"]),
                )
                return

            # 3. AI analysis
            analysis = await ai_service.analyze_place(
                text_data=raw_info.get("text_data", ""),
                images=raw_info.get("images", []),
            )
            if "error" in analysis:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_message_id,
                    text=strings.ERROR_AI_FAIL.format(error=analysis["error"]),
                )
                return

            details = analysis.get("details", {})
            marin_comment = analysis.get("marin_comment", strings.MARIN_BUSY)
            # Fix literal \n from JSON — replace with actual newlines
            marin_comment = marin_comment.replace("\\n", "\n")

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
            )

            # 4b. Download and save thumbnail
            thumbnail_photo_name = raw_info.get("thumbnail_photo_name")
            if thumbnail_photo_name:
                try:
                    img_data = await link_parser._fetch_photo_bytes(thumbnail_photo_name)
                    if img_data:
                        img_bytes, content_type = img_data
                        ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
                        os.makedirs("data/images", exist_ok=True)
                        filename = f"{place.id}.{ext}"
                        filepath = f"data/images/{filename}"
                        with open(filepath, "wb") as f:
                            f.write(img_bytes)
                        place.images = [f"/images/{filename}"]
                        place.local_image_path = filepath
                        logger.info(f"Saved thumbnail: {filepath}")
                except Exception as e:
                    logger.warning(f"Failed to save thumbnail: {e}")

            # 5. Save (with quality hooks: sync location + embed)
            from src.modules.places.quality import on_place_save
            place = await on_place_save(db, place)
            
            db.add(place)
            await db.commit()
            await db.refresh(place)

            # 6. Reply
            caption = strings.PLACE_CARD_TEMPLATE.format(
                name=place.name,
                address=place.address or "N/A",
                categories=", ".join(place.categories) if place.categories else "N/A",
                rating=place.rating or "N/A",
                price_level=place.price_level or "N/A",
                vibes=", ".join(place.vibes) if place.vibes else "",
                aesthetic_score=place.aesthetic_score or "N/A",
                hours_section=f"🕒 <b>Hours:</b> {place.opening_hours}\n" if place.opening_hours else "",
                comment=marin_comment,
            )
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=status_message_id,
                text=caption,
                parse_mode="HTML",
            )
            logger.info(f"Processed place: {place.name} (id={place.id})")

    except Exception as e:
        logger.error(f"Worker task error: {e}")
        try:
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=status_message_id,
                text=strings.ERROR_GENERIC.format(error=e),
            )
        except Exception:
            logger.error("Failed to send error message to user")
