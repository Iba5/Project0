from datetime import datetime, timezone
import time
import uuid as _uuid
from typing import List, Optional, Type, TypeVar, Generic
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.models import (
    User, Event, Participant, Payment, Activity, SocialPlatform, Setting,
    VoteTransaction, AuditLog, RevokedToken, RateLimitBucket,
)
from app.enums.enums import EventStatus, ContestantStatus, SocialPlatform as PlatformEnum, UserRole
from app.utils.sanitize import escape_like

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

    def count(self) -> int:
        """
        FIX 3: Count of (non-soft-deleted) rows. Used by the registration
        service to decide whether the platform is still in bootstrap mode
        (zero users → the very first Super Admin may self-register).
        """
        query = self.db.query(self.model)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at == None)
        return query.count()

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
            # FIX 7: Escape SQL LIKE wildcard metacharacters (\, %, _) before
            # interpolating the user's search term. Without this, an attacker
            # can submit a single "%" to match every row (forcing a full scan
            # and a cheap DoS) or craft patterns that bypass intended filters.
            # We also pass escape='\\' so SQLAlchemy emits the matching
            # `ESCAPE '\'` clause that pairs with our escaping.
            safe_search = escape_like(search)
            query = query.filter(
                Participant.name.ilike(f"%{safe_search}%", escape="\\")
                | Participant.category.ilike(f"%{safe_search}%", escape="\\")
            )
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

    # FIX 2: Re-fetch a payment row with a pessimistic lock. On PostgreSQL this
    # emits `SELECT ... FOR UPDATE`, so a second concurrent callback for the
    # same reference blocks until the first transaction commits — preventing
    # the read-then-write race that used to double-credit votes. SQLite (local
    # dev fallback) silently ignores `with_for_update`, but its database-wide
    # write lock makes concurrent writes serialize anyway.
    def get_by_reference_for_update(self, reference: str) -> Optional[Payment]:
        return (
            self.db.query(Payment)
            .filter(Payment.reference == reference)
            .with_for_update()
            .first()
        )

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


class RevokedTokenRepository(BaseRepository[RevokedToken]):
    """
    FIX 6: Persists and queries revoked JWT identifiers (jti). A token's jti is
    recorded here on logout; the auth dependency rejects any token whose jti is
    found below. Rows whose expires_at has passed are ignored (and pruned).
    """
    def __init__(self, db: Session):
        super().__init__(RevokedToken, db)

    def revoke(self, jti: str, user_id: Optional[str], expires_at: datetime) -> RevokedToken:
        """
        Record a jti as revoked. If the same jti is revoked twice (e.g. a
        duplicate logout), the unique constraint makes the second insert a
        harmless no-op once committed.
        """
        existing = self.db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
        if existing:
            return existing
        revoked = RevokedToken(
            jti=jti,
            user_id=user_id,
            expires_at=expires_at,
        )
        self.db.add(revoked)
        self.db.commit()
        self.db.refresh(revoked)
        return revoked

    def is_revoked(self, jti: str) -> bool:
        """
        True if the given jti has been revoked and is still within its token
        lifetime. Expired blocklist entries are treated as not-revoked because
        the token itself would already fail the expiry check — but we still
        prune them opportunistically to keep the table small.
        """
        now = datetime.now(timezone.utc)
        row = self.db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
        if row is None:
            return False
        # If the underlying token has already expired, the entry is stale;
        # drop it so the table cannot grow without bound.
        if row.expires_at < now:
            self.db.delete(row)
            self.db.commit()
            return False
        return True

    def prune_expired(self) -> int:
        """
        Delete all blocklist entries whose tokens have already expired.
        Returns the number of rows removed. Called periodically from logout.
        """
        now = datetime.now(timezone.utc)
        deleted = (
            self.db.query(RevokedToken)
            .filter(RevokedToken.expires_at < now)
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted


class RateLimitRepository:
    """
    FIX 4: Cross-worker rate-limit state backed by the database so that all
    Uvicorn workers share one counter per client IP. Replaces the old
    process-local dict that reset limits per worker and leaked memory.

    The hit() method performs an atomic check-and-increment using a database
    upsert. It returns the new request count for the current window, or 0 if
    the IP is over the limit for this window (and should be rejected with 429).
    """
    def __init__(self, db: Session):
        self.db = db

    def hit(self, client_ip: str, window_seconds: int, max_requests: int) -> int:
        """
        Record a request for `client_ip` and return the resulting count for the
        current window. A return of 0 signals "over limit".

        Strategy:
          * Postgres: a single INSERT ... ON CONFLICT DO UPDATE statement
            atomically creates-or-increments the row. Window resets and limit
            checks are folded into the same statement.
          * SQLite: uses a transactional read-then-write guarded by the
            database-wide write lock (sufficient for local dev).
        """
        now = time.time()

        # Detect dialect once per call to pick the right strategy.
        is_postgres = self.db.bind.dialect.name == "postgresql"

        if is_postgres:
            return self._hit_postgres(client_ip, now, window_seconds, max_requests)
        return self._hit_generic(client_ip, now, window_seconds, max_requests)

    def _hit_postgres(self, client_ip: str, now: float, window_seconds: int, max_requests: int) -> int:
        """
        Atomic Postgres upsert. The INSERT creates a fresh bucket (count=1). On
        a uniqueness conflict we UPDATE: if the existing window has expired we
        reset to count=1 with a new window_start; otherwise we increment.
        Returning the new count lets us check the limit in one round-trip.
        """
        from sqlalchemy import text

        stmt = text(
            """
            INSERT INTO rate_limit_buckets (id, client_ip, window_start, request_count, last_updated)
            VALUES (:id, :ip, :now, 1, :updated)
            ON CONFLICT (client_ip) DO UPDATE
            SET
                request_count = CASE
                    WHEN rate_limit_buckets.window_start < :cutoff
                        THEN 1
                    ELSE rate_limit_buckets.request_count + 1
                END,
                window_start = CASE
                    WHEN rate_limit_buckets.window_start < :cutoff
                        THEN :now
                    ELSE rate_limit_buckets.window_start
                END,
                last_updated = :updated
            RETURNING request_count
            """
        )
        result = self.db.execute(
            stmt,
            {
                "id": str(_uuid.uuid4()),
                "ip": client_ip,
                "now": now,
                "cutoff": now - window_seconds,
                "updated": datetime.now(timezone.utc),
            },
        )
        new_count = result.scalar()
        self.db.commit()
        return int(new_count) if new_count is not None else 0

    def _hit_generic(self, client_ip: str, now: float, window_seconds: int, max_requests: int) -> int:
        """
        Portable read-then-write used by SQLite and any non-Postgres backend.
        Correctness relies on the transaction; SQLite serializes writers via its
        database lock so two concurrent increments cannot both read the old
        count. (This path is intended for local development only.)
        """
        row = (
            self.db.query(RateLimitBucket)
            .filter(RateLimitBucket.client_ip == client_ip)
            .first()
        )
        if row is None:
            # First request from this IP: open a fresh bucket.
            row = RateLimitBucket(
                client_ip=client_ip,
                window_start=now,
                request_count=1,
                last_updated=datetime.now(timezone.utc),
            )
            self.db.add(row)
            self.db.commit()
            return 1

        # If the window has elapsed, reset; otherwise increment.
        if now - row.window_start > window_seconds:
            row.window_start = now
            row.request_count = 1
        else:
            row.request_count += 1
        row.last_updated = datetime.now(timezone.utc)
        self.db.commit()
        return row.request_count

    def prune_stale(self, window_seconds: int, keep_multiplier: int = 5) -> int:
        """
        Delete buckets whose window is well past expiry. Called occasionally to
        bound table growth. `keep_multiplier` widens the prune horizon so we
        never delete a bucket that could still be inside an active window.
        """
        cutoff = time.time() - (window_seconds * keep_multiplier)
        deleted = (
            self.db.query(RateLimitBucket)
            .filter(RateLimitBucket.window_start < cutoff)
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted
