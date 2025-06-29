"""AI governance models."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from decimal import Decimal

from sqlmodel import SQLModel, Field, JSON, Column


class Policy(SQLModel, table=True):
    """AI governance policy model."""
    __tablename__ = "policies"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=200)
    description: Optional[str] = None
    policy_type: str = Field(default="content_filter", max_length=50)
    rules: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    conditions: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    actions: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    priority: int = Field(default=100)
    is_enabled: bool = Field(default=True)
    applies_to: List[str] = Field(default_factory=lambda: ["all"], sa_column=Column(JSON))
    version: str = Field(default="1.0", max_length=20)
    created_by: UUID = Field(foreign_key="auth.users.id")
    last_modified_by: Optional[UUID] = Field(foreign_key="auth.users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class Evaluator(SQLModel, table=True):
    """AI model evaluator model."""
    __tablename__ = "evaluators"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    name: str = Field(max_length=200)
    description: Optional[str] = None
    evaluator_type: str = Field(max_length=50)
    provider: str = Field(max_length=100)
    model_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    prompt_template: Optional[str] = None
    threshold_config: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_enabled: bool = Field(default=True)
    cost_per_evaluation: Optional[Decimal] = Field(decimal_places=6, max_digits=10)
    avg_response_time_ms: Optional[int] = None
    success_rate: Decimal = Field(default=Decimal("1.0"), decimal_places=4, max_digits=5)
    total_evaluations: int = Field(default=0)
    created_by: UUID = Field(foreign_key="auth.users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None