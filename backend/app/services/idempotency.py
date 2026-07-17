import logging
from sqlalchemy.orm import Session
from app.repositories.repositories import PaymentRepository
from app.enums.enums import PaymentStatus

logger = logging.getLogger(__name__)

class IdempotencyService:
    """
    Enforces idempotency constraints on payment checkouts and callbacks.
    Ensures vote balances are never incremented multiple times for a single reference.
    """
    def __init__(self, db: Session):
        self.payment_repo = PaymentRepository(db)

    def is_callback_already_processed(self, reference: str) -> bool:
        """
        Checks if a transaction callback reference has already transitioned to a final state (PAID/FAILED).
        """
        payment = self.payment_repo.get_by_reference(reference)
        if not payment:
            return False
            
        # If status is PAID or FAILED, it is already processed and should be ignored
        if payment.status in [PaymentStatus.PAID, PaymentStatus.FAILED]:
            logger.info(f"Idempotency | Reference {reference} is already in state {payment.status.value}. Skipping callback.")
            return True
            
        return False
