
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission
from app.services.services import SettingsService
from app.schemas.schemas import NotificationPreferences, SettingsProfileResponse, SettingsProfileUpdate
from app.models.models import User

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_update = Depends(PermissionChecker(Permission.SETTINGS_UPDATE))

@router.get(
    "/",
    response_model=SettingsProfileResponse,
    summary="Get platform settings",
    dependencies=[allow_read]
)
def get_settings(db: Session = Depends(get_db)):
    settings_service = SettingsService(db)
    settings_row = settings_service.get_settings()
    
    return SettingsProfileResponse(
        company_name=settings_row.company_name,
        support_email=settings_row.support_email,
        timezone=settings_row.timezone,
        notifications=NotificationPreferences(
            email=settings_row.email_notifications,
            sms=settings_row.sms_notifications,
            marketing=settings_row.marketing_notifications,
        )
    )

@router.put(
    "/",
    response_model=SettingsProfileResponse,
    summary="Update platform settings"
)
def update_settings(
    settings_in: SettingsProfileUpdate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
)->SettingsProfileResponse:
    settings_service = SettingsService(db, user_id=current_user.id)
    settings_row = settings_service.update_settings(settings_in)
    
    return SettingsProfileResponse(
        company_name=settings_row.company_name,
        support_email=settings_row.support_email,
        timezone=settings_row.timezone,
        notifications=NotificationPreferences(
            email=settings_row.email_notifications,
            sms=settings_row.sms_notifications,
            marketing=settings_row.marketing_notifications,
        ),
    )

@router.get(
    "/r2-usage",
    summary="Get Cloudflare R2 storage usage statistics",
    description="Returns comprehensive R2 storage and bandwidth usage metrics for admin dashboard.",
    dependencies=[allow_read]
)
def get_r2_usage():
    """
    Get R2 storage usage statistics.
    Requires R2 to be configured in environment variables.
    """
    # Check if R2 is configured
    if not all([settings.R2_ACCOUNT_ID, settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY, settings.R2_BUCKET_NAME]):
        raise HTTPException(
            status_code=503,
            detail="R2 storage is not configured. Please set R2_* environment variables."
        )
    
    try:
        from app.integrations.storage.r2_monitoring import r2_monitor
        usage_data = r2_monitor.get_comprehensive_usage()
        return usage_data
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="R2 monitoring service is not available. Install boto3 library."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve R2 usage: {str(e)}"
        )
