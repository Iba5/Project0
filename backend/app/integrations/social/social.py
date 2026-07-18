import logging
from typing import Dict, Any
from app.enums.enums import SocialPlatform

logger = logging.getLogger(__name__)

class SocialSyncClient:
    """
    Handles synchronization of contestant video metadata, views, and comment streams
    from social media providers.
    
    STATUS: NOT IMPLEMENTED
    This class is a placeholder. Real social media API integration requires:
    - Platform-specific OAuth2 flows (TikTok, Facebook Graph API, Instagram Basic Display, YouTube Data API v3)
    - API rate limit management
    - Token refresh handling
    - Error retry logic
    
    Until implemented, callers should NOT depend on this class returning real data.
    """
    @staticmethod
    def fetch_video_metadata(platform: SocialPlatform, video_url: str) -> Dict[str, Any]:
        """
        NOT YET IMPLEMENTED.
        Raises NotImplementedError to prevent silent incorrect data usage.
        """
        raise NotImplementedError(
            f"Social media sync for {platform.value} is not yet implemented. "
            "Remove calls to SocialSyncClient.fetch_video_metadata or implement "
            "the real platform API integration."
        )