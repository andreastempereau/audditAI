"""Authentication and organization schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# User schemas
class UserCreate(BaseModel):
    """User creation schema."""
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = None


class UserRead(BaseModel):
    """User read schema."""
    id: UUID
    email: Optional[str]
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    """User update schema."""
    email: Optional[EmailStr] = None
    name: Optional[str] = None


# Profile schemas
class ProfileRead(BaseModel):
    """Profile read schema."""
    id: UUID
    name: Optional[str]
    email: Optional[str]
    picture_url: Optional[str]
    first_time: bool
    mfa_enabled: bool
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    """Profile update schema."""
    name: Optional[str] = None
    picture_url: Optional[str] = None
    first_time: Optional[bool] = None


# Organization schemas
class OrganizationCreate(BaseModel):
    """Organization creation schema."""
    name: str = Field(min_length=1, max_length=255)


class OrganizationRead(BaseModel):
    """Organization read schema."""
    id: UUID
    name: str
    tier: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class OrganizationUpdate(BaseModel):
    """Organization update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    tier: Optional[str] = None


# Authentication schemas
class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead
    profile: Optional[ProfileRead] = None


class TokenResponse(BaseModel):
    """Token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordResetRequest(BaseModel):
    """Password reset request schema."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""
    token: str
    new_password: str = Field(min_length=8)


class MFASetupRequest(BaseModel):
    """MFA setup request schema."""
    totp_secret: str


class MFAVerifyRequest(BaseModel):
    """MFA verification request schema."""
    totp_code: str = Field(min_length=6, max_length=6)