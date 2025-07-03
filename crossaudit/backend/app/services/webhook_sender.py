"""Enhanced webhook sender service with retry logic and delivery tracking."""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from uuid import UUID, uuid4

import aiohttp
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.core.config import get_settings
from app.models.admin import Webhook

logger = logging.getLogger(__name__)
settings = get_settings()


class WebhookSender:
    """Enhanced webhook sender with retry logic and delivery tracking."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.redis_client: Optional[redis.Redis] = None
        self.max_concurrent_deliveries = 10
        self.delivery_semaphore = asyncio.Semaphore(self.max_concurrent_deliveries)
        self._delivery_workers = []
        self._shutdown_event = asyncio.Event()
    
    async def initialize_redis(self):
        """Initialize Redis connection for queuing."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            logger.info("Redis connection established for webhook sender")
        except Exception as e:
            logger.warning(f"Redis connection failed for webhook sender: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    async def start_workers(self, num_workers: int = 3):
        """Start background delivery workers."""
        for i in range(num_workers):
            worker = asyncio.create_task(self._delivery_worker(f"worker-{i}"))
            self._delivery_workers.append(worker)
        
        logger.info(f"Started {num_workers} webhook delivery workers")
    
    async def stop_workers(self):
        """Stop background delivery workers."""
        self._shutdown_event.set()
        
        # Wait for workers to finish
        if self._delivery_workers:
            await asyncio.gather(*self._delivery_workers, return_exceptions=True)
            self._delivery_workers.clear()
        
        logger.info("Stopped webhook delivery workers")
    
    async def send_webhook(
        self,
        organization_id: UUID,
        event_type: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[UUID]:
        """Send webhook to all matching endpoints for an organization."""
        # Get active webhooks for this event type
        stmt = select(Webhook).where(
            Webhook.organization_id == organization_id,
            Webhook.is_active == True,
            Webhook.events.contains([event_type])
        )
        result = await self.session.execute(stmt)
        webhooks = result.scalars().all()
        
        if not webhooks:
            logger.debug(f"No webhooks found for event {event_type} in org {organization_id}")
            return []
        
        delivery_ids = []
        
        # Queue delivery for each webhook
        for webhook in webhooks:
            delivery_id = await self._queue_webhook_delivery(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                idempotency_key=idempotency_key,
                metadata=metadata or {}
            )
            delivery_ids.append(delivery_id)
        
        logger.info(f"Queued {len(delivery_ids)} webhook deliveries for event {event_type}")
        return delivery_ids
    
    async def _queue_webhook_delivery(
        self,
        webhook: Webhook,
        event_type: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> UUID:
        """Queue webhook delivery for processing."""
        delivery_id = uuid4()
        
        # Create delivery record
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
                "webhook_id": webhook.id,
                "event_type": event_type,
                "payload": payload,
                "created_at": datetime.utcnow()
            }
        )
        await self.session.commit()
        
        # Queue for delivery
        delivery_data = {
            "delivery_id": str(delivery_id),
            "webhook_id": str(webhook.id),
            "event_type": event_type,
            "payload": payload,
            "idempotency_key": idempotency_key,
            "metadata": metadata
        }
        
        if self.redis_client:
            await self.redis_client.lpush("webhook_delivery_queue", json.dumps(delivery_data, default=str))
        else:
            # Fallback: process immediately if Redis unavailable
            await self._deliver_webhook(delivery_data)
        
        return delivery_id
    
    async def _delivery_worker(self, worker_name: str):
        """Background worker for processing webhook deliveries."""
        logger.info(f"Webhook delivery worker {worker_name} started")
        
        while not self._shutdown_event.is_set():
            try:
                if not self.redis_client:
                    await asyncio.sleep(5)
                    continue
                
                # Get delivery from queue (blocking with timeout)
                result = await self.redis_client.brpop("webhook_delivery_queue", timeout=5)
                
                if result:
                    queue_name, delivery_json = result
                    delivery_data = json.loads(delivery_json)
                    
                    # Process delivery with concurrency control
                    async with self.delivery_semaphore:
                        await self._deliver_webhook(delivery_data)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Webhook worker {worker_name} error: {e}")
                await asyncio.sleep(1)
        
        logger.info(f"Webhook delivery worker {worker_name} stopped")
    
    async def _deliver_webhook(self, delivery_data: Dict[str, Any]):
        """Deliver individual webhook with retry logic."""
        delivery_id = UUID(delivery_data["delivery_id"])
        webhook_id = UUID(delivery_data["webhook_id"])
        
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
                success = await self._attempt_delivery(webhook, delivery_data, attempt + 1)
                
                if success:
                    # Reset consecutive failures on success
                    webhook.consecutive_failures = 0
                    webhook.last_triggered_at = datetime.utcnow()
                    await self.session.commit()
                    return
                
            except Exception as e:
                error_message = str(e)
                logger.warning(
                    f"Webhook delivery attempt {attempt + 1}/{max_attempts} failed: {error_message}"
                )
                
                if attempt == max_attempts - 1:
                    # Final failure
                    await self._update_delivery_status(
                        delivery_id, "failed", error_message=error_message[:500]
                    )
                    
                    # Update webhook failure tracking
                    webhook.consecutive_failures += 1
                    webhook.last_error = error_message[:500]
                    
                    # Disable webhook if too many consecutive failures
                    if webhook.consecutive_failures >= 10:
                        webhook.is_active = False
                        logger.warning(f"Webhook {webhook_id} disabled due to consecutive failures")
                    
                    await self.session.commit()
                    return
                else:
                    # Calculate retry delay with exponential backoff + jitter
                    base_delay = min(2 ** attempt, 300)  # Max 5 minutes
                    jitter = base_delay * 0.1  # 10% jitter
                    delay = base_delay + (jitter * (hash(str(delivery_id)) % 100) / 100)
                    
                    await asyncio.sleep(delay)
    
    async def _attempt_delivery(
        self,
        webhook: Webhook,
        delivery_data: Dict[str, Any],
        attempt_number: int
    ) -> bool:
        """Attempt to deliver webhook."""
        delivery_id = UUID(delivery_data["delivery_id"])
        
        # Calculate HMAC signature
        payload_json = json.dumps(delivery_data["payload"], sort_keys=True)
        signature = hmac.new(
            webhook.hmac_secret.encode(),
            payload_json.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "CrossAudit-Webhook/1.0",
            "X-CrossAudit-Signature": f"sha256={signature}",
            "X-CrossAudit-Event": delivery_data["event_type"],
            "X-CrossAudit-Delivery": str(delivery_id),
            "X-CrossAudit-Attempt": str(attempt_number),
            "X-CrossAudit-Timestamp": str(int(datetime.utcnow().timestamp())),
            **webhook.headers  # Custom headers from webhook config
        }
        
        if delivery_data.get("idempotency_key"):
            headers["X-CrossAudit-Idempotency-Key"] = delivery_data["idempotency_key"]
        
        # Enhanced payload with metadata
        enhanced_payload = {
            **delivery_data["payload"],
            "_meta": {
                "event_type": delivery_data["event_type"],
                "delivery_id": str(delivery_id),
                "webhook_id": str(webhook.id),
                "timestamp": datetime.utcnow().isoformat(),
                "attempt": attempt_number,
                **delivery_data.get("metadata", {})
            }
        }
        
        # Send webhook with timeout and retry-friendly error handling
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=webhook.timeout_seconds),
            connector=aiohttp.TCPConnector(limit=100, limit_per_host=10)
        ) as session:
            try:
                async with session.post(
                    webhook.url,
                    json=enhanced_payload,
                    headers=headers,
                    ssl=False if webhook.url.startswith("http://") else True
                ) as response:
                    response_body = await response.text()
                    
                    # Update delivery status
                    await self._update_delivery_status(
                        delivery_id,
                        "success" if response.status < 400 else "failed",
                        response_status=response.status,
                        response_body=response_body[:1000],  # Limit response size
                        error_message=None if response.status < 400 else f"HTTP {response.status}"
                    )
                    
                    if response.status < 400:
                        logger.info(f"Webhook delivery {delivery_id} succeeded (HTTP {response.status})")
                        return True
                    else:
                        # Check if error is retryable
                        if response.status in [408, 429, 502, 503, 504]:
                            logger.warning(f"Webhook delivery {delivery_id} failed with retryable error: HTTP {response.status}")
                            return False
                        else:
                            # Non-retryable error
                            logger.error(f"Webhook delivery {delivery_id} failed with non-retryable error: HTTP {response.status}")
                            raise aiohttp.ClientResponseError(
                                request_info=response.request_info,
                                history=response.history,
                                status=response.status,
                                message=response_body
                            )
            
            except asyncio.TimeoutError:
                logger.warning(f"Webhook delivery {delivery_id} timed out")
                return False
            except aiohttp.ClientConnectorError as e:
                logger.warning(f"Webhook delivery {delivery_id} connection error: {e}")
                return False
            except aiohttp.ClientResponseError as e:
                if e.status in [408, 429, 502, 503, 504]:
                    return False  # Retryable
                else:
                    raise  # Non-retryable
    
    async def _update_delivery_status(
        self,
        delivery_id: UUID,
        status: str,
        response_status: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update webhook delivery status."""
        try:
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
        except Exception as e:
            logger.error(f"Failed to update delivery status for {delivery_id}: {e}")
    
    # Monitoring and management methods
    
    async def get_delivery_status(self, delivery_id: UUID) -> Optional[Dict[str, Any]]:
        """Get delivery status by ID."""
        result = await self.session.execute(
            text("""
                SELECT id, webhook_id, event_type, status, attempt_count,
                       response_status, error_message, created_at, delivered_at
                FROM webhook_deliveries
                WHERE id = :delivery_id
            """),
            {"delivery_id": delivery_id}
        )
        
        row = result.fetchone()
        if not row:
            return None
        
        return {
            "id": str(row[0]),
            "webhook_id": str(row[1]),
            "event_type": row[2],
            "status": row[3],
            "attempt_count": row[4],
            "response_status": row[5],
            "error_message": row[6],
            "created_at": row[7].isoformat() if row[7] else None,
            "delivered_at": row[8].isoformat() if row[8] else None
        }
    
    async def get_queue_size(self) -> int:
        """Get current webhook delivery queue size."""
        if not self.redis_client:
            return 0
        
        try:
            return await self.redis_client.llen("webhook_delivery_queue")
        except Exception:
            return 0
    
    async def retry_failed_deliveries(
        self,
        webhook_id: Optional[UUID] = None,
        hours: int = 24,
        max_retries: int = 3
    ) -> int:
        """Retry failed webhook deliveries."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        # Get failed deliveries
        query = text("""
            SELECT wd.id, wd.webhook_id, wd.event_type, wd.payload, wd.attempt_count
            FROM webhook_deliveries wd
            JOIN webhooks w ON wd.webhook_id = w.id
            WHERE wd.status = 'failed'
            AND wd.created_at >= :since
            AND wd.attempt_count < :max_retries
            AND w.is_active = true
        """)
        
        params = {"since": since, "max_retries": max_retries}
        if webhook_id:
            query = text(str(query) + " AND wd.webhook_id = :webhook_id")
            params["webhook_id"] = webhook_id
        
        result = await self.session.execute(query, params)
        failed_deliveries = result.fetchall()
        
        retry_count = 0
        for delivery in failed_deliveries:
            # Reset delivery to pending and requeue
            await self.session.execute(
                text("""
                    UPDATE webhook_deliveries 
                    SET status = 'pending', error_message = NULL, response_status = NULL
                    WHERE id = :delivery_id
                """),
                {"delivery_id": delivery[0]}
            )
            
            # Requeue delivery
            delivery_data = {
                "delivery_id": str(delivery[0]),
                "webhook_id": str(delivery[1]),
                "event_type": delivery[2],
                "payload": delivery[3],
                "idempotency_key": None,
                "metadata": {"retry": True}
            }
            
            if self.redis_client:
                await self.redis_client.lpush(
                    "webhook_delivery_queue", 
                    json.dumps(delivery_data, default=str)
                )
            
            retry_count += 1
        
        await self.session.commit()
        logger.info(f"Requeued {retry_count} failed webhook deliveries for retry")
        return retry_count
    
    async def cleanup_old_deliveries(self, days: int = 30) -> int:
        """Clean up old webhook delivery records."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.session.execute(
            text("SELECT COUNT(*) FROM webhook_deliveries WHERE created_at < :cutoff"),
            {"cutoff": cutoff_date}
        )
        count = result.scalar()
        
        await self.session.execute(
            text("DELETE FROM webhook_deliveries WHERE created_at < :cutoff"),
            {"cutoff": cutoff_date}
        )
        await self.session.commit()
        
        logger.info(f"Cleaned up {count} old webhook delivery records")
        return count


# Utility functions for webhook event triggering

async def trigger_webhook_event(
    session: AsyncSession,
    organization_id: UUID,
    event_type: str,
    payload: Dict[str, Any],
    idempotency_key: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> List[UUID]:
    """Convenience function to trigger webhook events."""
    webhook_sender = WebhookSender(session)
    await webhook_sender.initialize_redis()
    
    try:
        delivery_ids = await webhook_sender.send_webhook(
            organization_id=organization_id,
            event_type=event_type,
            payload=payload,
            idempotency_key=idempotency_key,
            metadata=metadata
        )
        return delivery_ids
    finally:
        await webhook_sender.close_redis()


# Standard webhook event types
class WebhookEventTypes:
    """Standard webhook event types for CrossAudit platform."""
    
    # User events
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    
    # Document events
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_PROCESSED = "document.processed"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"
    DOCUMENT_SHARED = "document.shared"
    
    # Chat events
    CHAT_MESSAGE_CREATED = "chat.message.created"
    CHAT_MESSAGE_UPDATED = "chat.message.updated"
    CHAT_MESSAGE_DELETED = "chat.message.deleted"
    CHAT_THREAD_CREATED = "chat.thread.created"
    CHAT_THREAD_CLOSED = "chat.thread.closed"
    
    # Audit events
    AUDIT_LOG_CREATED = "audit.log.created"
    POLICY_VIOLATION_DETECTED = "policy.violation.detected"
    SECURITY_EVENT = "security.event"
    
    # Admin events
    API_KEY_CREATED = "api_key.created"
    API_KEY_REVOKED = "api_key.revoked"
    WEBHOOK_CREATED = "webhook.created"
    WEBHOOK_UPDATED = "webhook.updated"
    WEBHOOK_DELETED = "webhook.deleted"
    
    # Organization events
    ORGANIZATION_CREATED = "organization.created"
    ORGANIZATION_UPDATED = "organization.updated"
    USER_ROLE_ASSIGNED = "user.role.assigned"
    USER_ROLE_REVOKED = "user.role.revoked"
    
    # System events
    SYSTEM_MAINTENANCE_START = "system.maintenance.start"
    SYSTEM_MAINTENANCE_END = "system.maintenance.end"
    QUOTA_EXCEEDED = "quota.exceeded"
    QUOTA_WARNING = "quota.warning"