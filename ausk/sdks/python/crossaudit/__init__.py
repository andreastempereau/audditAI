"""
CrossAudit Python SDK

AI Governance Gateway Client for Python applications.
"""

from .client import CrossAuditClient
from .models import (
    LLMRequest,
    LLMResponse,
    EvaluationResult,
    PolicyViolation,
    DocumentUpload,
    AuditLog,
    APIError,
    ConfigurationError,
    AuthenticationError
)
from .async_client import AsyncCrossAuditClient

__version__ = "1.0.0"
__author__ = "CrossAudit Team"
__email__ = "support@crossaudit.ai"

__all__ = [
    "CrossAuditClient",
    "AsyncCrossAuditClient",
    "LLMRequest",
    "LLMResponse", 
    "EvaluationResult",
    "PolicyViolation",
    "DocumentUpload",
    "AuditLog",
    "APIError",
    "ConfigurationError",
    "AuthenticationError"
]