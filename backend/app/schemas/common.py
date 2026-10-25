"""Common schemas, enums, and API response envelope for CampusConnect."""

from enum import Enum
from typing import Generic, Optional, TypeVar, List, Any
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class UserRole(str, Enum):
    STUDENT = "student"
    STAFF = "staff"
    ADMIN = "admin"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ContentCategory(str, Enum):
    NOTICE = "notice"
    HALL_ALLOCATION = "hall_allocation"
    EVENT = "event"
    OTHER = "other"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class AuditAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    PUBLISH = "publish"
    UNPUBLISH = "unpublish"
    DELETE = "delete"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_RESET_REQUEST = "password_reset_request"
    PASSWORD_RESET_COMPLETE = "password_reset_complete"
    ROLE_CHANGE = "role_change"
    STATUS_CHANGE = "status_change"
    SETTINGS_CHANGE = "settings_change"
    ATTACHMENT_UPLOAD = "attachment_upload"
    ATTACHMENT_DELETE = "attachment_delete"


class PaginationMeta(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    total_items: int = Field(0, ge=0)
    total_pages: int = Field(0, ge=0)


class ApiResponse(BaseModel, Generic[T]):
    """Standardized envelope for all CampusConnect API responses."""
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    errors: Optional[List[str]] = None
    meta: Optional[PaginationMeta] = None
