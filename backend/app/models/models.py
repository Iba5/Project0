import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.enums.enums import UserRole, EventStatus, ContestantStatus, PaymentStatus, SocialPlatform, SocialSyncStatus

class User(Base):
    """
    User model representing Administrator accounts.
    Supports soft deletion and RBAC roles.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.ADMIN, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True) # Soft delete field
    
    # Password reset fields
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)
    
    # Invitation fields
    invitation_token = Column(String, nullable=True, unique=True, index=True)
    invitation_token_expires = Column(DateTime, nullable=True)
    invited_by = Column(String, nullable=True) # ID of user who sent invitation

    audit_logs = relationship("AuditLog", back_populates="user")

class Event(Base):
    """
    Event model representing active/upcoming digital entertainment competitions.
    Each event owns its custom configuration rules and lifecycle state.
    """
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    banner = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(Enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True) # Soft delete field

    # Event Rules & Configurations
    vote_price = Column(Float, default=1.0)
    votes_per_payment = Column(Integer, default=1)
    currency = Column(String, default="USD")
    registration_opens = Column(DateTime, nullable=True)
    registration_closes = Column(DateTime, nullable=True)
    voting_opens = Column(DateTime, nullable=True)
    voting_closes = Column(DateTime, nullable=True)
    public_leaderboard = Column(Boolean, default=True)
    allowed_platforms = Column(String, default="TikTok,Facebook,Instagram,YouTube")
    allowed_categories = Column(String, default="Singing,Dancing,Comedy")
    require_contestant_approval = Column(Boolean, default=True)

class Participant(Base):
    """
    Contestant in a competition who receives votes.
    Supports soft deletion and platform validation.
    """
    __tablename__ = "participants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    platform = Column(Enum(SocialPlatform), nullable=False)
    video_url = Column(String, nullable=False)
    status = Column(Enum(ContestantStatus), default=ContestantStatus.DRAFT, nullable=False)
    votes = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True) # Soft delete field

    payments = relationship("Payment", back_populates="contestant")
    vote_transactions = relationship("VoteTransaction", back_populates="contestant")

class Payment(Base):
    """
    Payment record verifying payment phase (via Paynow).
    """
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reference = Column(String, unique=True, index=True, nullable=False)
    contestant_id = Column(String, ForeignKey("participants.id"), nullable=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False) # Ecocash, OneMoney, Paynow, etc.
    status = Column(Enum(PaymentStatus), default=PaymentStatus.CREATED, nullable=False)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    contestant = relationship("Participant", back_populates="payments")
    vote_transaction = relationship("VoteTransaction", uselist=False, back_populates="payment")

class VoteTransaction(Base):
    """
    Separate audit record linking payments to contestants.
    Must never be deleted.
    """
    __tablename__ = "vote_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False, unique=True)
    contestant_id = Column(String, ForeignKey("participants.id"), nullable=False)
    votes_awarded = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    payment = relationship("Payment", back_populates="vote_transaction")
    contestant = relationship("Participant", back_populates="vote_transactions")

class AuditLog(Base):
    """
    Immutable audit log storing security actions.
    Must never be deleted.
    """
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="audit_logs")

class Activity(Base):
    """
    Legacy general dashboard activity items (for frontend overview mapping).
    """
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    time = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SocialPlatform(Base):
    """
    Sync status of social platforms used to pull video metadata.
    """
    __tablename__ = "social_platforms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    platform = Column(Enum(SocialPlatform), nullable=False)
    status = Column(Enum(SocialSyncStatus), default=SocialSyncStatus.DISCONNECTED, nullable=False)
    last_sync = Column(DateTime, nullable=True)
    detail = Column(String, nullable=True)

class Setting(Base):
    """
    Platform-wide global settings and preferences.
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    company_name = Column(String, default="Digital Voting Corp")
    support_email = Column(String, default="support@votingcorp.com")
    timezone = Column(String, default="UTC")
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)
    marketing_notifications = Column(Boolean, default=False)
