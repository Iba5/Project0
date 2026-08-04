from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MODERATOR = "moderator"

class Permission(str, Enum):
    EVENTS_CREATE = "events.create"
    EVENTS_UPDATE = "events.update"
    EVENTS_DELETE = "events.delete"
    CONTESTANTS_READ = "contestants.read"
    CONTESTANTS_UPDATE = "contestants.update"
    PAYMENTS_READ = "payments.read"
    REPORTS_EXPORT = "reports.export"
    SETTINGS_UPDATE = "settings.update"
    ADMINS_MANAGE = "admins.manage"  # M3 FIX: Dedicated permission for admin management

class EventStatus(str, Enum):
    # Administrative states (manual control)
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"

class ContestantStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISQUALIFIED = "disqualified"
    ARCHIVED = "archived"

class PaymentStatus(str, Enum):
    CREATED = "created"
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    EXPIRED = "expired"

class CompetitionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class PaymentMethod(str, Enum):
    """Supported payment methods for voting"""
    VISA = "visa"
    MASTERCARD = "mastercard"
    PAYPAL = "paypal"
    ECOCASH = "ecocash"
    ONEMONEY = "onemoney"
    ZIPIT = "zipit"
    VOUCHER = "voucher"

class PaymentMethodType(str, Enum):
    """Type of payment method"""
    WEB = "web"  # Redirect-based payments (Visa, MasterCard, PayPal)
    MOBILE = "mobile"  # Mobile money payments (EcoCash, OneMoney, Zipit)
    OFFLINE = "offline"  # Offline/voucher payments
