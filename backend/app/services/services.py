import logging
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, update as sa_update, func
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models.models import (
    User, Event, Participant, Payment, AuditLog, VoteTransaction,
    PaymentMethodConfig
)
from app.enums.enums import (
    UserRole, EventStatus, ContestantStatus, PaymentStatus
)
from app.repositories.repositories import (
    UserRepository, EventRepository, ParticipantRepository,
    PaymentRepository, ActivityRepository,
    SettingsRepository, VoteTransactionRepository,
    PaymentMethodConfigRepository
)
from app.utils.email import PreparedEmail
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.exceptions.exceptions import ValidationException, NotFoundException, PaymentException
from app.schemas.schemas import (
    PaymentInitiationResponse, SimpleMessageResponse, UserRegister, UserLogin, AuthResult, UserResponse,
    EventCreate, EventUpdate, ParticipantCreate, PaymentCreate, SettingsProfileUpdate,
    ResetPasswordRequest, AdminInvitationRequest, AdminInvitationResponse,
    InvalidateAdminRequest,
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
from app.core.cache import get_cache_service

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

    def request_password_reset(self, email: str) -> PreparedEmail | None:
        """
        Request password reset and return email data for background sending.
        Returns PreparedEmail if user exists, None otherwise.
        """
        user = self.user_repo.get_by_email(email)
        if user:
            reset_token = str(uuid.uuid4())
            reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)

            user.reset_token = reset_token
            user.reset_token_expires = reset_token_expires
            self.user_repo.update()

            AuditService.log_action(
                db=self.db,
                action="Password Reset Requested",
                user_id=user.id,
                details=f"Reset link requested for {email}"
            )

            # Prepare email data for background sending
            email_data = email_service.prepare_password_reset_email(
                to_email=user.email,
                reset_token=reset_token,
                user_name=user.name
            )

            logger.info(f"Password reset requested for: {email}, email prepared for background sending")
            return email_data

        logger.info(f"Password reset requested for non-existent email: {email}")
        return None

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

    def create_admin_invitation(self, invitation_request: AdminInvitationRequest, inviter_user: User) -> tuple[AdminInvitationResponse, PreparedEmail]:
        """
        Create admin invitation and return response with email data for background sending.
        Returns tuple of (response, PreparedEmail).
        """
        if inviter_user.role != UserRole.SUPER_ADMIN:
            raise AuthenticationException("Only super admins can create admin invitations")

        existing_user = self.user_repo.get_by_email(invitation_request.email)
        if existing_user:
            raise ValidationException("User with this email already exists")

        invitation_token = str(uuid.uuid4())
        invitation_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

        new_user = User(
            name="pending",
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

        AuditService.log_action(
            db=self.db,
            action="Admin Invitation Created",
            user_id=inviter_user.id,
            details=f"Invitation sent to {invitation_request.email} with role {invitation_request.role.value}"
        )

        # Prepare email data for background sending
        email_data = email_service.prepare_admin_invitation_email(
            to_email=invitation_request.email,
            invitation_link=invitation_link,
            inviter_name=inviter_user.name,
        )

        logger.info(f"Admin invitation created for: {invitation_request.email}, email prepared for background sending")

        response = AdminInvitationResponse(
            email=invitation_request.email,
            role=invitation_request.role,
            invitation_link=invitation_link,
            expires_at=invitation_token_expires
        )

        return response, email_data

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
        try:
            active_event = self.event_repo.get_active_event()
            active_event_data = (
                {
                    "id": active_event.id,
                    "name": active_event.name,
                    "status": (
                        active_event.status.value
                        if hasattr(active_event.status, "value")
                        else str(active_event.status)
                    ),
                }
                if active_event
                else None
            )

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
            for payment in recent_payment_rows:
                participant_name = contestants_map.get(payment.contestant_id, "Unknown") if payment.contestant_id else "Unknown"

                recent_payments.append({
                    "id": payment.id,
                    "reference": payment.reference,
                    "amount": float(payment.amount),
                    "status": (
                        payment.status.value
                        if hasattr(payment.status, "value")
                        else payment.status
                    ),
                    "paymentMethod": payment.payment_method,
                    "createdAt": payment.created_at.isoformat(),
                })

            recent_activities = self.activity_repo.get_recent(5)
            recent_activity = [
                {
                "id": activity.id,
                "title": activity.title,
                "detail": activity.detail,
                "time": activity.time.isoformat(),
                }
                for activity in recent_activities
            ]
            return {
                "activeEvent": active_event_data,
                "totalParticipants": total_participants,
                "totalVotes": total_votes,
                "totalRevenue": float(total_revenue_num),
                "recentPayments": recent_payments,
                "recentActivity": recent_activity,
                "range": "30d",
                "dateFrom": None,

                "revenueTrend": [],
                "votesByCategory": [],
                "topPaymentMethods": [],
                "voteTrend": [],
                "topPerformers": [],
                "enhancedRecentActivity": [],
            }
        except Exception as e:
            logger.error(f"Error fetching dashboard summary: {e}")
            # Return empty data instead of crashing
            return {
                "activeEvent": None,
                "totalParticipants": 0,
                "totalVotes": 0,
                "totalRevenue": 0.0,
                "recentPayments": [],
                "recentActivity": [],

                "range": "30d",
                "dateFrom": None,

                "revenueTrend": [],
                "votesByCategory": [],
                "topPaymentMethods": [],
                "voteTrend": [],
                "topPerformers": [],
                "enhancedRecentActivity": [],
            }

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
        # Validate event timeline
        from app.utils.event_utils import validate_event_timeline
        validation_errors = validate_event_timeline(
            event_in.start_date,
            event_in.end_date,
            event_in.registration_opens,
            event_in.registration_closes,
            event_in.voting_opens,
            event_in.voting_closes,
        )
        if validation_errors:
            raise ValidationException("Invalid event timeline: " + "; ".join(validation_errors))
        
        new_event = Event(
            name=event_in.name,
            description=event_in.description,
            banner=event_in.banner,
            start_date=event_in.start_date,
            end_date=event_in.end_date,
            status=event_in.status,
            vote_price=Decimal(str(event_in.vote_price)) if event_in.vote_price else None,
            minimum_payment=Decimal(str(event_in.minimum_payment)) if event_in.minimum_payment else None,
            votes_per_payment=event_in.votes_per_payment,
            currency=event_in.currency,
            registration_opens=event_in.registration_opens,
            registration_closes=event_in.registration_closes,
            voting_opens=event_in.voting_opens,
            voting_closes=event_in.voting_closes,
            public_leaderboard=event_in.public_leaderboard,
            require_contestant_approval=event_in.require_contestant_approval,
            enable_videos=event_in.enable_videos,
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

    def update_event(self, event_id: str, event_in: EventUpdate) -> Event:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")

        # Validate event timeline if dates are being updated
        from app.utils.event_utils import validate_event_timeline
        date_fields = ['start_date', 'end_date', 'registration_opens', 'registration_closes', 'voting_opens', 'voting_closes']
        if any(field in event_in.model_dump(exclude_unset=True) for field in date_fields):
            validation_errors = validate_event_timeline(
                event_in.start_date or event.start_date,
                event_in.end_date or event.end_date,
                event_in.registration_opens or event.registration_opens,
                event_in.registration_closes or event.registration_closes,
                event_in.voting_opens or event.voting_opens,
                event_in.voting_closes or event.voting_closes,
            )
            if validation_errors:
                raise ValidationException("Invalid event timeline: " + "; ".join(validation_errors))

        # L9 FIX: Only update fields that were actually provided (partial update)
        update_data = event_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == 'vote_price' and value is not None:
                setattr(event, field, Decimal(str(value)))
            elif field == 'minimum_payment' and value is not None:
                setattr(event, field, Decimal(str(value)))
            else:
                setattr(event, field, value)

        self.event_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Event Updated",
            user_id=self.user_id,
            details=f"Updated event: {event.name} ({event.id})"
        )
        
        # Invalidate cache after event update
        try:
            cache_service = get_cache_service()
            cache_service.invalidate_events()
        except Exception as e:
            logger.error(f"Failed to invalidate events cache: {e}")
        
        return event

    def publish_event(self, event_id: str) -> Event:
        """Publish an event, making it visible to the public."""
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")
        
        if event.status != EventStatus.DRAFT:
            raise ValidationException("Only Draft events can be published")
        
        # Validate timeline before publishing
        from app.utils.event_utils import validate_event_timeline
        validation_errors = validate_event_timeline(
            event.start_date,
            event.end_date,
            event.registration_opens,
            event.registration_closes,
            event.voting_opens,
            event.voting_closes,
        )
        if validation_errors:
            raise ValidationException("Cannot publish event with invalid timeline: " + "; ".join(validation_errors))
        
        # Generate share link
        from app.core.config import settings
        share_link = f"{settings.FRONTEND_URL}/events/{event.id}"
        
        event.status = EventStatus.PUBLISHED
        event.share_link = share_link
        self.event_repo.update()
        
        AuditService.log_action(
            db=self.db,
            action="Event Published",
            user_id=self.user_id,
            details=f"Published event: {event.name} ({event.id}) - Share link: {share_link}"
        )
        
        # Invalidate cache
        try:
            cache_service = get_cache_service()
            cache_service.invalidate_events()
        except Exception as e:
            logger.error(f"Failed to invalidate events cache: {e}")
        
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
        self.event_repo = EventRepository(db)

    def list_participants(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        event_id: Optional[str] = None,
        offset: int = 0, limit: int = 100
    ) -> Tuple[List[Participant], int]:
        # If no event_id provided, get all participants
        if not event_id:
            return self.part_repo.get_all_participants(search, status, offset, limit)
        return self.part_repo.search_and_filter(search, status, event_id, offset, limit)

    async def list_public_participants_cached(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None,
        event_id: Optional[str] = None,
        offset: int = 0, limit: int = 100
    ) -> Tuple[List[Participant], int]:
        """
        Returns public participants with Redis caching.
        Cache key includes search parameters for proper invalidation.
        """
        from app.core.cache import get_cache_service, get_cache_key, CACHE_TTL, CACHE_PREFIXES

        # Skip caching for searches or custom parameters (too many combinations)
        if search or status or offset != 0 or limit != 100:
            return self.list_participants(search, status, event_id, offset, limit)
        
        try:
            cache_service = get_cache_service()
            cache_key = get_cache_key(
                CACHE_PREFIXES['participants'],
                f"event:{event_id}" if event_id else "global"
            )
            
            # Try to get from cache (synchronous)
            cached_data = cache_service.get(cache_key)
            if cached_data is not None:
                logger.info(f"Cache hit for public participants: {cache_key}")
                # Return the cached data directly (endpoint will handle serialization)
                return cached_data['items'], cached_data['total']
            
            # Cache miss - fetch from database (only approved participants)
            items, total = self.list_participants(search, ContestantStatus.APPROVED, event_id, offset, limit)

            # Store in cache (synchronous)
            cache_service.set(cache_key, {'items': items, 'total': total}, CACHE_TTL['MEDIUM'])
            logger.info(f"Cache miss and set for public participants: {cache_key}")

            return items, total

        except Exception as e:
            logger.error(f"Cache error for public participants, falling back to DB: {e}")
            # Fallback to database query on cache failure (only approved participants)
            return self.list_participants(search, ContestantStatus.APPROVED, event_id, offset, limit)

    def get_participant(self, part_id: str) -> Optional[Participant]:
        part = self.part_repo.get_by_id(part_id)
        if not part:
            raise NotFoundException("Participant not found")
        
        # Populate event payment configuration if participant has an event
        if part.event_id:
            from app.utils.event_utils import get_computed_event_status
            from app.schemas.schemas import PaymentConfiguration
            event = self.event_repo.get_by_id(part.event_id)
            if event:
                # Create consolidated payment configuration object
                payment_config = PaymentConfiguration(
                    vote_price=float(event.vote_price) if event.vote_price else None,
                    minimum_payment=float(event.minimum_payment) if event.minimum_payment else None,
                    currency=event.currency or "USD",
                    voting_open=get_computed_event_status(
                        event.status,
                        event.start_date,
                        event.end_date,
                        event.registration_opens,
                        event.registration_closes,
                        event.voting_opens,
                        event.voting_closes,
                    ) == "voting_open"
                )
                setattr(part, 'payment_configuration', payment_config)
            else:
                setattr(part, 'payment_configuration', None)
        else:
            setattr(part, 'payment_configuration', None)
        
        return part

    def create_participant(self, part_in: ParticipantCreate) -> Participant:
        new_part = Participant(
            name=part_in.name,
            category=part_in.category,
            video_url=part_in.video_url,
            image_url=part_in.image_url,
            bio=part_in.bio,
            status=part_in.status,
            votes=part_in.votes,
            event_id=part_in.event_id,
        )
        saved = self.part_repo.create(new_part)

        AuditService.log_action(
            db=self.db,
            action="Contestant Created",
            user_id=self.user_id,
            details=f"Created contestant: {saved.name} ({saved.id}) for event: {saved.event_id}"
        )
        
        self._invalidate_participant_cache(saved.id, saved.event_id)
        
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
        
        self._invalidate_participant_cache(part_id, part.event_id)
        
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
        
        self._invalidate_participant_cache(part_id, part.event_id)

    def _invalidate_participant_cache(self, participant_id: str, event_id: Optional[str] = None):
        """Invalidate participant, participant list, and leaderboard caches."""
        from app.core.cache import get_cache_service

        try:
            cache_service = get_cache_service()
            cache_service.invalidate_participant(participant_id)
            cache_service.invalidate_participants()
            cache_service.invalidate_leaderboard()
            if event_id:
                cache_service.invalidate_participants(event_id)
                cache_service.invalidate_leaderboard(event_id)
        except Exception as e:
            logger.error(f"Failed to invalidate cache for participant {participant_id}: {e}")

    def get_leaderboard(self, event_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns the public leaderboard for an event.
        Does NOT expose voter phone numbers or emails.
        Only approved participants are shown.
        """
        if event_id:
            participants = self.part_repo.get_approved_by_event(event_id)
        else:
            all_participants = self.part_repo.get_all()
            participants = [p for p in all_participants if p.status == ContestantStatus.APPROVED]
            participants.sort(key=lambda p: p.votes, reverse=True)

        return [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "videoUrl": p.video_url,
                "votes": p.votes,
                "status": p.status.value,
            }
            for p in participants
        ]

    async def get_leaderboard_cached(self, event_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns the public leaderboard with Redis caching.
        Does NOT expose voter phone numbers or emails.
        """
        from app.core.cache import get_cache_service, get_cache_key, CACHE_TTL, CACHE_PREFIXES
        
        try:
            cache_service = get_cache_service()
            cache_key = get_cache_key(CACHE_PREFIXES['leaderboard'], f"event:{event_id}" if event_id else "global")
            
            # Try to get from cache (synchronous)
            cached_data = cache_service.get(cache_key)
            if cached_data is not None:
                logger.info(f"Cache hit for leaderboard: {cache_key}")
                return cached_data
            
            # Cache miss - fetch from database
            leaderboard_data = self.get_leaderboard(event_id)
            
            # Store in cache (synchronous)
            cache_service.set(cache_key, leaderboard_data, CACHE_TTL['MEDIUM'])
            logger.info(f"Cache miss and set for leaderboard: {cache_key}")
            
            return leaderboard_data
            
        except Exception as e:
            logger.error(f"Cache error for leaderboard, falling back to DB: {e}")
            # Fallback to database query on cache failure
            return self.get_leaderboard(event_id)

    def get_public_leaderboard(self, event_id: str):
        return self.part_repo.get_public_leaderboard(event_id)


# ---------------------------------------------------------------------------
# PaymentService
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# PaymentService
# ---------------------------------------------------------------------------

class PaymentService:
    """
    Handles the full payment lifecycle:
    1. Pre-payment voter duplicate check (by phone + event)
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
        self.part_repo = ParticipantRepository(db)
        self.vote_repo = VoteTransactionRepository(db)
        self.event_repo = EventRepository(db)
        self.paynow_client = PaynowClient()
        self.fraud_service = FraudDetectionService(db)
        self.idempotency_service = IdempotencyService(db)
        self.test_mode = settings.TEST_PAYMENT_MODE  # Use sandbox when true, production when false

    def check_voter_duplicate(
        self, phone: str, event_id: Optional[str] = None
    ) -> VoterCheckResponse:
        """
        PRE-PAYMENT CHECK: Detects if a phone number has already successfully
        voted in the current (or specified) event.
        Returns a warning if duplicate detected.
        """
        # Resolve event
        evt_id = event_id
        if not evt_id:
            # Try to get an active event
            active_event = self.event_repo.get_active_event()
            if active_event:
                evt_id = active_event.id

        if not evt_id:
            # No event scope, allow without warning
            return VoterCheckResponse(
                has_voted=False,
                message="No active event found. Proceeding without duplicate check."
            )

        # Check for successful payments by this phone in this event
        existing = self.payment_repo.get_by_voter_phone_and_event(phone, evt_id)

        if existing:
            return VoterCheckResponse(
                has_voted=True,
                message="Duplicate voter detected.",
                warning="You have already voted in this event. Continue only if you are paying for someone else."
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

    def initiate_payment(self, payment_in: PaymentCreate, idempotency_key: Optional[str] = None) -> PaymentInitiationResponse:
        """
        INITIATE PAYMENT (Enhanced):
        1. Validates contestant exists
        2. Validates event status and payment eligibility
        3. Checks voter duplication (phone + event)
        4. If duplicate, requires acknowledge_duplicate=True
        5. Rate limits by phone
        6. Checks idempotency to prevent duplicate payments
        7. In TEST MODE: Creates test payment without calling Paynow
        8. In PRODUCTION: Uses official Paynow SDK to create payment
        9. Saves poll_url to DB (MANDATORY per Paynow docs)
        10. Returns redirect URL (web) or instructions (mobile)
        """
        # 1. Validate contestant
        part = self.part_repo.get_by_id(payment_in.contestant_id)
        if not part:
            raise NotFoundException("Contestant not found")

        # 1b. Validate event-aware payment eligibility
        if part.event_id:
            from app.repositories.repositories import EventRepository
            event_repo = EventRepository(self.db)
            event = event_repo.get_by_id(part.event_id)
            if event:
                from app.utils.payment_utils import validate_payment_eligibility
                validate_payment_eligibility(
                    event.status,
                    event.start_date,
                    event.end_date,
                    event.registration_opens,
                    event.registration_closes,
                    event.voting_opens,
                    event.voting_closes,
                    part.status,
                )

        # 1d. Validate payment method is enabled
        from app.repositories.repositories import PaymentMethodConfigRepository
        payment_method_repo = PaymentMethodConfigRepository(self.db)
        payment_method_config = payment_method_repo.get_by_method(payment_in.payment_method.lower())
        if not payment_method_config or not payment_method_config.is_enabled:
            raise PaymentException(f"Payment method '{payment_in.payment_method}' is not available or has been disabled.")

        # 1e. Resolve vote price and minimum payment using centralized helpers
        from app.utils.payment_utils import resolve_vote_price, resolve_minimum_payment, calculate_votes_from_amount
        evt_id = payment_in.event_id
        event_vote_price = None
        event_minimum_payment = None
        
        # Get event configuration
        if hasattr(part, 'event_id') and part.event_id:
            event = self.event_repo.get_by_id(part.event_id)
            if event:
                event_vote_price = event.vote_price
                event_minimum_payment = event.minimum_payment
                evt_id = part.event_id
        
        vote_price = resolve_vote_price(event_vote_price)
        minimum_payment = resolve_minimum_payment(event_minimum_payment)
        
        # Validate amount using floor(amount / votePrice) calculation
        payment_amount = payment_in.amount  # Already Decimal from schema
        
        # Check global minimum (hard safety floor)
        if payment_amount < Decimal(str(settings.MIN_PAYMENT_AMOUNT)):
            raise PaymentException(
                f"Minimum payment amount is ${settings.MIN_PAYMENT_AMOUNT:.2f}. Please increase your contribution."
            )
        
        # Check event-specific minimum payment
        if payment_amount < minimum_payment:
            raise PaymentException(
                f"Minimum payment amount is ${minimum_payment:.2f}. Please increase your contribution."
            )
        
        # Check that amount purchases at least one vote
        estimated_votes = calculate_votes_from_amount(payment_amount, vote_price)
        if estimated_votes < 1:
            raise PaymentException(
                f"Your contribution of ${payment_amount:.2f} is insufficient to purchase any votes. "
                f"Minimum amount is ${vote_price:.2f} for one vote."
            )

        # 2. Duplicate voter check
        voter_check = self.check_voter_duplicate(
            payment_in.voter_phone,
            evt_id
        )

        if voter_check.has_voted and not payment_in.acknowledge_duplicate:
            # Return the warning but do NOT proceed with payment
            return PaymentInitiationResponse(
                warning=voter_check.warning,
                has_voted=True,
                reference=None,
                redirect_url=None,
                instructions=None,
            )
        # 4. Rate limiting
        self._rate_limit_check(payment_in.voter_phone)

        # 5. Idempotency dedupe: if client supplied a key and we already
        # have a payment with that key, return existing details instead
        if idempotency_key:
            existing = self.payment_repo.get_by_idempotency_key(idempotency_key)
            if existing:
                logger.info(f"Idempotency: returning existing payment for key {idempotency_key}")
                return PaymentInitiationResponse(
                    id=existing.id,
                    warning=None,
                    has_voted=False,
                    reference=existing.reference,
                    redirect_url=existing.paynow_redirect_url,
                    instructions=None,
                    poll_url=existing.poll_url,
                    amount=str(existing.amount),
                    payment_method=existing.payment_method,
                    status=(
                        existing.status.value
                        if hasattr(existing.status, "value")
                        else str(existing.status)
                    ),
                    contestant_id=existing.contestant_id,
                    voter_name=existing.voter_name,
                    voter_email=existing.voter_email,
                    date=existing.date,
                    created_at=existing.created_at,
                    idempotent=True,
                )
        # 6. Generate reference
        reference = f"VOTE-{uuid.uuid4().hex[:8].upper()}"

        # 7. Fraud detection before contacting Paynow
        # Calculate estimated votes and run fraud detection
        estimated_votes = calculate_votes_from_amount(payment_amount, vote_price)
        self.fraud_service.detect_suspicious_voting(part.id, estimated_votes)

        # 8. Initiate payment via Paynow (Sandbox or Production based on TEST_PAYMENT_MODE)
        # PaynowClient handles credential selection internally
        return self._initiate_payment(
            payment_in, part, reference, vote_price, evt_id, idempotency_key
        )

    def _initiate_payment(
        self, payment_in: PaymentCreate, part: Participant,
        reference: str, vote_price: Decimal, evt_id: Optional[str],
        idempotency_key: Optional[str]
    ) -> PaymentInitiationResponse:
        """
        Create a payment using Paynow SDK.
        
        Uses sandbox credentials when TEST_PAYMENT_MODE=true, production credentials otherwise.
        This ensures the test flow matches production exactly.
        """
        # Determine payment type (web vs mobile)
        is_mobile = payment_in.payment_method.lower() in ("ecocash", "onemoney")

        # Use the actual payment amount from the request
        payment_amount = Decimal(str(payment_in.amount))

        # Create local payment record with the actual amount
        pending_payment = Payment(
            reference=reference,
            contestant_id=part.id,
            amount=payment_amount,
            payment_method=payment_in.payment_method,
            status=PaymentStatus.CREATED,
            voter_phone=payment_in.voter_phone,
            voter_name=payment_in.voter_name,
            voter_email=payment_in.voter_email,
            event_id=evt_id,
            duplicate_vote_acknowledged=payment_in.acknowledge_duplicate,
        )
        # Persist optional idempotency key to detect client retries
        if idempotency_key:
            pending_payment.idempotency_key = idempotency_key
        # Don't commit yet — we'll commit after Paynow confirms creation

        # 13. Call Paynow SDK with the actual payment amount
        item_name = f"Vote for {part.name}"
        voter_email = payment_in.voter_email or "voter@example.com"

        try:
            if is_mobile:
                paynow_response = self.paynow_client.create_mobile_payment(
                    reference=reference,
                    email=voter_email,
                    item_name=item_name,
                    amount=payment_amount,
                    phone=payment_in.voter_phone,
                    method=payment_in.payment_method.lower(),
                )
            else:
                paynow_response = self.paynow_client.create_web_payment(
                    reference=reference,
                    email=voter_email,
                    item_name=item_name,
                    amount=payment_amount,
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
            error_msg = paynow_response.get("error", "Paynow payment initiation failed.")
            AuditService.log_action(
                db=self.db,
                action="Payment Initiation Failed",
                details=f"Paynow failed for ref {reference}: {error_msg}"
            )
            raise PaymentException(f"Payment could not be initiated: {error_msg}")

        # 13. Save poll_url and redirect URL to payment record
        pending_payment.poll_url = paynow_response.get("poll_url")
        pending_payment.paynow_redirect_url = paynow_response.get("redirect_url")
        pending_payment.status = PaymentStatus.PENDING

        self.payment_repo.create(pending_payment)

        # 14. Log payment initiation
        AuditService.log_action(
            db=self.db,
            action="Payment Created",
            details=f"Payment reference {reference} initiated for contestant: {part.name} ({part.id}) "
                    f"via {payment_in.payment_method}"
        )

        # Return response
        return PaymentInitiationResponse(
            id=pending_payment.id,
            reference=pending_payment.reference,
            redirect_url=paynow_response.get("redirect_url"),
            poll_url=paynow_response.get("poll_url"),
            amount=str(payment_amount),
            payment_method=payment_in.payment_method,
            status=pending_payment.status,
            contestant_id=part.id,
            voter_name=None,
            voter_email=payment_in.voter_email,
            created_at=pending_payment.created_at,
            test_mode=self.test_mode,  # Reflect actual mode (sandbox vs production)
        )

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
            # Paynow documentation: "Paid", "Awaiting Delivery", and "Delivered" are all successful payment statuses
            # Reference: https://developers.paynow.co.zw/docs/paynow/status_update/
            normalized_status = str(paynow_status).lower() if paynow_status else ""
            if normalized_status in ("paid", "successful", "awaiting delivery", "delivered"):
                # Calculate votes using centralized helper: floor(amount / votePrice)
                from app.utils.payment_utils import resolve_vote_price, calculate_votes_from_amount
                
                event_vote_price = None
                if payment.event_id:
                    event = self.event_repo.get_by_id(payment.event_id)
                    if event:
                        event_vote_price = event.vote_price
                
                vote_price = resolve_vote_price(event_vote_price)
                votes_to_add = calculate_votes_from_amount(payment.amount, vote_price)

                if not payment.contestant_id:
                    raise VotingException(
                        f"Payment {reference} has no associated contestant; cannot credit votes."
                    )

                # Fraud detection — uses calculated votes from actual amount
                self.fraud_service.detect_suspicious_voting(payment.contestant_id, votes_to_add)

                # Update payment status
                payment.status = PaymentStatus.PAID

                vote_txn = VoteTransaction(
                    payment_id=payment.id,
                    contestant_id=payment.contestant_id,
                    votes_awarded=votes_to_add,
                    event_id=payment.event_id,
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
                self._invalidate_vote_cache(payment.contestant_id, payment.event_id)
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

    def _invalidate_vote_cache(self, contestant_id: str, event_id: Optional[str] = None):
        """Invalidate participant and leaderboard caches after vote updates."""
        from app.core.cache import get_cache_service

        try:
            cache_service = get_cache_service()
            cache_service.invalidate_participant(contestant_id)
            cache_service.invalidate_participants()
            cache_service.invalidate_leaderboard()
            if event_id:
                cache_service.invalidate_participants(event_id)
                cache_service.invalidate_leaderboard(event_id)
        except Exception as e:
            logger.error(f"Failed to invalidate cache for contestant {contestant_id}: {e}")

    def check_payment_status(self, reference: str) -> PaymentStatusCheckResponse:
        """
        MANUAL STATUS CHECK:
        Allows the frontend to manually poll the payment status.
        Uses the saved poll_url to actively verify with Paynow.

        Uses select_for_update() to prevent concurrent requests from
        crediting the same vote twice (H5 race condition fix).
        """
        # Fix: Acquire lock on initial query to prevent race condition with callback
        payment = self.db.execute(
            select(Payment).where(Payment.reference == reference).with_for_update()
        ).scalar_one_or_none()
        
        if not payment:
            raise NotFoundException(f"Payment reference {reference} not found")

        # If already in a final state, return immediately
        if payment.status in (PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.REFUNDED, PaymentStatus.EXPIRED):
            # Fetch contestant details for successful payments
            contestant_name = None
            votes_awarded = None
            current_total_votes = None
            
            if payment.contestant_id and payment.status == PaymentStatus.PAID:
                contestant = self.part_repo.get_by_id(payment.contestant_id)
                if contestant:
                    contestant_name = contestant.name
                    current_total_votes = contestant.votes
                    # Get votes awarded from vote transaction
                    vote_txn = self.vote_repo.get_by_payment_id(payment.id)
                    if vote_txn:
                        votes_awarded = vote_txn.votes_awarded
            
            return PaymentStatusCheckResponse(
                reference=reference,
                status=payment.status,
                paid=(payment.status == PaymentStatus.PAID),
                contestant_id=payment.contestant_id,
                contestant_name=contestant_name,
                amount=str(payment.amount) if payment.amount else None,
                votes_awarded=votes_awarded,
                current_total_votes=current_total_votes
            )

        # Try to actively check via poll_url
        if payment.poll_url:
            try:
                poll_result = self.paynow_client.check_transaction_status(payment.poll_url)
                if poll_result.get("paid"):
                    # Directly apply the vote in this transaction (skip webhook signature)
                    try:
                        # Calculate votes using centralized helper: floor(amount / votePrice)
                        from app.utils.payment_utils import resolve_vote_price, calculate_votes_from_amount
                        
                        event_vote_price = None
                        if payment.event_id:
                            event = self.event_repo.get_by_id(payment.event_id)
                            if event:
                                event_vote_price = event.vote_price
                        
                        vote_price = resolve_vote_price(event_vote_price)
                        votes_to_add = calculate_votes_from_amount(payment.amount, vote_price)

                        payment.status = PaymentStatus.PAID

                        # Check idempotency — has a vote txn already been created?
                        existing_vote = self.vote_repo.get_by_payment_id(payment.id)
                        if not existing_vote:
                            vote_txn = VoteTransaction(
                                payment_id=payment.id,
                                contestant_id=payment.contestant_id,
                                votes_awarded=votes_to_add,
                                event_id=payment.event_id,
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
                        
                        # Fetch contestant details for response
                        contestant_name = None
                        current_total_votes = None
                        if payment.contestant_id:
                            contestant = self.part_repo.get_by_id(payment.contestant_id)
                            if contestant:
                                contestant_name = contestant.name
                                current_total_votes = contestant.votes
                    except Exception:
                        self.db.rollback()
                        raise

                    return PaymentStatusCheckResponse(
                        reference=reference,
                        status=PaymentStatus.PAID,
                        paid=True,
                        contestant_id=payment.contestant_id,
                        contestant_name=contestant_name,
                        amount=str(payment.amount) if payment.amount else None,
                        votes_awarded=votes_to_add,
                        current_total_votes=current_total_votes
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

    def update_voter_details(self, details_in: VoterDetailsUpdate) -> SimpleMessageResponse:
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
           return SimpleMessageResponse(
                success=True,
                message="No details to update."
            ) 

        self.payment_repo.update()

        AuditService.log_action(
            db=self.db,
            action="Voter Details Updated",
            details=f"Updated voter details for payment {payment.reference}: {', '.join(updated_fields)}"
        )

        return SimpleMessageResponse(
            success=True,
            message="Voter details updated successfully."
        )

    def list_payments(self, offset: int = 0, limit: int = 100) -> Tuple[List[Dict[str, Any]], int]:
        """
        Returns paginated payment records with raw fields for admin table rendering.
        """
        payments, total = self.payment_repo.get_all_ordered_by_date(offset, limit)

        contestant_ids = {p.contestant_id for p in payments if p.contestant_id}
        contestants = self.part_repo.get_by_ids(contestant_ids) if contestant_ids else []
        name_by_id: Dict[str, str] = {c.id: c.name for c in contestants}

        items: List[Dict[str, Any]] = [
            {
                "id": p.id,
                "reference": p.reference,
                "contestantId": p.contestant_id,
                "contestantName": name_by_id.get(p.contestant_id, "Unknown") if p.contestant_id else "Unknown",
                "amount": float(p.amount),
                "paymentMethod": p.payment_method,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                "voterName": p.voter_name,
                "voterEmail": p.voter_email,
                "date": p.date.isoformat() if p.date else None,
                "createdAt": p.created_at.isoformat() if p.created_at else None,
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
    Writes audit records when settings preferences are changed.
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
