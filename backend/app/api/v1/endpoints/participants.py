from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user, PaginationParams
from app.enums.enums import Permission, ContestantStatus
from app.services.services import ParticipantService
from app.schemas.schemas import ParticipantCreate, ParticipantResponse, ParticipantUpdate
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_update = Depends(PermissionChecker(Permission.CONTESTANTS_UPDATE))

@router.get("/public")
def list_public_participants(
    search: Optional[str] = None,
    event_id: Optional[str] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
):
    """Public endpoint - returns approved participants only"""
    part_service = ParticipantService(db)

    items, total = part_service.list_participants(
        search, ContestantStatus.APPROVED, event_id, pagination.offset, pagination.limit
    )

    serialized = [ParticipantResponse.model_validate(p).model_dump(by_alias=True) for p in items]
    return paginate_response(serialized, total, pagination.page, pagination.page_size)

@router.get(
    "/",
    summary="List and filter contestants (paginated)",
    description="Admin endpoint - returns all participants including drafts",
    dependencies=[allow_read]
)
def list_participants(
    search: Optional[str] = Query(None, description="Search by name or category"),
    status: Optional[ContestantStatus] = Query(None, description="Filter by contestant lifecycle status"),
    event_id: Optional[str] = Query(None, description="Filter by event"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db)
):
    """Admin endpoint - requires authentication"""
    part_service = ParticipantService(db)
    items, total = part_service.list_participants(
        search, status, event_id,
        pagination.offset, pagination.limit
    )
    serialized = [ParticipantResponse.model_validate(p).model_dump(by_alias=True) for p in items]
    return paginate_response(serialized, total, pagination.page, pagination.page_size)


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
    event_id: Optional[str] = Query(None, description="Optional event ID"),
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db)
    leaderboard_data = await part_service.get_leaderboard_cached(event_id)
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
        elif action == "disqualify":
            part_service.update_participant_status(pid, ContestantStatus.DISQUALIFIED)
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
    from datetime import datetime, timedelta, timezone
    today = datetime.now(timezone.utc).date()
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
    response_model=dict[str, ParticipantResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contestant"
)
def create_participant(
    part_in: ParticipantCreate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    created = part_service.create_participant(part_in)
    return {
        "participant": ParticipantResponse.model_validate(created).model_dump(by_alias=True)
    }


@router.patch(
    "/{part_id}",
    response_model=dict[str, ParticipantResponse],
    summary="Update contestant details"
)
def update_participant(
    part_id: str,
    part_in: ParticipantUpdate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    part_service = ParticipantService(db, user_id=current_user.id)
    participant = part_service.get_participant(part_id)
    if participant is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Participant not found")

    update_data = part_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field != "status":
            setattr(participant, field, value)

    if "status" in update_data:
        participant.status = update_data["status"]

    part_service.part_repo.update()
    return {
        "participant": ParticipantResponse.model_validate(participant).model_dump(by_alias=True)
    }


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
