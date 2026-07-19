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
from redis.asyncio import Redis
from redis.exceptions import ConnectionError


from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: Redis | None = None


async def init_redis() -> Redis | None:
    global redis_client

    if redis_client is None:
        try:
            redis_client = Redis.from_url( # pyright: ignore[reportUnknownMemberType]
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )

            await redis_client.ping()# pyright: ignore[reportUnknownMemberType]

            logger.info("Redis connected successfully")

        except ConnectionError as e:
            logger.error(
                "Redis connection failed: %s. Rate limiting will use in-memory fallback.",
                e,
            )
            redis_client = None

    return redis_client 

async def close_redis() -> None:
    """Close the Redis connection."""
    global redis_client

    if redis_client is not None:
        try:
            await redis_client.aclose()
            logger.info("Redis connection closed.")
        except Exception:
            logger.exception("Error while closing Redis.")
        finally:
            redis_client = None
            
async def get_redis() -> Redis:
    if redis_client is None:
        client = await init_redis()
        if client is None:
            raise RuntimeError("Redis is unavailable")
    assert redis_client is not None
    return redis_client