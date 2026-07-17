from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user
from app.enums.enums import Permission
from app.services.services import SettingsService
from app.schemas.schemas import SettingsProfileResponse, SettingsProfileUpdate
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
        notifications={
            "email": settings_row.email_notifications,
            "sms": settings_row.sms_notifications,
            "marketing": settings_row.marketing_notifications,
        }
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
):
    settings_service = SettingsService(db, user_id=current_user.id)
    settings_row = settings_service.update_settings(settings_in)
    
    return SettingsProfileResponse(
        company_name=settings_row.company_name,
        support_email=settings_row.support_email,
        timezone=settings_row.timezone,
        notifications={
            "email": settings_row.email_notifications,
            "sms": settings_row.sms_notifications,
            "marketing": settings_row.marketing_notifications,
        }
    )
