"""Audit and metrics models."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from decimal import Decimal
import ipaddress

from sqlmodel import SQLModel, Field, JSON, Column


class AuditLog(SQLModel, table=True):
    """Audit log model."""
    __tablename__ = "audit_logs"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: Optional[UUID] = Field(foreign_key="organizations.id")
    actor_user_id: Optional[UUID] = Field(foreign_key="auth.users.id")
    actor_type: str = Field(default="user", max_length=50)
    action: str = Field(max_length=100)
    resource_type: str = Field(max_length=100)
    resource_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = Field(foreign_key="auth.users.id")
    changes: Optional[Dict[str, Any]] = Field(sa_column=Column(JSON))
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    ip_address: Optional[str] = None  # Store as string, validate as IP
    user_agent: Optional[str] = None
    session_id: Optional[str] = Field(max_length=200)
    correlation_id: Optional[UUID] = None
    severity: str = Field(default="info", max_length=20)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MetricData(SQLModel, table=True):
    """Metrics data model."""
    __tablename__ = "metrics_data"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: Optional[UUID] = Field(foreign_key="organizations.id")
    metric_name: str = Field(max_length=200)
    metric_type: str = Field(default="counter", max_length=50)
    value: Decimal = Field(decimal_places=6, max_digits=26)
    unit: Optional[str] = Field(max_length=50)
    dimensions: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    retention_days: int = Field(default=90)
    created_at: datetime = Field(default_factory=datetime.utcnow)