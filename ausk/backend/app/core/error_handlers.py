"""Error handlers for CrossAudit AI."""

import logging
from typing import Dict, Any

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from redis.exceptions import RedisError

from app.core.exceptions import (
    CrossAuditException,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    QuotaExceededError,
    PolicyError,
    EvaluatorError,
    ExternalServiceError,
    DatabaseError,
    StorageError,
    ConfigurationError
)

logger = logging.getLogger(__name__)


async def crossaudit_exception_handler(request: Request, exc: CrossAuditException) -> JSONResponse:
    """Handle CrossAudit custom exceptions."""
    logger.error(f"CrossAudit exception: {exc.error_code} - {exc.message}", extra=exc.details)
    
    # Map error codes to HTTP status codes
    status_code_map = {
        "AUTH_ERROR": status.HTTP_401_UNAUTHORIZED,
        "AUTHZ_ERROR": status.HTTP_403_FORBIDDEN,
        "VALIDATION_ERROR": status.HTTP_400_BAD_REQUEST,
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "CONFLICT": status.HTTP_409_CONFLICT,
        "RATE_LIMIT": status.HTTP_429_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED": status.HTTP_402_PAYMENT_REQUIRED,
        "POLICY_ERROR": status.HTTP_400_BAD_REQUEST,
        "EVALUATOR_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "EXTERNAL_SERVICE_ERROR": status.HTTP_503_SERVICE_UNAVAILABLE,
        "DATABASE_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "STORAGE_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "CONFIG_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "GENERAL_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR
    }
    
    status_code = status_code_map.get(exc.error_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    response_data = {
        "error": {
            "code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    }
    
    return JSONResponse(
        status_code=status_code,
        content=response_data
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions."""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    
    response_data = {
        "error": {
            "code": "HTTP_ERROR",
            "message": exc.detail,
            "status_code": exc.status_code
        }
    }
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_data
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle Pydantic validation exceptions."""
    logger.warning(f"Validation exception: {exc}")
    
    # Extract validation errors
    errors = []
    if hasattr(exc, 'errors'):
        for error in exc.errors():
            errors.append({
                "field": " -> ".join(str(x) for x in error.get("loc", [])),
                "message": error.get("msg", ""),
                "type": error.get("type", "")
            })
    
    response_data = {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "details": {
                "validation_errors": errors
            }
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_data
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle database exceptions."""
    logger.error(f"Database exception: {exc}")
    
    response_data = {
        "error": {
            "code": "DATABASE_ERROR",
            "message": "Database operation failed",
            "details": {
                "type": type(exc).__name__
            }
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_data
    )


async def redis_exception_handler(request: Request, exc: RedisError) -> JSONResponse:
    """Handle Redis exceptions."""
    logger.error(f"Redis exception: {exc}")
    
    response_data = {
        "error": {
            "code": "CACHE_ERROR",
            "message": "Cache operation failed",
            "details": {
                "type": type(exc).__name__
            }
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_data
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all other exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    
    response_data = {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "details": {
                "type": type(exc).__name__
            }
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_data
    )


def register_error_handlers(app):
    """Register all error handlers with the FastAPI app."""
    
    # Custom CrossAudit exceptions
    app.add_exception_handler(CrossAuditException, crossaudit_exception_handler)
    
    # FastAPI HTTP exceptions
    app.add_exception_handler(HTTPException, http_exception_handler)
    
    # Database exceptions
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    
    # Redis exceptions
    app.add_exception_handler(RedisError, redis_exception_handler)
    
    # Pydantic validation exceptions
    try:
        from pydantic import ValidationError as PydanticValidationError
        app.add_exception_handler(PydanticValidationError, validation_exception_handler)
    except ImportError:
        pass
    
    # General exception handler (catch-all)
    app.add_exception_handler(Exception, general_exception_handler)