import os
import aiofiles
from datetime import datetime
import uuid
from typing import Tuple

class ImageManager:
    def __init__(self, base_dir: str = "data/images"):
        self.base_dir = base_dir
        self.screenshot_dir = os.path.join(base_dir, "screenshots")
        self.places_dir = os.path.join(base_dir, "places")
        
        # Ensure directories exist
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.places_dir, exist_ok=True)

    async def save_screenshot(self, image_bytes: bytes, user_id: int) -> Tuple[str, str]:
        """
        Save a screenshot to data/images/screenshots/YYYY-MM-DD/uuid.jpg
        Returns: (relative_path, absolute_path)
        """
        # Create date subfolder
        today = datetime.now().strftime("%Y-%m-%d")
        daily_dir = os.path.join(self.screenshot_dir, today)
        os.makedirs(daily_dir, exist_ok=True)
        
        # Generate filename
        filename = f"{uuid.uuid4()}.jpg"
        abs_path = os.path.join(daily_dir, filename)
        
        # Save file
        async with aiofiles.open(abs_path, 'wb') as out_file:
            await out_file.write(image_bytes)
            
        # Return relative path for DB storage (independent of deployment path)
        relative_path = os.path.join("screenshots", today, filename)
        return relative_path, abs_path

# Singleton instance
image_manager = ImageManager()
