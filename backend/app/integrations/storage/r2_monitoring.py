import logging
from typing import Dict, Optional
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)


class R2UsageMonitor:
    """
    Monitor Cloudflare R2 storage usage and bandwidth.
    Provides usage statistics for admin dashboard.
    """
    
    def __init__(self):
        self._s3_client = None
        self.bucket_name = settings.R2_BUCKET_NAME
        self.account_id = settings.R2_ACCOUNT_ID
        self.access_key_id = settings.R2_ACCESS_KEY_ID
        self.secret_access_key = settings.R2_SECRET_ACCESS_KEY
        
    def _get_s3_client(self):
        """Initialize boto3 S3 client for R2 monitoring."""
        if self._s3_client is None:
            try:
                import boto3
                from botocore.client import Config
                
                endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
                
                self._s3_client = boto3.client(
                    's3',
                    endpoint_url=endpoint_url,
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    config=Config(signature_version='s3v4'),
                    region_name='auto'
                )
                logger.info("R2 monitoring client initialized")
            except ImportError:
                logger.error("boto3 library not installed")
                raise ImportError("boto3 is required for R2 monitoring")
            except Exception as e:
                logger.error(f"Failed to initialize R2 monitoring client: {str(e)}")
                raise
        
        return self._s3_client
    
    def get_storage_usage(self) -> Dict:
        """
        Get current storage usage statistics.
        
        Returns:
            Dict with storage metrics including total size, file count, etc.
        """
        try:
            s3_client = self._get_s3_client()
            
            # List all objects in the bucket to calculate usage
            paginator = s3_client.get_paginator('list_objects_v2')
            
            total_size = 0
            file_count = 0
            file_types = {}
            largest_files = []
            
            for page in paginator.paginate(Bucket=self.bucket_name):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        total_size += obj['Size']
                        file_count += 1
                        
                        # Track file types
                        key = obj['Key']
                        if '.' in key:
                            file_ext = key.split('.')[-1].lower()
                            file_types[file_ext] = file_types.get(file_ext, 0) + 1
                        
                        # Track largest files
                        largest_files.append({
                            'key': key,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified']
                        })
            
            # Sort largest files and keep top 10
            largest_files.sort(key=lambda x: x['size'], reverse=True)
            largest_files = largest_files[:10]
            
            return {
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_size_gb': round(total_size / (1024 * 1024 * 1024), 2),
                'file_count': file_count,
                'file_types': file_types,
                'largest_files': largest_files,
                'free_tier_storage_mb': 10240,  # 10GB free tier
                'free_tier_usage_percent': round((total_size / (1024 * 1024 * 1024 * 10)) * 100, 2),
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get R2 storage usage: {str(e)}")
            return {
                'error': str(e),
                'total_size_bytes': 0,
                'total_size_mb': 0,
                'total_size_gb': 0,
                'file_count': 0,
                'file_types': {},
                'largest_files': [],
                'free_tier_storage_mb': 10240,
                'free_tier_usage_percent': 0,
                'last_updated': datetime.utcnow().isoformat()
            }
    
    def get_recent_uploads(self, days: int = 7) -> Dict:
        """
        Get upload statistics for recent days.
        
        Args:
            days: Number of days to look back
            
        Returns:
            Dict with upload metrics
        """
        try:
            s3_client = self._get_s3_client()
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            paginator = s3_client.get_paginator('list_objects_v2')
            
            recent_uploads = []
            daily_uploads = {}
            
            for page in paginator.paginate(Bucket=self.bucket_name):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        if obj['LastModified'] >= cutoff_date:
                            date_str = obj['LastModified'].strftime('%Y-%m-%d')
                            daily_uploads[date_str] = daily_uploads.get(date_str, 0) + 1
                            
                            recent_uploads.append({
                                'key': obj['Key'],
                                'size': obj['Size'],
                                'last_modified': obj['LastModified'].isoformat()
                            })
            
            return {
                'period_days': days,
                'total_uploads': len(recent_uploads),
                'daily_uploads': daily_uploads,
                'recent_files': recent_uploads[:20],  # Last 20 uploads
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get recent uploads: {str(e)}")
            return {
                'error': str(e),
                'period_days': days,
                'total_uploads': 0,
                'daily_uploads': {},
                'recent_files': [],
                'last_updated': datetime.utcnow().isoformat()
            }
    
    def get_comprehensive_usage(self) -> Dict:
        """
        Get comprehensive usage statistics for dashboard.
        
        Returns:
            Complete usage metrics including storage, uploads, and trends
        """
        storage_usage = self.get_storage_usage()
        recent_uploads = self.get_recent_uploads(days=30)
        
        return {
            'storage': storage_usage,
            'uploads': recent_uploads,
            'summary': {
                'total_size_gb': storage_usage.get('total_size_gb', 0),
                'file_count': storage_usage.get('file_count', 0),
                'monthly_uploads': recent_uploads.get('total_uploads', 0),
                'free_tier_remaining_gb': round(10 - storage_usage.get('total_size_gb', 0), 2),
                'free_tier_usage_percent': storage_usage.get('free_tier_usage_percent', 0),
                'is_near_limit': storage_usage.get('free_tier_usage_percent', 0) > 80
            },
            'last_updated': datetime.utcnow().isoformat()
        }


# Global instance
r2_monitor = R2UsageMonitor()