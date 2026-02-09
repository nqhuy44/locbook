import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import os
import shutil
from src.core.image_manager import ImageManager
from src.bot.handlers import handle_photo
from src.database.models import Place

class TestFutureProofing(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Use a temp dir for testing
        self.test_dir = "data/test_images"
        self.image_manager = ImageManager(base_dir=self.test_dir)
        
    def tearDown(self):
        # Cleanup
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    async def test_image_persistence(self):
        user_id = 123
        img_bytes = b"fake_image_data"
        
        rel_path, abs_path = await self.image_manager.save_screenshot(img_bytes, user_id)
        
        self.assertTrue(os.path.exists(abs_path))
        self.assertIn("screenshots", rel_path)
        
    async def test_rich_data_saving(self):
        # Mock Context/Update
        update = MagicMock()
        update.effective_user.id = 123
        update.message.date = None
        update.message.photo = [MagicMock(file_id="123")]
        
        context = MagicMock()
        # Mock get_file -> download_to_memory
        mock_file = AsyncMock()
        
        async def mock_download(f):
            f.write(b"fake_image")
            
        mock_file.download_to_memory = AsyncMock(side_effect=mock_download)
        
        # KEY FIX: context.bot.get_file must be AsyncMock
        context.bot.get_file = AsyncMock()
        context.bot.get_file.return_value = mock_file
        
        # Mock Settings
        with patch('src.bot.handlers.get_settings') as mock_settings:
            mock_settings.return_value.FEAT_SCREENSHOT_ANALYSIS = True
            mock_settings.return_value.MAX_MESSAGE_AGE_SECONDS = 999
            mock_settings.return_value.RATE_LIMIT_PER_MINUTE = 999

            # Mock AI Service to return Rich Data
            rich_response = {
                "details": {
                    "name": "Rich Cafe",
                    "noise_level": "Quiet",
                    "crowd_type": ["Students"],
                    "amenities": ["Wifi"],
                    "best_time_to_visit": "Afternoon"
                },
                "marin_comment": "Wow"
            }
            
            with patch('src.bot.handlers.ai_service.analyze_place_complex', new_callable=AsyncMock) as mock_ai:
                mock_ai.return_value = rich_response
                
                # Mock Rate Limiter
                with patch('src.bot.handlers.rate_limiter.check_limit', return_value=True):
                    # Mock Place Class (Avoid Beanie initialization)
                    with patch('src.bot.handlers.Place') as MockPlace:
                        mock_place_instance = MockPlace.return_value
                        mock_place_instance.save = AsyncMock()
                        
                        # Mock ImageManager in handlers (Swap global instance)
                        with patch('src.bot.handlers.image_manager', self.image_manager):
                             # Make sure 'status_msg' works
                             update.message.reply_text = AsyncMock()
                             update.message.reply_text.return_value.edit_text = AsyncMock()
                             
                             await handle_photo(update, context)
                             
                             # Verify Save called
                             self.assertTrue(mock_place_instance.save.called)

if __name__ == "__main__":
    unittest.main()
