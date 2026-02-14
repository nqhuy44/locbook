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
            # Use shared service logic
            from src.modules.places.service import get_or_create_place_from_url
            
            try:
                place, created, marin_comment = await get_or_create_place_from_url(db, url)
            except ValueError as ve:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_message_id,
                    text=strings.ERROR_GENERIC.format(error=str(ve)),
                )
                return

            if not created:
                caption = strings.PLACE_CARD_TEMPLATE.format(
                    name=place.name,
                    address=place.address or "N/A",
                    categories=", ".join(place.categories) if place.categories else "N/A",
                    rating=place.rating or "N/A",
                    price_level=place.price_level or "N/A",
                    vibes=", ".join(place.vibes) if place.vibes else "",
                    aesthetic_score=place.aesthetic_score or "N/A",
                    hours_section=f"🕒 <b>Hours:</b> {place.opening_hours}\n" if place.opening_hours else "",
                    comment=strings.MSG_ALREADY_SAVED.format(id=place.id),
                )
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_message_id,
                    text=caption,
                    parse_mode="HTML",
                )
                return

            # Reply for new place
            if not marin_comment:
                 marin_comment = strings.MARIN_BUSY

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
