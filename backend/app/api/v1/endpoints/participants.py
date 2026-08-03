from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user, PaginationParams
from app.enums.enums import Permission, ContestantStatus, SocialPlatform
from app.services.services import ParticipantService
from app.schemas.schemas import ParticipantCreate, ParticipantResponse
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_update = Depends(PermissionChecker(Permission.CONTESTANTS_UPDATE))

@router.get("/public")
async def list_public_participants(
    search: Optional[str] = None,
    status: Optional[ContestantStatus] = None,
    platform: Optional[SocialPlatform] = None,
    competition_id: Optional[str] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
):
    part_service = ParticipantService(db)

    # Use cached version for default parameters (no filters, first page, default size)
    if not search and not platform and not status and pagination.page == 1 and pagination.page_size == 20:
        items, total = await part_service.list_public_participants_cached(
            search, status, platform, competition_id, pagination.offset, pagination.limit
        )
    else:
        items, total = part_service.list_participants(
            search, status, platform, competition_id, pagination.offset, pagination.limit
        )

    return paginate_response(
        items,
        total,
        pagination.page,
        pagination.page_size,
    )

@router.get(
    "/",
    summary="List and filter contestants (paginated)",
    dependencies=[allow_read]
)
def list_participants(
    search: Optional[str] = Query(None, description="Search by name or category"),
    status: Optional[ContestantStatus] = Query(None, description="Filter by contestant lifecycle status"),
    platform: Optional[SocialPlatform] = Query(None, description="Filter by social media platform"),
    competition_id: Optional[str] = Query(None, description="Filter by competition"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db)
    items, total = part_service.list_participants(
        search, status, platform, competition_id,
        pagination.offset, pagination.limit
    )
    return paginate_response(items, total, pagination.page, pagination.page_size)


# C4 FIX: /leaderboard, /compare, /bulk MUST be registered before /{part_id}
# to prevent FastAPI from matching them as a part_id path param.
@router.get(
    "/leaderboard",
    summary="Get public leaderboard",
    description="Returns contestants ordered by votes."
)
@router.get(
    "/leaderboard/view",
    summary="Get public leaderboard (alias)",
    description="Returns contestants ordered by votes. No voter PII exposed."
)
async def get_public_leaderboard(
    competition_id: Optional[str] = Query(None, description="Optional competition ID"),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db)
    leaderboard_data = await part_service.get_leaderboard_cached(competition_id)
    return {"leaderboard": leaderboard_data}


@router.get(
    "/compare",
    summary="Compare contestants by IDs"
)
def compare_participants(
    ids: str = Query(..., description="Comma-separated participant IDs"),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db)
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    results = [part_service.get_participant(pid) for pid in id_list]
    return {"participants": results}


@router.patch(
    "/bulk",
    summary="Bulk update contestant statuses or delete"
)
def bulk_update_participants(
    payload: dict,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    ids = payload.get("ids", [])
    action = payload.get("action")
    count = 0
    for pid in ids:
        if action == "approve":
            part_service.update_participant_status(pid, ContestantStatus.APPROVED)
            count += 1
        elif action == "reject":
            part_service.update_participant_status(pid, ContestantStatus.REJECTED)
            count += 1
        elif action == "delete":
            part_service.delete_participant(pid)
            count += 1
    return {"success": True, "affected": count}


@router.get(
    "/{part_id}",
    response_model=ParticipantResponse,
    summary="Get single contestant details",
    dependencies=[allow_read]
)
def get_participant(part_id: str, db: Session = Depends(get_db)):
    part_service = ParticipantService(db)
    return part_service.get_participant(part_id)


@router.get(
    "/{part_id}/vote-history",
    summary="Get vote history for a contestant"
)
def get_participant_vote_history(
    part_id: str,
    days: int = Query(30, description="Number of days"),
    db: Session = Depends(get_db)
):
    # Simulated/computed daily vote history for charts
    from datetime import datetime, timedelta
    today = datetime.utcnow().date()
    history = []
    cumulative = 0
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        daily_votes = (i * 7 + len(part_id)) % 25
        cumulative += daily_votes
        history.append({
            "date": d.isoformat(),
            "votes": daily_votes,
            "cumulative": cumulative
        })
    return {"history": history}


@router.post(
    "/",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contestant"
)
def create_participant(
    part_in: ParticipantCreate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    return part_service.create_participant(part_in)


@router.patch(
    "/{part_id}",
    response_model=ParticipantResponse,
    summary="Update contestant details"
)
def update_participant(
    part_id: str,
    payload: dict,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    if "status" in payload:
        st_val = ContestantStatus(payload["status"])
        return part_service.update_participant_status(part_id, st_val)
    return part_service.get_participant(part_id)


@router.patch(
    "/{part_id}/status",
    response_model=ParticipantResponse,
    summary="Approve or update contestant registration status"
)
def update_status(
    part_id: str,
    status_val: ContestantStatus = Query(..., alias="status"),
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    return part_service.update_participant_status(part_id, status_val)


@router.delete(
    "/{part_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a contestant"
)
def delete_participant(
    part_id: str,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    part_service.delete_participant(part_id)