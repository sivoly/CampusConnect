"""Phase 1 Architecture, Folder Tree, Schema, and Core Security Unit Tests."""

import os
from pathlib import Path
import pytest
from backend.app.core.config import Settings
from backend.app.core.security import (
    hash_password,
    verify_password,
    generate_random_token,
    hash_token,
    generate_csrf_token,
    constant_time_compare,
)
from backend.app.schemas.common import (
    UserRole,
    AccountStatus,
    ContentCategory,
    ContentStatus,
    AuditAction,
    ApiResponse,
    PaginationMeta,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def test_directory_structure_exists():
    """Verify that all architectural directories and critical files exist."""
    required_paths = [
        "backend/app/api",
        "backend/app/core",
        "backend/app/models",
        "backend/app/schemas",
        "backend/app/services",
        "backend/app/auth",
        "backend/app/db",
        "backend/migrations",
        "backend/tests",
        "frontend/css",
        "frontend/js",
        "frontend/pages",
        "storage/uploads",
        "docs/ARCHITECTURE.md",
        "docs/SCHEMA.md",
        "docker-compose.yml",
        ".env.example",
        ".gitignore",
        "requirements.txt",
        "README.md",
    ]
    for rel_path in required_paths:
        target = PROJECT_ROOT / rel_path
        assert target.exists(), f"Missing required architectural path: {rel_path}"


def test_settings_load_and_validation():
    """Verify Pydantic Settings defaults, types, and custom parsing."""
    settings = Settings()
    assert settings.APP_NAME == "CampusConnect"
    assert settings.PORT == 8000
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_MAX_AGE_SECONDS == 86400
    assert "pdf" in settings.ALLOWED_FILE_EXTENSIONS
    assert len(settings.CORS_ORIGINS) >= 1
    assert settings.MAX_ATTACHMENTS_PER_ITEM == 5


def test_argon2_password_hashing_and_verification():
    """Verify Argon2id password hashing and constant-time verification."""
    password = "SuperSecretCampusPassword!2026"
    hashed = hash_password(password)

    # Must start with argon2id prefix
    assert hashed.startswith("$argon2id$")
    assert hashed != password

    # Correct password succeeds
    assert verify_password(password, hashed) is True

    # Incorrect password fails
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_session_and_csrf_tokens():
    """Verify cryptographic token generation and SHA-256 token hashing."""
    token = generate_random_token(32)
    assert len(token) >= 32

    # Hashing token produces a 64-character SHA-256 hex string
    hashed_token = hash_token(token)
    assert len(hashed_token) == 64
    assert hash_token(token) == hashed_token  # Deterministic

    # CSRF token generation
    csrf = generate_csrf_token()
    assert len(csrf) == 64
    assert all(c in "0123456789abcdef" for c in csrf)

    # Constant time compare
    assert constant_time_compare(csrf, csrf) is True
    assert constant_time_compare(csrf, csrf[:-1] + "x") is False


def test_schema_enums():
    """Verify required business enums match the schema specification."""
    # Roles
    assert UserRole.STUDENT.value == "student"
    assert UserRole.STAFF.value == "staff"
    assert UserRole.ADMIN.value == "admin"

    # Account status
    assert AccountStatus.ACTIVE.value == "active"
    assert AccountStatus.INACTIVE.value == "inactive"

    # Content categories
    assert ContentCategory.NOTICE.value == "notice"
    assert ContentCategory.HALL_ALLOCATION.value == "hall_allocation"
    assert ContentCategory.EVENT.value == "event"
    assert ContentCategory.OTHER.value == "other"

    # Content status
    assert ContentStatus.DRAFT.value == "draft"
    assert ContentStatus.PUBLISHED.value == "published"


def test_standard_api_response_envelope():
    """Verify standard ApiResponse envelope serialization."""
    payload = {"sample_key": "sample_value"}
    response = ApiResponse(
        success=True,
        data=payload,
        message="Request succeeded",
        meta=PaginationMeta(page=1, page_size=20, total_items=1, total_pages=1),
    )
    dumped = response.model_dump()
    assert dumped["success"] is True
    assert dumped["data"]["sample_key"] == "sample_value"
    assert dumped["message"] == "Request succeeded"
    assert dumped["meta"]["page"] == 1
    assert dumped["meta"]["total_items"] == 1
