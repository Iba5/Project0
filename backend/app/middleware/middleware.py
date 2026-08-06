import time
import uuid
import logging
import threading
import os
from typing import Dict, Tuple, Optional, Literal
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from redis.asyncio import Redis
from starlette.responses import Response
from app.core.config import settings
from app.utils.ip_utils import get_client_ip

logger = logging.getLogger(__name__)

# --- Rate Limit Categories ---
RateLimitCategory = Literal[
    "infrastructure",  # Excluded from rate limiting
    "public_read",     # Relaxed limits for public GET endpoints
    "auth",            # Strict limits for authentication endpoints
    "payment_init",    # Very strict for payment initiation
    "payment_status",  # Moderate for payment status polling
    "admin",           # Moderate for admin CRUD
    "general",         # Default fallback
]

# --- Route Classification ---
def classify_route(method: str, path: str) -> RateLimitCategory:
    """
    Classify a request into a rate limit category based on method and path.
    """
    path_lower = path.lower()
    method_upper = method.upper()
    
    # Infrastructure requests - exclude from rate limiting (bypass before any Redis/IP work)
    if method_upper == "OPTIONS":
        return "infrastructure"
    if path_lower.startswith("/socket.io"):
        return "infrastructure"
    if path_lower in ("/health", "/healthz", "/readiness", "/liveness"):
        return "infrastructure"
    if path_lower.startswith("/docs") or path_lower.startswith("/redoc") or path_lower.startswith("/openapi"):
        return "infrastructure"
    
    # Webhooks - exclude from rate limiting (protected by signature verification)
    if path_lower.startswith("/api/v1/payments/paynow/callback"):
        return "infrastructure"
    
    # Public GET endpoints - relaxed limits
    if method_upper == "GET":
        if path_lower.startswith("/api/v1/public/events"):
            return "public_read"
        if path_lower.startswith("/api/v1/public/participants"):
            return "public_read"
        if path_lower.startswith("/api/v1/participants/public"):
            return "public_read"
        if path_lower.startswith("/api/v1/participants/leaderboard"):
            return "public_read"
        if path_lower.startswith("/api/v1/stats"):
            return "public_read"
    
    # Authentication endpoints - strict limits
    if path_lower.startswith("/api/v1/auth/login"):
        return "auth"
    if path_lower.startswith("/api/v1/auth/refresh"):
        return "auth"
    if path_lower.startswith("/api/v1/auth/forgot-password"):
        return "auth"
    if path_lower.startswith("/api/v1/auth/reset-password"):
        return "auth"
    if path_lower.startswith("/api/v1/auth/otp"):
        return "auth"
    if path_lower.startswith("/api/v1/accept-invitation"):
        return "auth"
    
    # Payment initiation - very strict (POST /payments, POST /payments/, POST /payments/initiate)
    if method_upper == "POST" and (
        path_lower == "/api/v1/payments" or 
        path_lower == "/api/v1/payments/" or 
        path_lower.startswith("/api/v1/payments/initiate")
    ):
        return "payment_init"
    
    # Payment status polling - moderate
    if method_upper == "GET" and path_lower.startswith("/api/v1/payments/check-status"):
        return "payment_status"
    
    # Admin CRUD - moderate
    if path_lower.startswith("/api/v1/admin"):
        return "admin"
    
    # Default to general
    return "general"

# --- Rate Limit Configuration by Category ---
RATE_LIMIT_CONFIG: Dict[RateLimitCategory, Tuple[int, int]] = {
    "infrastructure": (0, 0),  # No rate limiting
    "public_read": (settings.RATE_LIMIT_PUBLIC_READ_REQUESTS, settings.RATE_LIMIT_PUBLIC_READ_WINDOW),
    "auth": (settings.RATE_LIMIT_AUTH_REQUESTS, settings.RATE_LIMIT_AUTH_WINDOW),
    "payment_init": (settings.RATE_LIMIT_PAYMENT_INIT_REQUESTS, settings.RATE_LIMIT_PAYMENT_INIT_WINDOW),
    "payment_status": (settings.RATE_LIMIT_PAYMENT_STATUS_REQUESTS, settings.RATE_LIMIT_PAYMENT_STATUS_WINDOW),
    "admin": (settings.RATE_LIMIT_ADMIN_REQUESTS, settings.RATE_LIMIT_ADMIN_WINDOW),
    "general": (settings.RATE_LIMIT_GENERAL_REQUESTS, settings.RATE_LIMIT_GENERAL_WINDOW),
}

# --- In-Memory Fallback (used when Redis is unavailable) ---
_in_memory_limits: Dict[str, Tuple[int, float]] = {}
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
        expired = [k for k, (_, ws) in _in_memory_limits.items() if now - ws > 300]  # 5 minute max window
        for k in expired:
            del _in_memory_limits[k]


def _check_in_memory(
    key: str,
    max_requests: int,
    window_seconds: float
) -> bool:
    """
    Check in-memory rate limit. Returns True if ALLOWED, False if blocked.
    Uses a sliding window approach.
    """
    now = time.time()
    if key not in _in_memory_limits:
        _in_memory_limits[key] = (1, now)
        return True
    count, window_start = _in_memory_limits[key]
    if now - window_start > window_seconds:
        _in_memory_limits[key] = (1, now)
        return True
    if count >= max_requests:
        return False
    _in_memory_limits[key] = (count + 1, window_start)
    return True


async def _check_redis_rate_limit(
    redis_client: Redis,
    key: str,
    max_requests: int,
    window_seconds: int,
) -> bool | None:
    """
    Redis-based sliding window rate limit using INCR + EXPIRE.
    Returns True if ALLOWED, False if blocked, None if error.
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
    Route-specific rate limiting middleware with category-based policies.
    
    Categories:
    - infrastructure: Excluded (OPTIONS, WebSocket, health, docs, webhooks)
    - public_read: Relaxed (300 req/min) for public GET endpoints
    - auth: Strict (10 req/min) for authentication endpoints
    - payment_init: Very strict (5 req/min) for payment initiation
    - payment_status: Moderate (30 req/min) for payment status polling
    - admin: Moderate (50 req/min) for admin CRUD
    - general: Default (100 req/min) for other endpoints
    
    Primary: Redis INCR/EXPIRE for atomic, multi-worker-safe counting.
    Fallback: In-memory dict if Redis is unavailable (single-worker only).
    
    Security: Uses composite keys (IP + identifier) for sensitive endpoints.
    """
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        # Extract real client IP (handles reverse proxies)
        client_ip = get_client_ip(request)
        path = request.url.path
        method = request.method
        
        # Classify the route
        category = classify_route(method, path)
        
        # Infrastructure requests bypass rate limiting entirely
        if category == "infrastructure":
            return await call_next(request)
        
        # Get rate limit configuration for this category
        max_requests, window_seconds = RATE_LIMIT_CONFIG[category]
        
        # Build composite rate limit key based on category
        rate_limit_key = await self._build_rate_limit_key(request, category, client_ip, path)
        
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
            redis_ok = await self._check_redis(rate_limit_key, max_requests, window_seconds, redis_client)
            if redis_ok is False:
                # Blocked by Redis
                return self._rate_limit_response(client_ip, category, max_requests, window_seconds)
        
        # In-memory fallback
        if redis_ok is not True:
            _cleanup_in_memory()
            with _fallback_lock:
                allowed = _check_in_memory(
                    rate_limit_key,
                    max_requests,
                    window_seconds
                )
                if not allowed:
                    return self._rate_limit_response(client_ip, category, max_requests, window_seconds)
        
        return await call_next(request)
    
    async def _build_rate_limit_key(
        self,
        request: Request,
        category: RateLimitCategory,
        client_ip: str,
        path: str
    ) -> str:
        """
        Build a composite rate limit key based on the category.
        
        - auth: IP + email (from request body)
        - payment_init: IP + phone (from request body)
        - payment_status: IP + reference (from URL path)
        - others: IP-only
        """
        # Auth: IP + email
        if category == "auth":
            try:
                body = await request.json()
                email = body.get("email", "unknown")
                return f"rl:auth:{client_ip}:{email}"
            except Exception:
                # Fallback to IP-only if body parsing fails
                return f"rl:auth:{client_ip}"
        
        # Payment initiation: IP + phone
        if category == "payment_init":
            try:
                body = await request.json()
                phone = body.get("voter_phone", "unknown")
                return f"rl:payment_init:{client_ip}:{phone}"
            except Exception:
                # Fallback to IP-only if body parsing fails
                return f"rl:payment_init:{client_ip}"
        
        # Payment status: IP + reference (from URL path)
        if category == "payment_status":
            # Extract reference from path: /api/v1/payments/check-status/{reference}
            parts = path.split("/")
            if len(parts) >= 6:
                reference = parts[5]  # /api/v1/payments/check-status/{reference}
                return f"rl:payment_status:{client_ip}:{reference}"
            return f"rl:payment_status:{client_ip}"
        
        # Default: IP-only
        return f"rl:{category}:{client_ip}"
    
    async def _check_redis(
        self,
        rate_limit_key: str,
        max_requests: int,
        window_seconds: int,
        redis_client: Redis,
    ) -> Optional[bool]:
        """Check rate limit via Redis. Returns True/False/None (error)."""
        try:
            return await _check_redis_rate_limit(redis_client, rate_limit_key, max_requests, window_seconds)
        except Exception as e:
            logger.warning(f"Redis rate limit error: {e}")
            return None
    
    @staticmethod
    def _rate_limit_response(
        client_ip: str,
        category: RateLimitCategory,
        max_requests: int,
        window_seconds: int,
    ) -> JSONResponse:
        """Return user-friendly rate limit response with Retry-After header."""
        retry_after = window_seconds
        
        # User-friendly messages by category
        user_messages = {
            "public_read": {
                "title": "Please wait a moment",
                "message": "We're processing your recent requests. Please try again shortly.",
            },
            "auth": {
                "title": "Too many authentication attempts",
                "message": "For your security, please wait before trying again.",
            },
            "payment_init": {
                "title": "Too many payment attempts",
                "message": "For your security, please wait before trying another payment.",
            },
            "payment_status": {
                "title": "Please wait a moment",
                "message": "We're checking your payment status. Please try again shortly.",
            },
            "admin": {
                "title": "Please wait a moment",
                "message": "We're processing your recent requests. Please try again shortly.",
            },
            "general": {
                "title": "Please wait a moment",
                "message": "We're processing your recent requests. Please try again shortly.",
            },
        }
        
        msg = user_messages.get(category, user_messages["general"])
        
        # Log detailed information server-side
        logger.warning(
            f"Rate limit exceeded | Category: {category} | IP: {client_ip} | "
            f"Limit: {max_requests}/{window_seconds}s"
        )
        
        response = JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "code": "RATE_LIMITED",
                "title": msg["title"],
                "message": msg["message"],
                "retryAfter": retry_after,
            }
        )
        response.headers["Retry-After"] = str(retry_after)
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware generating unique request IDs, tracking duration,
    enforcing security headers, and writing standard logging formats.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Bypass Socket.IO long-polling requests from custom headers/logging locks
        if request.url.path.startswith("/socket.io"):
            return await call_next(request)

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
        
        # Content Security Policy - restrictive for production
        if settings.DEBUG:
            # More permissive CSP for development
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.redoc.ly; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self' https://api.redoc.ly https://*.supabase.co wss://*.supabase.co; "
                "frame-ancestors 'none';"
            )
        else:
            # Strict CSP for production
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.redoc.ly; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self' https://api.redoc.ly; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        response.headers["Content-Security-Policy"] = csp
        
        # HSTS - only in production with HTTPS
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Additional security headers
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Extract real client IP (handles reverse proxies)
        client_ip = get_client_ip(request)
        user_id = getattr(request.state, "user_id", "anonymous")
        
        logger.info(
            f"REQID: {request_id} | USERID: {user_id} | IP: {client_ip} | "
            f"METHOD: {request.method} | PATH: {request.url.path} | "
            f"STATUS: {response.status_code} | DURATION: {process_time:.4f}s"
        )
        
        return response
