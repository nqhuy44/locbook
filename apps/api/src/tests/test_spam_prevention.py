import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timedelta, timezone
from src.bot.handlers import handle_message
from src.config import Settings

class TestSpamPrevention(unittest.IsolatedAsyncioTestCase):
    async def test_handle_message_ignores_old_message(self):
        # Mock settings
        mock_settings = Settings(
            TELEGRAM_BOT_TOKEN="test",
            MAX_MESSAGE_AGE_SECONDS=10
        )
        
        # Mock Update object
        update = MagicMock()
        update.effective_user.id = 12345
        update.message.text = "https://goo.gl/maps/example"
        
        # Set message date to be older than MAX_MESSAGE_AGE_SECONDS
        # 20 seconds ago
        update.message.date = datetime.now(timezone.utc) - timedelta(seconds=20)
        
        context = MagicMock()

        # Patches
        with patch("src.bot.handlers.get_settings", return_value=mock_settings), \
             patch("src.bot.handlers.logger") as mock_logger, \
             patch("src.bot.handlers.link_parser") as mock_link_parser:
            
            await handle_message(update, context)
            
            # Check that warning was logged
            args, _ = mock_logger.warning.call_args
            assert "Ignored old message" in args[0]
            
            # Ensure parsing was NOT triggered
            mock_link_parser.extract_url.assert_not_called()

    async def test_handle_message_processes_new_message(self):
        # Mock settings
        mock_settings = Settings(
            TELEGRAM_BOT_TOKEN="test",
            MAX_MESSAGE_AGE_SECONDS=120
        )
        
        # Mock Update object
        update = MagicMock()
        update.effective_user.id = 12345
        update.message.text = "Hello"
        # Fix AsyncMock
        update.message.reply_text = AsyncMock()
        update.message.reply_html = AsyncMock() 
        
        # Set message date to be recent (now)
        update.message.date = datetime.now(timezone.utc)
        
        context = MagicMock()

        # Patches
        with patch("src.bot.handlers.get_settings", return_value=mock_settings), \
             patch("src.bot.handlers.logger") as mock_logger, \
             patch("src.bot.handlers.link_parser") as mock_link_parser:
            
            # Mock extract_url to return None so we don't hit DB/AI logic
            mock_link_parser.extract_url.return_value = None
            
            await handle_message(update, context)
            
            # Check that warning was NOT logged
            mock_logger.warning.assert_not_called()
            
            # Ensure parsing WAS triggered
            mock_link_parser.extract_url.assert_called_once()

if __name__ == "__main__":
    unittest.main()
