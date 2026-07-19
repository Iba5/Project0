import math
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple, Type, TypeVar, Generic
from sqlalchemy.orm import Session,Query
from app.models.models import (
    User, Event, Participant, Payment, Activity, 
    SocialPlatformSync, Setting, VoteTransaction, AuditLog, Competition
)
from app.enums.enums import (
    EventStatus, ContestantStatus, SocialPlatform as PlatformEnum, 
    UserRole, CompetitionStatus, PaymentStatus
)


T = TypeVar("T")

# Default pagination clamp
DEFAULT_MAX_PAGE_SIZE = 100


class BaseRepository(Generic[T]):
    """
    Base repository implementing generic CRUD queries with pagination.
    Integrates automatic soft-delete filtering for models supporting it.
    """
    def __init__(self, model: Type[T], db: Session):
        self.model: Type[T] = model
        self.db = db

    def _apply_soft_delete(self, query:Query[T])->Query[T]:
        """Apply soft-delete filter if model supports it."""
        deleted_at = getattr(self.model, "deleted_at", None)
        if deleted_at is not None:
            query = query.filter(deleted_at.is_(None))
        return query

    def _base_query(self):
        return self._apply_soft_delete(self.db.query(self.model))

    def get_by_id(self, id: str) -> Optional[T]:
        return self._base_query().filter(self.model.id == id).first()

    def get_all(self, offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE) -> List[T]:
        return self._base_query().offset(offset).limit(limit).all()

    def count_all(self) -> int:
        """Return total count (for pagination)."""
        return self._base_query().count()

    def get_all_paginated(self, offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE) -> Tuple[List[T], int]:
        """Return (items, total_count) for paginated responses."""
        query = self._base_query()
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

    def create(self, obj: T) -> T:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self) -> None:
        self.db.commit()

    def delete(self, obj: T) -> None:
        """
        Applies generic soft-delete if model contains 'deleted_at',
        otherwise executes an atomic database DELETE statement.
        """
        if hasattr(obj, "deleted_at"):
            obj.deleted_at = datetime.now(timezone.utc)
            self.db.commit()
        else:
            self.db.delete(obj)
            self.db.commit()


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        query = self.db.query(User).filter(User.email == email)
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at.is_(None))
        return query.first()

    def get_by_reset_token(self, token: str) -> Optional[User]:
        query = self.db.query(User).filter(User.reset_token == token)
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at.is_(None))
        return query.first()

    def get_by_invitation_token(self, token: str) -> Optional[User]:
        query = self.db.query(User).filter(User.invitation_token == token)
        return query.first()

    def get_all_active_admins(self) -> List[User]:
        """Get all active admin users for super admin management."""
        query = self.db.query(User).filter(
            User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]),
            User.is_active.is_(True)
        )
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at.is_(None))
        return query.all()


class CompetitionRepository(BaseRepository[Competition]):
    def __init__(self, db: Session):
        super().__init__(Competition, db)

    def get_active_competition(self) -> Optional[Competition]:
        """Fetch the currently active competition."""
        query = self.db.query(Competition).filter(Competition.is_active.is_(True))
        if hasattr(Competition, "deleted_at"):
            query = query.filter(Competition.deleted_at.is_(None))
        return query.first()

    def get_by_status(self, status: CompetitionStatus) -> List[Competition]:
        query = self.db.query(Competition).filter(Competition.status == status)
        if hasattr(Competition, "deleted_at"):
            query = query.filter(Competition.deleted_at.is_(None))
        return query.all()


class EventRepository(BaseRepository[Event]):
    def __init__(self, db: Session):
        super().__init__(Event, db)

    def get_active_event(self) -> Optional[Event]:
        # Fetch first ongoing voting event
        query = self.db.query(Event).filter(Event.status == EventStatus.VOTING_OPEN)
        if hasattr(Event, "deleted_at"):
            query = query.filter(Event.deleted_at.is_(None))
        return query.first()


class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self, db: Session):
        super().__init__(Participant, db)

    def get_by_ids(self, ids: set[str]) -> List[Participant]:
        """Batch-fetch multiple participants in a single query, avoiding N+1 lookups."""
        if not ids:
            return []
        query = self.db.query(Participant).filter(Participant.id.in_(ids))
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at.is_(None))
        return query.all()

    def _filtered_query(
    self,
    search: str | None = None,
    status: ContestantStatus | None = None,
    platform: PlatformEnum | None = None,
    competition_id: str | None = None,
) -> Query[Participant]:
        query = self._base_query()
        if search:
            # H5 FIX: Escape SQL LIKE wildcards (% and _) in user search input
            # to prevent pattern injection. Users searching for "%" should
            # match literal percent signs, not "any characters".
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.filter(
                Participant.name.ilike(f"%{escaped}%", escape="\\") |
                Participant.category.ilike(f"%{escaped}%", escape="\\")
            )
        if status:
            query = query.filter(Participant.status == status)
        if platform:
            query = query.filter(Participant.platform == platform)
        if competition_id:
            query = query.filter(Participant.competition_id == competition_id)
        return query

    def search_and_filter(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None, 
        platform: Optional[PlatformEnum] = None, competition_id: Optional[str] = None,
        offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE
    ) -> Tuple[List[Participant], int]:
        query = self._filtered_query(search, status, platform, competition_id)
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total
    
    def get_by_competition(self, competition_id: str) -> List[Participant]:
        """Get all approved contestants in a specific competition (for leaderboard)."""
        query = self.db.query(Participant).filter(
            Participant.competition_id == competition_id,
            Participant.status == ContestantStatus.APPROVED
        )
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at.is_(None))
        return query.order_by(Participant.votes.desc()).all()
    def get_public_leaderboard(
    self,competition_id: str) -> List[Participant]|None:
        """
        Return the public leaderboard for a competition.

        Only approved contestants are returned, ordered by vote count
        from highest to lowest.
        """
        query = self._base_query().filter(
            Participant.competition_id == competition_id,
            Participant.status == ContestantStatus.APPROVED,
        )
        return (
            query.order_by(Participant.votes.desc())
            .all()
        )

class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: Session):
        super().__init__(Payment, db)

    def get_by_reference(self, reference: str) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.reference == reference).first()

    def get_all_ordered_by_date(
        self, offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE
    ) -> Tuple[List[Payment], int]:
        """Return (items, total) ordered by date descending."""
        query = self.db.query(Payment).order_by(Payment.date.desc())
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

    def get_by_voter_phone_and_competition(self, phone: str, competition_id: str) -> List[Payment]:
        """
        Find all successful payments by a voter phone in a specific competition.
        Used for duplicate voter detection.
        """
        return self.db.query(Payment).filter(
            Payment.voter_phone == phone,
            Payment.competition_id == competition_id,
            Payment.status == PaymentStatus.PAID
        ).all()

    def get_by_competition(self, competition_id: str) -> List[Payment]:
        """Get all payments for a specific competition."""
        return self.db.query(Payment).filter(
            Payment.competition_id == competition_id
        ).order_by(Payment.date.desc()).all()

    def get_recent_pending_by_phone(self, phone: str, minutes: int = 10) -> List[Payment]:
        """Get recent pending payments from a phone number (for rate limiting)."""
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        return self.db.query(Payment).filter(
            Payment.voter_phone == phone,
            Payment.status.in_([PaymentStatus.CREATED, PaymentStatus.PENDING]),
            Payment.created_at >= cutoff
        ).all()


class VoteTransactionRepository(BaseRepository[VoteTransaction]):
    def __init__(self, db: Session):
        super().__init__(VoteTransaction, db)

    def get_by_payment_id(self, payment_id: str) -> Optional[VoteTransaction]:
        return self.db.query(VoteTransaction).filter(VoteTransaction.payment_id == payment_id).first()


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, db: Session):
        super().__init__(AuditLog, db)

    def get_logs_by_user(self, user_id: str) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(AuditLog.user_id == user_id).order_by(AuditLog.timestamp.desc()).all()


class ActivityRepository(BaseRepository[Activity]):
    def __init__(self, db: Session):
        super().__init__(Activity, db)

    def get_recent(self, limit: int = 5) -> List[Activity]:
        return self.db.query(Activity).order_by(Activity.time.desc()).limit(limit).all()


class SocialPlatformRepository(BaseRepository[SocialPlatformSync]):
    def __init__(self, db: Session):
        super().__init__(SocialPlatformSync, db)

    def get_by_platform(self, platform: PlatformEnum) -> Optional[SocialPlatformSync]:
        return self.db.query(SocialPlatformSync).filter(SocialPlatformSync.platform == platform).first()


class SettingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_settings(self) -> Setting:
        settings_row = self.db.query(Setting).filter(Setting.id == 1).first()
        if not settings_row:
            settings_row = Setting(id=1)
            self.db.add(settings_row)
            self.db.commit()
            self.db.refresh(settings_row)
        return settings_row

    def update_settings(self, settings_row: Setting) -> Setting:
        self.db.add(settings_row)
        self.db.commit()
        self.db.refresh(settings_row)
        return settings_row


# --- Pagination helper ---

def paginate_response(
    items: list[Any],
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """
    Build a standardized paginated response dict.
    
    Args:
        items: The list of items for the current page
        total: Total item count across all pages
        page: Current page number (1-indexed)
        page_size: Items per page
    
    Returns:
        Dict with 'items' and 'pagination' keys (camelCase for frontend).
    """
    total_pages = max(1, math.ceil(total / page_size))
    return {
        "items": items,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": total_pages,
            "hasNext": page < total_pages,
            "hasPrev": page > 1,
        }
    }