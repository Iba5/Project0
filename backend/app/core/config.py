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
    # H4 FIX: Reduced from 11520 (8 days) to 1440 (24 hours).
    # Production should use 15-60 min access tokens with refresh token rotation.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # CORS & Trusted Hosts
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")  # Comma-separated, e.g. "https://myapp.com,https://admin.myapp.com"
    ALLOWED_HOSTS: str = os.getenv("ALLOWED_HOSTS", "*")  # Comma-separated, e.g. "myapp.com,admin.myapp.com"

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
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", "100"))

    def validate_secrets(self) -> None:
        """
        Call this at startup (after loading .env) to fail-fast on missing secrets.
        Enforces JWT_SECRET_KEY and Paynow credentials in non-debug mode.
        """
        if not self.DEBUG:
            missing = []
            if not self.JWT_SECRET_KEY:
                missing.append("JWT_SECRET_KEY")
            if not self.PAYNOW_INTEGRATION_ID:
                missing.append("PAYNOW_INTEGRATION_ID")
            if not self.PAYNOW_INTEGRATION_KEY:
                missing.append("PAYNOW_INTEGRATION_KEY")
            if missing:
                print(
                    f"FATAL: Required environment variables not set in non-debug mode: "
                    f"{', '.join(missing)}. Set them in your .env file or environment.",
                    file=sys.stderr,
                )
                sys.exit(1)


settings = Settings()