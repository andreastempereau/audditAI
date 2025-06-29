"""Admin and API management models."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, JSON, Column


class APIKey(SQLModel, table=True):
    """API key model."""
    __tablename__ = "api_keys"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=200)
    description: Optional[str] = None
    key_hash: str = Field(max_length=128)
    key_prefix: str = Field(max_length=20)
    provider: str = Field(max_length=100)
    scopes: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    rate_limit_rpm: Optional[int] = None
    rate_limit_rph: Optional[int] = None
    usage_count: int = Field(default=0)
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_by: UUID = Field(foreign_key="auth.users.id")
    is_active: bool = Field(default=True)
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class Webhook(SQLModel, table=True):
    """Webhook configuration model."""
    __tablename__ = "webhooks"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=200)
    url: str
    secret_hash: str = Field(max_length=128)
    events: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    content_type: str = Field(default="application/json", max_length=50)
    timeout_seconds: int = Field(default=30)
    retry_config: Dict[str, Any] = Field(
        default_factory=lambda: {"max_attempts": 3, "backoff_seconds": [1, 5, 25]},
        sa_column=Column(JSON)
    )
    headers: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    last_triggered_at: Optional[datetime] = None
    total_deliveries: int = Field(default=0)
    successful_deliveries: int = Field(default=0)
    created_by: UUID = Field(foreign_key="auth.users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class WebhookEvent(SQLModel, table=True):
    """Webhook delivery event model."""
    __tablename__ = "webhook_events"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    webhook_id: UUID = Field(foreign_key="webhooks.id")
    event_type: str = Field(max_length=100)
    payload: Dict[str, Any] = Field(sa_column=Column(JSON))
    attempt_number: int = Field(default=1)
    http_status: Optional[int] = None
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, str]] = Field(sa_column=Column(JSON))
    delivery_duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    is_successful: bool = Field(default=False)
    scheduled_at: datetime = Field(default_factory=datetime.utcnow)
    attempted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)