from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, PaginationParams
from app.enums.enums import Permission
from app.services.services import CompetitionService, ParticipantService
from app.schemas.schemas import (
    CompetitionCreate,
    CompetitionUpdate,
    CompetitionResponse,
    CompetitionSetActivate,
)
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_create = Depends(PermissionChecker(Permission.EVENTS_CREATE))
allow_update = Depends(PermissionChecker(Permission.EVENTS_UPDATE))
allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))


@router.get(
    "/",
    summary="List all competitions (Admin)",
    dependencies=[allow_read],
)
def list_competitions(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
):
    service = CompetitionService(db)
    items, total = service.list_competitions(
        pagination.offset,
        pagination.limit,
    )
    return paginate_response(items, total, pagination.page, pagination.page_size)


@router.get(
    "/active",
    response_model=CompetitionResponse,
    summary="Get active competition",
)
def get_active_competition(db: Session = Depends(get_db)):
    service = CompetitionService(db)
    competition = service.get_active_competition()

    if not competition:
        raise HTTPException(
            status_code=404,
            detail="No active competition found",
        )

    return competition


@router.post("/set-active")
def set_active_competition(
    body: CompetitionSetActivate,
    current_user: User = allow_update,
    db: Session = Depends(get_db),
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.set_active_competition(body.competition_id)


@router.get(
    "/{competition_id}",
    response_model=CompetitionResponse,
    dependencies=[allow_read],
)
def get_competition(
    competition_id: str,
    db: Session = Depends(get_db),
):
    service = CompetitionService(db)
    return service.get_competition(competition_id)


@router.post(
    "/",
    response_model=CompetitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_competition(
    comp_in: CompetitionCreate,
    current_user: User = allow_create,
    db: Session = Depends(get_db),
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.create_competition(comp_in)


@router.put(
    "/{competition_id}",
    response_model=CompetitionResponse,
)
def update_competition(
    competition_id: str,
    comp_in: CompetitionUpdate,
    current_user: User = allow_update,
    db: Session = Depends(get_db),
):
    service = CompetitionService(db, user_id=current_user.id)
    return service.update_competition(
        competition_id,
        comp_in,
    )


# --------------------------
# PUBLIC LEADERBOARD
# --------------------------

@router.get(
    "/{competition_id}/leaderboard/public",
    summary="Public competition leaderboard",
    description="Returns approved contestants ordered by votes. No authentication required.",
)
def get_public_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    ):
    service = ParticipantService(db)
    return service.get_public_leaderboard(competition_id)