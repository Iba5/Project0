"""
Event lifecycle utilities for intelligent status transitions.
"""

from datetime import datetime, timezone
from typing import Optional
from app.enums.enums import EventStatus


def get_computed_event_status(
    event_status: EventStatus,
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    registration_opens: Optional[datetime],
    registration_closes: Optional[datetime],
    voting_opens: Optional[datetime],
    voting_closes: Optional[datetime],
) -> str:
    """
    Compute the current runtime status of an event based on its timeline.
    
    Administrative states (manual control):
    - Draft: Event is not published yet
    - Published: Event is published and active
    - Cancelled: Event was cancelled
    - Archived: Event is archived
    
    Computed states (automatic based on timeline):
    - Upcoming: Event is published but hasn't started yet
    - Registration Open: Registration period is active
    - Voting Open: Voting period is active
    - Voting Closed: Voting has ended but event hasn't completed
    - Completed: Event has ended
    """
    now = datetime.now(timezone.utc)
    
    # Administrative states take precedence
    if event_status == EventStatus.DRAFT:
        return "Draft"
    if event_status == EventStatus.CANCELLED:
        return "Cancelled"
    if event_status == EventStatus.ARCHIVED:
        return "Archived"
    
    # Only Published events get computed statuses
    if event_status != EventStatus.PUBLISHED:
        return "Unknown"
    
    # If no dates are set, default to Published
    if not start_date or not end_date:
        return "Published"
    
    # Check if event hasn't started yet
    if now < start_date:
        return "Upcoming"
    
    # Check if event has ended
    if now > end_date:
        return "Completed"
    
    # Check registration period
    if registration_opens and registration_closes:
        if registration_opens <= now <= registration_closes:
            return "Registration Open"
    
    # Check voting period
    if voting_opens and voting_closes:
        if voting_opens <= now <= voting_closes:
            return "Voting Open"
        if now > voting_closes:
            return "Voting Closed"
    
    # Default to Published if within event but no specific period
    if start_date <= now <= end_date:
        return "Published"
    
    return "Unknown"


def validate_event_timeline(
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    registration_opens: Optional[datetime],
    registration_closes: Optional[datetime],
    voting_opens: Optional[datetime],
    voting_closes: Optional[datetime],
) -> list[str]:
    """
    Validate event timeline and return list of validation errors.
    
    Rules:
    1. Event start must occur before event end
    2. Registration must begin before registration closes
    3. Voting cannot begin before registration has finished
    4. Voting cannot close before it has started
    5. Event cannot end before voting has completed
    6. Overlapping or contradictory timelines are rejected
    """
    errors = []
    
    # Basic existence checks
    if not start_date or not end_date:
        errors.append("Event start and end dates are required")
        return errors
    
    # Rule 1: Event start before end
    if start_date >= end_date:
        errors.append("Event start date must be before event end date")
    
    # Registration validation
    if registration_opens and registration_closes:
        # Rule 2: Registration begins before closes
        if registration_opens >= registration_closes:
            errors.append("Registration opens must be before registration closes")
        
        # Registration must be within event period
        if registration_opens < start_date:
            errors.append("Registration opens cannot be before event start date")
        if registration_closes > end_date:
            errors.append("Registration closes cannot be after event end date")
    
    # Voting validation
    if voting_opens and voting_closes:
        # Rule 4: Voting begins before closes
        if voting_opens >= voting_closes:
            errors.append("Voting opens must be before voting closes")
        
        # Rule 3: Voting cannot begin before registration has finished
        if registration_closes and voting_opens < registration_closes:
            errors.append("Voting cannot begin before registration has closed")
        
        # Voting must be within event period
        if voting_opens < start_date:
            errors.append("Voting opens cannot be before event start date")
        if voting_closes > end_date:
            errors.append("Voting closes cannot be after event end date")
        
        # Rule 5: Event cannot end before voting has completed
        if voting_closes > end_date:
            errors.append("Event end date must be after voting closes date")
    
    # Cross-validation between registration and voting
    if registration_closes and voting_opens:
        if registration_closes > voting_opens:
            errors.append("Registration closes must be before or when voting opens")
    
    return errors
