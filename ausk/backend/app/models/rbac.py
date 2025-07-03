"""RBAC (Role-Based Access Control) models."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, JSON, Column


class Permission(SQLModel, table=True):
    """System permission model."""
    __tablename__ = "permissions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, max_length=100)
    description: Optional[str] = None
    resource: str = Field(max_length=50)
    action: str = Field(max_length=50)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Role(SQLModel, table=True):
    """Organization role model."""
    __tablename__ = "roles"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=100)
    description: Optional[str] = None
    is_system_role: bool = Field(default=False)
    is_default: bool = Field(default=False)
    permissions: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class Department(SQLModel, table=True):
    """Organizational department model."""
    __tablename__ = "departments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=100)
    description: Optional[str] = None
    parent_department_id: Optional[UUID] = Field(foreign_key="departments.id")
    default_role_id: Optional[UUID] = Field(foreign_key="roles.id")
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class UserRole(SQLModel, table=True):
    """User role assignment model."""
    __tablename__ = "user_roles"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="auth.users.id")
    role_id: UUID = Field(foreign_key="roles.id")
    department_id: Optional[UUID] = Field(foreign_key="departments.id")
    granted_by: Optional[UUID] = Field(foreign_key="auth.users.id")
    granted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = Field(default=True)
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)