from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user
from app.enums.enums import Permission, ContestantStatus, SocialPlatform
from app.services.services import ParticipantService
from app.schemas.schemas import ParticipantCreate, ParticipantResponse
from app.models.models import User

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_update = Depends(PermissionChecker(Permission.CONTESTANTS_UPDATE))

@router.get(
    "/",
    response_model=List[ParticipantResponse],
    summary="List and filter contestants",
    dependencies=[allow_read]
)
def list_participants(
    search: Optional[str] = Query(None, description="Search by name or category"),
    status: Optional[ContestantStatus] = Query(None, description="Filter by contestant lifecycle status"),
    platform: Optional[SocialPlatform] = Query(None, description="Filter by social media platform"),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db)
    return part_service.list_participants(search, status, platform)

@router.get(
    "/{part_id}",
    response_model=ParticipantResponse,
    summary="Get single contestant details",
    dependencies=[allow_read]
)
def get_participant(part_id: str, db: Session = Depends(get_db)):
    part_service = ParticipantService(db)
    return part_service.get_participant(part_id)

@router.post(
    "/",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contestant"
)
def create_participant(
    part_in: ParticipantCreate,
    current_user: User = Depends(allow_update),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    return part_service.create_participant(part_in)

@router.patch(
    "/{part_id}/status",
    response_model=ParticipantResponse,
    summary="Approve or update contestant registration status"
)
def update_status(
    part_id: str,
    status_val: ContestantStatus = Query(..., alias="status"),
    current_user: User = Depends(allow_update),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    return part_service.update_participant_status(part_id, status_val)
