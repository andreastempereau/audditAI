"""Celery tasks for chat inference pipeline with governance."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID

import redis.asyncio as redis
from celery import Celery
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.core.config import get_settings
from app.services.governor import AIGovernor
from app.services.documents import DocumentService
from app.models.chat import ChatThread, ChatMessage
from app.models.governance import QuotaUsage

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize Celery app
celery_app = Celery("crossaudit")
celery_app.conf.update(
    broker_url=settings.redis_url,
    result_backend=settings.redis_url,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "chat_inference.*": {"queue": "chat_inference"},
        "document_processing.*": {"queue": "document_processing"},
    }
)

# Database engine for async operations
engine = create_async_engine(settings.database_url)


async def get_async_session() -> AsyncSession:
    """Get async database session."""
    return AsyncSession(engine)


async def get_redis_client() -> redis.Redis:
    """Get Redis client for WebSocket streaming."""
    return redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True
    )


@celery_app.task(bind=True, max_retries=3)
def handle_chat_turn(
    self,
    thread_id: str,
    message_id: str,
    user_message: str,
    organization_id: str,
    user_id: str,
    context: Dict[str, Any] = None
):
    """
    Handle chat turn with governance pipeline:
    1. Retrieve top N fragments from Data Room
    2. Call governor.generate_safe_response()
    3. Stream tokens back to WebSocket via Redis pub/sub
    """
    try:
        return asyncio.run(_handle_chat_turn_async(
            thread_id=UUID(thread_id),
            message_id=UUID(message_id),
            user_message=user_message,
            organization_id=UUID(organization_id),
            user_id=UUID(user_id),
            context=context or {}
        ))
    except Exception as e:
        logger.error(f"Chat turn failed: {e}")
        
        # Send error to WebSocket
        asyncio.run(_send_error_to_websocket(
            thread_id, str(e), "governance_error"
        ))
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            countdown = 2 ** self.request.retries
            raise self.retry(countdown=countdown, exc=e)
        
        raise


async def _handle_chat_turn_async(
    thread_id: UUID,
    message_id: UUID,
    user_message: str,
    organization_id: UUID,
    user_id: UUID,
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Async implementation of chat turn handling."""
    start_time = datetime.utcnow()
    
    async with get_async_session() as session:
        try:
            # Check quota before processing
            quota_ok = await _check_quota_usage(session, organization_id, "tokens", 1000)
            if not quota_ok:
                await _send_error_to_websocket(
                    str(thread_id),
                    "Token quota exceeded. Please upgrade your plan or wait for quota reset.",
                    "quota_exceeded"
                )
                return {"status": "quota_exceeded"}
            
            # Retrieve Data Room context
            document_service = DocumentService(session)
            context_data = await _retrieve_data_room_context(
                document_service, user_message, organization_id, user_id
            )
            
            # Add context to governance pipeline
            enhanced_context = {
                **context,
                "organization_id": organization_id,
                "documents": context_data.get("documents", []),
                "fragments": context_data.get("fragments", []),
                "retrieval_score": context_data.get("avg_score", 0.0)
            }
            
            # Initialize governance engine
            governor = AIGovernor(session)
            
            # Start streaming response
            redis_client = await get_redis_client()
            stream_channel = f"chat:thread:{thread_id}"
            
            # Send typing indicator
            await redis_client.publish(stream_channel, json.dumps({
                "type": "typing_start",
                "thread_id": str(thread_id),
                "timestamp": datetime.utcnow().isoformat()
            }))
            
            # Generate safe response with governance
            governance_result = await governor.generate_safe_response(
                prompt=user_message,
                context=enhanced_context,
                organization_id=organization_id,
                user_id=user_id,
                thread_id=thread_id,
                message_id=message_id
            )
            
            # Handle governance decision
            if governance_result["action"] == "block":
                await _handle_blocked_response(
                    session, redis_client, stream_channel, thread_id, 
                    message_id, governance_result
                )
                return {"status": "blocked", "reason": governance_result.get("reason")}
            
            elif governance_result["action"] in ["rewrite", "redact"]:
                await _handle_modified_response(
                    session, redis_client, stream_channel, thread_id,
                    message_id, governance_result
                )
            
            else:  # allow
                await _handle_allowed_response(
                    session, redis_client, stream_channel, thread_id,
                    message_id, governance_result
                )
            
            # Update usage metrics
            await _update_usage_metrics(
                session, organization_id,
                tokens_used=len(governance_result["response"].split()),
                processing_time_ms=governance_result.get("processing_time_ms", 0)
            )
            
            # Send completion signal
            await redis_client.publish(stream_channel, json.dumps({
                "type": "response_complete",
                "thread_id": str(thread_id),
                "message_id": str(message_id),
                "processing_time_ms": governance_result.get("processing_time_ms"),
                "governance_action": governance_result["action"],
                "timestamp": datetime.utcnow().isoformat()
            }))
            
            await redis_client.close()
            
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.info(f"Chat turn completed: {processing_time:.0f}ms, action: {governance_result['action']}")
            
            return {
                "status": "success",
                "action": governance_result["action"],
                "processing_time_ms": processing_time,
                "evaluation_id": governance_result.get("evaluation_id")
            }
            
        except Exception as e:
            logger.error(f"Chat turn processing failed: {e}")
            await _send_error_to_websocket(str(thread_id), str(e), "processing_error")
            raise


async def _retrieve_data_room_context(
    document_service: DocumentService,
    query: str,
    organization_id: UUID,
    user_id: UUID,
    max_documents: int = 5,
    max_fragments: int = 10
) -> Dict[str, Any]:
    """Retrieve relevant documents and fragments from Data Room."""
    try:
        # Search for relevant documents
        document_results = await document_service.search_documents(
            query=query,
            organization_id=organization_id,
            user_id=user_id,
            limit=max_documents
        )
        
        # Search for relevant fragments
        fragment_results = await document_service.search_fragments(
            query=query,
            organization_id=organization_id,
            user_id=user_id,
            limit=max_fragments
        )
        
        # Extract context data
        documents = []
        for doc in document_results.get("documents", []):
            documents.append({
                "id": str(doc.get("id")),
                "title": doc.get("title"),
                "summary": doc.get("summary"),
                "classification": doc.get("classification"),
                "score": doc.get("score", 0.0)
            })
        
        fragments = []
        for fragment in fragment_results.get("fragments", []):
            fragments.append({
                "id": str(fragment.get("id")),
                "content": fragment.get("content"),
                "document_title": fragment.get("document_title"),
                "score": fragment.get("score", 0.0)
            })
        
        avg_score = 0.0
        if documents or fragments:
            scores = [d["score"] for d in documents] + [f["score"] for f in fragments]
            avg_score = sum(scores) / len(scores) if scores else 0.0
        
        logger.info(f"Retrieved {len(documents)} documents, {len(fragments)} fragments (avg score: {avg_score:.3f})")
        
        return {
            "documents": documents,
            "fragments": fragments,
            "avg_score": avg_score,
            "total_context_items": len(documents) + len(fragments)
        }
        
    except Exception as e:
        logger.warning(f"Failed to retrieve data room context: {e}")
        return {"documents": [], "fragments": [], "avg_score": 0.0}


async def _handle_blocked_response(
    session: AsyncSession,
    redis_client: redis.Redis,
    stream_channel: str,
    thread_id: UUID,
    message_id: UUID,
    governance_result: Dict[str, Any]
):
    """Handle blocked response due to policy violation."""
    reason = governance_result.get("reason", "Content policy violation")
    violations = governance_result.get("violations", [])
    
    # Send policy violation event
    await redis_client.publish(stream_channel, json.dumps({
        "type": "policy_violation",
        "thread_id": str(thread_id),
        "message_id": str(message_id),
        "reason": reason,
        "severity": governance_result.get("severity", "medium"),
        "violations": [
            {
                "type": v.get("type", "unknown"),
                "rule": v.get("rule_matched", "Policy violation")
            } 
            for v in violations
        ],
        "timestamp": datetime.utcnow().isoformat()
    }))
    
    # Create system message explaining the block
    system_message = f"Your request violates our content policy: {reason}"
    
    # Stream the system message
    await _stream_message_tokens(
        redis_client, stream_channel, str(thread_id), system_message
    )
    
    # Save system message to database
    await _save_system_message(session, thread_id, system_message, {
        "type": "policy_violation",
        "governance_result": governance_result
    })


async def _handle_modified_response(
    session: AsyncSession,
    redis_client: redis.Redis,
    stream_channel: str,
    thread_id: UUID,
    message_id: UUID,
    governance_result: Dict[str, Any]
):
    """Handle rewritten or redacted response."""
    response = governance_result["response"]
    action = governance_result["action"]
    
    # Send modification notice
    await redis_client.publish(stream_channel, json.dumps({
        "type": "response_modified",
        "thread_id": str(thread_id),
        "message_id": str(message_id),
        "action": action,
        "reason": governance_result.get("reason", f"Response {action}ed for safety"),
        "timestamp": datetime.utcnow().isoformat()
    }))
    
    # Stream the modified response
    await _stream_message_tokens(
        redis_client, stream_channel, str(thread_id), response
    )
    
    # Save assistant message
    await _save_assistant_message(session, thread_id, response, {
        "governance_action": action,
        "governance_result": governance_result
    })


async def _handle_allowed_response(
    session: AsyncSession,
    redis_client: redis.Redis,
    stream_channel: str,
    thread_id: UUID,
    message_id: UUID,
    governance_result: Dict[str, Any]
):
    """Handle allowed response."""
    response = governance_result["response"]
    
    # Stream the response
    await _stream_message_tokens(
        redis_client, stream_channel, str(thread_id), response
    )
    
    # Save assistant message
    await _save_assistant_message(session, thread_id, response, {
        "governance_action": "allow",
        "governance_result": governance_result
    })


async def _stream_message_tokens(
    redis_client: redis.Redis,
    stream_channel: str,
    thread_id: str,
    message: str,
    delay_ms: int = 50
):
    """Stream message tokens to WebSocket clients."""
    words = message.split()
    
    for i, word in enumerate(words):
        token_data = {
            "type": "token",
            "thread_id": thread_id,
            "token": word + (" " if i < len(words) - 1 else ""),
            "position": i,
            "is_final": i == len(words) - 1,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await redis_client.publish(stream_channel, json.dumps(token_data))
        
        # Small delay for realistic streaming effect
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000.0)


async def _save_assistant_message(
    session: AsyncSession,
    thread_id: UUID,
    content: str,
    metadata: Dict[str, Any]
):
    """Save assistant message to database."""
    message = ChatMessage(
        thread_id=thread_id,
        role="assistant",
        content=content,
        metadata=metadata
    )
    
    session.add(message)
    await session.commit()


async def _save_system_message(
    session: AsyncSession,
    thread_id: UUID,
    content: str,
    metadata: Dict[str, Any]
):
    """Save system message to database."""
    message = ChatMessage(
        thread_id=thread_id,
        role="system",
        content=content,
        metadata=metadata
    )
    
    session.add(message)
    await session.commit()


async def _send_error_to_websocket(
    thread_id: str,
    error_message: str,
    error_type: str = "error"
):
    """Send error message to WebSocket clients."""
    try:
        redis_client = await get_redis_client()
        stream_channel = f"chat:thread:{thread_id}"
        
        await redis_client.publish(stream_channel, json.dumps({
            "type": "error",
            "thread_id": thread_id,
            "error_type": error_type,
            "message": error_message,
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        await redis_client.close()
    except Exception as e:
        logger.error(f"Failed to send error to WebSocket: {e}")


async def _check_quota_usage(
    session: AsyncSession,
    organization_id: UUID,
    usage_type: str,
    estimated_usage: int
) -> bool:
    """Check if organization has quota remaining."""
    from sqlalchemy import text
    
    # Get current quota usage
    stmt = text("""
        SELECT current_usage, quota_limit
        FROM quota_usage
        WHERE organization_id = :org_id 
        AND usage_type = :usage_type
        AND period_start <= NOW()
        AND period_end > NOW()
        ORDER BY period_start DESC
        LIMIT 1
    """)
    
    result = await session.execute(stmt, {
        "org_id": organization_id,
        "usage_type": usage_type
    })
    
    row = result.fetchone()
    if not row:
        # No quota record found - assume unlimited for now
        return True
    
    current_usage, quota_limit = row
    
    # Check if estimated usage would exceed quota (with 10% grace)
    would_exceed = (current_usage + estimated_usage) > (quota_limit * 1.1)
    
    if would_exceed:
        logger.warning(f"Quota would be exceeded for org {organization_id}: {current_usage + estimated_usage} > {quota_limit}")
    
    return not would_exceed


async def _update_usage_metrics(
    session: AsyncSession,
    organization_id: UUID,
    tokens_used: int,
    processing_time_ms: int
):
    """Update usage metrics for billing."""
    from sqlalchemy import text
    
    # Update token usage
    await session.execute(
        text("SELECT update_quota_usage(:org_id, 'tokens', :usage)"),
        {
            "org_id": organization_id,
            "usage": tokens_used
        }
    )
    
    # Update API call count
    await session.execute(
        text("SELECT update_quota_usage(:org_id, 'api_calls', 1)"),
        {"org_id": organization_id}
    )
    
    await session.commit()
    
    logger.debug(f"Updated usage: {tokens_used} tokens, 1 API call for org {organization_id}")


# Background tasks for maintenance
@celery_app.task
def cleanup_expired_cache():
    """Clean up expired response cache entries."""
    asyncio.run(_cleanup_expired_cache_async())


async def _cleanup_expired_cache_async():
    """Async cleanup of expired cache entries."""
    from sqlalchemy import text
    
    async with get_async_session() as session:
        result = await session.execute(
            text("DELETE FROM response_cache WHERE expires_at < NOW()")
        )
        
        deleted_count = result.rowcount
        await session.commit()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} expired cache entries")


@celery_app.task
def aggregate_usage_metrics():
    """Aggregate usage metrics for billing."""
    asyncio.run(_aggregate_usage_metrics_async())


async def _aggregate_usage_metrics_async():
    """Async aggregation of usage metrics."""
    from datetime import datetime, timedelta
    from sqlalchemy import text
    
    async with get_async_session() as session:
        # Aggregate daily usage for Stripe billing
        yesterday = datetime.utcnow() - timedelta(days=1)
        start_of_day = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        # This would create usage records for Stripe metered billing
        # Implementation depends on specific billing requirements
        
        logger.info(f"Aggregated usage metrics for {start_of_day.date()}")


# Celery beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "cleanup-expired-cache": {
        "task": "cleanup_expired_cache",
        "schedule": 3600.0,  # Every hour
    },
    "aggregate-usage-metrics": {
        "task": "aggregate_usage_metrics", 
        "schedule": 86400.0,  # Daily
    },
}
celery_app.conf.timezone = "UTC"