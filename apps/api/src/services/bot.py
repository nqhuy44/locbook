"""Telegram Bot entrypoint.

Run with: python src/services/bot.py
"""
import logging
import asyncio

from telegram.ext import ApplicationBuilder
from src.core.config import get_settings
from src.modules.bot.handlers import get_handlers

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


def main():
    """Start the Telegram bot with polling."""
    settings = get_settings()
    
    if not settings.ENABLE_BOT:
        logger.info("Bot is disabled via ENABLE_BOT=False. Exiting.")
        return

    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
    
    for handler in get_handlers():
        app.add_handler(handler)
    
    logger.info("🤖 Marin Bot starting (polling mode)...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
