import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum, Text, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.enums.enums import (
    UserRole, EventStatus, ContestantStatus, PaymentStatus
)


def utcnow() -> datetime:
    """Timezone-aware UTC now, used as a default factory for DateTime(timezone=True) columns."""
    from datetime import timezone
    return datetime.now(timezone.utc)


class User(Base):
    """
    User model representing Administrator accounts.
    Supports soft deletion and RBAC roles.
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), default=UserRole.ADMIN, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Soft delete field

    # Password reset fields
    reset_token: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    reset_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Invitation fields
    invitation_token: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True, index=True)
    invitation_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    invited_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # ID of user who sent invitation

    # H2 FIX: Account lockout fields for brute-force protection
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Refresh token fields for JWT lifecycle management
    refresh_token: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True, index=True)
    refresh_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")


class Event(Base):
    """
    Event model representing active/upcoming digital entertainment competitions.
    Each event owns its custom configuration rules and lifecycle state.
    """
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)  # Index for search
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    banner: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)  # Index for date queries
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)  # Index for date queries
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, values_callable=lambda x: [e.value for e in x]), default=EventStatus.DRAFT, nullable=False, index=True)  # Index for status filtering
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)  # Index for date queries
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Soft delete field

    # C5 FIX: Numeric for monetary values
    vote_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=Decimal("1.00"))
    minimum_payment: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=Decimal("1.00"))  # Independent minimum payment
    votes_per_payment: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    currency: Mapped[Optional[str]] = mapped_column(String, default="USD")
    registration_opens: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_closes: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_opens: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_closes: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    public_leaderboard: Mapped[bool] = mapped_column(Boolean, default=True)
    require_contestant_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_videos: Mapped[bool] = mapped_column(Boolean, default=False)  # Enable participant videos for this event
    share_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Internal shareable link
    event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Unique event ID for public links

    # Relationship to participants
    participants: Mapped[List["Participant"]] = relationship("Participant", back_populates="event")


class Participant(Base):
    """
    Contestant in a competition who receives votes.
    Supports soft deletion.
    """
    __tablename__ = "participants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)  # Index for search
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)  # Index for filtering
    video_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Optional promotional video
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Profile picture
    gallery_images: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # 1-5 image URLs, in display order
    banner_image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Separate banner image
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Biography
    status: Mapped[ContestantStatus] = mapped_column(Enum(ContestantStatus, values_callable=lambda x: [e.value for e in x]), default=ContestantStatus.APPROVED, nullable=False, index=True)  # Index for status filtering
    votes: Mapped[int] = mapped_column(Integer, default=0, index=True)  # Index for leaderboard sorting
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)  # Index for date queries
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Soft delete field
    
    # Foreign key to Event (required in practice, nullable in DB for migration safety)
    event_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("events.id"), nullable=True, index=True)
    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="participants")

    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="contestant")
    vote_transactions: Mapped[List["VoteTransaction"]] = relationship("VoteTransaction", back_populates="contestant")


class Payment(Base):
    """
    Payment record verifying payment phase (via Paynow).
    Enhanced with voter tracking, source platform, and poll_url.
    """
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reference: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    contestant_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("participants.id"), nullable=True)
    # C5 FIX: Numeric for monetary values — never use Float for money
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String, nullable=False)  # Ecocash, OneMoney, Paynow, etc.
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, values_callable=lambda x: [e.value for e in x]), default=PaymentStatus.CREATED, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)  # H7 FIX: index for date-ordered queries
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # --- NEW FIELDS ---
    # Paynow integration
    poll_url: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)  # MUST be saved for status verification
    paynow_redirect_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)   # URL to redirect user to Paynow

    # Voter identification
    voter_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)  # Phone number of the payer
    voter_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)                # Name of actual voter (if proxy)
    voter_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)               # Email of actual voter (if proxy)

    # Event scoping
    event_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("events.id"), nullable=True, index=True)

    # Warning acknowledgement (for duplicate voters)
    duplicate_vote_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Idempotency: optional client-supplied idempotency key to detect retries
    idempotency_key: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)

    contestant: Mapped[Optional["Participant"]] = relationship("Participant", back_populates="payments")
    vote_transaction: Mapped[Optional["VoteTransaction"]] = relationship(
        "VoteTransaction", uselist=False, back_populates="payment"
    )


class VoteTransaction(Base):
    """
    Separate audit record linking payments to contestants.
    Must never be deleted.
    """
    __tablename__ = "vote_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_id: Mapped[str] = mapped_column(String, ForeignKey("payments.id"), nullable=False, unique=True)
    contestant_id: Mapped[str] = mapped_column(String, ForeignKey("participants.id"), nullable=False)
    votes_awarded: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Event scoping
    event_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("events.id"), nullable=True, index=True)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="vote_transaction")
    contestant: Mapped["Participant"] = relationship("Participant", back_populates="vote_transactions")


class AuditLog(Base):
    """
    Immutable audit log storing security actions.
    Must never be deleted.
    """
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)  # Index for user queries
    action: Mapped[str] = mapped_column(String, nullable=False, index=True)  # Index for action filtering
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    details: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)  # Index for time-based queries

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


class PaymentMethodConfig(Base):
    """
    Payment method configuration managed by admins.
    Allows enabling/disabling specific payment methods for voting.
    """
    __tablename__ = "payment_method_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    method: Mapped[str] = mapped_column(String, nullable=False, unique=True)  # e.g., "visa", "ecocash"
    method_type: Mapped[str] = mapped_column(String, nullable=False)  # "web", "mobile", "offline"
    display_name: Mapped[str] = mapped_column(String, nullable=False)  # "Visa", "EcoCash"
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    icon_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # For UI display
    config_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Additional config
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Activity(Base):
    """
    Legacy general dashboard activity items (for frontend overview mapping).
    """
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Setting(Base):
    """
    Platform-wide global settings and preferences.
    """
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    company_name: Mapped[str] = mapped_column(String, default="Digital Voting Corp")
    support_email: Mapped[str] = mapped_column(String, default="support@votingcorp.com")
    timezone: Mapped[str] = mapped_column(String, default="UTC")
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_notifications: Mapped[bool] = mapped_column(Boolean, default=False)
    marketing_notifications: Mapped[bool] = mapped_column(Boolean, default=False)


class TestPayment(Base):
    """
    Development-only test payment table for testing payment flows without real money.
    This table should be dropped before production deployment.
    """
    __tablename__ = "test_payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reference: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    contestant_id: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="created", nullable=False)
    
    # Voter identification (mirrors Payment model)
    voter_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voter_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Name of actual voter (if proxy)
    voter_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    test_redirect_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_test_payment: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    
    # Test-specific fields
    test_response_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    auto_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Auto-complete test payments
    test_completion_delay: Mapped[int] = mapped_column(Integer, default=5, nullable=False)  # Seconds before auto-completion