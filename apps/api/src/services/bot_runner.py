import logging
from telegram.ext import ApplicationBuilder
from src.core.config import get_settings
from src.core.logger import setup_logging
from src.modules.bot.handlers import get_handlers

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

def main():
    settings = get_settings()
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set.")
        return

    logger.info("Starting Telegram Bot...")
    
    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
    
    handlers = get_handlers()
    for handler in handlers:
        app.add_handler(handler)
        
    logger.info(f"Bot initialized with {len(handlers)} handlers. Polling...")
    app.run_polling()

if __name__ == "__main__":
    main()
