import logging
from sqlalchemy.orm import Session
from app.models.models import Payment
from app.repositories.repositories import PaymentRepository
from app.enums.enums import PaymentStatus

logger = logging.getLogger(__name__)


class IdempotencyService:
    """
    Enforces idempotency constraints on payment checkouts and callbacks.
    Ensures vote balances are never incremented multiple times for a single reference.
    """
    def __init__(self, db: Session) -> None:
        self.payment_repo = PaymentRepository(db)

    def is_callback_already_processed(self, payment: Payment) -> bool:
        """
        Checks if a payment has already transitioned to a final state (PAID/FAILED).
        Accepts a Payment object directly (may be row-locked).
        """
        if not payment:
            return False

        # If status is PAID or FAILED, it is already processed and should be ignored
        if payment.status in (PaymentStatus.PAID, PaymentStatus.FAILED):
            logger.info(f"Idempotency | Reference {payment.reference} is already in state {payment.status.value}. Skipping callback.")
            return True

        return False