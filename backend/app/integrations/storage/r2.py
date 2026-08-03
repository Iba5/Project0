import logging
import uuid
from typing import Optional, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)


class R2StorageService:
    """
    Cloudflare R2 storage service for image uploads.
    Uses S3-compatible API via boto3.
    """
    
    def __init__(self):
        self._s3_client = None
        self.bucket_name = settings.R2_BUCKET_NAME
        self.account_id = settings.R2_ACCOUNT_ID
        self.access_key_id = settings.R2_ACCESS_KEY_ID
        self.secret_access_key = settings.R2_SECRET_ACCESS_KEY
        self.public_url = settings.R2_PUBLIC_URL
        
    def _get_s3_client(self):
        """
        Lazily initialize boto3 S3 client for R2.
        """
        if self._s3_client is None:
            try:
                import boto3
                from botocore.client import Config
                
                # R2 uses S3-compatible API with specific endpoint
                endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
                
                self._s3_client = boto3.client(
                    's3',
                    endpoint_url=endpoint_url,
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    config=Config(signature_version='s3v4'),
                    region_name='auto'
                )
                logger.info("R2 S3 client initialized successfully")
            except ImportError:
                logger.error("boto3 library not installed. Run: pip install boto3")
                raise ImportError("boto3 is required for R2 storage. Install with: pip install boto3")
            except Exception as e:
                logger.error(f"Failed to initialize R2 client: {str(e)}")
                raise
        
        return self._s3_client
    
    def upload_image(
        self,
        file_content: bytes,
        content_type: str,
        file_extension: str,
        folder: str = "uploads"
    ) -> Tuple[str, str]:
        """
        Upload an image to R2 storage.
        
        Args:
            file_content: Binary content of the file
            content_type: MIME type (e.g., 'image/jpeg')
            file_extension: File extension (e.g., '.jpg')
            folder: Folder path in bucket (default: 'uploads')
            
        Returns:
            Tuple of (public_url, file_key)
        """
        try:
            s3_client = self._get_s3_client()
            
            # Generate unique filename
            filename = f"{uuid.uuid4().hex}{file_extension}"
            file_key = f"{folder}/{filename}"
            
            # Upload to R2
            s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_key,
                Body=file_content,
                ContentType=content_type,
                # Cache-Control header for CDN optimization
                CacheControl='public, max-age=31536000, immutable'
            )
            
            # Construct public URL
            public_url = f"{self.public_url}/{file_key}"
            
            logger.info(f"Successfully uploaded {file_key} to R2")
            return public_url, file_key
            
        except Exception as e:
            logger.error(f"Failed to upload image to R2: {str(e)}")
            raise
    
    def delete_image(self, file_key: str) -> bool:
        """
        Delete an image from R2 storage.
        
        Args:
            file_key: The key of the file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            s3_client = self._get_s3_client()
            
            s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key
            )
            
            logger.info(f"Successfully deleted {file_key} from R2")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete image from R2: {str(e)}")
            return False
    
    def get_public_url(self, file_key: str) -> str:
        """
        Get the public URL for a file in R2.
        
        Args:
            file_key: The key of the file
            
        Returns:
            Public URL string
        """
        return f"{self.public_url}/{file_key}"
    
    def check_bucket_access(self) -> bool:
        """
        Check if the bucket is accessible and credentials are valid.
        
        Returns:
            True if accessible, False otherwise
        """
        try:
            s3_client = self._get_s3_client()
            
            # Try to list objects (limit to 1 to minimize cost)
            s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                MaxKeys=1
            )
            
            logger.info(f"Successfully accessed R2 bucket: {self.bucket_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to access R2 bucket: {str(e)}")
            return False


# Global instance
r2_storage = R2StorageService()