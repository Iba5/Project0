import logging
import time
from contextlib import asynccontextmanager
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

# Validate critical secrets at import time (fails fast before any route is registered)
settings.validate_secrets()

# Setup application start time for health uptime calculation
APP_START_TIME = time.time()

# Configure logging format and default level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# H6 FIX: Use lifespan context manager instead of deprecated @app.on_event("startup")
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Redis connection at startup (non-blocking — middleware falls back to in-memory)."""
    from app.core.redis import init_redis
    init_redis()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for managing contestants, events, payments, and vote allocations.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# --- Middleware Registrations ---

# Parse allowed hosts from comma-separated env var
_allowed_hosts = [h.strip() for h in settings.ALLOWED_HOSTS.split(",") if h.strip()]

# 1. Trusted Hosts
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

# Parse CORS origins from comma-separated env var
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. GZip Compression
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000
)

# 4. Redis-Backed IP Rate Limiter (falls back to in-memory if Redis is down)
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
    
    # Try querying the DB with proper resource cleanup
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health Check DB failure: {str(e)}")
        db_status = "disconnected"
    finally:
        db.close()
        
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "storage": "connected",  # Placeholder for Supabase Storage check
        "version": "1.0.0",
        "uptime": f"{uptime:.2f}s"
    }

@app.get("/")
def root_redirect():
    return {"message": "Digital Entertainment Voting Platform API root. Navigate to /api/v1/docs for OpenAPI specs."}