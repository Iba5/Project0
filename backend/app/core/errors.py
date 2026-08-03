import logging
import traceback
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error with structured error information."""
    
    def __init__(
        self,
        message: str,
        error_code: str = "APP_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(AppError):
    """Validation error for invalid user input."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details=details
        )


class NotFoundError(AppError):
    """Resource not found error."""
    
    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message += f": {identifier}"
        details = {"resource": resource, "identifier": identifier} if identifier else {"resource": resource}
        super().__init__(
            message=message,
            error_code="NOT_FOUND",
            status_code=404,
            details=details
        )


class AuthenticationError(AppError):
    """Authentication error."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=401
        )


class AuthorizationError(AppError):
    """Authorization error."""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=403
        )


class RateLimitError(AppError):
    """Rate limit exceeded error."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None):
        details = {"retry_after": retry_after} if retry_after else {}
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_ERROR",
            status_code=429,
            details=details
        )


class ExternalServiceError(AppError):
    """External service error (e.g., Paynow, R2, Email)."""
    
    def __init__(self, service: str, message: str):
        super().__init__(
            message=f"{service} error: {message}",
            error_code="EXTERNAL_SERVICE_ERROR",
            status_code=503,
            details={"service": service}
        )


def log_error(
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
    level: str = "ERROR"
) -> None:
    """
    Centralized error logging with context.
    
    Args:
        error: The exception that occurred
        context: Additional context information
        level: Log level (ERROR, WARNING, etc.)
    """
    log_func = getattr(logger, level.lower(), logger.error)
    
    error_info = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "context": context or {},
    }
    
    # Add stack trace for detailed errors
    if level == "ERROR" and not settings.DEBUG:
        error_info["stack_trace"] = traceback.format_exc()
    
    log_func(f"Error occurred: {error_info}", extra={"error_info": error_info})


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global error handler for FastAPI application.
    Converts exceptions to consistent JSON error responses.
    """
    # Handle application-specific errors
    if isinstance(exc, AppError):
        log_error(exc, context={"path": request.url.path, "method": request.method})
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details if settings.DEBUG else {}
                }
            }
        )
    
    # Handle HTTP exceptions
    if isinstance(exc, HTTPException):
        log_error(exc, context={"path": request.url.path, "method": request.method}, level="WARNING")
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": exc.detail,
                    "details": {}
                }
            }
        )
    
    # Handle database errors
    if isinstance(exc, SQLAlchemyError):
        log_error(exc, context={"path": request.url.path, "method": request.method})
        
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "A database error occurred. Please try again later.",
                    "details": {} if not settings.DEBUG else {"error": str(exc)}
                }
            }
        )
    
    # Handle unexpected errors
    log_error(exc, context={"path": request.url.path, "method": request.method})
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "details": {} if not settings.DEBUG else {"error": str(exc)}
            }
        }
    )


def safe_execute(func, *args, **kwargs):
    """
    Safely execute a function with error handling.
    Returns (success: bool, result: Any, error: Optional[Exception])
    """
    try:
        result = func(*args, **kwargs)
        return True, result, None
    except Exception as e:
        log_error(e, context={"function": func.__name__})
        return False, None, e