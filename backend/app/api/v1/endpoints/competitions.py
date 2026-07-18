from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user, PaginationParams
from app.enums.enums import Permission
from app.services.services import CompetitionService, ParticipantService
from app.schemas.schemas import (
    CompetitionCreate, CompetitionUpdate, CompetitionResponse, 
    CompetitionSetActivate, ParticipantResponse, ContestantStatus
)
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

# Admin-only write permissions
allow_create = Depends(PermissionChecker(Permission.EVENTS_CREATE))
allow_update = Depends(PermissionChecker(Permission.EVENTS_UPDATE))
allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))


@router.get(
    "/",
    summary="List all competitions (paginated)",
    dependencies=[allow_read]
)
def list_competitions(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    service = CompetitionService(db)
    items, total = service.list_competitions(pagination.offset, pagination.limit)
    return paginate_response(items, total, pagination.page, pagination.page_size)


@router.get(
    "/active",
    response_model=CompetitionResponse,
    summary="Get the currently active competition",
)
def get_active_competition(db: Session = Depends(get_db)):
    service = CompetitionService(db)
    comp = service.get_active_competition()
    if not comp:
        raise HTTPException(status_code=404, detail="No active competition found")
    return comp


# ROUTE ORDER FIX: /set-active MUST be registered before /{competition_id}
# to prevent FastAPI from matching "set-active" as a competition_id path param.
@router.post(
    "/set-active",
    summary="Set the active competition",
    description="Activates a competition and deactivates any previously active one."
)
def set_active_competition(
    body: CompetitionSetActivate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.set_active_competition(body.competition_id)


@router.get(
    "/{competition_id}",
    response_model=CompetitionResponse,
    summary="Get single competition detail",
    dependencies=[allow_read]
)
def get_competition(competition_id: str, db: Session = Depends(get_db)):
    service = CompetitionService(db)
    return service.get_competition(competition_id)


@router.post(
    "/",
    response_model=CompetitionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new competition"
)
def create_competition(
    comp_in: CompetitionCreate,
    current_user: User = allow_create,
    db: Session = Depends(get_db)
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.create_competition(comp_in)


@router.put(
    "/{competition_id}",
    response_model=CompetitionResponse,
    summary="Update a competition"
)
def update_competition(
    competition_id: str,
    comp_in: CompetitionUpdate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.update_competition(competition_id, comp_in)


@router.get(
    "/{competition_id}/leaderboard",
    summary="Get competition leaderboard",
    description="Returns the public leaderboard. Voter PII is NOT exposed."
)
def get_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db)
):
    service = ParticipantService(db)
    return service.get_leaderboard(competition_id)