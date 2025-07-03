"""Universal audit logging service with HMAC integrity and Redis batching."""

import hashlib
import hmac
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Callable, Union
from uuid import UUID, uuid4
from functools import wraps
from contextlib import asynccontextmanager

from fastapi import HTTPException, status, Request
from sqlalchemy import select, desc, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.models.audit import AuditLog
from app.models.auth import User
from app.schemas.audit import (
    AuditLogCreate, AuditLogRead, AuditLogFilter
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AuditService:
    """Enhanced audit logging service with HMAC integrity and Redis batching."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.redis_client: Optional[redis.Redis] = None
        self.hmac_key = getattr(settings, 'audit_hmac_key', "default-audit-hmac-key-change-in-production")
        self.batch_size = 100
        self.batch_timeout = 30  # seconds
        self._batch_queue = []
        self._batch_lock = asyncio.Lock()
    
    async def initialize_redis(self):
        """Initialize Redis connection for batching."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            logger.info("Redis connection established for audit service")
        except Exception as e:
            logger.warning(f"Redis connection failed for audit service: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    def _calculate_hmac(self, audit_data: Dict[str, Any]) -> str:
        """Calculate HMAC for audit log integrity."""
        # Create deterministic string from audit data
        hmac_data = "|".join([
            str(audit_data.get("organization_id", "")),
            str(audit_data.get("actor_user_id", "")),
            str(audit_data.get("actor_type", "")),
            str(audit_data.get("action", "")),
            str(audit_data.get("resource_type", "")),
            str(audit_data.get("resource_id", "")),
            str(audit_data.get("created_at", ""))
        ])
        
        return hmac.new(
            self.hmac_key.encode('utf-8'),
            hmac_data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    async def log_event(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        actor_user_id: Optional[UUID] = None,
        actor_type: str = "user",
        organization_id: Optional[UUID] = None,
        outcome: str = "success",
        details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[UUID] = None,
        duration_ms: Optional[int] = None,
        batch: bool = True
    ) -> UUID:
        """Log audit event with HMAC integrity."""
        audit_id = uuid4()
        created_at = datetime.utcnow()
        
        audit_data = {
            "id": audit_id,
            "organization_id": organization_id,
            "actor_user_id": actor_user_id,
            "actor_type": actor_type,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "outcome": outcome,
            "details": details or {},
            "metadata": metadata or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "request_id": request_id,
            "duration_ms": duration_ms,
            "created_at": created_at
        }
        
        # Calculate HMAC
        audit_data["hmac_checksum"] = self._calculate_hmac(audit_data)
        
        if batch and self.redis_client:
            await self._add_to_batch(audit_data)
        else:
            await self._write_audit_log(audit_data)
        
        return audit_id
    
    async def create_audit_log(
        self,
        log_data: AuditLogCreate,
        organization_id: UUID,
        actor_user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLogRead:
        """Create new audit log entry (legacy method)."""
        audit_id = await self.log_event(
            action=log_data.action,
            resource_type=log_data.resource_type,
            resource_id=log_data.resource_id,
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            details=log_data.changes,
            metadata=log_data.metadata,
            ip_address=ip_address,
            user_agent=user_agent,
            batch=False  # Legacy method writes immediately
        )
        
        # Return the created audit log
        audit_log = await self.get_audit_log_by_id(audit_id)
        return audit_log
    
    async def _add_to_batch(self, audit_data: Dict[str, Any]):
        """Add audit log to batch queue."""
        async with self._batch_lock:
            self._batch_queue.append(audit_data)
            
            # Flush batch if it reaches size limit
            if len(self._batch_queue) >= self.batch_size:
                await self._flush_batch()
    
    async def _flush_batch(self):
        """Flush batched audit logs to database."""
        if not self._batch_queue:
            return
        
        batch = self._batch_queue.copy()
        self._batch_queue.clear()
        
        try:
            # Bulk insert
            audit_logs = []
            for data in batch:
                audit_log = AuditLog(
                    id=data["id"],
                    organization_id=data["organization_id"],
                    actor_user_id=data["actor_user_id"],
                    actor_type=data["actor_type"],
                    action=data["action"],
                    resource_type=data["resource_type"],
                    resource_id=data["resource_id"],
                    outcome=data["outcome"],
                    changes=data["details"],  # Map details to changes for compatibility
                    metadata=data["metadata"],
                    ip_address=data["ip_address"],
                    user_agent=data["user_agent"],
                    request_id=data["request_id"],
                    duration_ms=data["duration_ms"],
                    hmac_checksum=data["hmac_checksum"],
                    created_at=data["created_at"],
                    correlation_id=data["request_id"] or uuid4(),
                    severity="info"  # Default severity
                )
                audit_logs.append(audit_log)
            
            self.session.add_all(audit_logs)
            await self.session.commit()
            
            logger.debug(f"Flushed {len(batch)} audit logs to database")
            
        except Exception as e:
            logger.error(f"Failed to flush audit batch: {e}")
            await self.session.rollback()
            
            # Try individual inserts as fallback
            for data in batch:
                try:
                    await self._write_audit_log(data)
                except Exception as individual_error:
                    logger.error(f"Failed to write individual audit log: {individual_error}")
    
    async def _write_audit_log(self, audit_data: Dict[str, Any]):
        """Write single audit log to database."""
        try:
            audit_log = AuditLog(
                id=audit_data["id"],
                organization_id=audit_data["organization_id"],
                actor_user_id=audit_data["actor_user_id"],
                actor_type=audit_data["actor_type"],
                action=audit_data["action"],
                resource_type=audit_data["resource_type"],
                resource_id=audit_data["resource_id"],
                outcome=audit_data["outcome"],
                changes=audit_data["details"],
                metadata=audit_data["metadata"],
                ip_address=audit_data["ip_address"],
                user_agent=audit_data["user_agent"],
                request_id=audit_data["request_id"],
                duration_ms=audit_data["duration_ms"],
                hmac_checksum=audit_data["hmac_checksum"],
                created_at=audit_data["created_at"],
                correlation_id=audit_data["request_id"] or uuid4(),
                severity="info"
            )
            
            self.session.add(audit_log)
            await self.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            await self.session.rollback()
            raise
    
    async def get_audit_logs(
        self,
        organization_id: UUID,
        filters: Optional[AuditLogFilter] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLogRead]:
        """Get audit logs with filtering."""
        query = select(AuditLog).where(AuditLog.organization_id == organization_id)
        
        # Apply filters
        if filters:
            if filters.actor_user_id:
                query = query.where(AuditLog.actor_user_id == filters.actor_user_id)
            
            if filters.actor_type:
                query = query.where(AuditLog.actor_type == filters.actor_type)
            
            if filters.action:
                query = query.where(AuditLog.action == filters.action)
            
            if filters.resource_type:
                query = query.where(AuditLog.resource_type == filters.resource_type)
            
            if filters.resource_id:
                query = query.where(AuditLog.resource_id == filters.resource_id)
            
            if filters.severity:
                query = query.where(AuditLog.severity == filters.severity)
            
            if filters.start_date:
                query = query.where(AuditLog.created_at >= filters.start_date)
            
            if filters.end_date:
                query = query.where(AuditLog.created_at <= filters.end_date)
        
        # Order by most recent first
        query = query.order_by(desc(AuditLog.created_at))
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        result = await self.session.execute(query)
        logs = result.scalars().all()
        
        return [
            AuditLogRead(
                id=log.id,
                organization_id=log.organization_id,
                actor_user_id=log.actor_user_id,
                actor_type=log.actor_type,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                changes=log.changes,
                metadata=log.metadata,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                correlation_id=log.correlation_id,
                severity=log.severity,
                created_at=log.created_at
            )
            for log in logs
        ]
    
    async def get_audit_log_by_id(self, log_id: UUID) -> Optional[AuditLogRead]:
        """Get specific audit log by ID."""
        stmt = select(AuditLog).where(AuditLog.id == log_id)
        result = await self.session.execute(stmt)
        log = result.scalar_one_or_none()
        
        if not log:
            return None
        
        return AuditLogRead(
            id=log.id,
            organization_id=log.organization_id,
            actor_user_id=log.actor_user_id,
            actor_type=log.actor_type,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            changes=log.changes,
            metadata=log.metadata,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            correlation_id=log.correlation_id,
            severity=log.severity,
            created_at=log.created_at
        )
    
    async def verify_integrity(
        self,
        audit_log_id: UUID,
        organization_id: Optional[UUID] = None
    ) -> bool:
        """Verify HMAC integrity of audit log."""
        stmt = select(AuditLog).where(AuditLog.id == audit_log_id)
        if organization_id:
            stmt = stmt.where(AuditLog.organization_id == organization_id)
        
        result = await self.session.execute(stmt)
        audit_log = result.scalar_one_or_none()
        
        if not audit_log:
            return False
        
        # Recalculate HMAC
        audit_data = {
            "organization_id": audit_log.organization_id,
            "actor_user_id": audit_log.actor_user_id,
            "actor_type": audit_log.actor_type,
            "action": audit_log.action,
            "resource_type": audit_log.resource_type,
            "resource_id": audit_log.resource_id,
            "created_at": audit_log.created_at
        }
        
        expected_hmac = self._calculate_hmac(audit_data)
        return expected_hmac == audit_log.hmac_checksum
    
    async def get_audit_statistics(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get audit statistics for organization."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Total logs count
        total_stmt = select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= start_date
            )
        )
        total_result = await self.session.execute(total_stmt)
        total_logs = total_result.scalar()
        
        # Logs by severity
        severity_stmt = select(
            AuditLog.severity,
            func.count(AuditLog.id)
        ).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= start_date
            )
        ).group_by(AuditLog.severity)
        
        severity_result = await self.session.execute(severity_stmt)
        severity_counts = dict(severity_result.fetchall())
        
        # Logs by action
        action_stmt = select(
            AuditLog.action,
            func.count(AuditLog.id)
        ).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= start_date
            )
        ).group_by(AuditLog.action).limit(10)
        
        action_result = await self.session.execute(action_stmt)
        action_counts = dict(action_result.fetchall())
        
        # Logs by resource type
        resource_stmt = select(
            AuditLog.resource_type,
            func.count(AuditLog.id)
        ).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= start_date
            )
        ).group_by(AuditLog.resource_type)
        
        resource_result = await self.session.execute(resource_stmt)
        resource_counts = dict(resource_result.fetchall())
        
        return {
            "total_logs": total_logs,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": datetime.utcnow().isoformat(),
            "by_severity": severity_counts,
            "by_action": action_counts,
            "by_resource_type": resource_counts
        }
    
    async def search_audit_logs(
        self,
        organization_id: UUID,
        search_term: str,
        limit: int = 50
    ) -> List[AuditLogRead]:
        """Search audit logs by action, resource type, or metadata."""
        # Simple text search in action, resource_type, and metadata
        query = select(AuditLog).where(
            and_(
                AuditLog.organization_id == organization_id,
                (
                    AuditLog.action.ilike(f"%{search_term}%") |
                    AuditLog.resource_type.ilike(f"%{search_term}%") |
                    AuditLog.metadata.astext.ilike(f"%{search_term}%")
                )
            )
        ).order_by(desc(AuditLog.created_at)).limit(limit)
        
        result = await self.session.execute(query)
        logs = result.scalars().all()
        
        return [
            AuditLogRead(
                id=log.id,
                organization_id=log.organization_id,
                actor_user_id=log.actor_user_id,
                actor_type=log.actor_type,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                changes=log.changes,
                metadata=log.metadata,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                correlation_id=log.correlation_id,
                severity=log.severity,
                created_at=log.created_at
            )
            for log in logs
        ]
    
    async def cleanup_old_logs(
        self,
        organization_id: UUID,
        retention_days: int = 365
    ) -> int:
        """Clean up old audit logs based on retention policy."""
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Count logs to be deleted
        count_stmt = select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at < cutoff_date
            )
        )
        count_result = await self.session.execute(count_stmt)
        count = count_result.scalar()
        
        # Delete old logs
        delete_stmt = select(AuditLog).where(
            and_(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at < cutoff_date
            )
        )
        delete_result = await self.session.execute(delete_stmt)
        old_logs = delete_result.scalars().all()
        
        for log in old_logs:
            await self.session.delete(log)
        
        await self.session.commit()
        
        return count
    
    async def get_audit_trail(
        self,
        organization_id: UUID,
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        actor_user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        outcome: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get audit trail with enhanced filtering."""
        stmt = (
            select(AuditLog, User.email.label("actor_email"))
            .outerjoin(User, AuditLog.actor_user_id == User.id)
            .where(AuditLog.organization_id == organization_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        # Apply filters
        if resource_type:
            stmt = stmt.where(AuditLog.resource_type == resource_type)
        if resource_id:
            stmt = stmt.where(AuditLog.resource_id == resource_id)
        if actor_user_id:
            stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if outcome:
            stmt = stmt.where(AuditLog.outcome == outcome)
        if start_time:
            stmt = stmt.where(AuditLog.created_at >= start_time)
        if end_time:
            stmt = stmt.where(AuditLog.created_at <= end_time)
        
        result = await self.session.execute(stmt)
        rows = result.all()
        
        audit_entries = []
        for audit_log, actor_email in rows:
            entry = {
                "id": str(audit_log.id),
                "organization_id": str(audit_log.organization_id) if audit_log.organization_id else None,
                "actor_user_id": str(audit_log.actor_user_id) if audit_log.actor_user_id else None,
                "actor_email": actor_email,
                "actor_type": audit_log.actor_type,
                "action": audit_log.action,
                "resource_type": audit_log.resource_type,
                "resource_id": str(audit_log.resource_id) if audit_log.resource_id else None,
                "outcome": audit_log.outcome,
                "details": audit_log.changes,  # Map changes to details
                "metadata": audit_log.metadata,
                "ip_address": audit_log.ip_address,
                "user_agent": audit_log.user_agent,
                "request_id": str(audit_log.request_id) if audit_log.request_id else None,
                "duration_ms": audit_log.duration_ms,
                "created_at": audit_log.created_at.isoformat(),
                "hmac_checksum": audit_log.hmac_checksum
            }
            audit_entries.append(entry)
        
        return audit_entries
    
    async def export_audit_logs(
        self,
        organization_id: UUID,
        start_time: datetime,
        end_time: datetime,
        format: str = "json"
    ) -> Union[str, bytes]:
        """Export audit logs for compliance."""
        audit_logs = await self.get_audit_trail(
            organization_id=organization_id,
            start_time=start_time,
            end_time=end_time,
            limit=10000  # Large limit for export
        )
        
        export_data = {
            "organization_id": str(organization_id),
            "export_period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "total_records": len(audit_logs),
            "exported_at": datetime.utcnow().isoformat(),
            "format_version": "1.0",
            "audit_logs": audit_logs
        }
        
        if format.lower() == "json":
            return json.dumps(export_data, indent=2, default=str)
        elif format.lower() == "csv":
            import csv
            import io
            
            output = io.StringIO()
            if audit_logs:
                fieldnames = audit_logs[0].keys()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(audit_logs)
            
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    async def force_flush_batch(self):
        """Force flush any pending batch entries."""
        async with self._batch_lock:
            if self._batch_queue:
                await self._flush_batch()


# Audit decorators for automatic logging
def audit_action(
    action: str,
    resource_type: str,
    extract_resource_id: Optional[Callable] = None,
    extract_details: Optional[Callable] = None,
    batch: bool = True
):
    """Decorator for automatic audit logging of function calls."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            audit_service = None
            request_id = None
            user_id = None
            organization_id = None
            ip_address = None
            user_agent = None
            outcome = "success"
            error_details = None
            resource_id = None
            details = {}
            
            try:
                # Extract context from function arguments
                for arg in args:
                    if hasattr(arg, 'session') and hasattr(arg.session, 'execute'):
                        # Found service with database session
                        audit_service = AuditService(arg.session)
                        await audit_service.initialize_redis()
                        break
                
                # Extract request context if available
                for arg in args + tuple(kwargs.values()):
                    if isinstance(arg, Request):
                        request_id = getattr(arg.state, 'request_id', None)
                        user_id = getattr(arg.state, 'user_id', None)
                        organization_id = getattr(arg.state, 'organization_id', None)
                        ip_address = arg.client.host if arg.client else None
                        user_agent = arg.headers.get('user-agent')
                        break
                
                # Execute the function
                result = await func(*args, **kwargs)
                
                # Extract resource ID from result or arguments
                if extract_resource_id:
                    try:
                        resource_id = extract_resource_id(result, *args, **kwargs)
                    except Exception as e:
                        logger.warning(f"Failed to extract resource ID: {e}")
                
                # Extract additional details
                if extract_details:
                    try:
                        details = extract_details(result, *args, **kwargs)
                    except Exception as e:
                        logger.warning(f"Failed to extract audit details: {e}")
                
                return result
                
            except Exception as e:
                outcome = "failure"
                error_details = {"error": str(e), "error_type": type(e).__name__}
                raise
                
            finally:
                if audit_service:
                    try:
                        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                        
                        await audit_service.log_event(
                            action=action,
                            resource_type=resource_type,
                            resource_id=resource_id,
                            actor_user_id=user_id,
                            organization_id=organization_id,
                            outcome=outcome,
                            details=error_details or details,
                            ip_address=ip_address,
                            user_agent=user_agent,
                            request_id=request_id,
                            duration_ms=duration_ms,
                            batch=batch
                        )
                        
                        await audit_service.close_redis()
                        
                    except Exception as audit_error:
                        logger.error(f"Failed to log audit event: {audit_error}")
        
        return wrapper
    return decorator


class AuditContext:
    """Context manager for audit logging."""
    
    def __init__(
        self,
        audit_service: AuditService,
        action: str,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        actor_user_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.audit_service = audit_service
        self.action = action
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.actor_user_id = actor_user_id
        self.organization_id = organization_id
        self.metadata = metadata or {}
        self.start_time = None
        self.outcome = "success"
        self.details = {}
    
    async def __aenter__(self):
        self.start_time = datetime.utcnow()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.outcome = "failure"
            self.details["error"] = str(exc_val)
            self.details["error_type"] = exc_type.__name__
        
        duration_ms = int((datetime.utcnow() - self.start_time).total_seconds() * 1000)
        
        try:
            await self.audit_service.log_event(
                action=self.action,
                resource_type=self.resource_type,
                resource_id=self.resource_id,
                actor_user_id=self.actor_user_id,
                organization_id=self.organization_id,
                outcome=self.outcome,
                details=self.details,
                metadata=self.metadata,
                duration_ms=duration_ms
            )
        except Exception as e:
            logger.error(f"Failed to log audit event in context: {e}")
    
    def add_detail(self, key: str, value: Any):
        """Add detail to audit log."""
        self.details[key] = value
    
    def set_resource_id(self, resource_id: UUID):
        """Set resource ID after it's known."""
        self.resource_id = resource_id


@asynccontextmanager
async def audit_context(
    audit_service: AuditService,
    action: str,
    resource_type: str,
    **kwargs
) -> AuditContext:
    """Async context manager for audit logging."""
    ctx = AuditContext(audit_service, action, resource_type, **kwargs)
    async with ctx:
        yield ctx