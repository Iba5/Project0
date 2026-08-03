import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.sql import text
import socketio

from app.core.config import settings
from app.core.database import SessionLocal
from app.api.v1.api import api_router
from app.middleware.middleware import RequestLoggingMiddleware, RateLimitingMiddleware
from app.exceptions.exceptions import VotingException
from app.core.errors import app_error_handler

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


# Lifespan context manager replacing deprecated @app.on_event
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.redis import init_redis, close_redis

    await init_redis()

    try:
        yield
    finally:
        await close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for managing contestants, events, payments, and vote allocations.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
    redirect_slashes=False,
)

# --- Socket.IO Engine Initialization ---
# Parse CORS origins for Socket.IO
_socketio_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS else []

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=_socketio_cors_origins if not settings.DEBUG else '*',
    always_connect=True
)

# FIX: Set socketio_path="" so ASGIApp routes requests relative to where FastAPI mounts it (/socket.io)
sio_app = socketio.ASGIApp(socketio_server=sio, socketio_path="")

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

# 4. Redis-Backed IP Rate Limiter
app.add_middleware(
    RateLimitingMiddleware
)

# 5. Security Headers, Request ID, and Logging Policy Enforcer
app.add_middleware(
    RequestLoggingMiddleware
)

# Global router inclusion
app.include_router(api_router, prefix=settings.API_V1_STR)

# --- Socket.IO Routing & Mount ---
# Mount Socket.IO directly onto the FastAPI application
app.mount("/socket.io", sio_app)

# --- Socket.IO Event Handlers ---

@sio.event
async def connect(sid, environ):
    logger.info(f"[Socket.IO] Client connected safely: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"[Socket.IO] Client disconnected safely: {sid}")

@sio.on("join:participant")
async def handle_join_participant(sid, participant_id):
    logger.info(f"[Socket.IO] Client {sid} joining channel room: {participant_id}")
    await sio.enter_room(sid, participant_id)

@sio.on("leave:participant")
async def handle_leave_participant(sid, participant_id):
    logger.info(f"[Socket.IO] Client {sid} leaving channel room: {participant_id}")
    await sio.leave_room(sid, participant_id)

# --- Standardized Exception Handlers ---

@app.exception_handler(VotingException)
async def voting_exception_handler(request: Request, exc: VotingException):
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
    logger.warning(f"Validation failure on {request.url.path}: {exc.errors()}")
    errors_list: List[Dict[str, Any]] = [
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

# Add our comprehensive error handler
app.add_exception_handler(Exception, app_error_handler)

# --- Production Infrastructure Endpoints ---

@app.get("/health", tags=["health"])
def health_check():
    uptime = time.time() - APP_START_TIME
    db_status = "connected"
    
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
        "storage": "connected",
        "version": "1.0.0",
        "uptime": f"{uptime:.2f}s"
    }

@app.get("/")
def root_redirect():
    return {"message": "Digital Entertainment Voting Platform API root. Navigate to /api/v1/docs for OpenAPI specs."}