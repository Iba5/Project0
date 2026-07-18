from app.enums.enums import UserRole, Permission

# Role to Permission mappings defining RBAC configurations
ROLE_PERMISSIONS = {
    UserRole.SUPER_ADMIN: [
        Permission.EVENTS_CREATE,
        Permission.EVENTS_UPDATE,
        Permission.EVENTS_DELETE,
        Permission.CONTESTANTS_READ,
        Permission.CONTESTANTS_UPDATE,
        Permission.PAYMENTS_READ,
        Permission.REPORTS_EXPORT,
        Permission.SETTINGS_UPDATE,
        Permission.ADMINS_MANAGE,  # M3 FIX: Only Super Admin can manage admins
    ],
    UserRole.ADMIN: [
        Permission.EVENTS_CREATE,
        Permission.EVENTS_UPDATE,
        Permission.EVENTS_DELETE,
        Permission.CONTESTANTS_READ,
        Permission.CONTESTANTS_UPDATE,
        Permission.PAYMENTS_READ,
        Permission.REPORTS_EXPORT,
        Permission.SETTINGS_UPDATE,
    ],
    UserRole.MODERATOR: [
        Permission.CONTESTANTS_READ,
        Permission.CONTESTANTS_UPDATE,
        Permission.PAYMENTS_READ,
    ],
}

# Fraud Limits
MAX_VOTES_PER_TRANSACTION = 5000
RATE_LIMIT_VOTER_PERIOD_SEC = 60
MAX_VOTES_PERIOD_PER_IP = 100