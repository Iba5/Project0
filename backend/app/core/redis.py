"""
Redis connection management.

Provides a singleton Redis client used for:
- Distributed rate limiting across multiple uvicorn workers
- Future: idempotency keys, session cache, request replay detection

Usage:
    from app.core.redis import get_redis, redis_client

    # Direct usage
    redis_client.set("key", "value", ex=60)

    # FastAPI dependency
    @router.get("/")
    def my_endpoint(r = Depends(get_redis)):
        r.get("key")
"""

import logging
import redis as redis_lib
from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — created once on first import
redis_client: redis_lib.Redis | None = None


def init_redis() -> redis_lib.Redis:
    """
    Initialize and return the Redis connection.
    Called once at application startup.
    """
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis_lib.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            # Verify connection
            redis_client.ping()
            logger.info(f"Redis connected: {settings.REDIS_URL}")
        except redis_lib.ConnectionError as e:
            logger.error(f"Redis connection failed: {e}. Rate limiting will use in-memory fallback.")
            redis_client = None
    return redis_client


def get_redis():
    """
    FastAPI dependency that yields the Redis client.
    Returns None if Redis is not available (allows graceful degradation).
    """
    if redis_client is None:
        init_redis()
    return redis_client