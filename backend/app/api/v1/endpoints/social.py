from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission, SocialPlatform, SocialSyncStatus
from app.repositories.repositories import SocialPlatformRepository
from app.schemas.schemas import SocialPlatformResponse

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))

@router.get(
    "/",
    summary="Get social platforms sync status",
    description="Returns synchronization status for all configured social media connectors (TikTok, Facebook, Instagram, YouTube).",
    dependencies=[allow_read]
)
def get_social_status(db: Session = Depends(get_db)):
    repo = SocialPlatformRepository(db)
    platforms = repo.get_all()
    
    # If database is fresh/empty, return default mock sync details as fallback
    if not platforms:
        from datetime import datetime, timezone
        return {
            "items": [
                {
                    "id": "1",
                    "platform": SocialPlatform.TIKTOK,
                    "status": SocialSyncStatus.CONNECTED,
                    "lastSync": datetime.now(timezone.utc),
                    "detail": "Monitoring hashtag challenge feed."
                },
                {
                    "id": "2",
                    "platform": SocialPlatform.FACEBOOK,
                    "status": SocialSyncStatus.SYNCING,
                    "lastSync": datetime.now(timezone.utc),
                    "detail": "Ingesting video comment thread responses."
                },
                {
                    "id": "3",
                    "platform": SocialPlatform.INSTAGRAM,
                    "status": SocialSyncStatus.FAILED,
                    "lastSync": datetime.now(timezone.utc),
                    "detail": "Access token expired. Re-authentication required."
                },
                {
                    "id": "4",
                    "platform": SocialPlatform.YOUTUBE,
                    "status": SocialSyncStatus.DISCONNECTED,
                    "lastSync": None,
                    "detail": "No channel connection configured."
                }
            ]
        }

    return {"items": platforms}
