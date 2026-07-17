from datetime import datetime, timezone
from typing import List, Optional, Type, TypeVar, Generic
from sqlalchemy.orm import Session
from app.models.models import User, Event, Participant, Payment, Activity, SocialPlatform, Setting, VoteTransaction, AuditLog
from app.enums.enums import EventStatus, ContestantStatus, SocialPlatform as PlatformEnum, UserRole

T = TypeVar("T")

class BaseRepository(Generic[T]):
    """
    Base repository implementing generic CRUD queries.
    Integrates automatic soft-delete filtering for models supporting it.
    """
    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: str) -> Optional[T]:
        query = self.db.query(self.model).filter(self.model.id == id)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at == None)
        return query.first()

    def get_all(self) -> List[T]:
        query = self.db.query(self.model)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at == None)
        return query.all()

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
            query = query.filter(User.deleted_at == None)
        return query.first()

    def get_by_reset_token(self, token: str) -> Optional[User]:
        query = self.db.query(User).filter(User.reset_token == token)
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at == None)
        return query.first()

    def get_by_invitation_token(self, token: str) -> Optional[User]:
        query = self.db.query(User).filter(User.invitation_token == token)
        return query.first()

    def get_all_active_admins(self) -> List[User]:
        """Get all active admin users for super admin management."""
        query = self.db.query(User).filter(
            User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]),
            User.is_active == True
        )
        if hasattr(User, "deleted_at"):
            query = query.filter(User.deleted_at == None)
        return query.all()

class EventRepository(BaseRepository[Event]):
    def __init__(self, db: Session):
        super().__init__(Event, db)

    def get_active_event(self) -> Optional[Event]:
        # Fetch first ongoing voting event
        query = self.db.query(Event).filter(Event.status == EventStatus.VOTING_OPEN)
        if hasattr(Event, "deleted_at"):
            query = query.filter(Event.deleted_at == None)
        return query.first()

class ParticipantRepository(BaseRepository[Participant]):
    def __init__(self, db: Session):
        super().__init__(Participant, db)

    def get_by_ids(self, ids: set) -> List[Participant]:
        """Batch-fetch multiple participants in a single query, avoiding N+1 lookups."""
        if not ids:
            return []
        query = self.db.query(Participant).filter(Participant.id.in_(ids))
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at == None)
        return query.all()

    def search_and_filter(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None, platform: Optional[PlatformEnum] = None
    ) -> List[Participant]:
        query = self.db.query(Participant)
        if hasattr(Participant, "deleted_at"):
            query = query.filter(Participant.deleted_at == None)
        if search:
            query = query.filter(Participant.name.ilike(f"%{search}%") | Participant.category.ilike(f"%{search}%"))
        if status:
            query = query.filter(Participant.status == status)
        if platform:
            query = query.filter(Participant.platform == platform)
        return query.all()
    

class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: Session):
        super().__init__(Payment, db)

    def get_by_reference(self, reference: str) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.reference == reference).first()

    def get_all_ordered_by_date(self) -> List[Payment]:
        return self.db.query(Payment).order_by(Payment.date.desc()).all()

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

class SocialPlatformRepository(BaseRepository[SocialPlatform]):
    def __init__(self, db: Session):
        super().__init__(SocialPlatform, db)

    def get_by_platform(self, platform: PlatformEnum) -> Optional[SocialPlatform]:
        return self.db.query(SocialPlatform).filter(SocialPlatform.platform == platform).first()

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
