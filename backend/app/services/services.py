import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.models import User, Event, Participant, Payment, Activity, SocialPlatform, Setting, VoteTransaction
from app.enums.enums import UserRole, EventStatus, ContestantStatus, PaymentStatus, SocialPlatform as PlatformEnum
from app.repositories.repositories import (
    UserRepository, EventRepository, ParticipantRepository, 
    PaymentRepository, ActivityRepository, SocialPlatformRepository, SettingsRepository, VoteTransactionRepository
)
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.schemas import (
    UserRegister, UserLogin, AuthResult, UserResponse,
    EventCreate, EventUpdate, ParticipantCreate, PaymentCreate, SettingsProfileUpdate
)
from app.audit.audit import AuditService
from app.services.fraud import FraudDetectionService
from app.services.idempotency import IdempotencyService
from app.integrations.paynow.paynow import PaynowClient
from app.exceptions.exceptions import VotingException, NotFoundException, AuthenticationException

logger = logging.getLogger(__name__)

class AuthService:
    """
    Handles user authentication, admin registrations, password resets, and JWT signing.
    Creates audit log records for login and authentication events.
    """
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def register_admin(self, user_in: UserRegister) -> AuthResult:
        existing = self.user_repo.get_by_email(user_in.email)
        if existing:
            raise ValueError("Email already registered.")

        hashed = hash_password(user_in.password)
        new_user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=hashed,
            role=UserRole.ADMIN
        )
        self.user_repo.create(new_user)
        
        # Security audit log
        AuditService.log_action(
            db=self.db,
            action="Admin Registered",
            user_id=new_user.id,
            details=f"Admin account created: {new_user.email}"
        )

        token = create_access_token(new_user.id)
        return AuthResult(
            token=token,
            user=UserResponse(
                id=new_user.id,
                name=new_user.name,
                email=new_user.email,
                role=new_user.role
            ),
            message="Registration successful"
        )

    def login_admin(self, login_in: UserLogin, ip_address: Optional[str] = None) -> AuthResult:
        user = self.user_repo.get_by_email(login_in.email)
        if not user or not verify_password(login_in.password, user.hashed_password):
            logger.warning(f"Failed login attempt for email: {login_in.email}")
            AuditService.log_action(
                db=self.db,
                action="Failed Login",
                ip_address=ip_address,
                details=f"Email attempted: {login_in.email}"
            )
            raise AuthenticationException("Invalid email or password.")

        if not user.is_active:
            raise AuthenticationException("User account is deactivated.")

        logger.info(f"Admin logged in: {user.email}")
        
        AuditService.log_action(
            db=self.db,
            action="Login",
            user_id=user.id,
            ip_address=ip_address,
            details=f"Logged in successfully: {user.email}"
        )
        
        token = create_access_token(user.id)
        return AuthResult(
            token=token,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role
            ),
            message="Login successful"
        )

    def logout_admin(self, user_id: str, ip_address: Optional[str] = None) -> None:
        """
        Logs out user and writes immutable audit log entry.
        """
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
            logger.info(f"Password reset requested for: {email}")
            AuditService.log_action(
                db=self.db,
                action="Password Reset Requested",
                user_id=user.id,
                details=f"Reset link requested for {email}"
            )

class DashboardService:
    """
    Computes aggregated admin metrics: active events, vote counts, total revenue, 
    and returns audit log data.
    """
    def __init__(self, db: Session):
        self.event_repo = EventRepository(db)
        self.participant_repo = ParticipantRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.activity_repo = ActivityRepository(db)

    def get_summary(self):
        active_event = self.event_repo.get_active_event()
        active_event_name = active_event.name if active_event else "No Active Event"

        participants = self.participant_repo.get_all()
        total_votes = sum(p.votes for p in participants)

        payments = self.payment_repo.get_all()
        successful_payments = [p for p in payments if p.status == PaymentStatus.PAID]
        total_revenue_num = sum(p.amount for p in successful_payments)

        recent_payments = []
        for p in payments[:5]:
            participant_name = "Unknown"
            if p.contestant_id:
                part = self.participant_repo.get_by_id(p.contestant_id)
                if part:
                    participant_name = part.name
            
            recent_payments.append({
                "id": p.id,
                "reference": p.reference,
                "contestant": participant_name,
                "amount": f"${p.amount:.2f}",
                "paymentMethod": p.payment_method,
                "status": p.status,
                "date": p.date
            })

        recent_activities = self.activity_repo.get_recent(5)

        return {
            "activeEvent": active_event_name,
            "totalParticipants": len(participants),
            "totalVotes": total_votes,
            "totalRevenue": f"${total_revenue_num:.2f}",
            "recentPayments": recent_payments,
            "recentActivity": recent_activities
        }

class EventService:
    """
    CRUD management for entertainment competition events.
    Records audit actions on modifications.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None):
        self.db = db
        self.user_id = user_id
        self.event_repo = EventRepository(db)

    def list_events(self) -> List[Event]:
        return self.event_repo.get_all()

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
            require_contestant_approval=event_in.require_contestant_approval
        )
        saved = self.event_repo.create(new_event)
        
        AuditService.log_action(
            db=self.db,
            action="Event Created",
            user_id=self.user_id,
            details=f"Created event: {saved.name} ({saved.id})"
        )
        return saved

    def update_event(self, event_id: str, event_in: EventUpdate) -> Event:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")
        
        event.name = event_in.name
        event.description = event_in.description
        event.banner = event_in.banner
        event.start_date = event_in.start_date
        event.end_date = event_in.end_date
        event.status = event_in.status
        event.vote_price = event_in.vote_price
        event.votes_per_payment = event_in.votes_per_payment
        event.currency = event_in.currency
        event.registration_opens = event_in.registration_opens
        event.registration_closes = event_in.registration_closes
        event.voting_opens = event_in.voting_opens
        event.voting_closes = event_in.voting_closes
        event.public_leaderboard = event_in.public_leaderboard
        event.allowed_platforms = event_in.allowed_platforms
        event.allowed_categories = event_in.allowed_categories
        event.require_contestant_approval = event_in.require_contestant_approval
        
        self.event_repo.update()
        
        AuditService.log_action(
            db=self.db,
            action="Event Updated",
            user_id=self.user_id,
            details=f"Updated event: {event.name} ({event.id})"
        )
        return event

    def delete_event(self, event_id: str) -> None:
        event = self.event_repo.get_by_id(event_id)
        if not event:
            raise NotFoundException("Event not found")
        
        # Performs repository soft delete
        self.event_repo.delete(event)
        
        AuditService.log_action(
            db=self.db,
            action="Event Deleted",
            user_id=self.user_id,
            details=f"Soft deleted event: {event.name} ({event.id})"
        )

class ParticipantService:
    """
    CRUD and approval actions for contestants.
    Soft-delete and Audit Logging aware.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None):
        self.db = db
        self.user_id = user_id
        self.part_repo = ParticipantRepository(db)

    def list_participants(
        self, search: Optional[str] = None, status: Optional[ContestantStatus] = None, platform: Optional[PlatformEnum] = None
    ) -> List[Participant]:
        return self.part_repo.search_and_filter(search, status, platform)

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
            votes=part_in.votes
        )
        saved = self.part_repo.create(new_part)
        
        AuditService.log_action(
            db=self.db,
            action="Contestant Created",
            user_id=self.user_id,
            details=f"Created contestant: {saved.name} ({saved.id})"
        )
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

class PaymentService:
    """
    Handles payment checkout generation and secure Paynow callbacks.
    Ensures payment processing operations are idempotent and wrapped in DB transactions.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None):
        self.db = db
        self.user_id = user_id
        self.payment_repo = PaymentRepository(db)
        self.part_repo = ParticipantRepository(db)
        self.vote_repo = VoteTransactionRepository(db)
        self.paynow_client = PaynowClient()
        self.fraud_service = FraudDetectionService(db)
        self.idempotency_service = IdempotencyService(db)

    def list_payments(self) -> list:
        """
        Returns all payment records with contestant names attached,
        avoiding a per-row lookup by batch-fetching contestants in one query.
        """
        payments = self.payment_repo.get_all_ordered_by_date()

        contestant_ids = {p.contestant_id for p in payments if p.contestant_id}
        contestants = self.part_repo.get_by_ids(contestant_ids) if contestant_ids else []
        name_by_id = {c.id: c.name for c in contestants}

        return [
            {
                "id": p.id,
                "reference": p.reference,
                "contestant": name_by_id.get(p.contestant_id, "Unknown"),
                "amount": f"${p.amount:.2f}",
                "paymentMethod": p.payment_method,
                "status": p.status,
                "date": p.date,
            }
            for p in payments
        ]

    def initiate_payment(self, payment_in: PaymentCreate) -> dict:
        """
        Creates a pending local transaction record and simulates a Paynow checkout link redirect.
        """
        part = self.part_repo.get_by_id(payment_in.contestant_id)
        if not part:
            raise NotFoundException("Contestant not found")

        reference = f"VOTE-{uuid.uuid4().hex[:8].upper()}"
        
        pending_payment = Payment(
            reference=reference,
            contestant_id=part.id,
            amount=payment_in.amount,
            payment_method=payment_in.payment_method,
            status=PaymentStatus.PENDING
        )
        self.payment_repo.create(pending_payment)
        
        AuditService.log_action(
            db=self.db,
            action="Payment Created",
            details=f"Payment reference {reference} initiated for contestant: {part.name} ({part.id})"
        )

        checkout_url = f"https://www.paynow.co.zw/Payment/Confirm/{reference}"
        return {
            "reference": reference,
            "redirectUrl": checkout_url
        }

    def process_paynow_callback(self, callback_data: dict) -> None:
        """
        CRITICAL PAYMENT VERIFICATION FLOW (Idempotency and Transaction Safe):
        1. Verify Webhook Signature
        2. Verify Payment Status
        3. Check Idempotency
        4. Create/Update Payment Status
        5. Create Separate Vote Transaction
        6. Increment Contestant Votes
        7. Log Security Audit Log
        8. Commit atomically. Rollback on failure.
        """
        reference = callback_data.get("reference")
        paynow_status = callback_data.get("status")

        # 1. Verify webhook signature
        if not self.paynow_client.verify_callback(callback_data):
            logger.error(f"Security Alert | Paynow signature verification failed for ref: {reference}")
            AuditService.log_action(
                db=self.db,
                action="Payment Webhook Verification Failed",
                details=f"Webhook signature check failed for reference {reference}"
            )
            raise VotingException("Signature check failed")

        # 2. Check Idempotency (prevent double voting/callbacks)
        if self.idempotency_service.is_callback_already_processed(reference):
            logger.info(f"Payment reference {reference} callback already processed. Skipping.")
            return

        payment = self.payment_repo.get_by_reference(reference)
        if not payment:
            logger.error(f"Callback received for non-existent payment reference: {reference}")
            raise NotFoundException(f"Payment reference {reference} not found")

        # Execute operations inside transaction block
        try:
            if paynow_status.lower() in ["paid", "successful"]:
                # 3. Fraud Detection
                self.fraud_service.detect_suspicious_voting(payment.contestant_id, int(payment.amount))
                
                # 4. Update payment
                payment.status = PaymentStatus.PAID
                
                # 5. Create vote transaction
                votes_to_add = int(payment.amount)
                vote_txn = VoteTransaction(
                    payment_id=payment.id,
                    contestant_id=payment.contestant_id,
                    votes_awarded=votes_to_add
                )
                self.vote_repo.create(vote_txn)
                
                # 6. Update contestant votes
                if payment.contestant_id:
                    contestant = self.part_repo.get_by_id(payment.contestant_id)
                    if contestant:
                        contestant.votes += votes_to_add
                
                # 7. Audit log creation
                AuditService.log_action(
                    db=self.db,
                    action="Payment Verified",
                    details=f"Credited {votes_to_add} votes to contestant {contestant.name if contestant else 'Unknown'} on ref {reference}"
                )
                
                # 8. Commit
                self.db.commit()
                logger.info(f"Transaction committed successfully. reference: {reference}.")
            else:
                payment.status = PaymentStatus.FAILED
                
                AuditService.log_action(
                    db=self.db,
                    action="Payment Failed",
                    details=f"Payment reference {reference} reported failed status: {paynow_status}"
                )
                self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Transaction rolled back during callback process: {str(e)}")
            raise

class SettingsService:
    """
    Administrative customization settings service.
    Writes audit records when platform preferences are changed.
    """
    def __init__(self, db: Session, user_id: Optional[str] = None):
        self.db = db
        self.user_id = user_id
        self.settings_repo = SettingsRepository(db)

    def get_settings(self) -> Setting:
        return self.settings_repo.get_settings()

    def update_settings(self, settings_in: SettingsProfileUpdate) -> Setting:
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
