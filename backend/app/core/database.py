from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.core.config import settings

# In PostgreSQL, we want to enable pool_pre_ping to automatically handle drops in connection.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    # If sqlite is used as local fallback, we disable thread-checking
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
