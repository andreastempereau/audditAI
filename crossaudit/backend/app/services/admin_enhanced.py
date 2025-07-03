"""Enhanced admin services for API keys, webhooks, and organization management."""

import secrets
import hashlib
import hmac
import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Callable
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, desc, and_, text, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
import aiohttp

from app.models.admin import APIKey, Webhook, BillingPlan, Usage
from app.schemas.admin import (
    APIKeyCreate, APIKeyRead, APIKeyUpdate,
    WebhookCreate, WebhookRead, WebhookUpdate,
    BillingPlanRead, UsageRead
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EnhancedAdminService:
    """Enhanced admin management service with webhook delivery and rate limiting."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.redis_client: Optional[redis.Redis] = None
        self._webhook_queue = asyncio.Queue()
        self._webhook_worker_running = False
    
    async def initialize_redis(self):
        """Initialize Redis connection for rate limiting."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            logger.info("Redis connection established for admin service")
        except Exception as e:
            logger.warning(f"Redis connection failed for admin service: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    # Enhanced API Key management with rate limiting
    async def create_api_key(
        self,
        key_data: APIKeyCreate,
        organization_id: UUID,
        created_by: UUID
    ) -> APIKeyRead:
        """Create new API key with enhanced security."""
        # Generate secure API key
        key_value = f"ca_{secrets.token_urlsafe(32)}"
        
        # Set expiration
        expires_at = None
        if key_data.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days)
        
        api_key = APIKey(
            id=uuid4(),
            organization_id=organization_id,
            name=key_data.name,
            description=key_data.description,
            key_prefix=key_value[:12],  # Store prefix for display
            key_hash=self._hash_key(key_value),  # Store hash for verification
            scopes=key_data.scopes or ["read"],
            is_active=True,
            last_used_at=None,
            last_used_ip=None,
            usage_count=0,
            rate_limit=getattr(key_data, 'rate_limit', 1000),  # Default 1000 requests per hour
            expires_at=expires_at,
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(api_key)
        await self.session.commit()
        await self.session.refresh(api_key)
        
        return APIKeyRead(
            id=api_key.id,
            organization_id=api_key.organization_id,
            name=api_key.name,
            description=api_key.description,
            key_prefix=api_key.key_prefix,
            key_value=key_value,  # Only returned on creation
            scopes=api_key.scopes,
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            expires_at=api_key.expires_at,
            created_by=api_key.created_by,
            created_at=api_key.created_at,
            updated_at=api_key.updated_at
        )
    
    async def verify_api_key(
        self, 
        key_value: str, 
        ip_address: Optional[str] = None
    ) -> Optional[APIKey]:
        """Verify API key and check rate limits."""
        key_hash = self._hash_key(key_value)
        
        stmt = select(APIKey).where(
            and_(
                APIKey.key_hash == key_hash,
                APIKey.is_active == True,
                (APIKey.expires_at.is_(None) | (APIKey.expires_at > datetime.utcnow()))
            )
        )
        result = await self.session.execute(stmt)
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            return None
        
        # Check rate limit
        if not await self._check_rate_limit(api_key.id, api_key.rate_limit):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
        
        # Update usage statistics
        api_key.last_used_at = datetime.utcnow()
        api_key.last_used_ip = ip_address
        api_key.usage_count += 1
        await self.session.commit()
        
        return api_key
    
    async def _check_rate_limit(self, key_id: UUID, limit: int) -> bool:
        """Check if API key is within rate limits."""
        if not self.redis_client:
            return True  # Skip rate limiting if Redis is not available
        
        try:
            key = f"rate_limit:api_key:{key_id}"
            current = await self.redis_client.get(key)
            
            if current is None:
                # First request in this hour
                await self.redis_client.setex(key, 3600, 1)  # 1 hour TTL
                return True
            
            current_count = int(current)
            if current_count >= limit:
                return False
            
            # Increment counter
            await self.redis_client.incr(key)
            return True
            
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")
            return True  # Allow request if Redis check fails
    
    async def get_api_keys(
        self,
        organization_id: UUID
    ) -> List[APIKeyRead]:
        """Get all API keys for organization."""
        stmt = (
            select(APIKey)
            .where(APIKey.organization_id == organization_id)
            .order_by(desc(APIKey.created_at))
        )
        
        result = await self.session.execute(stmt)
        keys = result.scalars().all()
        
        return [
            APIKeyRead(
                id=key.id,
                organization_id=key.organization_id,
                name=key.name,
                description=key.description,
                key_prefix=key.key_prefix,
                key_value=None,  # Don't return full key value
                scopes=key.scopes,
                is_active=key.is_active,
                last_used_at=key.last_used_at,
                expires_at=key.expires_at,
                created_by=key.created_by,
                created_at=key.created_at,
                updated_at=key.updated_at
            )
            for key in keys
        ]
    
    async def delete_api_key(
        self,
        key_id: UUID,
        organization_id: UUID
    ) -> None:
        """Delete API key."""
        stmt = select(APIKey).where(
            and_(
                APIKey.id == key_id,
                APIKey.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        await self.session.delete(api_key)
        await self.session.commit()
    
    # Enhanced Webhook management with delivery tracking
    async def create_webhook(
        self,
        webhook_data: WebhookCreate,
        organization_id: UUID,
        created_by: UUID
    ) -> WebhookRead:
        """Create new webhook with enhanced features."""
        # Generate webhook secret
        secret = secrets.token_urlsafe(32)
        
        webhook = Webhook(
            id=uuid4(),
            organization_id=organization_id,
            name=webhook_data.name,
            description=webhook_data.description,
            url=webhook_data.url,
            events=webhook_data.events,
            secret=secret,
            hmac_secret=secrets.token_urlsafe(32),  # For HMAC signatures
            is_active=True,
            max_retries=getattr(webhook_data, 'max_retries', 3),
            timeout_seconds=getattr(webhook_data, 'timeout_seconds', 30),
            consecutive_failures=0,
            headers=getattr(webhook_data, 'headers', {}),
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(webhook)
        await self.session.commit()
        await self.session.refresh(webhook)
        
        return WebhookRead(
            id=webhook.id,
            organization_id=webhook.organization_id,
            name=webhook.name,
            description=webhook.description,
            url=webhook.url,
            events=webhook.events,
            secret=webhook.secret,
            is_active=webhook.is_active,
            retry_count=webhook.max_retries,
            last_triggered_at=webhook.last_triggered_at,
            created_by=webhook.created_by,
            created_at=webhook.created_at,
            updated_at=webhook.updated_at
        )
    
    async def send_webhook(
        self,
        webhook_id: UUID,
        event_type: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str] = None
    ) -> UUID:
        """Send webhook event asynchronously."""
        delivery_id = uuid4()
        
        # Create webhook delivery record
        await self.session.execute(
            text("""
                INSERT INTO webhook_deliveries (
                    id, webhook_id, event_type, payload, attempt_count, 
                    status, created_at
                ) VALUES (
                    :id, :webhook_id, :event_type, :payload, 0, 'pending', :created_at
                )
            """),
            {
                "id": delivery_id,
                "webhook_id": webhook_id,
                "event_type": event_type,
                "payload": payload,
                "created_at": datetime.utcnow()
            }
        )
        await self.session.commit()
        
        # Queue for delivery
        await self._webhook_queue.put({
            "delivery_id": delivery_id,
            "webhook_id": webhook_id,
            "event_type": event_type,
            "payload": payload,
            "idempotency_key": idempotency_key
        })
        
        # Start webhook worker if not running
        if not self._webhook_worker_running:
            asyncio.create_task(self._webhook_worker())
        
        return delivery_id
    
    async def _webhook_worker(self):
        """Background worker for webhook delivery."""
        self._webhook_worker_running = True
        
        try:
            while True:
                try:
                    # Get webhook from queue (with timeout)
                    webhook_data = await asyncio.wait_for(
                        self._webhook_queue.get(), timeout=60
                    )
                    await self._deliver_webhook(webhook_data)
                    
                except asyncio.TimeoutError:
                    # No webhooks in queue, continue
                    continue
                except Exception as e:
                    logger.error(f"Webhook worker error: {e}")
        finally:
            self._webhook_worker_running = False
    
    async def _deliver_webhook(self, webhook_data: Dict[str, Any]):
        """Deliver individual webhook with retries."""
        delivery_id = webhook_data["delivery_id"]
        webhook_id = webhook_data["webhook_id"]
        
        # Get webhook configuration
        webhook_result = await self.session.execute(
            select(Webhook).where(Webhook.id == webhook_id)
        )
        webhook = webhook_result.scalar_one_or_none()
        
        if not webhook or not webhook.is_active:
            await self._update_delivery_status(
                delivery_id, "failed", error_message="Webhook not found or inactive"
            )
            return
        
        max_attempts = webhook.max_retries + 1
        
        for attempt in range(max_attempts):
            try:
                # Calculate HMAC signature
                payload_json = json.dumps(webhook_data["payload"], sort_keys=True)
                signature = hmac.new(
                    webhook.hmac_secret.encode(),
                    payload_json.encode(),
                    hashlib.sha256
                ).hexdigest()
                
                # Prepare headers
                headers = {
                    "Content-Type": "application/json",
                    "X-CrossAudit-Signature": f"sha256={signature}",
                    "X-CrossAudit-Event": webhook_data["event_type"],
                    "X-CrossAudit-Delivery": str(delivery_id),
                    **webhook.headers
                }
                
                if webhook_data.get("idempotency_key"):
                    headers["X-CrossAudit-Idempotency-Key"] = webhook_data["idempotency_key"]
                
                # Send webhook
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        webhook.url,
                        json=webhook_data["payload"],
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=webhook.timeout_seconds)
                    ) as response:
                        response_body = await response.text()
                        
                        if response.status < 400:
                            # Success
                            await self._update_delivery_status(
                                delivery_id, "success", 
                                response_status=response.status,
                                response_body=response_body[:1000]  # Limit response size
                            )
                            
                            # Reset consecutive failures
                            webhook.consecutive_failures = 0
                            webhook.last_triggered_at = datetime.utcnow()
                            await self.session.commit()
                            return
                        else:
                            # HTTP error
                            raise aiohttp.ClientResponseError(
                                request_info=response.request_info,
                                history=response.history,
                                status=response.status,
                                message=response_body
                            )
            
            except Exception as e:
                error_message = str(e)
                logger.warning(f"Webhook delivery attempt {attempt + 1} failed: {error_message}")
                
                if attempt == max_attempts - 1:
                    # Final failure
                    await self._update_delivery_status(
                        delivery_id, "failed",
                        error_message=error_message[:500]
                    )
                    
                    # Increment consecutive failures
                    webhook.consecutive_failures += 1
                    webhook.last_error = error_message[:500]
                    
                    # Disable webhook if too many consecutive failures
                    if webhook.consecutive_failures >= 10:
                        webhook.is_active = False
                        logger.warning(f"Webhook {webhook_id} disabled due to consecutive failures")
                    
                    await self.session.commit()
                else:
                    # Schedule retry with exponential backoff
                    retry_delay = min(2 ** attempt, 300)  # Max 5 minutes
                    await asyncio.sleep(retry_delay)
    
    async def _update_delivery_status(
        self,
        delivery_id: UUID,
        status: str,
        response_status: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update webhook delivery status."""
        await self.session.execute(
            text("""
                UPDATE webhook_deliveries SET
                    status = :status,
                    response_status = :response_status,
                    response_body = :response_body,
                    error_message = :error_message,
                    delivered_at = CASE WHEN :status = 'success' THEN NOW() ELSE NULL END,
                    attempt_count = attempt_count + 1
                WHERE id = :delivery_id
            """),
            {
                "delivery_id": delivery_id,
                "status": status,
                "response_status": response_status,
                "response_body": response_body,
                "error_message": error_message
            }
        )
        await self.session.commit()
    
    async def get_webhook_deliveries(
        self,
        webhook_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get webhook delivery history."""
        result = await self.session.execute(
            text("""
                SELECT 
                    id, event_type, status, attempt_count, response_status,
                    error_message, created_at, delivered_at
                FROM webhook_deliveries
                WHERE webhook_id = :webhook_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"webhook_id": webhook_id, "limit": limit, "offset": offset}
        )
        
        return [
            {
                "id": str(row[0]),
                "event_type": row[1],
                "status": row[2],
                "attempt_count": row[3],
                "response_status": row[4],
                "error_message": row[5],
                "created_at": row[6].isoformat() if row[6] else None,
                "delivered_at": row[7].isoformat() if row[7] else None
            }
            for row in result.fetchall()
        ]
    
    async def get_webhooks(
        self,
        organization_id: UUID
    ) -> List[WebhookRead]:
        """Get all webhooks for organization."""
        stmt = (
            select(Webhook)
            .where(Webhook.organization_id == organization_id)
            .order_by(desc(Webhook.created_at))
        )
        
        result = await self.session.execute(stmt)
        webhooks = result.scalars().all()
        
        return [
            WebhookRead(
                id=webhook.id,
                organization_id=webhook.organization_id,
                name=webhook.name,
                description=webhook.description,
                url=webhook.url,
                events=webhook.events,
                secret=webhook.secret,
                is_active=webhook.is_active,
                retry_count=webhook.max_retries,
                last_triggered_at=webhook.last_triggered_at,
                created_by=webhook.created_by,
                created_at=webhook.created_at,
                updated_at=webhook.updated_at
            )
            for webhook in webhooks
        ]
    
    # Analytics and monitoring
    async def get_api_key_usage_stats(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get API key usage statistics."""
        start_time = datetime.utcnow() - timedelta(days=days)
        
        # Total API calls
        total_calls = await self.session.execute(
            select(func.sum(APIKey.usage_count))
            .where(APIKey.organization_id == organization_id)
        )
        
        # Active keys
        active_keys = await self.session.execute(
            select(func.count(APIKey.id))
            .where(
                and_(
                    APIKey.organization_id == organization_id,
                    APIKey.is_active == True
                )
            )
        )
        
        # Usage by key
        key_usage = await self.session.execute(
            text("""
                SELECT name, usage_count, last_used_at
                FROM api_keys
                WHERE organization_id = :org_id
                AND is_active = true
                ORDER BY usage_count DESC
                LIMIT 10
            """),
            {"org_id": organization_id}
        )
        
        return {
            "total_api_calls": total_calls.scalar() or 0,
            "active_keys": active_keys.scalar() or 0,
            "period_days": days,
            "top_keys": [
                {
                    "name": row[0],
                    "usage_count": row[1],
                    "last_used_at": row[2].isoformat() if row[2] else None
                }
                for row in key_usage.fetchall()
            ]
        }
    
    async def get_webhook_stats(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get webhook delivery statistics."""
        start_time = datetime.utcnow() - timedelta(days=days)
        
        # Get webhook delivery stats
        delivery_stats = await self.session.execute(
            text("""
                SELECT 
                    COUNT(*) as total_deliveries,
                    COUNT(*) FILTER (WHERE status = 'success') as successful_deliveries,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries
                FROM webhook_deliveries wd
                JOIN webhooks w ON wd.webhook_id = w.id
                WHERE w.organization_id = :org_id
                AND wd.created_at >= :start_time
            """),
            {"org_id": organization_id, "start_time": start_time}
        )
        
        stats_row = delivery_stats.fetchone()
        
        return {
            "total_deliveries": stats_row[0] if stats_row else 0,
            "successful_deliveries": stats_row[1] if stats_row else 0,
            "failed_deliveries": stats_row[2] if stats_row else 0,
            "pending_deliveries": stats_row[3] if stats_row else 0,
            "success_rate": round(
                (stats_row[1] / stats_row[0] * 100) if stats_row and stats_row[0] > 0 else 0,
                2
            ),
            "period_days": days
        }
    
    # Organization management
    async def get_organization_limits(
        self,
        organization_id: UUID
    ) -> Dict[str, Any]:
        """Get organization limits and usage."""
        # Get billing plan
        plan_result = await self.session.execute(
            select(BillingPlan).where(BillingPlan.organization_id == organization_id)
        )
        plan = plan_result.scalar_one_or_none()
        
        if not plan:
            # Default free plan limits
            limits = {
                "api_calls_per_month": 1000,
                "webhooks": 5,
                "api_keys": 10,
                "storage_gb": 1,
                "users": 5
            }
        else:
            limits = plan.limits
        
        # Get current usage
        current_usage = await self._get_current_usage(organization_id)
        
        return {
            "limits": limits,
            "current_usage": current_usage,
            "usage_percentage": {
                key: round((current_usage.get(key, 0) / limits.get(key, 1)) * 100, 2)
                for key in limits.keys()
            }
        }
    
    async def _get_current_usage(self, organization_id: UUID) -> Dict[str, int]:
        """Get current usage statistics."""
        # API calls this month
        first_day_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        api_calls = await self.session.execute(
            select(func.sum(APIKey.usage_count))
            .where(
                and_(
                    APIKey.organization_id == organization_id,
                    APIKey.last_used_at >= first_day_of_month
                )
            )
        )
        
        # Count resources
        webhooks_count = await self.session.execute(
            select(func.count(Webhook.id))
            .where(Webhook.organization_id == organization_id)
        )
        
        api_keys_count = await self.session.execute(
            select(func.count(APIKey.id))
            .where(APIKey.organization_id == organization_id)
        )
        
        return {
            "api_calls_per_month": api_calls.scalar() or 0,
            "webhooks": webhooks_count.scalar() or 0,
            "api_keys": api_keys_count.scalar() or 0,
            "storage_gb": 0,  # Would need to calculate from documents
            "users": 0  # Would need to calculate from user_organizations
        }
    
    def _hash_key(self, key_value: str) -> str:
        """Hash API key for secure storage."""
        return hashlib.sha256(key_value.encode()).hexdigest()


# Webhook event types
class WebhookEvents:
    """Standard webhook event types."""
    
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_PROCESSED = "document.processed"
    DOCUMENT_DELETED = "document.deleted"
    
    CHAT_MESSAGE_CREATED = "chat.message.created"
    CHAT_THREAD_CREATED = "chat.thread.created"
    
    AUDIT_LOG_CREATED = "audit.log.created"
    POLICY_VIOLATION = "policy.violation"
    
    API_KEY_CREATED = "api_key.created"
    API_KEY_DELETED = "api_key.deleted"
    
    WEBHOOK_CREATED = "webhook.created"
    WEBHOOK_DELETED = "webhook.deleted"


# Utility functions
async def trigger_webhook(
    admin_service: EnhancedAdminService,
    organization_id: UUID,
    event_type: str,
    payload: Dict[str, Any],
    idempotency_key: Optional[str] = None
):
    """Helper function to trigger webhooks for an event."""
    # Get active webhooks for this organization and event type
    webhooks = await admin_service.session.execute(
        select(Webhook).where(
            and_(
                Webhook.organization_id == organization_id,
                Webhook.is_active == True,
                Webhook.events.contains([event_type])
            )
        )
    )
    
    # Send webhook to each matching endpoint
    for webhook in webhooks.scalars():
        try:
            await admin_service.send_webhook(
                webhook_id=webhook.id,
                event_type=event_type,
                payload=payload,
                idempotency_key=idempotency_key
            )
        except Exception as e:
            logger.error(f"Failed to queue webhook {webhook.id}: {e}")