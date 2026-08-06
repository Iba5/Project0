"""
Public endpoints for event and participant access.
These endpoints allow public access to published events and participants.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.services.services import EventService, ParticipantService
from app.schemas.schemas import EventResponse, ParticipantResponse, PaymentConfigurationResponse
from app.enums.enums import EventStatus
from app.utils.event_utils import get_computed_event_status
from datetime import datetime, timezone

router = APIRouter()


@router.get(
    "/events/{event_id}",
    response_model=EventResponse,
    summary="Get public event by ID",
    description="Access a published event using its shareable link or ID"
)
def get_public_event(event_id: str, db: Session = Depends(get_db)):
    """Get a public event by its ID. Only published events are accessible."""
    event_service = EventService(db)
    event = event_service.get_event(event_id)
    
    # Only allow access to published events
    if event.status != EventStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found or not published"
        )
    
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


@router.get(
    "/events/{event_id}/participants",
    response_model=dict[str, list[ParticipantResponse]],
    summary="List public participants for an event",
    description="Get all approved participants for a published event"
)
def list_public_event_participants(
    event_id: str,
    db: Session = Depends(get_db)
):
    """Get all approved participants for a specific event."""
    event_service = EventService(db)
    event = event_service.get_event(event_id)
    
    # Only allow access to published events
    if event.status != EventStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found or not published"
        )
    
    participant_service = ParticipantService(db)
    # Get participants filtered by event_id
    from app.repositories.repositories import ParticipantRepository
    part_repo = ParticipantRepository(db)
    participants = part_repo.get_by_event_id(event_id)
    
    # Only return approved participants
    from app.enums.enums import ContestantStatus
    approved_participants = [p for p in participants if p.status == ContestantStatus.APPROVED]
    
    return {"participants": approved_participants}


@router.get(
    "/participants/{participant_id}",
    response_model=ParticipantResponse,
    summary="Get public participant by ID",
    description="Access a participant's public profile"
)
def get_public_participant(participant_id: str, db: Session = Depends(get_db)):
    """Get a public participant profile."""
    participant_service = ParticipantService(db)
    participant = participant_service.get_participant(participant_id)
    
    # Only allow access to approved participants
    from app.enums.enums import ContestantStatus
    if participant.status != ContestantStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found or not approved"
        )
    
    return participant


@router.get(
    "/participants/{participant_id}/payment-config",
    response_model=PaymentConfigurationResponse,
    summary="Get payment configuration for contestant",
    description="Returns payment configuration from the contestant's event (vote price, minimum, currency, voting status)"
)
def get_payment_configuration(participant_id: str, db: Session = Depends(get_db)):
    """
    Get payment configuration for a contestant's event.
    This allows the frontend to display backend-driven payment rules.
    """
    from app.repositories.repositories import ParticipantRepository, EventRepository
    from app.enums.enums import ContestantStatus
    from app.utils.event_utils import get_computed_event_status
    
    # Get participant
    part_repo = ParticipantRepository(db)
    participant = part_repo.get_by_id(participant_id)
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    # Only allow access to approved participants
    if participant.status != ContestantStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found or not approved"
        )
    
    # Get event
    if not participant.event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Participant is not associated with an event"
        )
    
    event_repo = EventRepository(db)
    event = event_repo.get_by_id(participant.event_id)
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Determine if voting is currently open
    computed_status = get_computed_event_status(
        event.status,
        event.start_date,
        event.end_date,
        event.registration_opens,
        event.registration_closes,
        event.voting_opens,
        event.voting_closes,
    )
    
    voting_open = computed_status == "voting_open"
    
    # Get configuration from event
    vote_price = float(event.vote_price) if event.vote_price else 1.0
    currency = event.currency or "USD"
    minimum_payment = vote_price  # Minimum is at least one vote
    
    return PaymentConfigurationResponse(
        minimum_payment=minimum_payment,
        vote_price=vote_price,
        currency=currency,
        event_name=event.name,
        voting_open=voting_open,
        event_id=event.id
    )
