"""CampusConnect Application Settings and Configuration

Validated via Pydantic Settings from environment variables.
"""

from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Core Application
    APP_NAME: str = "CampusConnect"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security
    SECRET_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="Must be at least 32 characters in production",
    )
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    CORS_ORIGINS: List[str] = ["http://localhost:8000", "http://127.0.0.1:8000"]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./campusconnect.db"

    # Server-Side Sessions & Cookies
    SESSION_COOKIE_NAME: str = "campus_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_MAX_AGE_SECONDS: int = 86400  # 24 hours

    # CSRF Protection
    CSRF_COOKIE_NAME: str = "campus_csrf"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"

    # File Storage
    STORAGE_DIR: str = "./storage/uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_FILE_EXTENSIONS: List[str] = ["pdf", "jpg", "jpeg", "png"]
    MAX_ATTACHMENTS_PER_ITEM: int = 5

    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_RESET: str = "3/minute"

    # Email
    DEV_EMAIL_CONSOLE: bool = True
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@campusconnect.edu"
    SMTP_USE_TLS: bool = False

    @field_validator("CORS_ORIGINS", "ALLOWED_HOSTS", mode="before")
    @classmethod
    def parse_list(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return [item.strip() for item in v.split(",") if item.strip()]
        return v


settings = Settings()
