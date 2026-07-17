import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import AuditLog
from app.repositories.repositories import AuditLogRepository

logger = logging.getLogger(__name__)

class AuditService:
    """
    Handles logging of security sensitive operations and admin activities.
    Generates immutable audit records that must never be deleted.
    """
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[str] = None
    ) -> AuditLog:
        """
        Creates and stores an immutable audit log entry in the database.
        """
        audit_repo = AuditLogRepository(db)
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address,
            details=details
        )
        
        # Log to standard logger (ensuring no passwords or secrets are contained in details)
        logger.info(
            f"AUDIT LOG | Action: {action} | UserID: {user_id} | "
            f"IP: {ip_address} | Details: {details}"
        )
        
        return audit_repo.create(log_entry)
