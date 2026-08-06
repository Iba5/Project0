from datetime import datetime
from decimal import Decimal
from typing import List, Optional, TypeVar, Generic, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from app.enums.enums import (
    UserRole, EventStatus, ContestantStatus, PaymentStatus, 
    PaymentMethod, PaymentMethodType
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
    total: Optional[int] = None
    per_page: Optional[int] = None


class AcceptInvitationBody(BaseModel):
    token: str
    name: str
    password: str

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
    refresh_token: Optional[str] = None
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
    minimum_payment: float = 1.0  # Independent minimum payment
    votes_per_payment: int = 1
    currency: str = "USD"
    registration_opens: Optional[datetime] = None
    registration_closes: Optional[datetime] = None
    voting_opens: Optional[datetime] = None
    voting_closes: Optional[datetime] = None
    public_leaderboard: bool = True
    require_contestant_approval: bool = True
    enable_videos: bool = False  # Enable participant videos for this event
    share_link: Optional[str] = None  # Internal shareable link

class EventCreate(EventBase):
    pass

# L9 FIX: Update schemas use Optional fields so PUT can be partial
class EventUpdate(CamelModel):
    name: Optional[str] = None
    description: Optional[str] = None
    banner: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[EventStatus] = None
    vote_price: Optional[float] = None
    minimum_payment: Optional[float] = None  # Independent minimum payment
    votes_per_payment: Optional[int] = None
    currency: Optional[str] = None
    registration_opens: Optional[datetime] = None
    registration_closes: Optional[datetime] = None
    voting_opens: Optional[datetime] = None
    voting_closes: Optional[datetime] = None
    public_leaderboard: Optional[bool] = None
    require_contestant_approval: Optional[bool] = None
    enable_videos: Optional[bool] = None
    share_link: Optional[str] = None

class EventResponse(EventBase):
    id: str
    event_id: Optional[str] = None
    computed_status: Optional[str] = None  # Computed runtime status
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    participant_count: Optional[int] = None
    minimum_payment: Optional[float] = None  # Include minimum_payment in response

# --- Participant / Contestant Schemas ---

class ParticipantBase(CamelModel):
    """Common read-only fields shared by all participant schemas.

    event_id is intentionally absent here: ParticipantCreate needs it
    as a required str, while ParticipantResponse needs it as Optional[str].
    Declaring the same mutable attribute with different types in a parent
    and child violates LSP and triggers a Pyrefly bad-override error.
    """
    name: str
    category: str
    video_url: Optional[str] = None  # Optional promotional video
    image_url: Optional[str] = None  # Profile picture
    bio: Optional[str] = None  # Biography
    status: ContestantStatus = ContestantStatus.APPROVED
    votes: int = 0

class ParticipantCreate(ParticipantBase):
    event_id: str  # Required: every new participant must belong to an event

class PaymentConfiguration(CamelModel):
    """Consolidated payment configuration from event."""
    vote_price: Optional[float] = None
    minimum_payment: Optional[float] = None
    currency: Optional[str] = None
    voting_open: Optional[bool] = None

class ParticipantResponse(ParticipantBase):
    id: str
    event_id: Optional[str] = None  # Optional: ORM rows may have NULL event_id
    thumbnail_url: Optional[str] = None
    created_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    # Consolidated payment configuration from participant's event
    payment_configuration: Optional[PaymentConfiguration] = None

class ParticipantUpdate(CamelModel):
    name: Optional[str] = None
    category: Optional[str] = None
    video_url: Optional[str] = None
    image_url: Optional[str] = None
    bio: Optional[str] = None
    event_id: Optional[str] = None
    status: Optional[ContestantStatus] = None

# --- Payment Schemas ---

class PaymentBase(CamelModel):
    reference: str
    amount: float
    payment_method: str
    status: PaymentStatus = PaymentStatus.CREATED
    date: datetime
class PaymentSummaryResponse(CamelModel):
    id: Optional[str] = None
    reference: Optional[str] = None
    contestant_id: Optional[str] = None
    amount: Optional[str] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None
    voter_name: Optional[str] = None
    voter_email: Optional[str] = None
    date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    poll_url: Optional[str] = None
    redirect_url: Optional[str] = Field(None, alias="paynowRedirectUrl")
    instructions: Optional[str] = None
    test_mode: bool = False

class PaymentEnvelopeResponse(CamelModel):
    payment: PaymentSummaryResponse
    idempotent: bool = False

class PaymentCreate(CamelModel):
    contestant_id: str
    amount: Decimal = Field(..., gt=0, description="Payment amount in currency units")
    payment_method: str
    voter_phone: str = Field(..., min_length=8, max_length=15, description="Voter phone number (required)")
    voter_name: Optional[str] = None  # Name of actual voter (if proxy)
    voter_email: Optional[str] = None
    event_id: Optional[str] = None
    acknowledge_duplicate: bool = False

    @field_validator('voter_phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Strip spaces and ensure it looks like a phone number."""
        cleaned = v.strip().replace(" ", "").replace("+", "")
        if not cleaned.isdigit() or len(cleaned) < 8:
            raise ValueError("Invalid phone number format")
        return cleaned

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

class PaymentInitiationResponse(CamelModel):
    id: Optional[str] = None

    warning: Optional[str] = None
    has_voted: bool = False

    reference: Optional[str] = None
    redirect_url: Optional[str] = None
    instructions: Optional[str] = None
    poll_url: Optional[str] = None

    amount: Optional[str] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None

    contestant_id: Optional[str] = None

    voter_name: Optional[str] = None
    voter_email: Optional[str] = None

    date: Optional[datetime] = None
    created_at: Optional[datetime] = None

    idempotent: bool = False
    test_mode: bool = False
    votes_awarded: Optional[int] = None  # Backend-calculated votes from amount


class SimpleMessageResponse(CamelModel):
    success: bool
    message: str

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


class CallbackAckResponse(CamelModel):
    """Minimal acknowledgement returned to the Paynow webhook caller.
    The gateway ignores the body; this exists purely so the endpoint
    has a declared contract and appears correctly in OpenAPI docs."""
    status: str


class PaymentListResponse(BaseModel):
    """Envelope for the paginated payment list endpoint.

    Items arrive from PaymentService.list_payments() as pre-serialised
    camelCase dicts (e.g. contestantId, paymentMethod).  Using plain
    BaseModel — NOT CamelModel — to avoid the alias generator
    mangling keys that are already in the correct format.
    """
    items: List[Any]
    payments: List[Any]
    pagination: PaginationMeta



class TestPaymentItemResponse(CamelModel):
    """Single test-payment record returned by the dev list endpoint."""
    reference: str
    contestant_id: Optional[str] = None
    amount: str
    payment_method: str
    status: str
    voter_phone: Optional[str] = None
    voter_name: Optional[str] = None
    voter_email: Optional[str] = None
    event_id: Optional[str] = None
    test_redirect_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    auto_complete: bool = True
    test_completion_delay: int = 5


class TestPaymentListResponse(CamelModel):
    """Response envelope for GET /payments/test/list."""
    test_payments: List[TestPaymentItemResponse]
    total: int


class TestPaymentCompleteResponse(CamelModel):
    """Response for POST /payments/test/{reference}/complete."""
    status: str
    reference: str
    contestant_name: str
    amount: str
    votes_awarded: int
    test_mode: bool = True


class TestPaymentCleanupResponse(CamelModel):
    """Response for DELETE /payments/test/cleanup."""
    status: str
    deleted_count: int
    message: str

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

# --- Dashboard Schemas ---
class DashboardPaymentResponse(CamelModel):
    id: str
    reference: str
    amount: float
    payment_method: str
    status: PaymentStatus
    created_at: datetime

class RevenueTrendPoint(CamelModel):
    date: str
    total: float

class VotesByCategoryPoint(CamelModel):
    category: str
    votes: int

class TopPaymentMethodPoint(CamelModel):
    method: str
    count: int
    percentage: float

class VoteTrendPoint(CamelModel):
    date: str
    votes: int

class TopPerformerEntry(CamelModel):
    id: str
    name: str
    votes: int

class EnhancedActivityEntry(CamelModel):
    id: str
    title: str
    detail: Optional[str] = None
    time: datetime

class DashboardActiveEvent(CamelModel):
    id: str
    name: str
    status: str

class DashboardSummaryResponse(CamelModel):
    active_event: Optional[DashboardActiveEvent] = None

    total_participants: int
    total_votes: int
    total_revenue: float

    recent_payments: List[DashboardPaymentResponse]
    recent_activity: List[ActivityResponse]

    range: str
    date_from: Optional[str] = None

    revenue_trend: List[RevenueTrendPoint]
    votes_by_category: List[VotesByCategoryPoint]
    top_payment_methods: List[TopPaymentMethodPoint]
    vote_trend: List[VoteTrendPoint]
    top_performers: List[TopPerformerEntry]
    enhanced_recent_activity: List[EnhancedActivityEntry]
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

# --- Payment Method Configuration Schemas ---

class PaymentMethodConfigCreate(CamelModel):
    method: str
    method_type: str
    display_name: str
    description: Optional[str] = None
    is_enabled: bool = True
    sort_order: int = 0
    icon_name: Optional[str] = None
    config_data: Optional[dict] = None

class PaymentMethodConfigUpdate(CamelModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    sort_order: Optional[int] = None
    icon_name: Optional[str] = None
    config_data: Optional[dict] = None

class PaymentMethodConfigResponse(CamelModel):
    id: str
    method: str
    method_type: str
    display_name: str
    description: Optional[str] = None
    is_enabled: bool
    sort_order: int
    icon_name: Optional[str] = None
    config_data: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

class SettingsProfileUpdate(CamelModel):
    company_name: str
    support_email: EmailStr
    timezone: str
    notifications: NotificationPreferences
