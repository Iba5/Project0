import time
import uuid
import logging
import threading
from typing import Dict, Tuple, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from redis.asyncio import Redis
from starlette.responses import Response

logger = logging.getLogger(__name__)

# --- Rate Limit Configuration ---
LIMIT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 60

PAYMENT_LIMIT_WINDOW_SECONDS = 60
MAX_PAYMENT_REQUESTS_PER_WINDOW = 10

# --- In-Memory Fallback (used when Redis is unavailable) ---
# This is only used as a degradation path. Redis is the primary backend.
_in_memory_limits: Dict[str, Tuple[int, float]] = {}
_in_memory_payment_limits: Dict[str, Tuple[int, float]] = {}
_fallback_lock = threading.Lock()
_fallback_cleanup_interval = 300
_last_fallback_cleanup = 0.0


def _cleanup_in_memory() -> None:
    """Purge expired in-memory entries to prevent unbounded growth."""
    global _last_fallback_cleanup
    now = time.time()
    if now - _last_fallback_cleanup < _fallback_cleanup_interval:
        return
    _last_fallback_cleanup = now
    with _fallback_lock:
        expired = [k for k, (_, ws) in _in_memory_limits.items() if now - ws > LIMIT_WINDOW_SECONDS]
        for k in expired:
            del _in_memory_limits[k]
        expired_p = [k for k, (_, ws) in _in_memory_payment_limits.items() if now - ws > PAYMENT_LIMIT_WINDOW_SECONDS]
        for k in expired_p:
            del _in_memory_payment_limits[k]


def _check_in_memory(
    store: Dict[str, Tuple[int, float]], 
    key: str, 
    max_requests: int, 
    window_seconds: float
) -> bool:
    """
    Check in-memory rate limit. Returns True if ALLOWED, False if blocked.
    Uses a sliding window approach.
    """
    now = time.time()
    if key not in store:
        store[key] = (1, now)
        return True
    count, window_start = store[key]
    if now - window_start > window_seconds:
        store[key] = (1, now)
        return True
    if count >= max_requests:
        return False
    store[key] = (count + 1, window_start)
    return True


async def _check_redis_rate_limit(
    redis_client: Redis,
    key: str,
    max_requests: int,
    window_seconds: int,) -> bool | None:    
    """
    Redis-based sliding window rate limit using INCR + EXPIRE.
    Returns True if ALLOWED, False if blocked.
    
    Uses a simple fixed-window counter:
    - INCR the key
    - If first request in window, set EXPIRE
    - If count > max, block
    """
    try:
        current: int = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, window_seconds)
        return current <= max_requests

    except Exception as e:
        logger.warning(
            f"Redis rate limit check failed for {key}: {e}. Falling back to in-memory."
        )
        return None


class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    Redis-backed distributed rate limiting middleware.
    
    Primary: Redis INCR/EXPIRE for atomic, multi-worker-safe counting.
    Fallback: In-memory dict if Redis is unavailable (single-worker only).
    
    Two tiers:
    - Global: 60 requests/minute per IP
    - Payment /initiate: 10 requests/minute per IP (stricter)
    """
    async def dispatch(
    self,
    request: Request,
    call_next: RequestResponseEndpoint,
    ) -> Response:
        client_ip = request.client.host if request.client else "127.0.0.1"
        path = request.url.path.lower()

        is_payment_init = "/payments/initiate" in path

        # Try Redis first
        redis_ok = False
        redis_client = None
        try:
            from app.core.redis import redis_client as rc
            if rc is not None:
                redis_client = rc
        except Exception:
            pass

        if redis_client is not None:
            redis_ok = await self._check_redis(client_ip, is_payment_init, redis_client)
            if redis_ok is False:
                # Blocked by Redis
                return self._rate_limit_response(client_ip, is_payment_init)
            # If redis_ok is None (Redis error), fall through to in-memory

        # In-memory fallback
        if redis_ok is not True:
            _cleanup_in_memory()
            with _fallback_lock:
                if is_payment_init:
                    allowed = _check_in_memory(
                        _in_memory_payment_limits, client_ip,
                        MAX_PAYMENT_REQUESTS_PER_WINDOW, PAYMENT_LIMIT_WINDOW_SECONDS
                    )
                else:
                    allowed = _check_in_memory(
                        _in_memory_limits, client_ip,
                        MAX_REQUESTS_PER_WINDOW, LIMIT_WINDOW_SECONDS
                    )
                if not allowed:
                    return self._rate_limit_response(client_ip, is_payment_init)

        return await call_next(request)

    async def _check_redis(
    self,
    client_ip: str,
    is_payment_init: bool,
    redis_client: Redis,
    ) -> Optional[bool]:
        """Check rate limit via Redis. Returns True/False/None (error)."""
        try:
            if is_payment_init:
                key = f"rl:payment:{client_ip}"
                return await _check_redis_rate_limit(redis_client, key, MAX_PAYMENT_REQUESTS_PER_WINDOW, PAYMENT_LIMIT_WINDOW_SECONDS)
            else:
                key = f"rl:global:{client_ip}"
                return await _check_redis_rate_limit(redis_client, key, MAX_REQUESTS_PER_WINDOW, LIMIT_WINDOW_SECONDS)
        except Exception as e:
            logger.warning(f"Redis rate limit error: {e}")
            return None

    @staticmethod
    def _rate_limit_response(client_ip: str, is_payment: bool) -> JSONResponse:
        if is_payment:
            logger.warning(f"Payment rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "message": "Too many payment attempts. Please wait before trying again.",
                    "errors": []
                }
            )
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "success": False,
                "message": "Too many requests. Please try again later.",
                "errors": []
            }
        )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware generating unique request IDs, tracking duration,
    enforcing security headers, and writing standard logging formats.
    """
    async def dispatch(self, request: Request, call_next:RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        
        # Enforce Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.redoc.ly; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data:; "
            "font-src 'self' https://fonts.gstatic.com"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Log entry satisfying the Logging Policy
        # Does NOT log passwords, tokens, or authorization headers
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", "anonymous")
        
        logger.info(
            f"REQID: {request_id} | USERID: {user_id} | IP: {client_ip} | "
            f"METHOD: {request.method} | PATH: {request.url.path} | "
            f"STATUS: {response.status_code} | DURATION: {process_time:.4f}s"
        )
        
        return response