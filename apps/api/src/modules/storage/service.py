"""Storage service — abstract file storage with Local and S3 implementations."""
import logging
import os
import shutil
import uuid
from abc import ABC, abstractmethod
from typing import Optional

from src.core.config import get_settings

logger = logging.getLogger(__name__)


class StorageService(ABC):
    """Abstract base class for file storage."""

    @abstractmethod
    async def upload(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """Upload file and return public URL."""
        ...

    @abstractmethod
    async def delete(self, url: str) -> bool:
        """Delete file by URL. Returns True if deleted."""
        ...


class LocalStorageService(StorageService):
    """Store files locally in data/uploads/. For development."""

    def __init__(self, upload_dir: str = "data/uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    async def upload(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        # Generate unique filename
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
        file_path = os.path.join(self.upload_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        logger.info(f"Stored locally: {file_path}")
        return f"/uploads/{unique_name}"

    async def delete(self, url: str) -> bool:
        # Extract filename from URL
        filename = url.split("/")[-1]
        file_path = os.path.join(self.upload_dir, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False


class S3StorageService(StorageService):
    """Store files in S3-compatible storage (AWS S3, Cloudflare R2, GCS)."""

    def __init__(self):
        settings = get_settings()
        self.bucket = getattr(settings, "S3_BUCKET", None)
        self.endpoint = getattr(settings, "S3_ENDPOINT", None)
        self.access_key = getattr(settings, "S3_ACCESS_KEY", None)
        self.secret_key = getattr(settings, "S3_SECRET_KEY", None)
        self.public_url = getattr(settings, "S3_PUBLIC_URL", None)

    async def upload(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """Upload to S3. Requires boto3."""
        try:
            import boto3
            from botocore.config import Config as BotoConfig

            client = boto3.client(
                "s3",
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=BotoConfig(signature_version="s3v4"),
            )

            ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
            key = f"uploads/{uuid.uuid4().hex[:12]}.{ext}"

            client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )

            if self.public_url:
                return f"{self.public_url}/{key}"
            return f"https://{self.bucket}.s3.amazonaws.com/{key}"

        except ImportError:
            logger.error("boto3 not installed. Run: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    async def delete(self, url: str) -> bool:
        try:
            import boto3
            from botocore.config import Config as BotoConfig

            client = boto3.client(
                "s3",
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=BotoConfig(signature_version="s3v4"),
            )

            # Extract key from URL
            key = url.split("/", 3)[-1] if "/" in url else url
            client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")
            return False


def get_storage_service() -> StorageService:
    """Factory: return the appropriate storage service based on config."""
    settings = get_settings()
    mode = getattr(settings, "STORAGE_MODE", "local")
    
    if mode == "s3":
        return S3StorageService()
    return LocalStorageService()


# Global singleton
storage = get_storage_service()
