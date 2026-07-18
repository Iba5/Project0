from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user, PaginationParams
from app.enums.enums import Permission
from app.services.services import EventService
from app.schemas.schemas import EventCreate, EventUpdate, EventResponse
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_create = Depends(PermissionChecker(Permission.EVENTS_CREATE))
allow_update = Depends(PermissionChecker(Permission.EVENTS_UPDATE))
allow_delete = Depends(PermissionChecker(Permission.EVENTS_DELETE))

@router.get(
    "/",
    summary="List all events (paginated)",
    dependencies=[allow_read]
)
def list_events(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    event_service = EventService(db)
    items, total = event_service.list_events(pagination.offset, pagination.limit)
    return paginate_response(items, total, pagination.page, pagination.page_size)

@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get single event detail",
    dependencies=[allow_read]
)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event_service = EventService(db)
    return event_service.get_event(event_id)

@router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event"
)
def create_event(
    event_in: EventCreate,
    current_user: User = allow_create,
    db: Session = Depends(get_db)
):
    event_service = EventService(db, user_id=current_user.id)
    return event_service.create_event(event_in)

@router.put(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update an existing event"
)
def update_event(
    event_id: str,
    event_in: EventUpdate,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    event_service = EventService(db, user_id=current_user.id)
    return event_service.update_event(event_id, event_in)

@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event"
)
def delete_event(
    event_id: str,
    current_user: User = allow_delete,
    db: Session = Depends(get_db)
):
    event_service = EventService(db, user_id=current_user.id)
    event_service.delete_event(event_id)