"""Custom exceptions for CrossAudit AI."""

from typing import Any, Dict, Optional


class CrossAuditException(Exception):
    """Base exception for CrossAudit AI."""
    
    def __init__(
        self,
        message: str,
        error_code: str = "GENERAL_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(CrossAuditException):
    """Authentication related errors."""
    
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, error_code="AUTH_ERROR", **kwargs)


class AuthorizationError(CrossAuditException):
    """Authorization/permission related errors."""
    
    def __init__(self, message: str = "Authorization failed", **kwargs):
        super().__init__(message, error_code="AUTHZ_ERROR", **kwargs)


class ValidationError(CrossAuditException):
    """Data validation errors."""
    
    def __init__(self, message: str = "Validation failed", **kwargs):
        super().__init__(message, error_code="VALIDATION_ERROR", **kwargs)


class NotFoundError(CrossAuditException):
    """Resource not found errors."""
    
    def __init__(self, message: str = "Resource not found", **kwargs):
        super().__init__(message, error_code="NOT_FOUND", **kwargs)


class ConflictError(CrossAuditException):
    """Resource conflict errors."""
    
    def __init__(self, message: str = "Resource conflict", **kwargs):
        super().__init__(message, error_code="CONFLICT", **kwargs)


class RateLimitError(CrossAuditException):
    """Rate limiting errors."""
    
    def __init__(self, message: str = "Rate limit exceeded", **kwargs):
        super().__init__(message, error_code="RATE_LIMIT", **kwargs)


class QuotaExceededError(CrossAuditException):
    """Quota exceeded errors."""
    
    def __init__(self, message: str = "Quota exceeded", **kwargs):
        super().__init__(message, error_code="QUOTA_EXCEEDED", **kwargs)


class PolicyError(CrossAuditException):
    """Policy related errors."""
    
    def __init__(self, message: str = "Policy error", **kwargs):
        super().__init__(message, error_code="POLICY_ERROR", **kwargs)


class EvaluatorError(CrossAuditException):
    """Evaluator related errors."""
    
    def __init__(self, message: str = "Evaluator error", **kwargs):
        super().__init__(message, error_code="EVALUATOR_ERROR", **kwargs)


class ExternalServiceError(CrossAuditException):
    """External service integration errors."""
    
    def __init__(self, message: str = "External service error", **kwargs):
        super().__init__(message, error_code="EXTERNAL_SERVICE_ERROR", **kwargs)


class DatabaseError(CrossAuditException):
    """Database related errors."""
    
    def __init__(self, message: str = "Database error", **kwargs):
        super().__init__(message, error_code="DATABASE_ERROR", **kwargs)


class StorageError(CrossAuditException):
    """Storage related errors."""
    
    def __init__(self, message: str = "Storage error", **kwargs):
        super().__init__(message, error_code="STORAGE_ERROR", **kwargs)


class ConfigurationError(CrossAuditException):
    """Configuration related errors."""
    
    def __init__(self, message: str = "Configuration error", **kwargs):
        super().__init__(message, error_code="CONFIG_ERROR", **kwargs)