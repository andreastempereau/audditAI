"""FastAPI middleware components."""

import asyncio
import json
import time
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

import redis.asyncio as redis
from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import get_async_session
from app.models.auth import User
from app.models.audit import AuditLog, MetricData

settings = get_settings()
security = HTTPBearer()


class TimingMiddleware(BaseHTTPMiddleware):
    """Middleware to track request timing."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Store timing in request state for metrics middleware
        request.state.process_time = process_time
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect metrics."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Collect metrics asynchronously
        asyncio.create_task(self._collect_metrics(request, response))
        
        return response
    
    async def _collect_metrics(self, request: Request, response: Response):
        """Collect and store metrics."""
        try:
            # Get timing from request state
            process_time = getattr(request.state, 'process_time', 0)
            
            # Get organization from request state (set by auth middleware)
            org_id = getattr(request.state, 'organization_id', None)
            
            # Create metric data
            from decimal import Decimal
            
            async for session in get_async_session():
                metric = MetricData(
                    organization_id=org_id,
                    metric_name="api.request.duration",
                    metric_type="histogram",
                    value=Decimal(str(process_time * 1000)),  # Convert to milliseconds
                    unit="ms",
                    dimensions={
                        "method": request.method,
                        "path": str(request.url.path),
                        "status_code": response.status_code,
                    }
                )
                session.add(metric)
                await session.commit()
                break
        except Exception:
            # Don't fail the request if metrics collection fails
            pass


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log audit events."""
    
    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    async def dispatch(self, request: Request, call_next):
        # Store request body for audit logging
        if request.method in self.MUTATING_METHODS:
            body = await request.body()
            # Create new request with body for the route
            request._body = body
        
        response = await call_next(request)
        
        # Log audit event asynchronously
        if request.method in self.MUTATING_METHODS:
            asyncio.create_task(self._log_audit_event(request, response))
        
        return response
    
    async def _log_audit_event(self, request: Request, response: Response):
        """Log audit event."""
        try:
            user_id = getattr(request.state, 'user_id', None)
            org_id = getattr(request.state, 'organization_id', None)
            
            # Parse request body
            changes = None
            if hasattr(request, '_body') and request._body:
                try:
                    changes = json.loads(request._body.decode())
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
            
            # Determine action from method and path
            path = str(request.url.path)
            action = f"{request.method.lower()}_resource"
            resource_type = self._extract_resource_type(path)
            
            async for session in get_async_session():
                audit_log = AuditLog(
                    organization_id=org_id,
                    actor_user_id=user_id,
                    actor_type="user",
                    action=action,
                    resource_type=resource_type,
                    changes=changes,
                    metadata={
                        "path": path,
                        "method": request.method,
                        "status_code": response.status_code,
                        "user_agent": request.headers.get("user-agent"),
                    },
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    correlation_id=uuid4(),
                    severity="info" if 200 <= response.status_code < 400 else "warning"
                )
                session.add(audit_log)
                await session.commit()
                break
        except Exception:
            # Don't fail the request if audit logging fails
            pass
    
    def _extract_resource_type(self, path: str) -> str:
        """Extract resource type from path."""
        parts = path.strip('/').split('/')
        if len(parts) >= 2 and parts[0] == 'api':
            return parts[1]
        return "unknown"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials,
    session: AsyncSession
) -> Optional[User]:
    """Get current user from JWT token."""
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        # Get user from database
        result = await session.get(User, UUID(user_id))
        return result
    except (JWTError, ValueError):
        return None


class AuthMiddleware:
    """Authentication middleware."""
    
    def __init__(self, require_auth: bool = True):
        self.require_auth = require_auth
    
    async def __call__(self, request: Request, call_next):
        # Skip auth for public endpoints
        if not self.require_auth or self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get authorization header
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            user_id = payload.get("sub")
            org_id = payload.get("org_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Store user info in request state
            request.state.user_id = UUID(user_id)
            request.state.organization_id = UUID(org_id) if org_id else None
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return await call_next(request)
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public."""
        public_paths = [
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/reset-password",
        ]
        return path in public_paths or path.startswith("/static/")


def require_permission(permission: str):
    """Decorator to require specific permission."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            from app.services.rbac import RBACService
            
            # Extract request and session from args/kwargs
            request = None
            session = None
            
            for arg in args:
                if hasattr(arg, 'state') and hasattr(arg.state, 'user_id'):
                    request = arg
                    break
            
            for key, value in kwargs.items():
                if hasattr(value, 'execute'):  # AsyncSession
                    session = value
                    break
            
            if request and session:
                user_id = getattr(request.state, 'user_id', None)
                org_id = getattr(request.state, 'organization_id', None)
                
                if user_id and org_id:
                    rbac_service = RBACService(session)
                    has_permission = await rbac_service.check_user_permission(
                        user_id, org_id, permission
                    )
                    
                    if not has_permission:
                        from fastapi import HTTPException, status
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Insufficient permissions. Required: {permission}"
                        )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


class RBACMiddleware(BaseHTTPMiddleware):
    """RBAC middleware for route-level permission checking."""
    
    def __init__(self, app, default_permissions: dict = None):
        super().__init__(app)
        self.default_permissions = default_permissions or {}
    
    async def dispatch(self, request: Request, call_next):
        # Skip RBAC for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get user context from request state (set by AuthMiddleware)
        user_id = getattr(request.state, 'user_id', None)
        org_id = getattr(request.state, 'organization_id', None)
        
        if not user_id or not org_id:
            # Auth middleware should have caught this
            return await call_next(request)
        
        # Check if route requires specific permission
        route_permission = self._get_route_permission(request)
        
        if route_permission:
            from app.core.database import get_async_session
            from app.services.rbac import RBACService
            
            async for session in get_async_session():
                rbac_service = RBACService(session)
                has_permission = await rbac_service.check_user_permission(
                    user_id, org_id, route_permission
                )
                
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Insufficient permissions. Required: {route_permission}"
                    )
                break
        
        return await call_next(request)
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public."""
        public_paths = [
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/reset-password",
        ]
        return path in public_paths or path.startswith("/static/")
    
    def _get_route_permission(self, request: Request) -> Optional[str]:
        """Get required permission for route."""
        path = request.url.path
        method = request.method.lower()
        
        # Define route permissions
        route_permissions = {
            # Documents
            ("GET", "/api/documents"): "documents.read",
            ("POST", "/api/documents"): "documents.write",
            ("PUT", "/api/documents"): "documents.write",
            ("DELETE", "/api/documents"): "documents.delete",
            
            # Chat
            ("GET", "/api/chat"): "chat.read",
            ("POST", "/api/chat"): "chat.write",
            
            # RBAC
            ("GET", "/api/rbac/roles"): "admin.rbac",
            ("POST", "/api/rbac/roles"): "admin.rbac",
            ("PUT", "/api/rbac/roles"): "admin.rbac",
            
            # Admin
            ("GET", "/api/admin"): "admin.full",
            ("POST", "/api/admin"): "admin.full",
            ("PUT", "/api/admin"): "admin.full",
            ("DELETE", "/api/admin"): "admin.full",
            
            # Audit
            ("GET", "/api/audit"): "audit.read",
            
            # Metrics
            ("GET", "/api/metrics"): "metrics.read",
            ("POST", "/api/metrics"): "metrics.write",
        }
        
        # Check exact path match first
        exact_key = (method, path)
        if exact_key in route_permissions:
            return route_permissions[exact_key]
        
        # Check prefix matches
        for (route_method, route_path), permission in route_permissions.items():
            if method == route_method and path.startswith(route_path):
                return permission
        
        return None