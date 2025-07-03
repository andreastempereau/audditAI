"""Quota enforcement middleware for billing integration."""

import logging
from typing import Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import get_async_session
from app.services.billing import BillingService, QuotaExceededError

logger = logging.getLogger(__name__)


class QuotaEnforcementMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce quota limits based on subscription."""
    
    # Quota usage by endpoint
    ENDPOINT_QUOTAS = {
        # Documents
        ("/api/documents/upload", "POST"): ("storage", "file_size"),
        ("/api/documents/process", "POST"): ("api_calls", 1),
        ("/api/documents/search", "GET"): ("api_calls", 1),
        
        # Chat
        ("/api/chat/messages", "POST"): ("tokens", "estimated_tokens"),
        ("/api/chat/stream", "POST"): ("tokens", "estimated_tokens"),
        
        # AI Governance
        ("/api/policies/evaluate", "POST"): ("evaluator_calls", 1),
        ("/api/evaluators/test", "POST"): ("evaluator_calls", 1),
        
        # General API
        ("/api/", "ALL"): ("api_calls", 1),
    }
    
    def __init__(self, app, enforce_quotas: bool = True):
        super().__init__(app)
        self.enforce_quotas = enforce_quotas
    
    async def dispatch(self, request: Request, call_next):
        # Skip quota check for certain endpoints
        if self._is_exempt_endpoint(request.url.path):
            return await call_next(request)
        
        # Get organization context
        org_id = getattr(request.state, 'organization_id', None)
        if not org_id or not self.enforce_quotas:
            return await call_next(request)
        
        # Check quota before processing
        quota_check = await self._check_request_quota(request, org_id)
        if not quota_check["allowed"]:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "quota_exceeded",
                    "message": f"{quota_check['usage_type']} quota exceeded",
                    "current_usage": quota_check["current_usage"],
                    "quota_limit": quota_check["quota_limit"],
                    "upgrade_url": "/billing/upgrade"
                },
                headers={
                    "X-Quota-Exceeded": quota_check["usage_type"],
                    "X-Quota-Current": str(quota_check["current_usage"]),
                    "X-Quota-Limit": str(quota_check["quota_limit"])
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Record usage after successful response
        if response.status_code < 400:
            await self._record_request_usage(request, org_id, quota_check)
        
        # Add quota headers to response
        if quota_check.get("quota_info"):
            response.headers["X-Quota-Type"] = quota_check["usage_type"]
            response.headers["X-Quota-Remaining"] = str(
                quota_check["quota_limit"] - quota_check["current_usage"] - quota_check["requested_amount"]
            )
            response.headers["X-Quota-Limit"] = str(quota_check["quota_limit"])
        
        return response
    
    def _is_exempt_endpoint(self, path: str) -> bool:
        """Check if endpoint is exempt from quota checks."""
        exempt_paths = [
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth",
            "/api/billing",
            "/api/rbac",
            "/api/admin",
            "/api/platform"
        ]
        
        for exempt in exempt_paths:
            if path.startswith(exempt):
                return True
        
        return False
    
    async def _check_request_quota(
        self,
        request: Request,
        organization_id: UUID
    ) -> Dict[str, Any]:
        """Check quota for the request."""
        path = request.url.path
        method = request.method
        
        # Determine quota type and amount
        quota_type, amount = self._get_quota_requirements(path, method, request)
        
        if not quota_type:
            return {"allowed": True, "usage_type": None}
        
        # Get actual amount if it's dynamic
        if isinstance(amount, str):
            amount = await self._calculate_dynamic_amount(request, amount)
        
        try:
            async for session in get_async_session():
                billing_service = BillingService(session)
                
                allowed, quota_info = await billing_service.check_quota(
                    organization_id,
                    quota_type,
                    Decimal(str(amount))
                )
                
                return {
                    "allowed": allowed,
                    "usage_type": quota_type,
                    "requested_amount": amount,
                    "current_usage": quota_info["current_usage"],
                    "quota_limit": quota_info["quota_limit"],
                    "quota_info": quota_info
                }
        
        except Exception as e:
            logger.error(f"Quota check failed: {e}")
            # Allow request on error (fail open)
            return {"allowed": True, "usage_type": quota_type, "error": str(e)}
    
    async def _record_request_usage(
        self,
        request: Request,
        organization_id: UUID,
        quota_check: Dict[str, Any]
    ):
        """Record usage after successful request."""
        if not quota_check.get("usage_type"):
            return
        
        try:
            async for session in get_async_session():
                billing_service = BillingService(session)
                
                # Get actual usage (may differ from estimate)
                actual_usage = await self._get_actual_usage(
                    request,
                    quota_check["usage_type"],
                    quota_check["requested_amount"]
                )
                
                await billing_service.record_usage(
                    organization_id,
                    quota_check["usage_type"],
                    Decimal(str(actual_usage)),
                    metadata={
                        "endpoint": request.url.path,
                        "method": request.method,
                        "user_id": str(getattr(request.state, 'user_id', None))
                    }
                )
                
                break
        
        except Exception as e:
            logger.error(f"Failed to record usage: {e}")
    
    def _get_quota_requirements(
        self,
        path: str,
        method: str,
        request: Request
    ) -> Tuple[Optional[str], Any]:
        """Get quota type and amount for endpoint."""
        # Check exact match
        key = (path, method)
        if key in self.ENDPOINT_QUOTAS:
            return self.ENDPOINT_QUOTAS[key]
        
        # Check prefix matches
        for (endpoint_path, endpoint_method), quota in self.ENDPOINT_QUOTAS.items():
            if endpoint_method in ["ALL", method] and path.startswith(endpoint_path):
                return quota
        
        # Default API call quota
        if path.startswith("/api/"):
            return ("api_calls", 1)
        
        return (None, 0)
    
    async def _calculate_dynamic_amount(
        self,
        request: Request,
        amount_type: str
    ) -> float:
        """Calculate dynamic quota amount based on request."""
        if amount_type == "file_size":
            # Get file size from request
            content_length = request.headers.get("content-length", "0")
            return int(content_length) / (1024 * 1024 * 1024)  # Convert to GB
        
        elif amount_type == "estimated_tokens":
            # Estimate tokens from request body
            if hasattr(request.state, 'request_body'):
                body = request.state.request_body
                try:
                    import json
                    data = json.loads(body)
                    text = data.get("message", "") + data.get("prompt", "")
                    # Rough estimate: 1 token ≈ 4 characters
                    return len(text) / 4
                except:
                    pass
            return 100  # Default estimate
        
        return 1
    
    async def _get_actual_usage(
        self,
        request: Request,
        usage_type: str,
        estimated: float
    ) -> float:
        """Get actual usage after request completion."""
        # For some usage types, we can get more accurate numbers after processing
        if usage_type == "tokens" and hasattr(request.state, 'actual_tokens_used'):
            return request.state.actual_tokens_used
        
        if usage_type == "storage" and hasattr(request.state, 'actual_file_size'):
            return request.state.actual_file_size / (1024 * 1024 * 1024)  # GB
        
        return estimated


class SubscriptionRequiredMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure active subscription."""
    
    def __init__(self, app, required_plans: Optional[List[str]] = None):
        super().__init__(app)
        self.required_plans = required_plans or []
    
    async def dispatch(self, request: Request, call_next):
        # Skip for exempt endpoints
        if self._is_exempt_endpoint(request.url.path):
            return await call_next(request)
        
        # Get organization context
        org_id = getattr(request.state, 'organization_id', None)
        if not org_id:
            return await call_next(request)
        
        # Check subscription status
        subscription_info = await self._check_subscription(org_id)
        
        if not subscription_info["active"]:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "subscription_required",
                    "message": "Active subscription required",
                    "subscription_status": subscription_info["status"],
                    "subscribe_url": "/billing/subscribe"
                }
            )
        
        # Check plan requirements
        if self.required_plans and subscription_info["plan"] not in self.required_plans:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "plan_upgrade_required",
                    "message": f"This feature requires {' or '.join(self.required_plans)} plan",
                    "current_plan": subscription_info["plan"],
                    "upgrade_url": "/billing/upgrade"
                }
            )
        
        # Add subscription info to request state
        request.state.subscription_plan = subscription_info["plan"]
        request.state.subscription_status = subscription_info["status"]
        
        return await call_next(request)
    
    def _is_exempt_endpoint(self, path: str) -> bool:
        """Check if endpoint is exempt from subscription checks."""
        exempt_paths = [
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth",
            "/api/billing/webhook",
            "/api/billing/plans"
        ]
        
        for exempt in exempt_paths:
            if path.startswith(exempt):
                return True
        
        return False
    
    async def _check_subscription(self, organization_id: UUID) -> Dict[str, Any]:
        """Check organization subscription status."""
        try:
            async for session in get_async_session():
                from sqlalchemy import select
                from app.models.governance import Subscription, SubscriptionPlan
                
                stmt = select(Subscription, SubscriptionPlan).join(
                    SubscriptionPlan
                ).where(
                    Subscription.organization_id == organization_id
                )
                
                result = await session.execute(stmt)
                row = result.first()
                
                if not row:
                    return {
                        "active": False,
                        "status": "none",
                        "plan": None
                    }
                
                subscription, plan = row
                
                # Check if subscription is active
                active_statuses = ["active", "trialing"]
                
                return {
                    "active": subscription.status in active_statuses,
                    "status": subscription.status,
                    "plan": plan.name,
                    "trial_end": subscription.trial_end.isoformat() if subscription.trial_end else None
                }
        
        except Exception as e:
            logger.error(f"Subscription check failed: {e}")
            # Fail open - allow request
            return {
                "active": True,
                "status": "unknown",
                "plan": "unknown"
            }