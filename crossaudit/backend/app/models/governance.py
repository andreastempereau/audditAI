"""Models for AI governance, policies, evaluators, billing, and security."""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship, Column, JSON, ARRAY, String


class EncryptionKey(SQLModel, table=True):
    """Encryption keys for customer data."""
    __tablename__ = "encryption_keys"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    key_name: str = Field(max_length=255)
    key_version: int = Field(default=1)
    encrypted_key: bytes
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


class SecretsManager(SQLModel, table=True):
    """Encrypted secrets storage."""
    __tablename__ = "secrets_manager"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    secret_name: str = Field(max_length=255)
    secret_type: str = Field(max_length=50)  # 'api_key', 'oauth_token', 'webhook_secret'
    encrypted_value: bytes
    encryption_key_id: UUID = Field(foreign_key="encryption_keys.id")
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


class Evaluator(SQLModel, table=True):
    """LLM Evaluator configurations."""
    __tablename__ = "evaluators"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=255)
    evaluator_type: str = Field(max_length=50)  # 'openai', 'anthropic', 'gemini', 'local_llm'
    model_name: str = Field(max_length=255)
    endpoint_url: Optional[str] = Field(max_length=500)
    api_key_secret_id: Optional[UUID] = Field(foreign_key="secrets_manager.id")
    configuration: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_by: Optional[UUID] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class EvaluatorPool(SQLModel, table=True):
    """Evaluator pool configurations."""
    __tablename__ = "evaluator_pools"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=255)
    description: Optional[str]
    evaluator_ids: List[UUID] = Field(sa_column=Column(ARRAY(String)))
    load_balancing_strategy: str = Field(default="round_robin")  # 'round_robin', 'weighted', 'fastest'
    timeout_ms: int = Field(default=800)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Policy(SQLModel, table=True):
    """AI Governance Policies with YAML DSL."""
    __tablename__ = "policies"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=255)
    description: Optional[str]
    policy_yaml: str  # YAML policy definition
    parsed_config: Dict[str, Any] = Field(sa_column=Column(JSON))  # Parsed YAML for fast access
    priority: int = Field(default=100)  # Lower number = higher priority
    is_active: bool = Field(default=True)
    evaluator_pool_id: Optional[UUID] = Field(foreign_key="evaluator_pools.id")
    created_by: Optional[UUID] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PolicyEvaluation(SQLModel, table=True):
    """Policy evaluation results."""
    __tablename__ = "policy_evaluations"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    policy_id: UUID = Field(foreign_key="policies.id")
    user_id: Optional[UUID] = Field(foreign_key="users.id")
    thread_id: Optional[UUID] = Field(foreign_key="chat_threads.id")
    message_id: Optional[UUID] = Field(foreign_key="chat_messages.id")
    input_text: str
    generated_text: Optional[str]
    final_text: Optional[str]
    action_taken: str  # 'allow', 'block', 'rewrite', 'redact'
    severity: str  # 'low', 'medium', 'high', 'critical'
    evaluator_scores: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    processing_time_ms: Optional[int]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PolicyViolation(SQLModel, table=True):
    """Policy violation tracking."""
    __tablename__ = "policy_violations"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    policy_evaluation_id: UUID = Field(foreign_key="policy_evaluations.id")
    violation_type: str = Field(max_length=100)
    severity: str = Field(max_length=20)
    rule_matched: str
    confidence_score: Optional[Decimal] = Field(max_digits=5, decimal_places=4)
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubscriptionPlan(SQLModel, table=True):
    """Subscription plans."""
    __tablename__ = "subscription_plans"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True)  # 'starter', 'business', 'enterprise'
    display_name: str = Field(max_length=255)
    description: Optional[str]
    price_monthly: Optional[Decimal] = Field(max_digits=10, decimal_places=2)
    price_yearly: Optional[Decimal] = Field(max_digits=10, decimal_places=2)
    quotas: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    features: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Subscription(SQLModel, table=True):
    """Organization subscriptions."""
    __tablename__ = "subscriptions"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", unique=True)
    plan_id: UUID = Field(foreign_key="subscription_plans.id")
    stripe_subscription_id: Optional[str] = Field(max_length=255, unique=True)
    stripe_customer_id: Optional[str] = Field(max_length=255)
    status: str = Field(default="active")  # 'active', 'past_due', 'canceled', 'incomplete'
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UsageRecord(SQLModel, table=True):
    """Usage tracking for billing."""
    __tablename__ = "usage_records"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    subscription_id: UUID = Field(foreign_key="subscriptions.id")
    usage_type: str = Field(max_length=100)  # 'tokens', 'storage', 'evaluator_calls', 'api_calls'
    quantity: Decimal = Field(max_digits=15, decimal_places=4)
    unit: str = Field(max_length=20)  # 'tokens', 'bytes', 'calls'
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    period_start: datetime
    period_end: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    stripe_usage_record_id: Optional[str] = Field(max_length=255)


class QuotaUsage(SQLModel, table=True):
    """Quota limits and current usage."""
    __tablename__ = "quota_usage"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    usage_type: str = Field(max_length=100)
    current_usage: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    quota_limit: Decimal = Field(max_digits=15, decimal_places=4)
    period_start: datetime
    period_end: datetime
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class EmailVerificationToken(SQLModel, table=True):
    """Email verification tokens."""
    __tablename__ = "email_verification_tokens"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    email: str = Field(max_length=255)
    token: str = Field(max_length=255, unique=True, index=True)
    expires_at: datetime = Field(index=True)
    verified_at: Optional[datetime]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PasswordResetToken(SQLModel, table=True):
    """Password reset tokens."""
    __tablename__ = "password_reset_tokens"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    token: str = Field(max_length=255, unique=True, index=True)
    expires_at: datetime = Field(index=True)
    used_at: Optional[datetime]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserMFASettings(SQLModel, table=True):
    """TOTP MFA settings."""
    __tablename__ = "user_mfa_settings"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", unique=True)
    is_enabled: bool = Field(default=False)
    secret_key: Optional[str] = Field(max_length=255)  # Base32 encoded TOTP secret
    backup_codes: Optional[List[str]] = Field(sa_column=Column(ARRAY(String)))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MFAVerificationAttempt(SQLModel, table=True):
    """MFA verification attempts."""
    __tablename__ = "mfa_verification_attempts"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    attempt_type: str = Field(max_length=50)  # 'totp', 'backup_code'
    success: bool
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class OAuthProvider(SQLModel, table=True):
    """OAuth provider configurations."""
    __tablename__ = "oauth_providers"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: Optional[UUID] = Field(foreign_key="organizations.id")
    provider_name: str = Field(max_length=100)  # 'google', 'okta', 'azure'
    client_id: str = Field(max_length=255)
    client_secret_id: Optional[UUID] = Field(foreign_key="secrets_manager.id")
    configuration: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AlertRule(SQLModel, table=True):
    """Alert rules configuration."""
    __tablename__ = "alert_rules"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=255)
    description: Optional[str]
    metric_name: str = Field(max_length=255)
    condition_type: str = Field(max_length=50)  # 'threshold', 'anomaly', 'trend'
    threshold_value: Optional[Decimal] = Field(max_digits=15, decimal_places=4)
    comparison_operator: Optional[str] = Field(max_length=10)  # '>', '<', '>=', '<=', '='
    evaluation_window_minutes: int = Field(default=5)
    severity: str = Field(max_length=20)  # 'info', 'warning', 'critical'
    notification_channels: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AlertInstance(SQLModel, table=True):
    """Alert instances (fired alerts)."""
    __tablename__ = "alert_instances"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    alert_rule_id: UUID = Field(foreign_key="alert_rules.id")
    fired_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    resolved_at: Optional[datetime]
    severity: str = Field(max_length=20)
    metric_value: Optional[Decimal] = Field(max_digits=15, decimal_places=4)
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    notification_status: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class ResponseCache(SQLModel, table=True):
    """Response cache for identical prompts."""
    __tablename__ = "response_cache"
    
    id: Optional[UUID] = Field(default=None, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    prompt_hash: str = Field(max_length=64, index=True)  # SHA-256 of prompt + context
    context_hash: str = Field(max_length=64, index=True)  # SHA-256 of data room context
    cached_response: str
    policy_evaluation_id: Optional[UUID] = Field(foreign_key="policy_evaluations.id")
    hit_count: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(index=True)