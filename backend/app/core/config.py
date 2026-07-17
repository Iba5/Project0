import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    """
    Application configurations managed via pydantic-settings.
    Secrets and configurations are loaded from system environment or a .env file.
    """
    model_config = SettingsConfigDict(case_sensitive=True)

    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Digital Entertainment Voting Platform API")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./voting.db" # Default fallback for local testing
    )

    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-to-a-secure-random-key")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "11520")) # 8 days default

    # Paynow Zimbabwe
    PAYNOW_INTEGRATION_ID: str = os.getenv("PAYNOW_INTEGRATION_ID", "")
    PAYNOW_INTEGRATION_KEY: str = os.getenv("PAYNOW_INTEGRATION_KEY", "")
    PAYNOW_RESULT_URL: str = os.getenv("PAYNOW_RESULT_URL", "")
    PAYNOW_RETURN_URL: str = os.getenv("PAYNOW_RETURN_URL", "")

    # Email Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Voting Platform")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

settings = Settings()
