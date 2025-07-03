"""Enhanced middleware components with full RBAC, audit, and metrics integration."""

import asyncio
import json
import time
import logging
from typing import Optional, Dict, Any, Callable
from uuid import UUID, uuid4

import redis.asyncio as redis
from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import get_async_session
from app.services.rbac import RBACService
from app.services.audit import AuditService
from app.services.metrics_enhanced import EnhancedMetricsService
from app.services.admin_enhanced import EnhancedAdminService

logger = logging.getLogger(__name__)
settings = get_settings()
security = HTTPBearer()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware to add request context and timing."""
    
    async def dispatch(self, request: Request, call_next):
        # Add request ID for tracing
        request_id = uuid4()
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        # Add request ID to headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = str(request_id)
        
        # Add timing header
        process_time = time.time() - request.state.start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        request.state.process_time = process_time
        
        return response


class EnhancedAuthMiddleware(BaseHTTPMiddleware):
    """Enhanced authentication middleware with API key support."""
    
    def __init__(self, app, require_auth: bool = True):
        super().__init__(app)
        self.require_auth = require_auth
        self._admin_service = None
    
    async def _get_admin_service(self, session: AsyncSession) -> EnhancedAdminService:
        """Get admin service instance."""
        if not self._admin_service:
            self._admin_service = EnhancedAdminService(session)
            await self._admin_service.initialize_redis()
        return self._admin_service
    
    async def dispatch(self, request: Request, call_next):
        # Skip auth for public endpoints
        if not self.require_auth or self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Try JWT authentication first
        auth_header = request.headers.get("authorization")
        api_key = request.headers.get("x-api-key")
        
        if auth_header and auth_header.startswith("Bearer "):
            # JWT authentication
            await self._authenticate_jwt(request, auth_header[7:])
        elif api_key:
            # API key authentication
            await self._authenticate_api_key(request, api_key)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return await call_next(request)
    
    async def _authenticate_jwt(self, request: Request, token: str):
        """Authenticate using JWT token."""
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
                    detail="Invalid token: missing user ID"
                )
            
            # Store auth context in request state
            request.state.user_id = UUID(user_id)
            request.state.organization_id = UUID(org_id) if org_id else None
            request.state.auth_type = "jwt"
            request.state.token_data = payload
            
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
    
    async def _authenticate_api_key(self, request: Request, api_key: str):
        """Authenticate using API key."""
        try:
            async for session in get_async_session():
                admin_service = await self._get_admin_service(session)
                
                # Verify API key
                key_record = await admin_service.verify_api_key(
                    api_key, 
                    ip_address=request.client.host if request.client else None
                )
                
                if not key_record:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid API key"
                    )
                
                # Store auth context
                request.state.user_id = None  # API keys are not user-specific
                request.state.organization_id = key_record.organization_id
                request.state.auth_type = "api_key"
                request.state.api_key_id = key_record.id
                request.state.api_key_scopes = key_record.scopes
                
                break
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"API key authentication error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
            )
    
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
            "/api/auth/callback",
            "/api/auth/reset-password",
            "/api/auth/verify-email",
        ]
        return path in public_paths or path.startswith("/static/")


class EnhancedRBACMiddleware(BaseHTTPMiddleware):
    """Enhanced RBAC middleware with conditional permissions."""
    
    def __init__(self, app, enable_caching: bool = True):
        super().__init__(app)
        self.enable_caching = enable_caching
        self._rbac_service = None
    
    async def _get_rbac_service(self, session: AsyncSession) -> RBACService:
        """Get RBAC service instance."""
        if not self._rbac_service:
            self._rbac_service = RBACService(session)
            if self.enable_caching:
                await self._rbac_service.initialize_redis()
        return self._rbac_service
    
    async def dispatch(self, request: Request, call_next):
        # Skip RBAC for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get auth context
        auth_type = getattr(request.state, 'auth_type', None)
        user_id = getattr(request.state, 'user_id', None)
        org_id = getattr(request.state, 'organization_id', None)
        
        if not org_id:
            # No organization context, skip RBAC
            return await call_next(request)
        
        # Check permissions based on auth type
        if auth_type == "jwt" and user_id:
            await self._check_user_permissions(request, user_id, org_id)
        elif auth_type == "api_key":
            await self._check_api_key_permissions(request)
        
        return await call_next(request)
    
    async def _check_user_permissions(self, request: Request, user_id: UUID, org_id: UUID):
        """Check user permissions for the route."""
        required_permission = self._get_route_permission(request)
        
        if not required_permission:
            return  # No specific permission required
        
        try:
            async for session in get_async_session():
                rbac_service = await self._get_rbac_service(session)
                
                # Build permission context
                context = {
                    "client_ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "request_method": request.method,
                    "request_path": request.url.path
                }
                
                # Check conditional permission
                has_permission = await rbac_service.check_conditional_permission(
                    user_id=user_id,
                    organization_id=org_id,
                    permission=required_permission,
                    context=context
                )
                
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Insufficient permissions. Required: {required_permission}"
                    )
                
                # Store permission check result for audit
                request.state.permission_checked = required_permission
                request.state.permission_granted = True
                
                break
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Permission check error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Permission check failed"
            )
    
    async def _check_api_key_permissions(self, request: Request):
        """Check API key permissions for the route."""
        scopes = getattr(request.state, 'api_key_scopes', [])
        required_scope = self._get_api_key_scope(request)
        
        if required_scope and required_scope not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key missing required scope: {required_scope}"
            )
        
        request.state.api_scope_checked = required_scope
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public."""
        public_paths = [
            "/", "/health", "/docs", "/redoc", "/openapi.json",
            "/api/auth/login", "/api/auth/register", "/api/auth/callback",
            "/api/auth/reset-password", "/api/auth/verify-email"
        ]
        return path in public_paths or path.startswith("/static/")
    
    def _get_route_permission(self, request: Request) -> Optional[str]:
        """Get required permission for route."""
        path = request.url.path
        method = request.method.upper()
        
        # Enhanced route permission mapping
        route_permissions = {
            # Chat permissions
            ("GET", "/api/chat"): "chat.message:read",
            ("POST", "/api/chat"): "chat.message:create",
            ("PUT", "/api/chat"): "chat.message:update",
            ("DELETE", "/api/chat"): "chat.message:delete",
            
            # Document permissions
            ("GET", "/api/documents"): "document:read",
            ("POST", "/api/documents"): "document:create",
            ("PUT", "/api/documents"): "document:update",
            ("DELETE", "/api/documents"): "document:delete",
            ("POST", "/api/documents/upload"): "document:create",
            ("GET", "/api/documents/search"): "document:search",
            ("GET", "/api/documents/download"): "document:download",
            
            # Fragment search
            ("GET", "/api/fragments/search"): "document:search",
            ("POST", "/api/fragments/search"): "document:search",
            
            # Admin permissions
            ("GET", "/api/admin/audit"): "admin.audit:view",
            ("POST", "/api/admin/audit/export"): "admin.audit:export",
            ("GET", "/api/admin/metrics"): "admin.metrics:view",
            ("GET", "/api/admin/api-keys"): "admin.api_key:manage",
            ("POST", "/api/admin/api-keys"): "admin.api_key:manage",
            ("DELETE", "/api/admin/api-keys"): "admin.api_key:manage",
            ("GET", "/api/admin/webhooks"): "admin.webhook:manage",
            ("POST", "/api/admin/webhooks"): "admin.webhook:manage",
            ("PUT", "/api/admin/webhooks"): "admin.webhook:manage",
            
            # RBAC permissions
            ("GET", "/api/rbac/roles"): "admin.role:manage",
            ("POST", "/api/rbac/roles"): "admin.role:manage",
            ("PUT", "/api/rbac/roles"): "admin.role:manage",
            ("GET", "/api/rbac/permissions"): "admin.role:manage",
            ("POST", "/api/rbac/users/assign-role"): "admin.user:manage",
            ("GET", "/api/rbac/departments"): "admin.user:manage",
            ("POST", "/api/rbac/departments"): "admin.user:manage",
            
            # Platform admin
            ("GET", "/api/platform"): "platform.admin:access",
            ("POST", "/api/platform"): "platform.admin:access",
        }
        
        # Check exact match first
        exact_key = (method, path)
        if exact_key in route_permissions:
            return route_permissions[exact_key]
        
        # Check prefix matches
        for (route_method, route_path), permission in route_permissions.items():
            if method == route_method and path.startswith(route_path):
                return permission
        
        return None
    
    def _get_api_key_scope(self, request: Request) -> Optional[str]:
        """Get required API key scope for route."""
        path = request.url.path
        method = request.method.upper()
        
        # Map routes to API key scopes
        if path.startswith("/api/documents"):
            return "read" if method == "GET" else "write"
        elif path.startswith("/api/chat"):
            return "read" if method == "GET" else "write"
        elif path.startswith("/api/admin"):
            return "admin"
        elif path.startswith("/api/metrics"):
            return "read"
        
        return "read"  # Default scope


class EnhancedAuditMiddleware(BaseHTTPMiddleware):
    """Enhanced audit middleware with comprehensive logging."""
    
    AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    def __init__(self, app, enable_batching: bool = True):
        super().__init__(app)
        self.enable_batching = enable_batching
        self._audit_service = None
    
    async def _get_audit_service(self, session: AsyncSession) -> AuditService:
        """Get audit service instance."""
        if not self._audit_service:
            self._audit_service = AuditService(session)
            if self.enable_batching:
                await self._audit_service.initialize_redis()
        return self._audit_service
    
    async def dispatch(self, request: Request, call_next):
        # Store request body for audit logging
        if request.method in self.AUDITED_METHODS:
            body = await request.body()
            request.state.request_body = body
        
        response = await call_next(request)
        
        # Log audit event asynchronously for all requests
        asyncio.create_task(self._log_audit_event(request, response))
        
        return response
    
    async def _log_audit_event(self, request: Request, response: Response):
        """Log comprehensive audit event."""
        try:
            # Get context from request state
            user_id = getattr(request.state, 'user_id', None)
            org_id = getattr(request.state, 'organization_id', None)
            request_id = getattr(request.state, 'request_id', None)
            process_time = getattr(request.state, 'process_time', 0)
            auth_type = getattr(request.state, 'auth_type', 'unknown')
            permission_checked = getattr(request.state, 'permission_checked', None)
            
            # Determine action and resource
            action = self._get_action_from_request(request)
            resource_type = self._get_resource_type_from_path(request.url.path)
            
            # Parse request details
            details = {}
            if hasattr(request.state, 'request_body') and request.state.request_body:
                try:
                    details = json.loads(request.state.request_body.decode())
                except (json.JSONDecodeError, UnicodeDecodeError):
                    details = {"raw_body": len(request.state.request_body)}
            
            # Add response information
            outcome = "success" if 200 <= response.status_code < 400 else "failure"
            
            # Enhanced metadata
            metadata = {
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "auth_type": auth_type,
                "permission_checked": permission_checked,
                "query_params": dict(request.query_params),
                "response_size": len(response.body) if hasattr(response, 'body') else None
            }
            
            async for session in get_async_session():
                audit_service = await self._get_audit_service(session)
                
                await audit_service.log_event(
                    action=action,
                    resource_type=resource_type,
                    actor_user_id=user_id,
                    organization_id=org_id,
                    outcome=outcome,
                    details=details,
                    metadata=metadata,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    request_id=request_id,
                    duration_ms=int(process_time * 1000),
                    batch=self.enable_batching
                )
                break
                
        except Exception as e:
            logger.error(f"Audit logging failed: {e}")
    
    def _get_action_from_request(self, request: Request) -> str:
        """Determine action from request."""
        method = request.method.lower()
        path = request.url.path
        
        # Map HTTP methods to actions
        method_actions = {
            "get": "view",
            "post": "create",
            "put": "update",
            "patch": "update",
            "delete": "delete"
        }
        
        base_action = method_actions.get(method, method)
        
        # Special cases
        if "login" in path:
            return "auth.login"
        elif "logout" in path:
            return "auth.logout"
        elif "upload" in path:
            return "file.upload"
        elif "download" in path:
            return "file.download"
        elif "search" in path:
            return "data.search"
        
        return base_action
    
    def _get_resource_type_from_path(self, path: str) -> str:
        """Extract resource type from path."""
        parts = path.strip('/').split('/')
        if len(parts) >= 2 and parts[0] == 'api':
            return parts[1]
        return "unknown"


class EnhancedMetricsMiddleware(BaseHTTPMiddleware):
    """Enhanced metrics middleware with real-time collection."""
    
    def __init__(self, app, enable_realtime: bool = True):
        super().__init__(app)
        self.enable_realtime = enable_realtime
        self._metrics_service = None
    
    async def _get_metrics_service(self, session: AsyncSession) -> EnhancedMetricsService:
        """Get metrics service instance."""
        if not self._metrics_service:
            self._metrics_service = EnhancedMetricsService(session)
            if self.enable_realtime:
                await self._metrics_service.initialize_redis()
        return self._metrics_service
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Get request size
        request_size = None
        if hasattr(request, '_body'):
            request_size = len(request._body)
        
        response = await call_next(request)
        
        # Calculate metrics
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Collect metrics asynchronously
        asyncio.create_task(self._collect_metrics(request, response, duration_ms, request_size))
        
        return response
    
    async def _collect_metrics(
        self, 
        request: Request, 
        response: Response, 
        duration_ms: int,
        request_size: Optional[int]
    ):
        """Collect comprehensive request metrics."""
        try:
            # Get context
            org_id = getattr(request.state, 'organization_id', None)
            user_id = getattr(request.state, 'user_id', None)
            
            # Determine error type
            error_type = None
            if response.status_code >= 400:
                if response.status_code == 401:
                    error_type = "unauthorized"
                elif response.status_code == 403:
                    error_type = "forbidden"
                elif response.status_code == 404:
                    error_type = "not_found"
                elif response.status_code >= 500:
                    error_type = "server_error"
                else:
                    error_type = "client_error"
            
            # Get response size (estimate)
            response_size = None
            if hasattr(response, 'headers'):
                content_length = response.headers.get('content-length')
                if content_length:
                    response_size = int(content_length)
            
            async for session in get_async_session():
                metrics_service = await self._get_metrics_service(session)
                
                await metrics_service.collect_request_metrics(
                    organization_id=org_id,
                    route=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    request_size=request_size,
                    response_size=response_size,
                    error_type=error_type,
                    user_id=user_id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent")
                )
                break
                
        except Exception as e:
            logger.error(f"Metrics collection failed: {e}")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    def __init__(self, app, default_limit: int = 1000, window_seconds: int = 3600):
        super().__init__(app)
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.redis_client = None
    
    async def initialize_redis(self):
        """Initialize Redis connection."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
        except Exception as e:
            logger.warning(f"Rate limit Redis connection failed: {e}")
    
    async def dispatch(self, request: Request, call_next):
        if not self.redis_client:
            await self.initialize_redis()
        
        if not self.redis_client:
            return await call_next(request)  # Skip rate limiting if Redis unavailable
        
        # Get rate limit key
        rate_limit_key = self._get_rate_limit_key(request)
        
        try:
            # Check rate limit
            current = await self.redis_client.get(rate_limit_key)
            
            if current is None:
                # First request
                await self.redis_client.setex(rate_limit_key, self.window_seconds, 1)
            else:
                current_count = int(current)
                if current_count >= self.default_limit:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded",
                        headers={
                            "X-RateLimit-Limit": str(self.default_limit),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": str(int(time.time()) + self.window_seconds)
                        }
                    )
                
                # Increment counter
                await self.redis_client.incr(rate_limit_key)
                
                # Add rate limit headers
                remaining = max(0, self.default_limit - current_count - 1)
                request.state.rate_limit_remaining = remaining
            
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        if hasattr(request.state, 'rate_limit_remaining'):
            response.headers["X-RateLimit-Limit"] = str(self.default_limit)
            response.headers["X-RateLimit-Remaining"] = str(request.state.rate_limit_remaining)
        
        return response
    
    def _get_rate_limit_key(self, request: Request) -> str:
        """Get rate limit key for request."""
        # Use API key ID if available, otherwise IP address
        api_key_id = getattr(request.state, 'api_key_id', None)
        if api_key_id:
            return f"rate_limit:api_key:{api_key_id}"
        
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"rate_limit:user:{user_id}"
        
        # Fallback to IP address
        ip = request.client.host if request.client else "unknown"
        return f"rate_limit:ip:{ip}"


# Permission decorators
def require_permission(permission: str, context_extractor: Optional[Callable] = None):
    """Decorator to require specific permission with context."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            from fastapi import Request
            
            # Find request and session
            request = None
            session = None
            
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                elif hasattr(arg, 'execute'):  # AsyncSession
                    session = arg
            
            if not request or not session:
                # If we can't find request/session, skip permission check
                return await func(*args, **kwargs)
            
            user_id = getattr(request.state, 'user_id', None)
            org_id = getattr(request.state, 'organization_id', None)
            
            if user_id and org_id:
                rbac_service = RBACService(session)
                await rbac_service.initialize_redis()
                
                # Build context
                context = {
                    "client_ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent")
                }
                
                # Extract additional context if provided
                if context_extractor:
                    additional_context = context_extractor(*args, **kwargs)
                    context.update(additional_context)
                
                # Check permission
                has_permission = await rbac_service.check_conditional_permission(
                    user_id, org_id, permission, context
                )
                
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Insufficient permissions. Required: {permission}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_scope(scope: str):
    """Decorator to require specific API key scope."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            from fastapi import Request
            
            # Find request
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                auth_type = getattr(request.state, 'auth_type', None)
                if auth_type == "api_key":
                    scopes = getattr(request.state, 'api_key_scopes', [])
                    if scope not in scopes:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"API key missing required scope: {scope}"
                        )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator