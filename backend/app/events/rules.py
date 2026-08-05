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
    def _ensure_timezone(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    @staticmethod
    def validate_voting_allowed(event: Event) -> None:
        """
        Verifies that voting has opened, hasn't closed, and is in an Ongoing/Voting Open phase.
        """
        now = datetime.now(timezone.utc)
        voting_opens = EventRulesEngine._ensure_timezone(event.voting_opens)
        voting_closes = EventRulesEngine._ensure_timezone(event.voting_closes)

        if voting_opens and now < voting_opens:
            raise VotingException("Voting has not yet opened for this event.")

        if voting_closes and now > voting_closes:
            raise VotingException("Voting has closed for this event.")
    @staticmethod
    def validate_registration_allowed(event: Event) -> None:
        """
        Verifies that contestant registrations are open.
        """
        now = datetime.now(timezone.utc)
        
        registration_opens = EventRulesEngine._ensure_timezone(event.registration_opens)
        registration_closes = EventRulesEngine._ensure_timezone(event.registration_closes)

        if registration_opens and now < registration_opens:
            raise VotingException("Registration has not yet opened.")

        if registration_closes and now > registration_closes:
            raise VotingException("Registration has closed.")

    @staticmethod
    def validate_platform_allowed(event: Event, platform: str) -> None:
        """
        Ensures a participant entry matches the event's allowed platforms list.
        """
        if not event.allowed_platforms:
            raise VotingException("No allowed platforms have been configured for this event.")

        allowed = [
            p.strip().lower()
            for p in event.allowed_platforms.split(",")
        ]

        if platform.lower() not in allowed:
            raise VotingException(
                f"Platform {platform} is not allowed. "
                f"Allowed platforms: {event.allowed_platforms}"
            )