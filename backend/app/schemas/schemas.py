from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from pydantic.alias_generators import to_camel
from app.enums.enums import UserRole, EventStatus, ContestantStatus, PaymentStatus, SocialPlatform, SocialSyncStatus

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
    password: str

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
    pass

class EventUpdate(EventBase):
    pass

class EventResponse(EventBase):
    id: str

# --- Participant / Contestant Schemas ---

class ParticipantBase(CamelModel):
    name: str
    category: str
    platform: SocialPlatform
    video_url: str
    status: ContestantStatus = ContestantStatus.DRAFT
    votes: int = 0

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantResponse(ParticipantBase):
    id: str

# --- Payment Schemas ---

class PaymentBase(CamelModel):
    reference: str
    amount: float
    payment_method: str
    status: PaymentStatus = PaymentStatus.CREATED
    date: datetime

class PaymentCreate(CamelModel):
    contestant_id: str
    amount: float
    payment_method: str

class PaymentResponse(CamelModel):
    id: str
    reference: str
    contestant: str
    amount: str
    payment_method: str
    status: PaymentStatus
    date: datetime

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
