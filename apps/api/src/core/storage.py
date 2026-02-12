import os
import shutil
import logging
from abc import ABC, abstractmethod
from typing import Optional
from fastapi import UploadFile

from src.core.config import get_settings

logger = logging.getLogger(__name__)

class StorageService(ABC):
    @abstractmethod
    async def save_file(self, file_data: bytes, filename: str, content_type: str, folder: str = "images") -> str:
        """Save bytes to storage and return the public URL or path."""
        pass

    @abstractmethod
    async def save_upload_file(self, file: UploadFile, filename: str, folder: str = "images") -> str:
        """Save FastAPI UploadFile to storage and return the public URL or path."""
        pass

class LocalStorage(StorageService):
    def __init__(self):
        self.base_path = "data"
        os.makedirs(self.base_path, exist_ok=True)

    async def save_file(self, file_data: bytes, filename: str, content_type: str, folder: str = "images") -> str:
        # Local path: data/{folder}/{filename}
        # Web path: /{folder}/{filename} (assuming static mount)
        
        directory = os.path.join(self.base_path, folder)
        os.makedirs(directory, exist_ok=True)
        
        file_path = os.path.join(directory, filename)
        with open(file_path, "wb") as f:
            f.write(file_data)
            
        logger.info(f"Saved local file: {file_path}")
        return f"/{folder}/{filename}"

    async def save_upload_file(self, file: UploadFile, filename: str, folder: str = "images") -> str:
        directory = os.path.join(self.base_path, folder)
        os.makedirs(directory, exist_ok=True)
        
        file_path = os.path.join(directory, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Saved local upload: {file_path}")
        return f"/{folder}/{filename}"

class S3Storage(StorageService):
    def __init__(self):
        try:
            import boto3
            self.s3 = boto3.client(
                's3',
                aws_access_key_id=get_settings().AWS_ACCESS_KEY_ID,
                aws_secret_access_key=get_settings().AWS_SECRET_ACCESS_KEY,
                region_name=get_settings().AWS_REGION
            )
            self.bucket = get_settings().AWS_BUCKET_NAME
        except ImportError:
            logger.error("boto3 not installed. S3 storage unavailable.")
            raise

    async def save_file(self, file_data: bytes, filename: str, content_type: str, folder: str = "images") -> str:
        key = f"{folder}/{filename}"
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type,
            ACL='public-read' # Adjust if using private bucket + signed URLs
        )
        # Return public URL
        return f"https://{self.bucket}.s3.amazonaws.com/{key}"

    async def save_upload_file(self, file: UploadFile, filename: str, folder: str = "images") -> str:
        content = await file.read()
        return await self.save_file(content, filename, file.content_type, folder)

class GCSStorage(StorageService):
    def __init__(self):
        try:
            from google.cloud import storage
            # Assumes GOOGLE_APPLICATION_CREDENTIALS env var is set or passed explicitly
            self.client = storage.Client()
            self.bucket = self.client.bucket(get_settings().GCS_BUCKET_NAME)
        except ImportError:
            logger.error("google-cloud-storage not installed. GCS storage unavailable.")
            raise

    async def save_file(self, file_data: bytes, filename: str, content_type: str, folder: str = "images") -> str:
        blob = self.bucket.blob(f"{folder}/{filename}")
        blob.upload_from_string(file_data, content_type=content_type)
        blob.make_public()
        return blob.public_url

    async def save_upload_file(self, file: UploadFile, filename: str, folder: str = "images") -> str:
        blob = self.bucket.blob(f"{folder}/{filename}")
        # Reset file pointer just in case
        await file.seek(0)
        content = await file.read()
        blob.upload_from_string(content, content_type=file.content_type)
        blob.make_public()
        return blob.public_url

def get_storage() -> StorageService:
    settings = get_settings()
    stype = settings.STORAGE_TYPE.upper()
    
    if stype == "S3":
        return S3Storage()
    elif stype == "GCS":
        return GCSStorage()
    else:
        return LocalStorage()
