from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, MessageHandler, filters
import logging
from datetime import datetime, timezone

from src.modules.places.parser import link_parser
from src.core.database.sql_models import Place
from src.core.database.postgres import get_db_session
from src.core.config import get_settings
from src.modules.bot.rate_limiter import rate_limiter
import src.modules.bot.strings as strings
from src.core.redis import enqueue_task
from sqlmodel import select

logger = logging.getLogger(__name__)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a welcome message when /start is issued."""
    user = update.effective_user
    await update.message.reply_html(
        f"Moshi Moshi! {user.mention_html()}! Mình là Marin, AI Location Scout. 📸\n"
        "Gửi link Google Maps để mình phân tích và lưu vào LocBook nha!"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send usage guide when /help is issued."""
    await update.message.reply_text(
        "📌 Gửi link Google Maps cho Marin để phân tích quán!\n"
        "Ví dụ: https://maps.app.goo.gl/xxx"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages — ACK immediately, enqueue heavy work to Worker."""
    text = update.message.text
    user = update.effective_user
    settings = get_settings()

    # Ignore old messages
    if update.message.date:
        message_age = (datetime.now(timezone.utc) - update.message.date).total_seconds()
        if message_age > settings.MAX_MESSAGE_AGE_SECONDS:
            logger.warning(f"Ignored old message from {user.id} (Age: {message_age:.2f}s)")
            return

    # Rate limit
    if not rate_limiter.check_limit(user.id, settings.RATE_LIMIT_PER_MINUTE):
        logger.warning(f"Rate limit exceeded for {user.id}")
        return

    # Extract URL
    url = link_parser.extract_url(text)

    if not url or not link_parser.is_google_maps_url(url):
        await update.message.reply_text(strings.DEFAULT_RESPONSE)
        return

    # --- Google Maps Link: Quick duplicate check, then enqueue ---
    async for db in get_db_session():
        # Fast duplicate check (lightweight, stays in Bot)
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
            await update.message.reply_html(caption)
            return

    # ACK: Send status message immediately
    status_msg = await update.message.reply_text(strings.SEARCHING_MSG.format(url=url))

    # Enqueue heavy work to Worker
    try:
        await enqueue_task(
            "process_google_maps_link",
            update.effective_chat.id,
            status_msg.message_id,
            url,
        )
        logger.info(f"Enqueued link processing for {url} (chat={update.effective_chat.id})")
    except Exception as e:
        logger.error(f"Failed to enqueue task: {e}")
        await status_msg.edit_text(strings.ERROR_GENERIC.format(error="Hệ thống đang bận, thử lại sau nhé!"))


def get_handlers():
    """Return bot handlers."""
    return [
        CommandHandler("start", start_command),
        CommandHandler("help", help_command),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message),
    ]
