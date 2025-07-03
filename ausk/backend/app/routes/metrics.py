"""Metrics collection and reporting routes."""

from datetime import datetime
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.metrics import (
    MetricCreate, MetricRead, MetricFilter, MetricAggregation
)
from app.services.metrics import MetricsService

router = APIRouter()
security = HTTPBearer()


@router.post("/", response_model=BaseResponse[MetricRead])
async def record_metric(
    metric_data: MetricCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[MetricRead]:
    """Record a new metric data point."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to record metrics
    
    metrics_service = MetricsService(session)
    metric = await metrics_service.record_metric(metric_data, org_id)
    return BaseResponse(data=metric)


@router.get("/", response_model=BaseResponse[List[MetricRead]])
async def get_metrics(
    limit: int = Query(default=1000, le=5000),
    offset: int = Query(default=0, ge=0),
    metric_name: Optional[str] = None,
    metric_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[List[MetricRead]]:
    """Get metrics with filtering."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to view metrics
    
    # Build filters
    filters = MetricFilter(
        metric_name=metric_name,
        metric_type=metric_type,
        start_date=start_date,
        end_date=end_date
    )
    
    metrics_service = MetricsService(session)
    metrics = await metrics_service.get_metrics(org_id, filters, limit, offset)
    return BaseResponse(data=metrics)


@router.get("/names", response_model=BaseResponse[List[str]])
async def get_metric_names(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[str]]:
    """Get list of available metric names."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    metrics_service = MetricsService(session)
    names = await metrics_service.get_metric_names(org_id)
    return BaseResponse(data=names)


@router.get("/aggregate/{metric_name}", response_model=BaseResponse[dict])
async def aggregate_metric(
    metric_name: str,
    aggregation: MetricAggregation,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    group_by: Optional[List[str]] = Query(default=None),
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[dict]:
    """Aggregate metrics data."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to view metrics
    
    metrics_service = MetricsService(session)
    result = await metrics_service.aggregate_metrics(
        metric_name=metric_name,
        aggregation=aggregation,
        organization_id=org_id,
        start_date=start_date,
        end_date=end_date,
        group_by=group_by
    )
    return BaseResponse(data=result)


@router.get("/system", response_model=BaseResponse[dict])
async def get_system_metrics(
    hours: int = Query(default=24, ge=1, le=168),
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Get system-level metrics for dashboard."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to view system metrics
    
    metrics_service = MetricsService(session)
    metrics = await metrics_service.get_system_metrics(org_id, hours)
    return BaseResponse(data=metrics)