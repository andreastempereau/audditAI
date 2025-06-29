"""Audit logging service layer."""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, desc, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.schemas.audit import (
    AuditLogCreate, AuditLogRead, AuditLogFilter
)


class AuditService:
    """Audit logging service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_audit_log(
        self,
        log_data: AuditLogCreate,
        organization_id: UUID,
        actor_user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLogRead:
        """Create new audit log entry."""
        audit_log = AuditLog(
            id=uuid4(),
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=log_data.actor_type,
            action=log_data.action,
            resource_type=log_data.resource_type,
            resource_id=log_data.resource_id,
            changes=log_data.changes,
            metadata=log_data.metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            correlation_id=log_data.correlation_id or uuid4(),
            severity=log_data.severity,
            created_at=datetime.utcnow()
        )
        
        self.session.add(audit_log)
        await self.session.commit()
        await self.session.refresh(audit_log)
        
        return AuditLogRead(
            id=audit_log.id,
            organization_id=audit_log.organization_id,
            actor_user_id=audit_log.actor_user_id,
            actor_type=audit_log.actor_type,
            action=audit_log.action,
            resource_type=audit_log.resource_type,
            resource_id=audit_log.resource_id,
            changes=audit_log.changes,
            metadata=audit_log.metadata,
            ip_address=audit_log.ip_address,
            user_agent=audit_log.user_agent,
            correlation_id=audit_log.correlation_id,
            severity=audit_log.severity,
            created_at=audit_log.created_at
        )
    
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