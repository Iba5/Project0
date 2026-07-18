from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    MODERATOR = "Moderator"

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
    DRAFT = "Draft"
    UPCOMING = "Upcoming"
    REGISTRATION_OPEN = "Registration Open"
    VOTING_OPEN = "Voting Open"
    VOTING_CLOSED = "Voting Closed"
    COMPLETED = "Completed"
    ARCHIVED = "Archived"

class ContestantStatus(str, Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    DISQUALIFIED = "Disqualified"
    ARCHIVED = "Archived"

class PaymentStatus(str, Enum):
    CREATED = "Created"
    PENDING = "Pending"
    PROCESSING = "Processing"
    PAID = "Paid"
    FAILED = "Failed"
    CANCELLED = "Cancelled"
    REFUNDED = "Refunded"
    EXPIRED = "Expired"

class SocialPlatform(str, Enum):
    TIKTOK = "TikTok"
    FACEBOOK = "Facebook"
    INSTAGRAM = "Instagram"
    YOUTUBE = "YouTube"

class SocialSyncStatus(str, Enum):
    CONNECTED = "Connected"
    SYNCING = "Syncing"
    FAILED = "Failed"
    DISCONNECTED = "Disconnected"

class CompetitionStatus(str, Enum):
    DRAFT = "Draft"
    ACTIVE = "Active"
    COMPLETED = "Completed"
    ARCHIVED = "Archived"

class SourcePlatform(str, Enum):
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    DIRECT = "direct"

# Strict whitelist for URL parameter validation
ALLOWED_SOURCE_PLATFORMS = {e.value for e in SourcePlatform}
