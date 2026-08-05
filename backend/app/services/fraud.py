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

    async def verify_request_replay(self, request_id: str) -> None:
        """
        Verify request replay protection using Redis with a thread-safe in-memory fallback.
        nx=True ensures SET only succeeds if the key does not already exist.
        ex=300 sets a 5-minute TTL.
        """
        if not request_id:
            return

        from app.core.redis import redis_client

        if redis_client is not None:
            try:
                # Set key with TTL of 300 seconds (5 minutes)
                # nx=True ensures it is only set if it does not already exist
                is_new = await redis_client.set(f"replay:{request_id}", "1", nx=True, ex=300)
                if not is_new:
                    logger.warning(f"Fraud Alert | Replay detected for request ID: {request_id}")
                    raise FraudException(f"Replay detected: this request ID has already been processed.")
            except Exception as e:
                if isinstance(e, FraudException):
                    raise
                logger.warning(f"Redis error during replay check: {e}. Falling back to in-memory replay check.")
                self._verify_in_memory_replay(request_id)
        else:
            self._verify_in_memory_replay(request_id)

    def _verify_in_memory_replay(self, request_id: str) -> None:
        """Fallback thread-safe in-memory replay check."""
        import time
        import threading

        # Initialize global class-level or module-level tracking if not already present
        if not hasattr(self.__class__, "_in_memory_replays"):
            self.__class__._in_memory_replays = {}
            self.__class__._replays_lock = threading.Lock()

        now = time.time()
        with self.__class__._replays_lock:
            # Cleanup expired entries (older than 300 seconds)
            expired = [k for k, ts in self.__class__._in_memory_replays.items() if now - ts > 300]
            for k in expired:
                del self.__class__._in_memory_replays[k]

            # Check for replay
            if request_id in self.__class__._in_memory_replays:
                logger.warning(f"Fraud Alert | Replay detected (in-memory) for request ID: {request_id}")
                raise FraudException(f"Replay detected: this request ID has already been processed.")

            # Record request ID
            self.__class__._in_memory_replays[request_id] = now