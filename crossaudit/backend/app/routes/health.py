"""Health check endpoints for CrossAudit AI."""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any

import redis.asyncio as redis
from fastapi import APIRouter, Request, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


@router.get("/health", summary="Basic health check")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "service": "crossaudit-api"
    }


@router.get("/health/detailed", summary="Detailed health check")
async def detailed_health_check(request: Request) -> Dict[str, Any]:
    """Detailed health check with dependency status."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "service": "crossaudit-api",
        "checks": {}
    }
    
    overall_healthy = True
    
    # Check database
    try:
        db_healthy = await check_database_health()
        health_status["checks"]["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "message": "Database connection successful" if db_healthy else "Database connection failed"
        }
        if not db_healthy:
            overall_healthy = False
    except Exception as e:
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database check error: {str(e)}"
        }
        overall_healthy = False
    
    # Check Redis
    try:
        redis_healthy = await check_redis_health(request)
        health_status["checks"]["redis"] = {
            "status": "healthy" if redis_healthy else "unhealthy",
            "message": "Redis connection successful" if redis_healthy else "Redis connection failed"
        }
        if not redis_healthy:
            overall_healthy = False
    except Exception as e:
        health_status["checks"]["redis"] = {
            "status": "unhealthy",
            "message": f"Redis check error: {str(e)}"
        }
        overall_healthy = False
    
    # Check external services
    external_checks = await check_external_services()
    health_status["checks"]["external"] = external_checks
    
    # Set overall status
    health_status["status"] = "healthy" if overall_healthy else "unhealthy"
    
    # Return appropriate HTTP status code
    if not overall_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_status
        )
    
    return health_status


@router.get("/health/db", summary="Database health check")
async def database_health_check() -> Dict[str, Any]:
    """Database-specific health check."""
    try:
        healthy = await check_database_health()
        
        if not healthy:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "database_connected": False,
                    "message": "Database connection failed",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
        
        return {
            "database_connected": True,
            "message": "Database connection successful",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database health check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "database_connected": False,
                "message": f"Database health check error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health/redis", summary="Redis health check")
async def redis_health_check(request: Request) -> Dict[str, Any]:
    """Redis-specific health check."""
    try:
        healthy = await check_redis_health(request)
        
        if not healthy:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "redis_connected": False,
                    "message": "Redis connection failed",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
        
        return {
            "redis_connected": True,
            "message": "Redis connection successful",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Redis health check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "redis_connected": False,
                "message": f"Redis health check error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health/readiness", summary="Readiness probe")
async def readiness_check(request: Request) -> Dict[str, Any]:
    """Kubernetes readiness probe."""
    # Check if application is ready to serve traffic
    try:
        # Quick database check
        db_ready = await check_database_health()
        
        # Quick Redis check
        redis_ready = await check_redis_health(request)
        
        ready = db_ready and redis_ready
        
        if not ready:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "ready": False,
                    "message": "Service not ready",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
        
        return {
            "ready": True,
            "message": "Service ready",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Readiness check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "ready": False,
                "message": f"Readiness check error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@router.get("/health/liveness", summary="Liveness probe")
async def liveness_check() -> Dict[str, Any]:
    """Kubernetes liveness probe."""
    # Simple check to ensure the application is running
    return {
        "alive": True,
        "message": "Service alive",
        "timestamp": datetime.utcnow().isoformat()
    }


async def check_database_health() -> bool:
    """Check database connectivity."""
    try:
        async for session in get_async_session():
            # Simple query to test connection
            result = await session.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


async def check_redis_health(request: Request) -> bool:
    """Check Redis connectivity."""
    try:
        redis_client = getattr(request.app.state, 'redis', None)
        
        if not redis_client:
            # Create temporary connection
            redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            
            # Test connection
            await redis_client.ping()
            await redis_client.close()
            return True
        else:
            # Use existing connection
            await redis_client.ping()
            return True
            
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False


async def check_external_services() -> Dict[str, Any]:
    """Check external service health."""
    checks = {}
    
    # Check OpenAI API (if configured)
    if settings.openai_api_key:
        try:
            # Simple check - we'll just verify the key format
            # In production, you might want to make a lightweight API call
            checks["openai"] = {
                "status": "configured",
                "message": "OpenAI API key configured"
            }
        except Exception as e:
            checks["openai"] = {
                "status": "error",
                "message": f"OpenAI check failed: {str(e)}"
            }
    else:
        checks["openai"] = {
            "status": "not_configured",
            "message": "OpenAI API key not configured"
        }
    
    # Check Anthropic API (if configured)
    if settings.anthropic_api_key:
        checks["anthropic"] = {
            "status": "configured",
            "message": "Anthropic API key configured"
        }
    else:
        checks["anthropic"] = {
            "status": "not_configured",
            "message": "Anthropic API key not configured"
        }
    
    # Check Stripe (if configured)
    if settings.stripe_secret_key:
        checks["stripe"] = {
            "status": "configured",
            "message": "Stripe API key configured"
        }
    else:
        checks["stripe"] = {
            "status": "not_configured",
            "message": "Stripe API key not configured"
        }
    
    return checks


@router.get("/health/startup", summary="Startup probe")
async def startup_check(request: Request) -> Dict[str, Any]:
    """Kubernetes startup probe."""
    try:
        # Check if application has completed startup
        # This is more comprehensive than liveness but less than readiness
        
        # Check if database is accessible
        db_ready = await check_database_health()
        
        if not db_ready:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "started": False,
                    "message": "Database not accessible during startup",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
        
        return {
            "started": True,
            "message": "Service started successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Startup check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "started": False,
                "message": f"Startup check error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )