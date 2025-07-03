"""Pydantic schemas for request/response models."""

from .base import BaseResponse, PaginatedResponse, ErrorResponse
from .auth import (
    UserCreate, UserRead, UserUpdate,
    ProfileRead, ProfileUpdate,
    OrganizationCreate, OrganizationRead, OrganizationUpdate,
    LoginRequest, LoginResponse, TokenResponse
)
from .chat import (
    ChatThreadCreate, ChatThreadRead, ChatThreadUpdate,
    ChatMessageCreate, ChatMessageRead, 
    TypingIndicator, WebSocketMessage
)
from .documents import (
    DocumentCreate, DocumentRead, DocumentUpdate,
    DocumentVersionRead, FragmentRead, FragmentSearch,
    FileUploadResponse
)
from .rbac import (
    PermissionRead, RoleCreate, RoleRead, RoleUpdate,
    DepartmentCreate, DepartmentRead, DepartmentUpdate,
    UserRoleCreate, UserRoleRead, EffectivePermissions
)
from .admin import (
    APIKeyCreate, APIKeyRead, APIKeyUpdate,
    WebhookCreate, WebhookRead, WebhookUpdate,
    WebhookEventRead, BillingInfo
)
from .audit import AuditLogRead, MetricRead, MetricsOverview

__all__ = [
    # Base
    "BaseResponse",
    "PaginatedResponse", 
    "ErrorResponse",
    # Auth
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "ProfileRead",
    "ProfileUpdate",
    "OrganizationCreate",
    "OrganizationRead",
    "OrganizationUpdate",
    "LoginRequest",
    "LoginResponse",
    "TokenResponse",
    # Chat
    "ChatThreadCreate",
    "ChatThreadRead",
    "ChatThreadUpdate",
    "ChatMessageCreate",
    "ChatMessageRead",
    "TypingIndicator",
    "WebSocketMessage",
    # Documents
    "DocumentCreate",
    "DocumentRead",
    "DocumentUpdate",
    "DocumentVersionRead",
    "FragmentRead",
    "FragmentSearch",
    "FileUploadResponse",
    # RBAC
    "PermissionRead",
    "RoleCreate",
    "RoleRead",
    "RoleUpdate",
    "DepartmentCreate",
    "DepartmentRead",
    "DepartmentUpdate",
    "UserRoleCreate",
    "UserRoleRead",
    "EffectivePermissions",
    # Admin
    "APIKeyCreate",
    "APIKeyRead",
    "APIKeyUpdate",
    "WebhookCreate",
    "WebhookRead",
    "WebhookUpdate",
    "WebhookEventRead",
    "BillingInfo",
    # Audit
    "AuditLogRead",
    "MetricRead",
    "MetricsOverview",
]