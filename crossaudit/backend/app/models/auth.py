"""Authentication and organization models."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    """User model - represents auth.users from Supabase."""
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: Optional[str] = None
    encrypted_password: Optional[str] = None
    email_confirmed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    profile: Optional["Profile"] = Relationship(back_populates="user")
    owned_organizations: List["Organization"] = Relationship(back_populates="owner")


class Profile(SQLModel, table=True):
    """User profile extending auth.users."""
    __tablename__ = "profiles"
    
    id: UUID = Field(foreign_key="auth.users.id", primary_key=True)
    name: Optional[str] = None
    email: Optional[str] = Field(unique=True)
    picture_url: Optional[str] = None
    first_time: bool = Field(default=True)
    mfa_enabled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="profile")


class Organization(SQLModel, table=True):
    """Organization model."""
    __tablename__ = "organizations"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    tier: str = Field(default="free")
    owner_id: UUID = Field(foreign_key="auth.users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    owner: Optional[User] = Relationship(back_populates="owned_organizations")
    members: List["UserOrganization"] = Relationship(back_populates="organization")


class UserOrganization(SQLModel, table=True):
    """User organization membership."""
    __tablename__ = "user_organizations"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="auth.users.id")
    org_id: UUID = Field(foreign_key="organizations.id")
    role: str = Field(default="member")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    organization: Optional[Organization] = Relationship(back_populates="members")