import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    """Fail fast if a required secret is not set."""
    val = os.getenv(name, "")
    if not val:
        print(f"FATAL: Required environment variable '{name}' is not set. Refusing to start.", file=sys.stderr)
        sys.exit(1)
    return val


class Settings(BaseSettings):
    """
    Application configurations managed via pydantic-settings.
    Secrets and configurations are loaded from system environment or a .env file.
    """
    model_config = SettingsConfigDict(case_sensitive=True)

    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Digital Entertainment Voting Platform API")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL","")

    # Redis — used for distributed rate limiting across multiple workers
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Security — JWT_SECRET_KEY has NO default; app refuses to start without it
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    # Production should use 15-60 min access tokens with refresh token rotation.
    # Development defaults to 1440 (24 hours) for convenience
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440" if DEBUG else "15"))
    # Refresh token expiration (default 7 days)
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    # Cookie security settings - MUST be true in production
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "true" if not DEBUG else "false").lower() in ("true", "1", "yes")

    # CORS & Trusted Hosts
    # In production, always specify exact domains - no wildcards
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000" if DEBUG else "")  # Comma-separated, e.g. "https://myapp.com,https://admin.myapp.com"
    ALLOWED_HOSTS: str = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")  # Comma-separated, e.g. "myapp.com,admin.myapp.com"
    
    # Test Mode Configuration
    # When DEBUG=true, payments use test mode without real money
    # Set TEST_PAYMENT_MODE=false to force real payments even in development
    TEST_PAYMENT_MODE: bool = os.getenv("TEST_PAYMENT_MODE", "true" if DEBUG else "false").lower() in ("true", "1", "yes")

    # Bootstrap — allows initial admin registration when no admins exist
    BOOTSTRAP_TOKEN: str = os.getenv("BOOTSTRAP_TOKEN", "")

    # Paynow Zimbabwe
    PAYNOW_INTEGRATION_ID: str = os.getenv("PAYNOW_INTEGRATION_ID", "")
    PAYNOW_INTEGRATION_KEY: str = os.getenv("PAYNOW_INTEGRATION_KEY", "")
    PAYNOW_RESULT_URL: str = os.getenv("PAYNOW_RESULT_URL", "")
    PAYNOW_RETURN_URL: str = os.getenv("PAYNOW_RETURN_URL", "")

    # Email Configuration (Resend HTTPS API — Railway blocks raw SMTP ports)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Voting Platform")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Database pool settings (used for PostgreSQL; ignored by SQLite)
    # Increased for Supabase/production workloads
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "40"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", "100"))

    # Upload Configuration
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/var/www/uploads")
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB default
    ALLOWED_IMAGE_TYPES: list = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    MAX_IMAGE_DIMENSION: int = int(os.getenv("MAX_IMAGE_DIMENSION", "4096"))  # 4K max dimension

    # Video Configuration
    MAX_VIDEO_SIZE: int = int(os.getenv("MAX_VIDEO_SIZE", "104857600"))  # 100MB default
    ALLOWED_VIDEO_FORMATS: list = ["mp4", "webm", "mov", "avi"]
    MAX_VIDEO_DURATION: int = int(os.getenv("MAX_VIDEO_DURATION", "300"))  # 5 minutes in seconds

    # Cloudflare R2 Storage Configuration
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "")
    R2_PUBLIC_URL: str = os.getenv("R2_PUBLIC_URL", "")

    # Payment Configuration
    MIN_PAYMENT_AMOUNT: float = float(os.getenv("MIN_PAYMENT_AMOUNT", "0.5"))  # $0.50 minimum

    # Cheat Mode Configuration
    CHEAT_MODE_ENABLED: bool = os.getenv("CHEAT_MODE_ENABLED", "false").lower() in ("true", "1", "yes")

    # Rate Limiting Configuration
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))  # Requests per window
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # Seconds
    VIDEO_RATE_LIMIT_REQUESTS: int = int(os.getenv("VIDEO_RATE_LIMIT_REQUESTS", "10"))  # Video requests per window
    VIDEO_RATE_LIMIT_WINDOW: int = int(os.getenv("VIDEO_RATE_LIMIT_WINDOW", "60"))  # Seconds

    def validate_secrets(self) -> None:
        """
        Call this at startup (after loading .env) to fail-fast on missing secrets.
        Enforces JWT_SECRET_KEY, Paynow credentials, and CORS settings in non-debug mode.
        """
        if not self.DEBUG:
            missing = []
            if not self.JWT_SECRET_KEY:
                missing.append("JWT_SECRET_KEY")
            if not self.PAYNOW_INTEGRATION_ID:
                missing.append("PAYNOW_INTEGRATION_ID")
            if not self.PAYNOW_INTEGRATION_KEY:
                missing.append("PAYNOW_INTEGRATION_KEY")
            if not self.CORS_ORIGINS:
                missing.append("CORS_ORIGINS")
            if not self.ALLOWED_HOSTS:
                missing.append("ALLOWED_HOSTS")
            if missing:
                print(
                    f"FATAL: Required environment variables not set in non-debug mode: "
                    f"{', '.join(missing)}. Set them in your .env file or environment.",
                    file=sys.stderr,
                )
                sys.exit(1)


settings = Settings()