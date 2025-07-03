"""Audit logging routes."""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.audit import AuditLogRead, AuditLogFilter
from app.services.audit import AuditService

router = APIRouter()
security = HTTPBearer()


@router.get("/logs", response_model=BaseResponse[List[AuditLogRead]])
async def get_audit_logs(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    actor_user_id: Optional[UUID] = None,
    actor_type: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[List[AuditLogRead]]:
    """Get audit logs with filtering."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to view audit logs
    
    # Build filters
    filters = AuditLogFilter(
        actor_user_id=actor_user_id,
        actor_type=actor_type,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        severity=severity
    )
    
    audit_service = AuditService(session)
    logs = await audit_service.get_audit_logs(org_id, filters, limit, offset)
    return BaseResponse(data=logs)


@router.get("/logs/{log_id}", response_model=BaseResponse[AuditLogRead])
async def get_audit_log(
    log_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[AuditLogRead]:
    """Get specific audit log by ID."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to view audit logs
    
    audit_service = AuditService(session)
    log = await audit_service.get_audit_log_by_id(log_id)
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )
    
    return BaseResponse(data=log)


@router.get("/logs/search/{search_term}", response_model=BaseResponse[List[AuditLogRead]])
async def search_audit_logs(
    search_term: str,
    limit: int = Query(default=50, le=500),
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[AuditLogRead]]:
    """Search audit logs."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to search audit logs
    
    audit_service = AuditService(session)
    logs = await audit_service.search_audit_logs(org_id, search_term, limit)
    return BaseResponse(data=logs)


@router.get("/statistics", response_model=BaseResponse[dict])
async def get_audit_statistics(
    days: int = Query(default=30, ge=1, le=365),
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Get audit statistics."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to view audit statistics
    
    audit_service = AuditService(session)
    stats = await audit_service.get_audit_statistics(org_id, days)
    return BaseResponse(data=stats)