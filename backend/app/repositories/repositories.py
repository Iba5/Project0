import math
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional, Tuple, Type, TypeVar, Generic
from pydantic import BaseModel
from sqlalchemy.orm import Session,Query
from app.models.models import (
    User, Event, Participant, Payment, Activity, 
    Setting, VoteTransaction, AuditLog,
    PaymentMethodConfig, TestPayment
)
from app.enums.enums import (
    EventStatus, ContestantStatus, 
    UserRole, PaymentStatus
)
from app.schemas.schemas import EventResponse, ParticipantResponse


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
            User.role.in_([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR]),
            User.is_active.is_(True)
        )
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at.is_(None))
        return query.all()


class EventRepository(BaseRepository[Event]):
    def __init__(self, db: Session):
        super().__init__(Event, db)

    def get_active_event(self) -> Optional[Event]:
        # Fetch first published event (active voting event)
        query = self.db.query(Event).filter(Event.status == EventStatus.PUBLISHED)
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

    def get_by_event_id(self, event_id: str) -> List[Participant]:
        """Get all participants for a specific event."""
        query = self.db.query(Participant).filter(Participant.event_id == event_id)
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at.is_(None))
        return query.all()

    def _filtered_query(
        self,
        search: str | None = None,
        status: ContestantStatus | None = None,
        event_id: str | None = None,
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
        if event_id:
            query = query.filter(Participant.event_id == event_id)
        return query

    def search_and_filter(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        event_id: Optional[str] = None,
        offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE
    ) -> Tuple[List[Participant], int]:
        query = self._filtered_query(search, status, event_id)
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total
    
    def get_all_participants(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE
    ) -> Tuple[List[Participant], int]:
        """Get all participants without requiring event_id."""
        query = self._base_query()
        if search:
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.filter(
                Participant.name.ilike(f"%{escaped}%", escape="\\") |
                Participant.category.ilike(f"%{escaped}%", escape="\\")
            )
        if status:
            query = query.filter(Participant.status == status)
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total
    
    def get_approved_by_event(self, event_id: str) -> List[Participant]:
        """Get all approved contestants in a specific event (for leaderboard)."""
        query = self.db.query(Participant).filter(
            Participant.event_id == event_id,
            Participant.status == ContestantStatus.APPROVED
        )
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at.is_(None))
        return query.order_by(Participant.votes.desc()).all()
    def get_public_leaderboard(
    self,event_id: str) -> List[Participant]|None:
        """
        Return the public leaderboard for an event.

        Only approved contestants are returned, ordered by vote count
        from highest to lowest.
        """
        query = self._base_query().filter(
            Participant.event_id == event_id,
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

    def get_by_idempotency_key(self, key: str) -> Optional[Payment]:
        if not key:
            return None
        return self.db.query(Payment).filter(Payment.idempotency_key == key).first()

    def get_all_ordered_by_date(
        self, offset: int = 0, limit: int = DEFAULT_MAX_PAGE_SIZE
    ) -> Tuple[List[Payment], int]:
        """Return (items, total) ordered by date descending."""
        query = self.db.query(Payment).order_by(Payment.date.desc())
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

    def get_by_voter_phone_and_event(self, phone: str, event_id: str) -> List[Payment]:
        """
        Find all successful payments by a voter phone in a specific event.
        Retained for reporting/analytics use; no longer used to block new
        votes (voting is unlimited once a prior payment has resolved).
        """
        return self.db.query(Payment).filter(
            Payment.voter_phone == phone,
            Payment.event_id == event_id,
            Payment.status == PaymentStatus.PAID
        ).all()

    def get_unresolved_by_voter_phone_and_event(self, phone: str, event_id: str) -> List[Payment]:
        """
        Find payments by this voter phone in this event that have not yet
        reached a terminal state (paid, failed, cancelled, refunded,
        expired). Used to block starting a NEW payment while a previous
        one from the same phone is still genuinely unresolved — voting
        itself is unlimited; this only prevents a second payment from
        being created while the first hasn't finished either way.
        """
        return self.db.query(Payment).filter(
            Payment.voter_phone == phone,
            Payment.event_id == event_id,
            Payment.status.in_([PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.PROCESSING])
        ).all()

    def get_by_event(self, event_id: str) -> List[Payment]:
        """Get all payments for a specific event."""
        return self.db.query(Payment).filter(
            Payment.event_id == event_id
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


class PaymentMethodConfigRepository(BaseRepository[PaymentMethodConfig]):
    """Repository for payment method configuration management."""
    
    def __init__(self, db: Session):
        super().__init__(PaymentMethodConfig, db)
    
    def get_enabled_methods(self) -> List[PaymentMethodConfig]:
        """Get all enabled payment methods ordered by sort_order."""
        return self.db.query(PaymentMethodConfig)\
            .filter(PaymentMethodConfig.is_enabled == True)\
            .order_by(PaymentMethodConfig.sort_order)\
            .all()
    
    def get_by_method(self, method: str) -> Optional[PaymentMethodConfig]:
        """Get payment method config by method identifier."""
        return self.db.query(PaymentMethodConfig)\
            .filter(PaymentMethodConfig.method == method)\
            .first()
    
    def get_all_ordered(self) -> List[PaymentMethodConfig]:
        """Get all payment methods ordered by sort_order."""
        return self.db.query(PaymentMethodConfig)\
            .order_by(PaymentMethodConfig.sort_order)\
            .all()
    
    def update(self) -> None:
        """Override update to handle timestamp auto-update."""
        self.db.commit()


# --- Pagination helper ---

def _serialize_paginated_item(item: Any) -> Any:
    """Serialize paginated response items without changing the response envelope."""
    if isinstance(item, BaseModel):
        return item.model_dump(by_alias=True, mode="json")
    if isinstance(item, dict):
        return item
    if isinstance(item, Event):
        return EventResponse.model_validate(item).model_dump(by_alias=True, mode="json")
    if isinstance(item, Participant):
        return ParticipantResponse.model_validate(item).model_dump(by_alias=True, mode="json")
    return item

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
        "items": [_serialize_paginated_item(item) for item in items],
        "pagination": {
            "total": total,
            "page": page,
            "per_page": page_size,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": total_pages,
            "hasNext": page < total_pages,
            "hasPrev": page > 1,
        }
    }



class TestPaymentRepository(BaseRepository[TestPayment]):
    """Repository for test payment operations during development."""
    
    def __init__(self, db: Session):
        super().__init__(TestPayment, db)
    
    def get_by_reference(self, reference: str) -> Optional[TestPayment]:
        return self.db.query(TestPayment).filter(TestPayment.reference == reference).first()
    
    def get_by_voter_phone(self, phone: str, limit: int = 10) -> List[TestPayment]:
        return self.db.query(TestPayment).filter(
            TestPayment.voter_phone == phone
        ).order_by(TestPayment.created_at.desc()).limit(limit).all()
    
    def get_recent_pending(self, minutes: int = 10) -> List[TestPayment]:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        return self.db.query(TestPayment).filter(
            TestPayment.status == "created",
            TestPayment.created_at >= cutoff
        ).all()
    
    def update_status(self, test_payment: TestPayment, status: str) -> TestPayment:
        test_payment.status = status
        test_payment.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(test_payment)
        return test_payment
    
    def create(self, test_payment: TestPayment) -> TestPayment:
        self.db.add(test_payment)
        self.db.commit()
        self.db.refresh(test_payment)
        return test_payment
    
    def delete(self, test_payment: TestPayment) -> bool:
        try:
            self.db.delete(test_payment)
            self.db.commit()
            return True
        except Exception:
            self.db.rollback()
            return False
    
    def get_all_test_payments(self, offset: int = 0, limit: int = 100) -> List[TestPayment]:
        return self.db.query(TestPayment).order_by(TestPayment.created_at.desc()).offset(offset).limit(limit).all()
    
    def count_all(self) -> int:
        return self.db.query(TestPayment).count()
