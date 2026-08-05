import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Ensure test environment settings are set BEFORE app/main is imported
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver,*"
os.environ["BOOTSTRAP_TOKEN"] = "test-bootstrap-token"
os.environ["REDIS_URL"] = ""
os.environ["R2_ACCOUNT_ID"] = ""
os.environ["R2_ACCESS_KEY_ID"] = ""
os.environ["R2_SECRET_ACCESS_KEY"] = ""
os.environ["R2_BUCKET_NAME"] = ""
os.environ["UPLOAD_DIR"] = "/tmp/test_uploads"

from app.core.config import settings
settings.ALLOWED_HOSTS = "localhost,127.0.0.1,testserver,*"
settings.BOOTSTRAP_TOKEN = "test-bootstrap-token"
settings.REDIS_URL = ""
settings.R2_ACCOUNT_ID = ""
settings.R2_ACCESS_KEY_ID = ""
settings.R2_SECRET_ACCESS_KEY = ""
settings.R2_BUCKET_NAME = ""
settings.UPLOAD_DIR = "/tmp/test_uploads"


from app.core.database import Base, get_db
from app.main import app

from sqlalchemy.pool import StaticPool

# Use in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)

from unittest.mock import patch

@pytest.fixture(scope="session", autouse=True)
def disable_redis_for_tests():
    """Bypass external Redis connections during test suite runs for speed and stability."""
    with patch("app.core.redis.init_redis", return_value=None), \
         patch("app.core.redis.close_redis", return_value=None):
        yield


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """Create all tables per test function for full isolation."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provides a transactional DB session that rolls back after each test."""
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    Overrides get_db dependency in FastAPI app with scoped db_session fixture.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()