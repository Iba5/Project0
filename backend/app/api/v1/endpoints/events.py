from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user, PaginationParams
from app.enums.enums import Permission, EventStatus
from app.services.services import EventService
from app.schemas.schemas import EventCreate, EventUpdate, EventResponse
from app.repositories.repositories import paginate_response
from app.models.models import User
from app.utils.event_utils import get_computed_event_status

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))
allow_create = Depends(PermissionChecker(Permission.EVENTS_CREATE))
allow_update = Depends(PermissionChecker(Permission.EVENTS_UPDATE))
allow_delete = Depends(PermissionChecker(Permission.EVENTS_DELETE))

@router.get(
    "/",
    summary="List public events (paginated)",
    description="Public endpoint - returns only published events"
)
def list_public_events(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    event_service = EventService(db)
    items, total = event_service.list_events(pagination.offset, pagination.limit)
    
    # Filter to only published events for public access
    published_events = [event for event in items if event.status == EventStatus.PUBLISHED]
    
    # Add computed status to each event
    for event in published_events:
        event.computed_status = get_computed_event_status(
            event.status,
            event.start_date,
            event.end_date,
            event.registration_opens,
            event.registration_closes,
            event.voting_opens,
            event.voting_closes,
        )
    
    return paginate_response(published_events, len(published_events), pagination.page, pagination.page_size)

@router.get(
    "/admin",
    summary="List all events (paginated)",
    description="Admin endpoint - returns all events including drafts",
    dependencies=[allow_read]
)
def list_admin_events(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    event_service = EventService(db)
    items, total = event_service.list_events(pagination.offset, pagination.limit)
    
    # Add computed status to each event
    for event in items:
        event.computed_status = get_computed_event_status(
            event.status,
            event.start_date,
            event.end_date,
            event.registration_opens,
            event.registration_closes,
            event.voting_opens,
            event.voting_closes,
        )
    
    return paginate_response(items, total, pagination.page, pagination.page_size)

@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get single event detail",
    dependencies=[allow_read]
)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event_service = EventService(db)
    event = event_service.get_event(event_id)
    
    # Add computed status
    event.computed_status = get_computed_event_status(
        event.status,
        event.start_date,
        event.end_date,
        event.registration_opens,
        event.registration_closes,
        event.voting_opens,
        event.voting_closes,
    )
    
    return event

@router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event",
    dependencies=[allow_create]
)
def create_event(
    event_in: EventCreate,
    current_user: User = Depends(get_current_active_user),
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

@router.post(
    "/{event_id}/publish",
    response_model=EventResponse,
    summary="Publish an event",
    description="Publish a Draft event, making it visible to the public and generating a share link"
)
def publish_event(
    event_id: str,
    current_user: User = allow_update,
    db: Session = Depends(get_db)
):
    event_service = EventService(db, user_id=current_user.id)
    return event_service.publish_event(event_id)

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