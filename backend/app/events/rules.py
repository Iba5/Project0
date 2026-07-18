import logging
from datetime import datetime, timezone
from app.models.models import Event
from app.exceptions.exceptions import VotingException

logger = logging.getLogger(__name__)

class EventRulesEngine:
    """
    Validates business rules tied to specific events (e.g. status checking,
    allowed platform list verification, opening/closing dates).
    """
    @staticmethod
    def validate_voting_allowed(event: Event) -> None:
        """
        Verifies that voting has opened, hasn't closed, and is in an Ongoing/Voting Open phase.
        """
        now = datetime.now(timezone.utc)
        
        # Check date boundaries if set
        if event.voting_opens and now < event.voting_opens.replace(tzinfo=timezone.utc):
            raise VotingException("Voting has not yet opened for this event.")
            
        if event.voting_closes and now > event.voting_closes.replace(tzinfo=timezone.utc):
            raise VotingException("Voting has closed for this event.")

    @staticmethod
    def validate_registration_allowed(event: Event) -> None:
        """
        Verifies that contestant registrations are open.
        """
        now = datetime.now(timezone.utc)
        
        if event.registration_opens and now < event.registration_opens.replace(tzinfo=timezone.utc):
            raise VotingException("Registration has not yet opened.")
            
        if event.registration_closes and now > event.registration_closes.replace(tzinfo=timezone.utc):
            raise VotingException("Registration has closed.")

    @staticmethod
    def validate_platform_allowed(event: Event, platform: str) -> None:
        """
        Ensures a participant entry matches the event's allowed platforms list.
        """
        allowed = [p.strip().lower() for p in event.allowed_platforms.split(",")]
        if platform.lower() not in allowed:
            raise VotingException(f"Platform {platform} is not allowed. Allowed platforms: {event.allowed_platforms}")
