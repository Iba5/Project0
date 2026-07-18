from datetime import datetime
from typing import List, Optional, Dict, Any, TypeVar, Generic
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from app.enums.enums import (
    UserRole, EventStatus, ContestantStatus, PaymentStatus, 
    SocialPlatform, SocialSyncStatus, CompetitionStatus, SourcePlatform,
    ALLOWED_SOURCE_PLATFORMS
)

T = TypeVar("T")


# --- Pagination ---

class PaginationMeta(BaseModel):
    """Pagination metadata returned with every paginated response."""
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic wrapper for paginated list responses."""
    items: List[T]
    pagination: PaginationMeta


class CamelModel(BaseModel):
    """
    Base Pydantic model that automatically converts python snake_case fields 
    to camelCase for JSON output to match the frontend's expected format.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

# --- Authentication Schemas ---

class UserRegister(CamelModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 characters)")

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """M6 FIX: Enforce minimum password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

class UserLogin(CamelModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False

class UserResponse(CamelModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole

class AuthResult(CamelModel):
    token: str
    user: UserResponse
    message: str

class ForgotPasswordRequest(CamelModel):
    email: EmailStr

class ResetPasswordRequest(CamelModel):
    token: str
    new_password: str

class AdminInvitationRequest(CamelModel):
    email: EmailStr
    role: UserRole = UserRole.ADMIN

class AdminInvitationResponse(CamelModel):
    email: str
    role: UserRole
    invitation_link: str
    expires_at: datetime

class InvalidateAdminRequest(CamelModel):
    admin_id: str

# --- Competition Schemas ---

class CompetitionBase(CamelModel):
    name: str
    description: Optional[str] = None
    status: CompetitionStatus = CompetitionStatus.DRAFT
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    vote_price: float = 1.0
    votes_per_payment: int = 1
    currency: str = "USD"
    public_leaderboard: bool = True

class CompetitionCreate(CompetitionBase):
    pass

# L9 FIX: Update schemas use Optional fields so PUT can be partial
class CompetitionUpdate(CamelModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CompetitionStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    vote_price: Optional[float] = None
    votes_per_payment: Optional[int] = None
    currency: Optional[str] = None
    public_leaderboard: Optional[bool] = None

class CompetitionResponse(CompetitionBase):
    id: str
    is_active: bool

class CompetitionSetActivate(CamelModel):
    competition_id: str

# --- Event Schemas ---

class EventBase(CamelModel):
    name: str
    description: Optional[str] = None
    banner: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: EventStatus = EventStatus.DRAFT

    # Configurations
    vote_price: float = 1.0
    votes_per_payment: int = 1
    currency: str = "USD"
    registration_opens: Optional[datetime] = None
    registration_closes: Optional[datetime] = None
    voting_opens: Optional[datetime] = None
    voting_closes: Optional[datetime] = None
    public_leaderboard: bool = True
    allowed_platforms: str = "TikTok,Facebook,Instagram,YouTube"
    allowed_categories: str = "Singing,Dancing,Comedy"
    require_contestant_approval: bool = True

class EventCreate(EventBase):
    competition_id: Optional[str] = None

# L9 FIX: Update schemas use Optional fields so PUT can be partial
class EventUpdate(CamelModel):
    name: Optional[str] = None
    description: Optional[str] = None
    banner: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[EventStatus] = None
    vote_price: Optional[float] = None
    votes_per_payment: Optional[int] = None
    currency: Optional[str] = None
    registration_opens: Optional[datetime] = None
    registration_closes: Optional[datetime] = None
    voting_opens: Optional[datetime] = None
    voting_closes: Optional[datetime] = None
    public_leaderboard: Optional[bool] = None
    allowed_platforms: Optional[str] = None
    allowed_categories: Optional[str] = None
    require_contestant_approval: Optional[bool] = None
    competition_id: Optional[str] = None

class EventResponse(EventBase):
    id: str
    competition_id: Optional[str] = None

# --- Participant / Contestant Schemas ---

class ParticipantBase(CamelModel):
    name: str
    category: str
    platform: SocialPlatform
    video_url: str
    status: ContestantStatus = ContestantStatus.DRAFT
    votes: int = 0

class ParticipantCreate(ParticipantBase):
    competition_id: Optional[str] = None

class ParticipantResponse(ParticipantBase):
    id: str
    competition_id: Optional[str] = None

# --- Payment Schemas ---

class PaymentBase(CamelModel):
    reference: str
    amount: float
    payment_method: str
    status: PaymentStatus = PaymentStatus.CREATED
    date: datetime

class PaymentCreate(CamelModel):
    contestant_id: str
    # BUG 5 FIX: `amount` removed. The server determines the payment
    # amount from Competition.vote_price. Client-supplied amounts are
    # ignored to prevent price manipulation (e.g. amount=0.01).
    payment_method: str
    voter_phone: str = Field(..., min_length=8, max_length=15, description="Voter phone number (required)")
    voter_email: Optional[str] = None
    source_platform: Optional[str] = None
    competition_id: Optional[str] = None
    acknowledge_duplicate: bool = False

    @field_validator('voter_phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Strip spaces and ensure it looks like a phone number."""
        cleaned = v.strip().replace(" ", "").replace("+", "")
        if not cleaned.isdigit() or len(cleaned) < 8:
            raise ValueError("Invalid phone number format")
        return cleaned

    @field_validator('source_platform')
    @classmethod
    def validate_source_platform(cls, v: Optional[str]) -> Optional[str]:
        """Strictly validate source_platform against whitelist."""
        if v is not None and v.strip().lower() not in ALLOWED_SOURCE_PLATFORMS:
            raise ValueError(
                f"Invalid source_platform. Allowed: {', '.join(sorted(ALLOWED_SOURCE_PLATFORMS))}"
            )
        return v.strip().lower() if v else None


class PaymentResponse(CamelModel):
    id: str
    reference: str
    contestant: str
    amount: str
    payment_method: str
    status: PaymentStatus
    date: datetime
    # NOTE: voter_phone and voter_email are intentionally NOT exposed here
    # for data privacy. They exist in the DB but are not in public responses.


class VoterCheckResponse(CamelModel):
    """Response for pre-payment voter duplicate check."""
    has_voted: bool
    message: str
    warning: Optional[str] = None


class VoterDetailsUpdate(CamelModel):
    """Schema for post-payment voter details collection."""
    payment_reference: str
    voter_name: Optional[str] = Field(None, min_length=1, max_length=200)
    voter_email: Optional[EmailStr] = None


class PaymentStatusCheckResponse(CamelModel):
    """Response for manual payment status polling."""
    reference: str
    status: PaymentStatus
    paid: bool

# --- Vote Transaction Schemas ---

class VoteTransactionResponse(CamelModel):
    id: str
    payment_id: str
    contestant_id: str
    votes_awarded: int
    created_at: datetime

# --- Audit Log Schemas ---

class AuditLogResponse(CamelModel):
    id: str
    user_id: Optional[str] = None
    action: str
    ip_address: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

# --- Activity Schemas ---

class ActivityResponse(CamelModel):
    id: str
    title: str
    detail: Optional[str] = None
    time: datetime

# --- Social Platform Sync Schemas ---

class SocialPlatformResponse(CamelModel):
    id: str
    platform: SocialPlatform
    status: SocialSyncStatus = SocialSyncStatus.DISCONNECTED
    last_sync: Optional[datetime] = None
    detail: Optional[str] = None

# --- Dashboard Schemas ---

class DashboardSummaryResponse(CamelModel):
    active_event: str
    total_participants: int
    total_votes: int
    total_revenue: str
    recent_payments: List[PaymentResponse]
    recent_activity: List[ActivityResponse]

# --- Settings Schemas ---

class NotificationPreferences(CamelModel):
    email: bool = True
    sms: bool = False
    marketing: bool = False

class SettingsProfileResponse(CamelModel):
    company_name: str
    support_email: EmailStr
    timezone: str
    notifications: NotificationPreferences

class SettingsProfileUpdate(CamelModel):
    company_name: str
    support_email: EmailStr
    timezone: str
    notifications: NotificationPreferences