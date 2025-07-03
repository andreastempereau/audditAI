"""Metrics collection and reporting service layer."""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select, desc, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import MetricData
from app.schemas.metrics import (
    MetricCreate, MetricRead, MetricFilter, MetricAggregation
)


class MetricsService:
    """Metrics collection and reporting service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def record_metric(
        self,
        metric_data: MetricCreate,
        organization_id: Optional[UUID] = None
    ) -> MetricRead:
        """Record a new metric data point."""
        metric = MetricData(
            id=uuid4(),
            organization_id=organization_id,
            metric_name=metric_data.metric_name,
            metric_type=metric_data.metric_type,
            value=metric_data.value,
            unit=metric_data.unit,
            dimensions=metric_data.dimensions or {},
            tags=metric_data.tags or {},
            created_at=datetime.utcnow()
        )
        
        self.session.add(metric)
        await self.session.commit()
        await self.session.refresh(metric)
        
        return MetricRead(
            id=metric.id,
            organization_id=metric.organization_id,
            metric_name=metric.metric_name,
            metric_type=metric.metric_type,
            value=metric.value,
            unit=metric.unit,
            dimensions=metric.dimensions,
            tags=metric.tags,
            created_at=metric.created_at
        )
    
    async def get_metrics(
        self,
        organization_id: Optional[UUID] = None,
        filters: Optional[MetricFilter] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> List[MetricRead]:
        """Get metrics with filtering."""
        query = select(MetricData)
        
        # Organization filter
        if organization_id:
            query = query.where(MetricData.organization_id == organization_id)
        
        # Apply filters
        if filters:
            if filters.metric_name:
                query = query.where(MetricData.metric_name == filters.metric_name)
            
            if filters.metric_type:
                query = query.where(MetricData.metric_type == filters.metric_type)
            
            if filters.start_date:
                query = query.where(MetricData.created_at >= filters.start_date)
            
            if filters.end_date:
                query = query.where(MetricData.created_at <= filters.end_date)
            
            if filters.dimensions:
                for key, value in filters.dimensions.items():
                    query = query.where(MetricData.dimensions[key].astext == str(value))
            
            if filters.tags:
                for key, value in filters.tags.items():
                    query = query.where(MetricData.tags[key].astext == str(value))
        
        # Order by most recent first
        query = query.order_by(desc(MetricData.created_at))
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        result = await self.session.execute(query)
        metrics = result.scalars().all()
        
        return [
            MetricRead(
                id=metric.id,
                organization_id=metric.organization_id,
                metric_name=metric.metric_name,
                metric_type=metric.metric_type,
                value=metric.value,
                unit=metric.unit,
                dimensions=metric.dimensions,
                tags=metric.tags,
                created_at=metric.created_at
            )
            for metric in metrics
        ]
    
    async def aggregate_metrics(
        self,
        metric_name: str,
        aggregation: MetricAggregation,
        organization_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        group_by: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Aggregate metrics data."""
        # Build base query
        query = select(MetricData).where(MetricData.metric_name == metric_name)
        
        if organization_id:
            query = query.where(MetricData.organization_id == organization_id)
        
        if start_date:
            query = query.where(MetricData.created_at >= start_date)
        
        if end_date:
            query = query.where(MetricData.created_at <= end_date)
        
        # Get all matching metrics
        result = await self.session.execute(query)
        metrics = result.scalars().all()
        
        if not metrics:
            return {
                "metric_name": metric_name,
                "aggregation": aggregation.value,
                "count": 0,
                "value": None,
                "period": {
                    "start": start_date.isoformat() if start_date else None,
                    "end": end_date.isoformat() if end_date else None
                }
            }
        
        values = [float(metric.value) for metric in metrics]
        
        # Calculate aggregation
        if aggregation == MetricAggregation.SUM:
            agg_value = sum(values)
        elif aggregation == MetricAggregation.AVG:
            agg_value = sum(values) / len(values)
        elif aggregation == MetricAggregation.MIN:
            agg_value = min(values)
        elif aggregation == MetricAggregation.MAX:
            agg_value = max(values)
        elif aggregation == MetricAggregation.COUNT:
            agg_value = len(values)
        else:
            agg_value = sum(values)  # Default to sum
        
        result_data = {
            "metric_name": metric_name,
            "aggregation": aggregation.value,
            "count": len(metrics),
            "value": agg_value,
            "unit": metrics[0].unit if metrics else None,
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            }
        }
        
        # Group by dimensions if requested
        if group_by:
            grouped = {}
            for metric in metrics:
                key_parts = []
                for group_field in group_by:
                    if group_field in metric.dimensions:
                        key_parts.append(f"{group_field}:{metric.dimensions[group_field]}")
                    elif group_field in metric.tags:
                        key_parts.append(f"{group_field}:{metric.tags[group_field]}")
                
                group_key = "|".join(key_parts) if key_parts else "unknown"
                
                if group_key not in grouped:
                    grouped[group_key] = []
                grouped[group_key].append(float(metric.value))
            
            # Calculate aggregation for each group
            group_results = {}
            for group_key, group_values in grouped.items():
                if aggregation == MetricAggregation.SUM:
                    group_results[group_key] = sum(group_values)
                elif aggregation == MetricAggregation.AVG:
                    group_results[group_key] = sum(group_values) / len(group_values)
                elif aggregation == MetricAggregation.MIN:
                    group_results[group_key] = min(group_values)
                elif aggregation == MetricAggregation.MAX:
                    group_results[group_key] = max(group_values)
                elif aggregation == MetricAggregation.COUNT:
                    group_results[group_key] = len(group_values)
                else:
                    group_results[group_key] = sum(group_values)
            
            result_data["groups"] = group_results
        
        return result_data
    
    async def get_metric_names(
        self,
        organization_id: Optional[UUID] = None
    ) -> List[str]:
        """Get list of available metric names."""
        query = select(MetricData.metric_name).distinct()
        
        if organization_id:
            query = query.where(MetricData.organization_id == organization_id)
        
        result = await self.session.execute(query)
        metric_names = result.scalars().all()
        
        return list(metric_names)
    
    async def get_system_metrics(
        self,
        organization_id: Optional[UUID] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get system-level metrics for dashboard."""
        start_date = datetime.utcnow() - timedelta(hours=hours)
        
        # Common system metrics
        metrics_to_fetch = [
            "api.request.count",
            "api.request.duration",
            "api.error.count",
            "auth.login.count",
            "documents.upload.count",
            "chat.message.count"
        ]
        
        system_metrics = {}
        
        for metric_name in metrics_to_fetch:
            # Get total count/sum
            total = await self.aggregate_metrics(
                metric_name=metric_name,
                aggregation=MetricAggregation.SUM,
                organization_id=organization_id,
                start_date=start_date
            )
            
            # Get average if it's a duration metric
            if "duration" in metric_name:
                avg = await self.aggregate_metrics(
                    metric_name=metric_name,
                    aggregation=MetricAggregation.AVG,
                    organization_id=organization_id,
                    start_date=start_date
                )
                system_metrics[metric_name] = {
                    "total": total["value"],
                    "average": avg["value"],
                    "count": total["count"]
                }
            else:
                system_metrics[metric_name] = {
                    "total": total["value"],
                    "count": total["count"]
                }
        
        return {
            "period_hours": hours,
            "start_date": start_date.isoformat(),
            "end_date": datetime.utcnow().isoformat(),
            "metrics": system_metrics
        }
    
    async def cleanup_old_metrics(
        self,
        organization_id: Optional[UUID] = None,
        retention_days: int = 90
    ) -> int:
        """Clean up old metrics based on retention policy."""
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        query = select(MetricData).where(MetricData.created_at < cutoff_date)
        
        if organization_id:
            query = query.where(MetricData.organization_id == organization_id)
        
        # Count metrics to be deleted
        count_stmt = select(func.count(MetricData.id)).where(MetricData.created_at < cutoff_date)
        if organization_id:
            count_stmt = count_stmt.where(MetricData.organization_id == organization_id)
        
        count_result = await self.session.execute(count_stmt)
        count = count_result.scalar()
        
        # Delete old metrics
        result = await self.session.execute(query)
        old_metrics = result.scalars().all()
        
        for metric in old_metrics:
            await self.session.delete(metric)
        
        await self.session.commit()
        
        return count