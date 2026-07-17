import logging
import time
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.sql import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.api.v1.api import api_router
from app.middleware.middleware import RequestLoggingMiddleware, RateLimitingMiddleware
from app.exceptions.exceptions import VotingException, NotFoundException, AuthenticationException, AuthorizationException

# Setup application start time for health uptime calculation
APP_START_TIME = time.time()

# Configure logging format and default level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for managing contestants, events, payments, and vote allocations.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# --- Middleware Registrations ---

# 1. Trusted Hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] # Adjust in production config
)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. GZip Compression
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000
)

# 4. In-Memory IP Rate Limiter
app.add_middleware(
    RateLimitingMiddleware
)

# 5. Security Headers, Request ID, and Logging Policy Enforcer
app.add_middleware(
    RequestLoggingMiddleware
)

# Redirect to HTTPS in production
if not settings.DEBUG:
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# Global router inclusion
app.include_router(api_router, prefix=settings.API_V1_STR)

# --- Standardized Exception Handlers ---

@app.exception_handler(VotingException)
async def voting_exception_handler(request: Request, exc: VotingException):
    """
    Standardized handler for custom business logic exceptions.
    """
    logger.warning(f"Business logic exception on {request.url.path}: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "errors": exc.errors
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Standardized handler for FastAPI validation failures.
    """
    logger.warning(f"Validation failure on {request.url.path}: {exc.errors()}")
    errors_list = [
        {"field": " -> ".join(map(str, err["loc"])), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error occurred.",
            "errors": errors_list
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Central fallback exception handler preventing stack traces and technical details leaks.
    """
    logger.exception(f"Unhandled system exception on {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An internal server error occurred. Please contact support.",
            "errors": []
        }
    )

# --- Production Infrastructure Endpoints ---

@app.get("/health", tags=["health"])
def health_check():
    """
    Public health check monitoring endpoint validating API, Database, and mock Storage state.
    """
    uptime = time.time() - APP_START_TIME
    db_status = "connected"
    
    # Try querying the DB
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        logger.error(f"Health Check DB failure: {str(e)}")
        db_status = "disconnected"
        
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "storage": "connected", # Placeholder for Supabase Storage check
        "version": "1.0.0",
        "uptime": f"{uptime:.2f}s"
    }

@app.get("/")
def root_redirect():
    return {"message": "Digital Entertainment Voting Platform API root. Navigate to /api/v1/docs for OpenAPI specs."}
