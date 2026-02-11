import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from src.modules.bot.handlers import handle_message
from src.core.database.sql_models import Place


class TestBotHandlers(unittest.IsolatedAsyncioTestCase):
    """Test the simplified bot — Google Maps link handler only."""

    async def test_non_link_message_returns_default(self):
        """Non-link messages should return the default response."""
        update = MagicMock()
        update.effective_user.id = 123
        update.message.text = "hello marin"
        update.message.date = None
        update.message.reply_text = AsyncMock()

        context = MagicMock()

        with patch("src.bot.handlers.get_settings") as mock_settings:
            mock_settings.return_value.MAX_MESSAGE_AGE_SECONDS = 999
            mock_settings.return_value.RATE_LIMIT_PER_MINUTE = 999

            with patch("src.bot.handlers.rate_limiter.check_limit", return_value=True):
                await handle_message(update, context)

                update.message.reply_text.assert_called_once()
                call_args = update.message.reply_text.call_args[0][0]
                self.assertIn("Google Maps", call_args)

    async def test_google_maps_link_triggers_analysis(self):
        """A Google Maps link should trigger the fetch + analyze + save flow."""
        update = MagicMock()
        update.effective_user.id = 123
        update.message.text = "https://maps.app.goo.gl/test123"
        update.message.date = None
        update.message.reply_text = AsyncMock()
        update.message.reply_html = AsyncMock()

        status_msg = AsyncMock()
        update.message.reply_text.return_value = status_msg

        context = MagicMock()

        with patch("src.bot.handlers.get_settings") as mock_settings:
            mock_settings.return_value.MAX_MESSAGE_AGE_SECONDS = 999
            mock_settings.return_value.RATE_LIMIT_PER_MINUTE = 999

            with patch("src.bot.handlers.rate_limiter.check_limit", return_value=True):
                with patch("src.bot.handlers.link_parser") as mock_parser:
                    mock_parser.extract_url.return_value = "https://maps.app.goo.gl/test123"
                    mock_parser.is_google_maps_url.return_value = True
                    mock_parser.fetch_place_info = AsyncMock(return_value={
                        "status": "success",
                        "text_data": "name: Test Cafe",
                        "images": [],
                        "raw_api": None,
                        "inferred_name": "Test Cafe",
                    })

                    with patch("src.bot.handlers.ai_service") as mock_ai:
                        mock_ai.analyze_place = AsyncMock(return_value={
                            "details": {"name": "Test Cafe", "categories": ["Cafe"]},
                            "marin_comment": "Quán đẹp lắm!",
                        })

                        with patch("src.bot.handlers.get_db_session") as mock_db_gen:
                            mock_db = AsyncMock()
                            mock_db.execute = AsyncMock()
                            mock_db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
                            mock_db.add = MagicMock()
                            mock_db.commit = AsyncMock()
                            mock_db.refresh = AsyncMock()

                            # Make async generator yield the mock db
                            async def mock_gen():
                                yield mock_db

                            mock_db_gen.return_value = mock_gen()

                            await handle_message(update, context)

                            # Verify AI was called
                            mock_ai.analyze_place.assert_called_once()


if __name__ == "__main__":
    unittest.main()
