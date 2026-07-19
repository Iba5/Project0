import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.enums.enums import (
    UserRole, EventStatus, ContestantStatus, PaymentStatus,
    SocialPlatform, SocialSyncStatus, CompetitionStatus
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
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.ADMIN, nullable=False)
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

    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")


class Competition(Base):
    """
    Competition entity that groups Events, Contestants, Votes and Transactions.
    All voting operations are scoped to the active competition.
    """
    __tablename__ = "competitions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[CompetitionStatus] = mapped_column(Enum(CompetitionStatus), default=CompetitionStatus.DRAFT, nullable=False)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # C5 FIX: Numeric for monetary values — Float causes precision corruption
    # (e.g. 0.1 + 0.2 = 0.30000000000000004)
    vote_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1.00"), nullable=False)
    votes_per_payment: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="USD", nullable=False)
    public_leaderboard: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    events: Mapped[List["Event"]] = relationship("Event", back_populates="competition")
    participants: Mapped[List["Participant"]] = relationship("Participant", back_populates="competition")


class Event(Base):
    """
    Event model representing active/upcoming digital entertainment competitions.
    Each event owns its custom configuration rules and lifecycle state.
    """
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    banner: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Soft delete field

    # C5 FIX: Numeric for monetary values
    vote_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=Decimal("1.00"))
    votes_per_payment: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    currency: Mapped[Optional[str]] = mapped_column(String, default="USD")
    registration_opens: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_closes: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_opens: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_closes: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    public_leaderboard: Mapped[bool] = mapped_column(Boolean, default=True)
    allowed_platforms: Mapped[Optional[str]] = mapped_column(String, default="TikTok,Facebook,Instagram,YouTube")
    allowed_categories: Mapped[Optional[str]] = mapped_column(String, default="Singing,Dancing,Comedy")
    require_contestant_approval: Mapped[bool] = mapped_column(Boolean, default=True)

    # Foreign key to Competition (nullable for backward compatibility)
    competition_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("competitions.id"), nullable=True, index=True)
    competition: Mapped[Optional["Competition"]] = relationship("Competition", back_populates="events")


class Participant(Base):
    """
    Contestant in a competition who receives votes.
    Supports soft deletion and platform validation.
    """
    __tablename__ = "participants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    platform: Mapped[SocialPlatform] = mapped_column(Enum(SocialPlatform), nullable=False)
    video_url: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[ContestantStatus] = mapped_column(Enum(ContestantStatus), default=ContestantStatus.DRAFT, nullable=False)
    votes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Soft delete field

    # Foreign key to Competition (nullable for backward compatibility)
    competition_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("competitions.id"), nullable=True, index=True)
    competition: Mapped[Optional["Competition"]] = relationship("Competition", back_populates="participants")

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
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.CREATED, nullable=False)
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

    # Traffic source tracking
    source_platform: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)  # tiktok, facebook, instagram, youtube, direct

    # Competition scoping
    competition_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("competitions.id"), nullable=True, index=True)

    # Warning acknowledgement (for duplicate voters)
    duplicate_vote_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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

    # Competition scoping
    competition_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("competitions.id"), nullable=True, index=True)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="vote_transaction")
    contestant: Mapped["Participant"] = relationship("Participant", back_populates="vote_transactions")


class AuditLog(Base):
    """
    Immutable audit log storing security actions.
    Must never be deleted.
    """
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    details: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


class Activity(Base):
    """
    Legacy general dashboard activity items (for frontend overview mapping).
    """
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialPlatformSync(Base):
    """
    Sync status of social platforms used to pull video metadata.
    Renamed from SocialPlatform to avoid conflict with the enum.
    """
    __tablename__ = "social_platforms"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    platform: Mapped[SocialPlatform] = mapped_column(Enum(SocialPlatform), nullable=False)
    status: Mapped[SocialSyncStatus] = mapped_column(Enum(SocialSyncStatus), default=SocialSyncStatus.DISCONNECTED, nullable=False)
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(String, nullable=True)


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