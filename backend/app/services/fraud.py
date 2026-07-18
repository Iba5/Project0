import logging
from sqlalchemy.orm import Session
from app.exceptions.exceptions import FraudException
from app.repositories.repositories import PaymentRepository, VoteTransactionRepository
from app.constants.constants import MAX_VOTES_PER_TRANSACTION

logger = logging.getLogger(__name__)

class FraudDetectionService:
    """
    Dedicated security service checking for abnormal voter activities,
    duplicate callbacks, replay attacks, and transaction verification integrity.
    """
    def __init__(self, db: Session):
        self.db = db
        self.payment_repo = PaymentRepository(db)
        self.vote_repo = VoteTransactionRepository(db)

    def detect_duplicate_payment(self, reference: str) -> None:
        """
        Validates whether a payment reference was already recorded in DB.
        """
        existing = self.payment_repo.get_by_reference(reference)
        if existing:
            logger.warning(f"Fraud Alert | Duplicate payment reference detected: {reference}")
            raise FraudException(f"Payment reference {reference} has already been registered.")

    def detect_suspicious_voting(self, contestant_id: str, votes: int) -> None:
        """
        M5/M6 FIX: Actually enforce the MAX_VOTES_PER_TRANSACTION limit.
        Previously only logged a warning. Now blocks transactions exceeding the threshold.
        """
        if votes > MAX_VOTES_PER_TRANSACTION:
            logger.warning(
                f"Fraud Alert | Vote purchase of {votes} exceeds limit "
                f"({MAX_VOTES_PER_TRANSACTION}) for contestant: {contestant_id}"
            )
            raise FraudException(
                f"Vote amount {votes} exceeds the maximum allowed "
                f"per transaction ({MAX_VOTES_PER_TRANSACTION})."
            )

    def verify_request_replay(self, request_id: str) -> None:
        """
        M10 FIX: Previously a no-op placeholder. Now raises NotImplementedError
        to prevent false sense of security.
        
        To implement: use Redis SET NX with TTL to store seen request IDs.
        Example:
            if redis.set(f"replay:{request_id}", "1", nx=True, ex=300):
                return  # First time seeing this request
            raise FraudException("Replay detected: this request ID has already been processed.")
        """
        raise NotImplementedError(
            "Replay detection is not yet implemented. "
            "Implement with Redis SET NX before enabling in production."
        )