from typing import Generator, Dict, Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

# ---------------------------------------------------------------------------
# Database URL normalization
# ---------------------------------------------------------------------------
# Use Psycopg 3 for PostgreSQL if a standard PostgreSQL URL is provided.
database_url = settings.DATABASE_URL

if database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )

# ---------------------------------------------------------------------------
# SQLAlchemy engine configuration
# ---------------------------------------------------------------------------
engine_kwargs: Dict[str, Any] = {
    "pool_pre_ping": True,
}

if database_url.startswith("sqlite"):
    # SQLite doesn't support normal connection pooling.
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / MySQL production settings
    engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
        }
    )

engine = create_engine(database_url, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency injection to retrieve a request-scoped database session.
    Automatically rolls back on exceptions and closes the session when done.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()