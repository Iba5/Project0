"""
Payment validation utilities for event-aware payment processing.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException

from app.enums.enums import EventStatus, ContestantStatus
from app.utils.event_utils import get_computed_event_status


def validate_payment_eligibility(
    event_status: EventStatus,
    event_start_date: Optional[datetime],
    event_end_date: Optional[datetime],
    registration_opens: Optional[datetime],
    registration_closes: Optional[datetime],
    voting_opens: Optional[datetime],
    voting_closes: Optional[datetime],
    participant_status: ContestantStatus,
) -> None:
    """
    Validate that a payment can be processed for a participant in an event.
    
    Payment eligibility rules:
    - Draft events cannot accept payments
    - Unpublished events cannot accept payments
    - Cancelled events cannot accept payments
    - Archived events cannot accept payments
    - Payments are only allowed during registration or voting periods
    - Participant must be approved to receive payments
    
    Args:
        event_status: Current event status
        event_start_date: Event start date
        event_end_date: Event end date
        registration_opens: Registration open date
        registration_closes: Registration close date
        voting_opens: Voting open date
        voting_closes: Voting close date
        participant_status: Participant's approval status
    
    Raises:
        HTTPException: If payment is not eligible
    """
    now = datetime.now(timezone.utc)
    
    # Check event status
    if event_status == EventStatus.DRAFT:
        raise HTTPException(
            status_code=403,
            detail="Payments cannot be processed for Draft events. Please publish the event first."
        )
    
    if event_status == EventStatus.CANCELLED:
        raise HTTPException(
            status_code=403,
            detail="Payments cannot be processed for Cancelled events."
        )
    
    if event_status == EventStatus.ARCHIVED:
        raise HTTPException(
            status_code=403,
            detail="Payments cannot be processed for Archived events."
        )
    
    # Check participant status
    if participant_status != ContestantStatus.APPROVED:
        raise HTTPException(
            status_code=403,
            detail=f"Payments can only be processed for approved participants. Current status: {participant_status.value}"
        )
    
    # Check event hasn't ended
    if event_end_date and now > event_end_date:
        raise HTTPException(
            status_code=403,
            detail="Payments cannot be processed for events that have ended."
        )
    
    # Check event has started
    if event_start_date and now < event_start_date:
        raise HTTPException(
            status_code=403,
            detail="Payments cannot be processed for events that haven't started yet."
        )
    
    # Check if within registration or voting period
    computed_status = get_computed_event_status(
        event_status,
        event_start_date,
        event_end_date,
        registration_opens,
        registration_closes,
        voting_opens,
        voting_closes,
    )
    
    # Allow payments during Registration Open or Voting Open
    if computed_status not in ["Registration Open", "Voting Open", "Published"]:
        raise HTTPException(
            status_code=403,
            detail=f"Payments are not currently accepted. Event status: {computed_status}"
        )


def get_payment_method_availability(
    event_status: EventStatus,
    computed_status: str,
) -> dict:
    """
    Determine which payment methods are available based on event state.
    
    Args:
        event_status: Current event status
        computed_status: Computed runtime status
    
    Returns:
        dict: Available payment methods and their states
    """
    if event_status != EventStatus.PUBLISHED:
        return {
            "registration_open": False,
            "voting_open": False,
            "methods": [],
            "reason": "Event is not published"
        }
    
    if computed_status == "Registration Open":
        return {
            "registration_open": True,
            "voting_open": False,
            "methods": ["paynow", "ecocash"],  # Example payment methods
            "reason": "Registration period is open"
        }
    
    if computed_status == "Voting Open":
        return {
            "registration_open": False,
            "voting_open": True,
            "methods": ["paynow", "ecocash"],  # Example payment methods
            "reason": "Voting period is open"
        }
    
    return {
        "registration_open": False,
        "voting_open": False,
        "methods": [],
        "reason": f"Payment period not open. Current status: {computed_status}"
    }
