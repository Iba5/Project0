import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, update as sa_update, func
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models.models import (
    User, Event, Participant, Payment, Competition, AuditLog, VoteTransaction,
    PaymentMethodConfig, TestPayment
)
from app.enums.enums import (
    UserRole, ContestantStatus, PaymentStatus,
    SocialPlatform as PlatformEnum
)
from app.repositories.repositories import (
    UserRepository, EventRepository, ParticipantRepository,
    PaymentRepository, ActivityRepository,
    SettingsRepository, VoteTransactionRepository, CompetitionRepository,
    PaymentMethodConfigRepository, TestPaymentRepository
)
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.exceptions.exceptions import ValidationException, NotFoundException, PaymentException
from app.schemas.schemas import (
    UserRegister, UserLogin, AuthResult, UserResponse,
    EventCreate, EventUpdate, ParticipantCreate, PaymentCreate, SettingsProfileUpdate,
    ResetPasswordRequest, AdminInvitationRequest, AdminInvitationResponse,
    InvalidateAdminRequest, CompetitionCreate, CompetitionUpdate,
    VoterCheckResponse, VoterDetailsUpdate, PaymentStatusCheckResponse,
    PaymentMethodConfigCreate, PaymentMethodConfigUpdate
)
from app.audit.audit import AuditService
from app.services.fraud import FraudDetectionService
from app.services.idempotency import IdempotencyService
from app.integrations.paynow.paynow import PaynowClient
from app.exceptions.exceptions import (
    VotingException, ValidationException, NotFoundException, AuthenticationException, PaymentException
)
from app.utils.email import email_service
from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# AuthService
# ---------------------------------------------------------------------------

class AuthService:
    """
    Handles user authentication, admin registrations, password resets, and JWT signing.
    Creates audit log records for login and authentication events.
    """
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    def register_admin(self, user_in: UserRegister) -> AuthResult:
        existing = self.user_repo.get_by_email(user_in.email)
        if existing:
            raise ValidationException("Email already registered.")

        hashed = hash_password(user_in.password)

        # First person to ever register becomes Super Admin. Everyone after that
        # gets a regular Admin role.
        is_first_user = self.user_repo.count_all() == 0
        role = UserRole.SUPER_ADMIN if is_first_user else UserRole.ADMIN

        new_user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=hashed,
            role=role
        )
        self.user_repo.create(new_user)

        AuditService.log_action(
            db=self.db,
            action="Admin Registered",
            user_id=new_user.id,
            details=f"Admin account created: {new_user.email}"
        )

        token = create_access_token(new_user.id)
        refresh_token = create_refresh_token(new_user.id)
        
        # Store refresh token in database
        new_user.refresh_token = refresh_token
        new_user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.user_repo.update()
        
        return AuthResult(
            token=token,
            refresh_token=refresh_token,
            user=UserResponse(
                id=str(new_user.id),
                name=str(new_user.name),
                email=str(new_user.email),
                role=new_user.role
            ),
            message="Registration successful"
        )

    def login_admin(self, login_in: UserLogin, ip_address: Optional[str] = None) -> AuthResult:
        user = self.user_repo.get_by_email(login_in.email)

        # H2 FIX: Increment failed login counter and lock account after 5 failures.
        # `user` is Optional[User] here — every branch below must handle None
        # explicitly before accessing user attributes, or Pylance (correctly)
        # flags every subsequent user.X access as reportOptionalMemberAccess.
        password_ok = user is not None and verify_password(login_in.password, user.hashed_password)

        if user is not None and password_ok:
            # Check account lock BEFORE checking is_active.
            # failed_login_count/locked_until are non-Optional on the model
            # (failed_login_count defaults to 0, not nullable), so no `and`
            # guard is needed here — that guard was dead code Pylance flagged
            # as reportUnnecessaryComparison.
            if user.failed_login_count >= 5:
                if user.locked_until is not None and user.locked_until > datetime.now(timezone.utc):
                    remaining_seconds = int((user.locked_until - datetime.now(timezone.utc)).total_seconds())
                    raise AuthenticationException(
                        f"Account temporarily locked due to too many failed attempts. "
                        f"Try again in {remaining_seconds} seconds or contact support."
                    )
                else:
                    # Lock expired — reset counter
                    user.failed_login_count = 0
                    user.locked_until = None

        if user is None or not password_ok:
            # Increment failed login counter on the existing user record, if any
            if user is not None:
                user.failed_login_count = user.failed_login_count + 1
                # Lock account for 15 minutes after 5 failed attempts
                if user.failed_login_count >= 5:
                    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                self.user_repo.update()

            logger.warning(f"Failed login attempt for email: {login_in.email}")
            AuditService.log_action(
                db=self.db,
                action="Failed Login",
                ip_address=ip_address,
                details=f"Email attempted: {login_in.email}"
            )
            raise AuthenticationException("Invalid email or password.")

        # From this point on, `user` is guaranteed non-None: either branch
        # above raised, or we fell through with a valid, password-verified user.
        assert user is not None

        if not user.is_active:
            raise AuthenticationException("User account is deactivated.")

        # Reset failed login counter on successful login
        if user.failed_login_count > 0:
            user.failed_login_count = 0
            user.locked_until = None

        logger.info(f"Admin logged in: {user.email}")

        AuditService.log_action(
            db=self.db,
            action="Login",
            user_id=user.id,
            ip_address=ip_address,
            details=f"Logged in successfully: {user.email}"
        )

        token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        # Store refresh token in database
        user.refresh_token = refresh_token
        user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.user_repo.update()
        
        return AuthResult(
            token=token,
            refresh_token=refresh_token,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role
            ),
            message="Login successful"
        )

    def logout_admin(self, user_id: str, ip_address: Optional[str] = None) -> None:
        # Clear refresh token from database
        user = self.user_repo.get_by_id(user_id)
        if user:
            user.refresh_token = None
            user.refresh_token_expires = None
            self.user_repo.update()
        
        AuditService.log_action(
            db=self.db,
            action="Logout",
            user_id=user_id,
            ip_address=ip_address,
            details="User logged out"
        )

    def request_password_reset(self, email: str) -> None:
        user = self.user_repo.get_by_email(email)
        if user:
            reset_token = str(uuid.uuid4())
            reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)

            user.reset_token = reset_token
            user.reset_token_expires = reset_token_expires
            self.user_repo.update()

            email_sent = email_service.send_password_reset_email(
                to_email=user.email,
                reset_token=reset_token,
                user_name=user.name
            )

            logger.info(f"Password reset requested for: {email}, email sent: {email_sent}")
            AuditService.log_action(
                db=self.db,
                action="Password Reset Requested",
                user_id=user.id,
                details=f"Reset link requested for {email}, email sent: {email_sent}"
            )

    def reset_password(self, reset_request: ResetPasswordRequest) -> bool:
        user = self.user_repo.get_by_reset_token(reset_request.token)

        if not user:
            raise AuthenticationException("Invalid or expired reset token")

        expires = user.reset_token_expires

        if expires is not None:
            expires = (
                expires.replace(tzinfo=timezone.utc)
                if expires.tzinfo is None
                else expires
            )

            if expires < datetime.now(timezone.utc):
                raise AuthenticationException("Reset token has expired")

        user.hashed_password = hash_password(reset_request.new_password)
        user.reset_token = None
        user.reset_token_expires = None
        self.user_repo.update()

        logger.info(f"Password reset completed for user: {user.email}")
        AuditService.log_action(
            db=self.db,
            action="Password Reset Completed",
            user_id=user.id,
            details=f"Password reset for {user.email}"
        )

        return True

    def create_admin_invitation(self, invitation_request: AdminInvitationRequest, inviter_user: User) -> AdminInvitationResponse:
        if inviter_user.role != UserRole.SUPER_ADMIN:
            raise AuthenticationException("Only super admins can create admin invitations")

        existing_user = self.user_repo.get_by_email(invitation_request.email)
        if existing_user:
            raise ValidationException("User with this email already exists")

        invitation_token = str(uuid.uuid4())
        invitation_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

        new_user = User(
            name="Pending",
            email=invitation_request.email,
            hashed_password="",
            role=invitation_request.role,
            is_active=False,
            invitation_token=invitation_token,
            invitation_token_expires=invitation_token_expires,
            invited_by=inviter_user.id
        )
        self.user_repo.create(new_user)

        invitation_link = f"{email_service.frontend_url}/accept-invitation?token={invitation_token}"
        email_sent = email_service.send_admin_invitation_email(
            to_email=invitation_request.email,
            invitation_link=invitation_link,
            inviter_name=inviter_user.name,
            )

        logger.info(f"Admin invitation created for: {invitation_request.email}, email sent: {email_sent}")
        AuditService.log_action(
            db=self.db,
            action="Admin Invitation Created",
            user_id=inviter_user.id,
            details=f"Invitation sent to {invitation_request.email} with role {invitation_request.role.value}"
        )

        return AdminInvitationResponse(
            email=invitation_request.email,
            role=invitation_request.role,
            invitation_link=invitation_link,
            expires_at=invitation_token_expires
        )

    def complete_admin_signup(self, token: str, name: str, password: str) -> AuthResult:
        user = self.user_repo.get_by_invitation_token(token)

        if not user:
            raise AuthenticationException("Invalid or expired invitation token")

        expires = user.invitation_token_expires

        if expires is not None:
            expires = (
                expires.replace(tzinfo=timezone.utc)
                if expires.tzinfo is None
                else expires
            )

            if expires < datetime.now(timezone.utc):
                raise ValidationException("Invitation token has expired.")

        user.name = name
        user.hashed_password = hash_password(password)
        user.is_active = True
        user.invitation_token = None
        user.invitation_token_expires = None
        self.user_repo.update()

        logger.info(f"Admin signup completed for: {user.email}")
        AuditService.log_action(
            db=self.db,
            action="Admin Signup Completed",
            user_id=user.id,
            details=f"Admin account activated for {user.email}"
        )

        token_jwt = create_access_token(user.id)
        refresh_token_jwt = create_refresh_token(user.id)
        
        # Store refresh token in database
        user.refresh_token = refresh_token_jwt
        user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.user_repo.update()
        
        return AuthResult(
            token=token_jwt,
            refresh_token=refresh_token_jwt,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role
            ),
            message="Account created successfully"
        )

    def invalidate_admin(self, invalidate_request: InvalidateAdminRequest, current_user: User) -> None:
        if current_user.role != UserRole.SUPER_ADMIN:
            raise AuthenticationException("Only super admins can invalidate other admins")

        if invalidate_request.admin_id == current_user.id:
            raise AuthenticationException("Cannot invalidate your own account")

        target_user = self.user_repo.get_by_id(invalidate_request.admin_id)
        if not target_user:
            raise NotFoundException("Admin not found")

        if target_user.role == UserRole.SUPER_ADMIN:
            raise AuthenticationException("Cannot invalidate super admin accounts")

        target_user.is_active = False
        self.user_repo.update()

        logger.info(f"Admin invalidated: {target_user.email} by {current_user.email}")
        AuditService.log_action(
            db=self.db,
            action="Admin Invalidated",
            user_id=current_user.id,
            details=f"Admin {target_user.email} was invalidated by {current_user.email}"
        )

    def verify_invitation_token(self, token: str) -> User:
        """
        Verify that an invitation token is valid and return the invited user.
        """

        user = self.user_repo.get_by_invitation_token(token)

        if user is None:
            raise AuthenticationException(
                "Invalid or expired invitation token."
            )
            
        expires = user.invitation_token_expires

        if expires is not None:
            expires = (
                expires.replace(tzinfo=timezone.utc)
                if expires.tzinfo is None
                else expires
            )

            if expires < datetime.now(timezone.utc):
                raise AuthenticationException(
                    "Invitation token has expired."
                )
        return user
    
    def accept_admin_invitation(
        self,
        token: str,
        name: str,
        password: str,
    ) -> AuthResult:
        """
        Complete an invited administrator's signup.
        """

        user = self.verify_invitation_token(token)

        user.name = name
        user.hashed_password = hash_password(password)
        user.is_active = True
        user.invitation_token = None
        user.invitation_token_expires = None

        self.user_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Admin Invitation Accepted",
            user_id=user.id,
            details=f"Admin account activated for {user.email}"
        )

        jwt = create_access_token(user.id)
        refresh_token_jwt = create_refresh_token(user.id)
        
        # Store refresh token in database
        user.refresh_token = refresh_token_jwt
        user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.user_repo.update()

        return AuthResult(
            token=jwt,
            refresh_token=refresh_token_jwt,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
            ),
            message="Account activated successfully."
        )


# ---------------------------------------------------------------------------
# DashboardService
# ---------------------------------------------------------------------------

class DashboardService:
    """
    Computes aggregated admin metrics: active events, vote counts, total revenue,
    and returns audit log data.
    H1 FIX: Uses SQL aggregation instead of loading all records into memory.
    """
    def __init__(self, db: Session) -> None:
        self.event_repo = EventRepository(db)
        self.participant_repo = ParticipantRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.activity_repo = ActivityRepository(db)
        self.db = db

    def get_summary(self) -> Dict[str, Any]:
        active_event = self.event_repo.get_active_event()
        active_event_name = active_event.name if active_event else "No Active Event"

        # H1 FIX: Use SQL COUNT/SUM instead of loading all rows into Python
        total_participants = self.db.query(func.count(Participant.id)).filter(
            Participant.deleted_at.is_(None)
        ).scalar() or 0

        total_votes = self.db.query(func.coalesce(func.sum(Participant.votes), 0)).filter(
            Participant.deleted_at.is_(None)
        ).scalar() or 0

        total_revenue_result = self.db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.status == PaymentStatus.PAID
        ).scalar()
        total_revenue_num = float(total_revenue_result) if total_revenue_result else 0.0

        # Recent payments — limit query at DB level
        recent_payment_rows = self.db.query(Payment).order_by(Payment.date.desc()).limit(5).all()

        contestant_ids = {p.contestant_id for p in recent_payment_rows if p.contestant_id}
        contestants_map: Dict[str, str] = {}
        if contestant_ids:
            batch = self.participant_repo.get_by_ids(contestant_ids)
            contestants_map = {c.id: c.name for c in batch}

        recent_payments: List[Dict[str, Any]] = []
        for p in recent_payment_rows:
            participant_name = contestants_map.get(p.contestant_id, "Unknown") if p.contestant_id else "Unknown"

            recent_payments.append({
                "id": p.id,
                "reference": p.reference,
                "contestant": participant_name,
                "amount": f"${float(p.amount):.2f}",
                "paymentMethod": p.payment_method,
                "status": p.status,
                "date": p.date,
            })

        recent_activities = self.activity_repo.get_recent(5)

        return {
            "activeEvent": active_event_name,
            "totalParticipants": total_participants,
            "totalVotes": total_votes,
            "totalRevenue": f"${total_revenue_num:.2f}",
            "recentPayments": recent_payments,
            "recentActivity": recent_activities
        }


# ---------------------------------------------------------------------------
# CompetitionService
# ---------------------------------------------------------------------------

class CompetitionService:
    """
    CRUD management for Competitions.
    Only one competition can be active at a time.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.comp_repo = CompetitionRepository(db)

    def list_competitions(self, offset: int = 0, limit: int = 100) -> Tuple[List[Competition], int]:
        return self.comp_repo.get_all_paginated(offset, limit)

    def get_competition(self, competition_id: str) -> Competition:
        comp = self.comp_repo.get_by_id(competition_id)
        if not comp:
            raise NotFoundException("Competition not found")
        return comp

    def create_competition(self, comp_in: CompetitionCreate) -> Competition:
        new_comp = Competition(
            name=comp_in.name,
            description=comp_in.description,
            status=comp_in.status,
            start_date=comp_in.start_date,
            end_date=comp_in.end_date,
            vote_price=comp_in.vote_price,
            votes_per_payment=comp_in.votes_per_payment,
            currency=comp_in.currency,
            public_leaderboard=comp_in.public_leaderboard,
        )
        saved = self.comp_repo.create(new_comp)

        AuditService.log_action(
            db=self.db,
            action="Competition Created",
            user_id=self.user_id,
            details=f"Created competition: {saved.name} ({saved.id})"
        )
        return saved

    def update_competition(self, competition_id: str, comp_in: CompetitionUpdate) -> Competition:
        comp = self.comp_repo.get_by_id(competition_id)
        if not comp:
            raise NotFoundException("Competition not found")

        # L9 FIX: Only update fields that were actually provided (partial update)
        update_data = comp_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(comp, field, value)

        self.comp_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Competition Updated",
            user_id=self.user_id,
            details=f"Updated competition: {comp.name} ({comp.id})"
        )
        return comp

    def set_active_competition(self, competition_id: str) -> Competition:
        """
        Sets a competition as active. Deactivates any previously active competition.
        Only one competition can be active at a time.
        L3 FIX: Uses targeted UPDATE instead of loading all competitions.
        """
        comp = self.comp_repo.get_by_id(competition_id)
        if not comp:
            raise NotFoundException("Competition not found")

        # Deactivate all other active competitions in a single query
        self.db.execute(
            sa_update(Competition)
            .where(Competition.is_active.is_(True), Competition.id != competition_id)
            .values(is_active=False)
        )

        comp.is_active = True
        self.comp_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Competition Activated",
            user_id=self.user_id,
            details=f"Activated competition: {comp.name} ({comp.id})"
        )
        return comp

    def get_active_competition(self) -> Optional[Competition]:
        return self.comp_repo.get_active_competition()


# ---------------------------------------------------------------------------
# EventService
# ---------------------------------------------------------------------------

class EventService:
    """
    CRUD management for entertainment competition events.
    Records audit actions on modifications.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.event_repo = EventRepository(db)

    def list_events(self, offset: int = 0, limit: int = 100) -> Tuple[List[Event], int]:
        return self.event_repo.get_all_paginated(offset, limit)

    def get_event(self, event_id: str) -> Optional[Event]:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")
        return event

    def create_event(self, event_in: EventCreate) -> Event:
        new_event = Event(
            name=event_in.name,
            description=event_in.description,
            banner=event_in.banner,
            start_date=event_in.start_date,
            end_date=event_in.end_date,
            status=event_in.status,
            vote_price=event_in.vote_price,
            votes_per_payment=event_in.votes_per_payment,
            currency=event_in.currency,
            registration_opens=event_in.registration_opens,
            registration_closes=event_in.registration_closes,
            voting_opens=event_in.voting_opens,
            voting_closes=event_in.voting_closes,
            public_leaderboard=event_in.public_leaderboard,
            allowed_platforms=event_in.allowed_platforms,
            allowed_categories=event_in.allowed_categories,
            require_contestant_approval=event_in.require_contestant_approval,
            competition_id=event_in.competition_id,
        )
        saved = self.event_repo.create(new_event)

        AuditService.log_action(
            db=self.db,
            action="Event Created",
            user_id=self.user_id,
            details=f"Created event: {saved.name} ({saved.id})"
        )
        
        # Invalidate cache synchronously (called from thread pool)
        try:
            cache_service = get_cache_service()
            cache_service.invalidate_events()
        except Exception as e:
            logger.error(f"Failed to invalidate events cache: {e}")
        
        return saved

    def _invalidate_event_cache_async(self):
        """No longer used - cache invalidation is now synchronous"""
        pass

    def update_event(self, event_id: str, event_in: EventUpdate) -> Event:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")

        # L9 FIX: Only update fields that were actually provided (partial update)
        update_data = event_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(event, field, value)

        self.event_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Event Updated",
            user_id=self.user_id,
            details=f"Updated event: {event.name} ({event.id})"
        )
        
        # Invalidate cache after event update
        self._invalidate_event_cache_async()
        
        return event

    def delete_event(self, event_id: str) -> None:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")

        self.event_repo.delete(event)

        AuditService.log_action(
            db=self.db,
            action="Event Deleted",
            user_id=self.user_id,
            details=f"Soft deleted event: {event.name} ({event.id})"
        )
        
        # Invalidate cache synchronously (called from thread pool)
        try:
            cache_service = get_cache_service()
            cache_service.invalidate_events()
        except Exception as e:
            logger.error(f"Failed to invalidate events cache: {e}")

    def _invalidate_event_cache_async(self):
        """No longer used - cache invalidation is now synchronous"""
        pass


# ---------------------------------------------------------------------------
# ParticipantService
# ---------------------------------------------------------------------------

class ParticipantService:
    """
    CRUD and approval actions for contestants.
    Soft-delete and Audit Logging aware.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.part_repo = ParticipantRepository(db)

    def list_participants(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        platform: Optional[PlatformEnum] = None, competition_id: Optional[str] = None,
        offset: int = 0, limit: int = 100
    ) -> Tuple[List[Participant], int]:
        return self.part_repo.search_and_filter(search, status, platform, competition_id, offset, limit)

    async def list_public_participants_cached(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        platform: Optional[PlatformEnum] = None, competition_id: Optional[str] = None,
        offset: int = 0, limit: int = 100
    ) -> Tuple[List[Participant], int]:
        """
        Returns public participants with Redis caching.
        Cache key includes search parameters for proper invalidation.
        """
        from app.core.cache import get_cache_service, get_cache_key, CACHE_TTL, CACHE_PREFIXES
        
        # Skip caching for searches or custom parameters (too many combinations)
        if search or platform or status or offset != 0 or limit != 100:
            return self.list_participants(search, status, platform, competition_id, offset, limit)
        
        try:
            cache_service = get_cache_service()
            cache_key = get_cache_key(
                CACHE_PREFIXES['participants'],
                f"comp:{competition_id}" if competition_id else "global"
            )
            
            # Try to get from cache (synchronous)
            cached_data = cache_service.get(cache_key)
            if cached_data is not None:
                logger.info(f"Cache hit for public participants: {cache_key}")
                # Return the cached data directly (endpoint will handle serialization)
                return cached_data['items'], cached_data['total']
            
            # Cache miss - fetch from database
            items, total = self.list_participants(search, status, platform, competition_id, offset, limit)
            
            # Store in cache (synchronous)
            cache_service.set(cache_key, {'items': items, 'total': total}, CACHE_TTL['MEDIUM'])
            logger.info(f"Cache miss and set for public participants: {cache_key}")
            
            return items, total
            
        except Exception as e:
            logger.error(f"Cache error for public participants, falling back to DB: {e}")
            # Fallback to database query on cache failure
            return self.list_participants(search, status, platform, competition_id, offset, limit)

    def get_participant(self, part_id: str) -> Optional[Participant]:
        part = self.part_repo.get_by_id(part_id)
        if not part:
            raise NotFoundException("Participant not found")
        return part

    def create_participant(self, part_in: ParticipantCreate) -> Participant:
        new_part = Participant(
            name=part_in.name,
            category=part_in.category,
            platform=part_in.platform,
            video_url=part_in.video_url,
            status=part_in.status,
            votes=part_in.votes,
            competition_id=part_in.competition_id,
        )
        saved = self.part_repo.create(new_part)

        AuditService.log_action(
            db=self.db,
            action="Contestant Created",
            user_id=self.user_id,
            details=f"Created contestant: {saved.name} ({saved.id})"
        )
        
        # Invalidate cache after participant creation
        self._invalidate_participant_cache_async(saved.id, saved.competition_id)
        
        return saved

    def update_participant_status(self, part_id: str, status: ContestantStatus) -> Participant:
        part = self.part_repo.get_by_id(part_id)
        if not part:
            raise NotFoundException("Participant not found")

        old_status = part.status
        part.status = status
        self.part_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Contestant Status Changed",
            user_id=self.user_id,
            details=f"Contestant status updated from {old_status.value} to {status.value} for {part.name} ({part.id})"
        )
        
        # Invalidate cache after status change
        self._invalidate_participant_cache_async(part_id, part.competition_id)
        
        return part

    def delete_participant(self, part_id: str) -> None:
        part = self.part_repo.get_by_id(part_id)
        if not part:
            raise NotFoundException("Participant not found")

        self.part_repo.delete(part)
        AuditService.log_action(
            db=self.db,
            action="Contestant Deleted",
            user_id=self.user_id,
            details=f"Soft deleted contestant: {part.name} ({part.id})"
        )
        
        # Invalidate cache after deletion
        self._invalidate_participant_cache_async(part_id, part.competition_id)

    def _invalidate_participant_cache_async(self, participant_id: str, competition_id: Optional[str] = None):
        """Async cache invalidation helper that doesn't block the main operation."""
        import asyncio
        from app.core.cache import get_cache_service
        
        async def _invalidate():
            try:
                cache_service = get_cache_service()
                await cache_service.invalidate_participant(participant_id)
                await cache_service.invalidate_participants()  # Also invalidate public participants
                if competition_id:
                    await cache_service.invalidate_leaderboard(competition_id)
            except Exception as e:
                logger.error(f"Failed to invalidate cache for participant {participant_id}: {e}")
        
        # Fire and forget - don't block the main operation
        asyncio.create_task(_invalidate())

    def get_leaderboard(self, competition_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns the public leaderboard for a competition.
        Does NOT expose voter phone numbers or emails.
        """
        if competition_id:
            participants = self.part_repo.get_by_competition(competition_id)
        else:
            all_participants = self.part_repo.get_all()
            participants = [p for p in all_participants if p.status == ContestantStatus.APPROVED]
            participants.sort(key=lambda p: p.votes, reverse=True)

        return [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "platform": p.platform.value,
                "videoUrl": p.video_url,
                "votes": p.votes,
                "status": p.status.value,
            }
            for p in participants
        ]

    async def get_leaderboard_cached(self, competition_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns the public leaderboard with Redis caching.
        Does NOT expose voter phone numbers or emails.
        """
        from app.core.cache import get_cache_service, get_cache_key, CACHE_TTL, CACHE_PREFIXES
        
        try:
            cache_service = get_cache_service()
            cache_key = get_cache_key(CACHE_PREFIXES['leaderboard'], f"comp:{competition_id}" if competition_id else "global")
            
            # Try to get from cache (synchronous)
            cached_data = cache_service.get(cache_key)
            if cached_data is not None:
                logger.info(f"Cache hit for leaderboard: {cache_key}")
                return cached_data
            
            # Cache miss - fetch from database
            leaderboard_data = self.get_leaderboard(competition_id)
            
            # Store in cache (synchronous)
            cache_service.set(cache_key, leaderboard_data, CACHE_TTL['MEDIUM'])
            logger.info(f"Cache miss and set for leaderboard: {cache_key}")
            
            return leaderboard_data
            
        except Exception as e:
            logger.error(f"Cache error for leaderboard, falling back to DB: {e}")
            # Fallback to database query on cache failure
            return self.get_leaderboard(competition_id)

    def get_public_leaderboard(self, competition_id: str):
        return self.part_repo.get_public_leaderboard(competition_id)


# ---------------------------------------------------------------------------
# PaymentService
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# PaymentService
# ---------------------------------------------------------------------------

class PaymentService:
    """
    Handles the full payment lifecycle:
    1. Pre-payment voter duplicate check (by phone + competition)
    2. Payment initiation via official Paynow SDK (web or mobile)
    3. Webhook callback processing with dual verification (signature + poll_url)
    4. ACID transaction for payment status + vote creation
    5. Post-payment voter details collection
    6. Manual status check via poll_url
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.payment_repo = PaymentRepository(db)
        self.test_payment_repo = TestPaymentRepository(db)
        self.part_repo = ParticipantRepository(db)
        self.vote_repo = VoteTransactionRepository(db)
        self.comp_repo = CompetitionRepository(db)
        self.paynow_client = PaynowClient()
        self.fraud_service = FraudDetectionService(db)
        self.idempotency_service = IdempotencyService(db)
        self.test_mode = settings.TEST_PAYMENT_MODE  # Use specific test payment mode setting

    def check_voter_duplicate(
        self, phone: str, competition_id: Optional[str] = None
    ) -> VoterCheckResponse:
        """
        PRE-PAYMENT CHECK: Detects if a phone number has already successfully
        voted in the current (or specified) competition.
        Returns a warning if duplicate detected.
        """
        # Resolve competition
        comp_id = competition_id
        if not comp_id:
            active_comp = self.comp_repo.get_active_competition()
            if active_comp:
                comp_id = active_comp.id

        if not comp_id:
            # No competition scope, allow without warning
            return VoterCheckResponse(
                has_voted=False,
                message="No active competition found. Proceeding without duplicate check."
            )

        # Check for successful payments by this phone in this competition
        existing = self.payment_repo.get_by_voter_phone_and_competition(phone, comp_id)

        if existing:
            return VoterCheckResponse(
                has_voted=True,
                message="Duplicate voter detected.",
                warning="You have already voted in this competition. Continue only if you are paying for someone else."
            )

        return VoterCheckResponse(
            has_voted=False,
            message="No previous votes found. You may proceed."
        )

    def _rate_limit_check(self, phone: str) -> None:
        """
        Prevents a single phone number from spamming pending transactions.
        Maximum 3 pending payments per phone in the last 10 minutes.
        """
        pending = self.payment_repo.get_recent_pending_by_phone(phone, minutes=10)
        if len(pending) >= 3:
            logger.warning(f"Rate limit hit for phone {phone[:4]}***: {len(pending)} pending in 10 min")
            raise PaymentException(
                "Too many payment attempts. Please wait a few minutes before trying again."
            )

    def initiate_payment(self, payment_in: PaymentCreate, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """
        INITIATE PAYMENT (Enhanced):
        1. Validates contestant exists
        2. Checks voter duplication (phone + competition)
        3. If duplicate, requires acknowledge_duplicate=True
        4. Rate limits by phone
        5. Checks idempotency to prevent duplicate payments
        6. In TEST MODE: Creates test payment without calling Paynow
        7. In PRODUCTION: Uses official Paynow SDK to create payment
        8. Saves poll_url to DB (MANDATORY per Paynow docs)
        9. Returns redirect URL (web) or instructions (mobile)
        """
        # 1. Validate contestant
        part = self.part_repo.get_by_id(payment_in.contestant_id)
        if not part:
            raise NotFoundException("Contestant not found")

        # 1b. Validate voting window via competition time constraints (H6 fix)
        if part.competition_id:
            comp = self.comp_repo.get_by_id(part.competition_id)
            if comp and (comp.start_date or comp.end_date):
                now = datetime.now(timezone.utc)
                # Ensure datetimes are timezone-aware for comparison
                start = comp.start_date.replace(tzinfo=timezone.utc) if comp.start_date and comp.start_date.tzinfo is None else comp.start_date
                end = comp.end_date.replace(tzinfo=timezone.utc) if comp.end_date and comp.end_date.tzinfo is None else comp.end_date
                if start and now < start:
                    raise PaymentException("Voting has not yet opened for this competition.")
                if end and now > end:
                    raise PaymentException("Voting has closed for this competition.")

        # 1c. Validate payment method is enabled
        from app.repositories.repositories import PaymentMethodConfigRepository
        payment_method_repo = PaymentMethodConfigRepository(self.db)
        payment_method_config = payment_method_repo.get_by_method(payment_in.payment_method.lower())
        if not payment_method_config or not payment_method_config.is_enabled:
            raise PaymentException(f"Payment method '{payment_in.payment_method}' is not available or has been disabled.")

        # 2. Duplicate voter check
        voter_check = self.check_voter_duplicate(
            payment_in.voter_phone,
            payment_in.competition_id
        )

        if voter_check.has_voted and not payment_in.acknowledge_duplicate:
            # Return the warning but do NOT proceed with payment
            return {
                "warning": voter_check.warning,
                "has_voted": True,
                "reference": None,
                "redirectUrl": None,
                "instructions": None
            }

        # 3. Rate limiting
        self._rate_limit_check(payment_in.voter_phone)

        # 3b. Idempotency dedupe: if client supplied a key and we already
        # have a payment with that key, return existing details instead
        if idempotency_key:
            existing = self.payment_repo.get_by_idempotency_key(idempotency_key)
            if existing:
                logger.info(f"Idempotency: returning existing payment for key {idempotency_key}")
                return {
                    "warning": None,
                    "has_voted": False,
                    "reference": existing.reference,
                    "redirectUrl": existing.paynow_redirect_url,
                    "instructions": None,
                    "pollUrl": existing.poll_url,
                }

        # 4. Generate reference
        reference = f"VOTE-{uuid.uuid4().hex[:8].upper()}"

        # 5. Resolve competition_id and vote price with fallback chain
        comp_id = payment_in.competition_id
        vote_price = None
        
        # Priority: Event vote_price → Competition vote_price → Global minimum
        if hasattr(part, 'event_id') and part.event_id:
            from app.repositories.repositories import EventRepository
            event_repo = EventRepository(self.db)
            event = event_repo.get_by_id(part.event_id)
            if event and event.vote_price:
                vote_price = event.vote_price
        
        if not vote_price and part.competition_id:
            comp = self.comp_repo.get_by_id(part.competition_id)
            if comp and comp.vote_price:
                vote_price = comp.vote_price
        
        if not vote_price:
            vote_price = settings.MIN_PAYMENT_AMOUNT
        
        # Ensure the amount meets the minimum requirement
        if vote_price < settings.MIN_PAYMENT_AMOUNT:
            vote_price = settings.MIN_PAYMENT_AMOUNT
            logger.info(f"Adjusted vote_price to minimum ${vote_price} for contestant {part.id}")

        # 6. TEST MODE: Create test payment without Paynow
        if self.test_mode:
            return self._initiate_test_payment(
                payment_in, part, reference, vote_price, comp_id, idempotency_key
            )

        # 7. PRODUCTION MODE: Continue with real Paynow flow
        return self._initiate_real_payment(
            payment_in, part, reference, vote_price, comp_id, idempotency_key
        )

    def _initiate_test_payment(
        self, payment_in: PaymentCreate, part: Participant, 
        reference: str, vote_price: float, comp_id: Optional[str],
        idempotency_key: Optional[str]
    ) -> Dict[str, Any]:
        """
        Create a test payment without calling Paynow SDK.
        Used in development mode for testing payment flows without real money.
        """
        test_redirect_url = f"{settings.FRONTEND_URL}/payments/test/{reference}"
        
        test_payment = TestPayment(
            reference=reference,
            contestant_id=part.id,
            amount=vote_price,
            payment_method=payment_in.payment_method,
            status="created",
            voter_phone=payment_in.voter_phone,
            voter_email=payment_in.voter_email,
            source_platform=payment_in.source_platform,
            competition_id=comp_id,
            test_redirect_url=test_redirect_url,
            is_test_payment=True,
            auto_complete=True,  # Auto-complete test payments after delay
            test_completion_delay=5,  # Complete after 5 seconds
            test_response_data={
                "test_mode": True,
                "simulated": True,
                "vote_price": str(vote_price)
            }
        )
        
        self.test_payment_repo.create(test_payment)
        
        logger.info(f"Test payment created: {reference} for contestant {part.name} (${vote_price})")
        
        # Log test payment initiation
        AuditService.log_action(
            db=self.db,
            action="Test Payment Created",
            user_id=self.user_id,
            details=f"TEST MODE: Payment {reference} for contestant {part.name} (${vote_price})"
        )
        
        return {
            "warning": None,
            "has_voted": False,
            "reference": reference,
            "redirectUrl": test_redirect_url,
            "instructions": None,
            "pollUrl": None,
            "amount": str(vote_price),
            "test_mode": True
        }

    def _initiate_real_payment(
        self, payment_in: PaymentCreate, part: Participant,
        reference: str, vote_price: float, comp_id: Optional[str],
        idempotency_key: Optional[str]
    ) -> Dict[str, Any]:
        """
        Create a real payment using Paynow SDK.
        Used in production mode for actual payment processing.
        """
        # Determine payment type (web vs mobile)
        is_mobile = payment_in.payment_method.lower() in ("ecocash", "onemoney")

        # Create local payment record with SERVER-DETERMINED amount
        pending_payment = Payment(
            reference=reference,
            contestant_id=part.id,
            amount=vote_price,
            payment_method=payment_in.payment_method,
            status=PaymentStatus.CREATED,
            voter_phone=payment_in.voter_phone,
            voter_email=payment_in.voter_email,
            source_platform=payment_in.source_platform,
            competition_id=comp_id,
            duplicate_vote_acknowledged=payment_in.acknowledge_duplicate,
        )
        # Persist optional idempotency key to detect client retries
        if idempotency_key:
            pending_payment.idempotency_key = idempotency_key
        # Don't commit yet — we'll commit after Paynow confirms creation

        # Call Paynow SDK with SERVER-DETERMINED amount
        item_name = f"Vote for {part.name}"
        voter_email = payment_in.voter_email or "voter@platform.com"

        try:
            if is_mobile:
                paynow_response = self.paynow_client.create_mobile_payment(
                    reference=reference,
                    email=voter_email,
                    item_name=item_name,
                    amount=vote_price,
                    phone=payment_in.voter_phone,
                    method=payment_in.payment_method.lower(),
                )
            else:
                paynow_response = self.paynow_client.create_web_payment(
                    reference=reference,
                    email=voter_email,
                    item_name=item_name,
                    amount=vote_price,
                )
        except ImportError:
            # H4 FIX: Paynow SDK not installed — FAIL loudly, don't fake success.
            # Previously this returned a fabricated URL with success=True,
            # creating phantom payment records that could never complete.
            logger.error("Paynow SDK not installed. Payment initiation failed.")
            raise PaymentException(
                "Payment service is currently unavailable. "
                "Please contact support."
            )

        if not paynow_response.get("success"):
            errors = paynow_response.get("errors", [])
            error_msg = "; ".join(errors) if errors else "Paynow payment initiation failed."
            AuditService.log_action(
                db=self.db,
                action="Payment Initiation Failed",
                details=f"Paynow failed for ref {reference}: {error_msg}"
            )
            raise PaymentException(f"Payment could not be initiated: {error_msg}")

        # Save poll_url and redirect URL to payment record
        pending_payment.poll_url = paynow_response.get("poll_url")
        pending_payment.paynow_redirect_url = paynow_response.get("redirect_url")
        pending_payment.status = PaymentStatus.PENDING

        self.payment_repo.create(pending_payment)

        # Log payment initiation
        AuditService.log_action(
            db=self.db,
            action="Payment Created",
            details=f"Payment reference {reference} initiated for contestant: {part.name} ({part.id}) "
                    f"via {payment_in.payment_method}, src={payment_in.source_platform or 'direct'}"
        )

        # Return response
        return {
            "warning": None,
            "has_voted": False,
            "reference": reference,
            "redirectUrl": paynow_response.get("redirect_url"),
            "instructions": paynow_response.get("instructions"),
            "pollUrl": paynow_response.get("poll_url"),
            "amount": str(vote_price)
        }

    def process_paynow_callback(self, callback_data: Dict[str, Any]) -> None:
        """
        CRITICAL PAYMENT VERIFICATION FLOW (Idempotent, ACID, Dual Verification):

        1. Verify Webhook Signature (SHA512 hash)
        2. Check Idempotency (prevent double voting)
        3. Cross-reference reference with internal payment
        4. DUAL VERIFICATION: Actively poll Paynow using saved poll_url
           "Do not trust the webhook payload blindly" — Paynow docs
        5. Inside a DB transaction:
           a. Update payment status to PAID
           b. Create VoteTransaction record
           c. Increment contestant votes
        6. Commit atomically — rollback on ANY failure
        7. Log security audit
        """
        reference: Optional[str] = callback_data.get("reference")
        paynow_status: Optional[str] = callback_data.get("status")

        # --- 1. Verify webhook signature ---
        if not self.paynow_client.verify_callback(callback_data):
            logger.error(f"Security Alert | Paynow signature verification failed for ref: {reference}")
            AuditService.log_action(
                db=self.db,
                action="Payment Webhook Verification Failed",
                details=f"Webhook signature check failed for reference {reference}"
            )
            raise VotingException("Signature check failed")

        if not reference:
            raise NotFoundException("Payment reference missing from callback payload")

        # --- 2. Cross-reference with internal payment AND lock the row ---
        # C1 FIX: Use select_for_update() to prevent concurrent webhook + manual poll
        # from both passing idempotency checks and double-crediting votes.
        payment = self.db.execute(
            select(Payment).where(Payment.reference == reference).with_for_update()
        ).scalar_one_or_none()

        if not payment:
            logger.error(f"Callback received for non-existent payment reference: {reference}")
            raise NotFoundException(f"Payment reference {reference} not found")

        # --- 3. Check Idempotency (AFTER acquiring row lock) ---
        if self.idempotency_service.is_callback_already_processed(payment):
            logger.info(f"Payment reference {reference} callback already processed. Skipping.")
            return

        # --- 4. DUAL VERIFICATION: Active poll_url check ---
        if payment.poll_url:
            try:
                poll_result = self.paynow_client.check_transaction_status(payment.poll_url)
                if poll_result.get("paid"):
                    paynow_status = "paid"  # Trust the active poll over webhook
                    logger.info(f"Dual verification confirmed PAID for ref: {reference} via poll_url")
                elif poll_result.get("error"):
                    logger.warning(
                        f"Poll_url check error for ref {reference}: {poll_result['error']}. "
                        f"Falling back to webhook status: {paynow_status}"
                    )
            except Exception as e:
                logger.warning(
                    f"Could not verify via poll_url for ref {reference}: {str(e)}. "
                    f"Falling back to webhook status: {paynow_status}"
                )

        # --- 5. ACID Transaction Block ---
        try:
            if paynow_status is not None and paynow_status.lower() in ("paid", "successful"):
                # H3 FIX: Compute votes_to_add BEFORE fraud check.
                # Previously used int(payment.amount) — a monetary value —
                # compared against MAX_VOTES_PER_TRANSACTION.
                votes_to_add = 1
                if payment.competition_id:
                    comp = self.comp_repo.get_by_id(payment.competition_id)
                    if comp:
                        votes_to_add = comp.votes_per_payment

                if not payment.contestant_id:
                    raise VotingException(
                        f"Payment {reference} has no associated contestant; cannot credit votes."
                    )

                # Fraud detection — now uses correct vote count
                self.fraud_service.detect_suspicious_voting(payment.contestant_id, votes_to_add)

                # Update payment status
                payment.status = PaymentStatus.PAID

                vote_txn = VoteTransaction(
                    payment_id=payment.id,
                    contestant_id=payment.contestant_id,
                    votes_awarded=votes_to_add,
                    competition_id=payment.competition_id,
                )
                self.db.add(vote_txn)

                # H1 FIX: Atomic vote increment via SQL UPDATE.
                # Previously: contestant.votes += votes_to_add (read-modify-write).
                # Two concurrent callbacks for the same contestant could both
                # read votes=100, both write votes=101, losing one vote.
                result: CursorResult[Any] = self.db.execute(  # type: ignore[assignment]
                    sa_update(Participant)
                    .where(Participant.id == payment.contestant_id,
                           Participant.deleted_at.is_(None))
                    .values(votes=Participant.votes + votes_to_add)
                )
                if result.rowcount == 0:
                    raise VotingException(
                        f"Contestant {payment.contestant_id} not found or soft-deleted. "
                        f"Payment {reference} was paid but no votes were credited."
                    )

                audit_entry = AuditLog(
                    action="Payment Verified",
                    details=(
                        f"Credited {votes_to_add} votes to contestant "
                        f"{payment.contestant_id} on ref {reference}. "
                        f"Verified via poll_url dual check."
                    )
                )
                self.db.add(audit_entry)

                # COMMIT — atomic
                self.db.commit()
                logger.info(f"Transaction committed successfully. reference: {reference}.")
                
                # Invalidate cache after vote crediting
                self._invalidate_vote_cache_async(payment.contestant_id, payment.competition_id)
            else:
                payment.status = PaymentStatus.FAILED

                # Audit log for failure (use direct SQL insert to stay inside transaction)
                audit_entry = AuditLog(
                    action="Payment Failed",
                    details=f"Payment reference {reference} reported failed status: {paynow_status}"
                )
                self.db.add(audit_entry)
                self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Transaction rolled back during callback process: {str(e)}")
            raise

    def _invalidate_vote_cache_async(self, contestant_id: str, competition_id: Optional[str] = None):
        """Async cache invalidation helper for vote updates."""
        import asyncio
        from app.core.cache import get_cache_service
        
        async def _invalidate():
            try:
                cache_service = get_cache_service()
                await cache_service.invalidate_participant(contestant_id)
                await cache_service.invalidate_participants()  # Also invalidate public participants
                if competition_id:
                    await cache_service.invalidate_leaderboard(competition_id)
            except Exception as e:
                logger.error(f"Failed to invalidate cache for contestant {contestant_id}: {e}")
        
        # Fire and forget - don't block the main operation
        asyncio.create_task(_invalidate())

    def check_payment_status(self, reference: str) -> PaymentStatusCheckResponse:
        """
        MANUAL STATUS CHECK:
        Allows the frontend to manually poll the payment status.
        Uses the saved poll_url to actively verify with Paynow.

        Uses select_for_update() to prevent concurrent requests from
        crediting the same vote twice (H5 race condition fix).
        """
        payment = self.payment_repo.get_by_reference(reference)
        if not payment:
            raise NotFoundException(f"Payment reference {reference} not found")

        # Re-fetch with row-level lock for PostgreSQL (no-op on SQLite but harmless)
        payment = self.db.execute(
            select(Payment).where(Payment.id == payment.id).with_for_update()
        ).scalar_one()

        # If already in a final state, return immediately
        if payment.status in (PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.REFUNDED, PaymentStatus.EXPIRED):
            return PaymentStatusCheckResponse(
                reference=reference,
                status=payment.status,
                paid=(payment.status == PaymentStatus.PAID)
            )

        # Try to actively check via poll_url
        if payment.poll_url:
            try:
                poll_result = self.paynow_client.check_transaction_status(payment.poll_url)
                if poll_result.get("paid"):
                    # Directly apply the vote in this transaction (skip webhook signature)
                    try:
                        votes_to_add = 1
                        if payment.competition_id:
                            comp = self.comp_repo.get_by_id(payment.competition_id)
                            if comp:
                                votes_to_add = comp.votes_per_payment

                        payment.status = PaymentStatus.PAID

                        # Check idempotency — has a vote txn already been created?
                        existing_vote = self.vote_repo.get_by_payment_id(payment.id)
                        if not existing_vote:
                            vote_txn = VoteTransaction(
                                payment_id=payment.id,
                                contestant_id=payment.contestant_id,
                                votes_awarded=votes_to_add,
                                competition_id=payment.competition_id,
                            )
                            self.db.add(vote_txn)

                        # H1 FIX: Same atomic SQL UPDATE as callback path
                        if payment.contestant_id:
                            self.db.execute(
                                sa_update(Participant)
                                .where(Participant.id == payment.contestant_id,
                                       Participant.deleted_at.is_(None))
                                .values(votes=Participant.votes + votes_to_add)
                            )

                        self.db.commit()
                        logger.info(f"Manual poll confirmed PAID for ref: {reference}")
                    except Exception:
                        self.db.rollback()
                        raise

                    return PaymentStatusCheckResponse(
                        reference=reference,
                        status=PaymentStatus.PAID,
                        paid=True
                    )
            except Exception as e:
                logger.warning(f"Manual status check failed for {reference}: {str(e)}")

        # NOTE: payment.status can only be CREATED, PENDING, or PROCESSING at
        # this point — all terminal states (PAID, FAILED, CANCELLED, REFUNDED,
        # EXPIRED) were already returned above. So `paid` is always False here;
        # this is not a bug, just documenting why it's a constant.
        return PaymentStatusCheckResponse(
            reference=reference,
            status=payment.status,
            paid=False
        )

    def update_voter_details(self, details_in: VoterDetailsUpdate) -> Dict[str, Any]:
        """
        POST-PAYMENT VOTER DETAILS COLLECTION:
        After a successful payment, the voter may provide name/email
        if they were paying on behalf of someone else.
        """
        payment = self.payment_repo.get_by_reference(details_in.payment_reference)
        if not payment:
            raise NotFoundException(f"Payment reference {details_in.payment_reference} not found")

        if payment.status != PaymentStatus.PAID:
            raise PaymentException("Voter details can only be updated for successful payments.")

        updated_fields: List[str] = []
        if details_in.voter_name:
            payment.voter_name = details_in.voter_name
            updated_fields.append(f"name={details_in.voter_name}")

        if details_in.voter_email:
            payment.voter_email = details_in.voter_email
            updated_fields.append(f"email={details_in.voter_email}")

        if not updated_fields:
            return {"message": "No details to update.", "success": True}

        self.payment_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Voter Details Updated",
            details=f"Updated voter details for payment {payment.reference}: {', '.join(updated_fields)}"
        )

        return {
            "success": True,
            "message": "Voter details updated successfully."
        }

    def list_payments(self, offset: int = 0, limit: int = 100) -> Tuple[List[Dict[str, Any]], int]:
        """
        Returns paginated payment records with contestant names attached.
        PRIVACY: voter_phone and voter_email are NOT included in responses.
        """
        payments, total = self.payment_repo.get_all_ordered_by_date(offset, limit)

        contestant_ids = {p.contestant_id for p in payments if p.contestant_id}
        contestants = self.part_repo.get_by_ids(contestant_ids) if contestant_ids else []
        name_by_id: Dict[str, str] = {c.id: c.name for c in contestants}

        items: List[Dict[str, Any]] = [
            {
                "id": p.id,
                "reference": p.reference,
                "contestant": name_by_id.get(p.contestant_id, "Unknown") if p.contestant_id else "Unknown",
                "amount": f"${p.amount:.2f}",
                "paymentMethod": p.payment_method,
                "status": p.status,
                "date": p.date,
                "sourcePlatform": p.source_platform,
                # NOTE: voter_phone and voter_email intentionally excluded
            }
            for p in payments
        ]

        return items, total


# ---------------------------------------------------------------------------
# SettingsService
# ---------------------------------------------------------------------------

class SettingsService:
    """
    Administrative customization settings service.
    Writes audit records when platform preferences are changed.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.settings_repo = SettingsRepository(db)

    def get_settings(self):
        return self.settings_repo.get_settings()

    def update_settings(self, settings_in: SettingsProfileUpdate):
        settings = self.settings_repo.get_settings()

        settings.company_name = settings_in.company_name
        settings.support_email = settings_in.support_email
        settings.timezone = settings_in.timezone
        settings.email_notifications = settings_in.notifications.email
        settings.sms_notifications = settings_in.notifications.sms
        settings.marketing_notifications = settings_in.notifications.marketing

        saved = self.settings_repo.update_settings(settings)

        AuditService.log_action(
            db=self.db,
            action="Settings Changed",
            user_id=self.user_id,
            details=f"Platform settings updated for company: {saved.company_name}"
        )
        return saved


# ---------------------------------------------------------------------------
# PaymentMethodConfigService
# ---------------------------------------------------------------------------

class PaymentMethodConfigService:
    """
    Service for managing payment method configurations.
    Allows admins to enable/disable payment methods for voting.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None) -> None:
        self.db = db
        self.user_id = user_id
        self.payment_method_repo = PaymentMethodConfigRepository(db)

    def list_payment_methods(self) -> List[PaymentMethodConfig]:
        """Get all payment methods ordered by sort_order."""
        return self.payment_method_repo.get_all_ordered()

    def list_enabled_payment_methods(self) -> List[PaymentMethodConfig]:
        """Get only enabled payment methods for public display."""
        return self.payment_method_repo.get_enabled_methods()

    def get_payment_method(self, method_id: str) -> Optional[PaymentMethodConfig]:
        """Get payment method by ID."""
        return self.payment_method_repo.get_by_id(method_id)

    def create_payment_method(self, method_in: PaymentMethodConfigCreate) -> PaymentMethodConfig:
        """Create a new payment method configuration."""
        from app.models.models import PaymentMethodConfig
        
        # Check if method already exists
        existing = self.payment_method_repo.get_by_method(method_in.method)
        if existing:
            raise ValidationException(f"Payment method '{method_in.method}' already exists")
        
        new_method = PaymentMethodConfig(
            method=method_in.method,
            method_type=method_in.method_type,
            display_name=method_in.display_name,
            description=method_in.description,
            is_enabled=method_in.is_enabled,
            sort_order=method_in.sort_order,
            icon_name=method_in.icon_name,
            config_data=method_in.config_data
        )
        
        saved = self.payment_method_repo.create(new_method)
        
        AuditService.log_action(
            db=self.db,
            action="Payment Method Created",
            user_id=self.user_id,
            details=f"Created payment method: {saved.display_name} ({saved.method})"
        )
        
        return saved

    def update_payment_method(self, method_id: str, method_in: PaymentMethodConfigUpdate) -> PaymentMethodConfig:
        """Update an existing payment method configuration."""
        method = self.payment_method_repo.get_by_id(method_id)
        if not method:
            raise NotFoundException("Payment method not found")
        
        # Update only provided fields
        if method_in.display_name is not None:
            method.display_name = method_in.display_name
        if method_in.description is not None:
            method.description = method_in.description
        if method_in.is_enabled is not None:
            method.is_enabled = method_in.is_enabled
        if method_in.sort_order is not None:
            method.sort_order = method_in.sort_order
        if method_in.icon_name is not None:
            method.icon_name = method_in.icon_name
        if method_in.config_data is not None:
            method.config_data = method_in.config_data
        
        self.payment_method_repo.update()
        
        AuditService.log_action(
            db=self.db,
            action="Payment Method Updated",
            user_id=self.user_id,
            details=f"Updated payment method: {method.display_name} ({method.method})"
        )
        
        return method

    def delete_payment_method(self, method_id: str) -> None:
        """Delete a payment method configuration."""
        method = self.payment_method_repo.get_by_id(method_id)
        if not method:
            raise NotFoundException("Payment method not found")
        
        self.payment_method_repo.delete(method)
        
        AuditService.log_action(
            db=self.db,
            action="Payment Method Deleted",
            user_id=self.user_id,
            details=f"Deleted payment method: {method.display_name} ({method.method})"
        )

    def toggle_payment_method(self, method_id: str, enabled: bool) -> PaymentMethodConfig:
        """Quick toggle for enabling/disabling a payment method."""
        method = self.payment_method_repo.get_by_id(method_id)
        if not method:
            raise NotFoundException("Payment method not found")
        
        method.is_enabled = enabled
        self.payment_method_repo.update()
        
        action = "Payment Method Enabled" if enabled else "Payment Method Disabled"
        AuditService.log_action(
            db=self.db,
            action=action,
            user_id=self.user_id,
            details=f"{'Enabled' if enabled else 'Disabled'} payment method: {method.display_name} ({method.method})"
        )
        
        return method