import time
import uuid
import logging
from typing import Dict, Tuple
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Simple in-memory storage for IP rate limiting
# Key: client_ip, Value: (request_count, window_start_time)
ip_rate_limits: Dict[str, Tuple[int, float]] = {}
LIMIT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 60

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    Middleware providing in-memory IP rate limiting.
    Blocks client IPs exceeding MAX_REQUESTS_PER_WINDOW in LIMIT_WINDOW_SECONDS.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        
        # Initialize or retrieve rate limiting state for IP
        if client_ip not in ip_rate_limits:
            ip_rate_limits[client_ip] = (1, now)
        else:
            count, window_start = ip_rate_limits[client_ip]
            if now - window_start > LIMIT_WINDOW_SECONDS:
                # Reset window
                ip_rate_limits[client_ip] = (1, now)
            else:
                if count >= MAX_REQUESTS_PER_WINDOW:
                    logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "success": False,
                            "message": "Too many requests. Please try again later.",
                            "errors": []
                        }
                    )
                ip_rate_limits[client_ip] = (count + 1, window_start)

        return await call_next(request)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware generating unique request IDs, tracking duration,
    enforcing security headers, and writing standard logging formats.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
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
        response.headers["Content-Security-Policy"] = "default-src 'self'"
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
