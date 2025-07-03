"""Enhanced metrics collection and reporting service with real-time aggregation."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
import statistics

from fastapi import HTTPException, status
from sqlalchemy import select, desc, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.models.audit import MetricData
from app.schemas.metrics import (
    MetricCreate, MetricRead, MetricFilter, MetricAggregation
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EnhancedMetricsService:
    """Enhanced metrics collection service with real-time aggregation and TimescaleDB support."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.redis_client: Optional[redis.Redis] = None
        self._aggregation_queue = asyncio.Queue()
        self._aggregation_worker_running = False
        self.batch_size = 1000
        self.batch_timeout = 60  # seconds
    
    async def initialize_redis(self):
        """Initialize Redis connection for real-time metrics."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            logger.info("Redis connection established for metrics service")
        except Exception as e:
            logger.warning(f"Redis connection failed for metrics service: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    # Real-time metrics collection
    async def collect_request_metrics(
        self,
        organization_id: Optional[UUID],
        route: str,
        method: str,
        status_code: int,
        duration_ms: int,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        error_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Collect HTTP request metrics."""
        metric_data = {
            "organization_id": organization_id,
            "route": route,
            "method": method,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "request_size": request_size,
            "response_size": response_size,
            "error_type": error_type,
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow()
        }
        
        # Store in raw metrics table
        await self._store_raw_metric(metric_data)
        
        # Update real-time counters in Redis
        await self._update_realtime_counters(metric_data)
        
        # Queue for aggregation
        await self._queue_for_aggregation(metric_data)
    
    async def _store_raw_metric(self, metric_data: Dict[str, Any]):
        """Store raw metric in database."""
        try:
            await self.session.execute(
                text("""
                    INSERT INTO metrics_raw (
                        organization_id, route, method, status_code, duration_ms,
                        request_size, response_size, error_type, user_id,
                        ip_address, user_agent, created_at
                    ) VALUES (
                        :organization_id, :route, :method, :status_code, :duration_ms,
                        :request_size, :response_size, :error_type, :user_id,
                        :ip_address, :user_agent, :created_at
                    )
                """),
                metric_data
            )
            await self.session.commit()
        except Exception as e:
            logger.error(f"Failed to store raw metric: {e}")
            await self.session.rollback()
    
    async def _update_realtime_counters(self, metric_data: Dict[str, Any]):
        """Update real-time counters in Redis."""
        if not self.redis_client:
            return
        
        try:
            org_id = str(metric_data["organization_id"]) if metric_data["organization_id"] else "global"
            current_minute = datetime.utcnow().replace(second=0, microsecond=0)
            
            # Update various counter keys
            keys = [
                f"metrics:requests:{org_id}:{current_minute.isoformat()}",
                f"metrics:route:{org_id}:{metric_data['route']}:{current_minute.isoformat()}",
                f"metrics:status:{org_id}:{metric_data['status_code']}:{current_minute.isoformat()}"
            ]
            
            if metric_data["error_type"]:
                keys.append(f"metrics:errors:{org_id}:{metric_data['error_type']}:{current_minute.isoformat()}")
            
            # Increment counters with 1-hour expiry
            for key in keys:
                await self.redis_client.incr(key)
                await self.redis_client.expire(key, 3600)
            
            # Store duration for percentile calculations
            duration_key = f"metrics:durations:{org_id}:{current_minute.isoformat()}"
            await self.redis_client.lpush(duration_key, metric_data["duration_ms"])
            await self.redis_client.expire(duration_key, 3600)
            await self.redis_client.ltrim(duration_key, 0, 1000)  # Keep only last 1000 durations
            
        except Exception as e:
            logger.warning(f"Failed to update real-time counters: {e}")
    
    async def _queue_for_aggregation(self, metric_data: Dict[str, Any]):
        """Queue metric for batch aggregation."""
        await self._aggregation_queue.put(metric_data)
        
        # Start aggregation worker if not running
        if not self._aggregation_worker_running:
            asyncio.create_task(self._aggregation_worker())
    
    async def _aggregation_worker(self):
        """Background worker for metric aggregation."""
        self._aggregation_worker_running = True
        
        try:
            batch = []
            last_flush = datetime.utcnow()
            
            while True:
                try:
                    # Get metric from queue (with timeout)
                    metric = await asyncio.wait_for(
                        self._aggregation_queue.get(), timeout=10
                    )
                    batch.append(metric)
                    
                    # Flush batch if it reaches size limit or timeout
                    now = datetime.utcnow()
                    if (len(batch) >= self.batch_size or 
                        (now - last_flush).total_seconds() >= self.batch_timeout):
                        await self._process_aggregation_batch(batch)
                        batch = []
                        last_flush = now
                    
                except asyncio.TimeoutError:
                    # Timeout reached, flush any pending batch
                    if batch:
                        await self._process_aggregation_batch(batch)
                        batch = []
                        last_flush = datetime.utcnow()
                except Exception as e:
                    logger.error(f"Aggregation worker error: {e}")
        finally:
            self._aggregation_worker_running = False
    
    async def _process_aggregation_batch(self, batch: List[Dict[str, Any]]):
        """Process a batch of metrics for aggregation."""
        try:
            # Group metrics by minute and route/method
            grouped = {}
            for metric in batch:
                bucket_time = metric["created_at"].replace(second=0, microsecond=0)
                key = (
                    metric["organization_id"],
                    bucket_time,
                    metric["route"],
                    metric["method"]
                )
                
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append(metric)
            
            # Create or update aggregated metrics
            for (org_id, bucket_time, route, method), metrics in grouped.items():
                await self._update_aggregate_metrics(org_id, bucket_time, route, method, metrics)
                
        except Exception as e:
            logger.error(f"Failed to process aggregation batch: {e}")
    
    async def _update_aggregate_metrics(
        self,
        organization_id: Optional[UUID],
        bucket_time: datetime,
        route: str,
        method: str,
        metrics: List[Dict[str, Any]]
    ):
        """Update 1-minute aggregated metrics."""
        try:
            durations = [m["duration_ms"] for m in metrics]
            request_bytes = sum(m["request_size"] or 0 for m in metrics)
            response_bytes = sum(m["response_size"] or 0 for m in metrics)
            total_errors = sum(1 for m in metrics if m["status_code"] >= 400)
            unique_users = len(set(m["user_id"] for m in metrics if m["user_id"]))
            
            # Calculate percentiles
            durations.sort()
            p50 = durations[len(durations) // 2] if durations else 0
            p95 = durations[int(len(durations) * 0.95)] if durations else 0
            p99 = durations[int(len(durations) * 0.99)] if durations else 0
            
            # Build error breakdown
            error_breakdown = {}
            for metric in metrics:
                if metric["error_type"]:
                    error_breakdown[metric["error_type"]] = error_breakdown.get(metric["error_type"], 0) + 1
            
            # Upsert aggregated metrics
            await self.session.execute(
                text("""
                    INSERT INTO metrics_aggregate_1min (
                        organization_id, bucket_time, route, method,
                        total_requests, total_errors, avg_duration_ms,
                        p50_duration_ms, p95_duration_ms, p99_duration_ms,
                        total_request_bytes, total_response_bytes,
                        unique_users, error_breakdown
                    ) VALUES (
                        :organization_id, :bucket_time, :route, :method,
                        :total_requests, :total_errors, :avg_duration_ms,
                        :p50_duration_ms, :p95_duration_ms, :p99_duration_ms,
                        :total_request_bytes, :total_response_bytes,
                        :unique_users, :error_breakdown
                    )
                    ON CONFLICT (organization_id, bucket_time, route, method)
                    DO UPDATE SET
                        total_requests = EXCLUDED.total_requests + metrics_aggregate_1min.total_requests,
                        total_errors = EXCLUDED.total_errors + metrics_aggregate_1min.total_errors,
                        avg_duration_ms = (EXCLUDED.avg_duration_ms + metrics_aggregate_1min.avg_duration_ms) / 2,
                        p50_duration_ms = EXCLUDED.p50_duration_ms,
                        p95_duration_ms = EXCLUDED.p95_duration_ms,
                        p99_duration_ms = EXCLUDED.p99_duration_ms,
                        total_request_bytes = EXCLUDED.total_request_bytes + metrics_aggregate_1min.total_request_bytes,
                        total_response_bytes = EXCLUDED.total_response_bytes + metrics_aggregate_1min.total_response_bytes,
                        unique_users = EXCLUDED.unique_users,
                        error_breakdown = EXCLUDED.error_breakdown
                """),
                {
                    "organization_id": organization_id,
                    "bucket_time": bucket_time,
                    "route": route,
                    "method": method,
                    "total_requests": len(metrics),
                    "total_errors": total_errors,
                    "avg_duration_ms": statistics.mean(durations) if durations else 0,
                    "p50_duration_ms": p50,
                    "p95_duration_ms": p95,
                    "p99_duration_ms": p99,
                    "total_request_bytes": request_bytes,
                    "total_response_bytes": response_bytes,
                    "unique_users": unique_users,
                    "error_breakdown": error_breakdown
                }
            )
            await self.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to update aggregate metrics: {e}")
            await self.session.rollback()
    
    # Real-time metrics retrieval
    async def get_realtime_metrics(
        self,
        organization_id: Optional[UUID] = None,
        minutes: int = 15
    ) -> Dict[str, Any]:
        """Get real-time metrics from Redis."""
        if not self.redis_client:
            return {"error": "Redis not available"}
        
        try:
            org_id = str(organization_id) if organization_id else "global"
            now = datetime.utcnow()
            
            metrics = {
                "total_requests": 0,
                "error_rate": 0,
                "avg_duration": 0,
                "requests_per_minute": [],
                "error_breakdown": {},
                "top_routes": {},
                "status_codes": {}
            }
            
            # Get metrics for the last N minutes
            for i in range(minutes):
                minute = (now - timedelta(minutes=i)).replace(second=0, microsecond=0)
                
                # Total requests
                requests_key = f"metrics:requests:{org_id}:{minute.isoformat()}"
                requests = await self.redis_client.get(requests_key)
                requests_count = int(requests) if requests else 0
                metrics["total_requests"] += requests_count
                metrics["requests_per_minute"].append({
                    "minute": minute.isoformat(),
                    "requests": requests_count
                })
                
                # Get durations for this minute
                duration_key = f"metrics:durations:{org_id}:{minute.isoformat()}"
                durations = await self.redis_client.lrange(duration_key, 0, -1)
                if durations:
                    avg_duration = sum(int(d) for d in durations) / len(durations)
                    metrics["avg_duration"] = (metrics["avg_duration"] + avg_duration) / 2
            
            # Get error breakdown and status codes
            pattern = f"metrics:errors:{org_id}:*"
            error_keys = await self.redis_client.keys(pattern)
            for key in error_keys:
                error_type = key.split(":")[-2]
                count = await self.redis_client.get(key)
                metrics["error_breakdown"][error_type] = int(count) if count else 0
            
            # Calculate error rate
            total_errors = sum(metrics["error_breakdown"].values())
            metrics["error_rate"] = (total_errors / metrics["total_requests"] * 100) if metrics["total_requests"] > 0 else 0
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get real-time metrics: {e}")
            return {"error": str(e)}
    
    # Advanced analytics
    async def get_performance_trends(
        self,
        organization_id: Optional[UUID] = None,
        hours: int = 24,
        granularity: str = "hour"  # minute, hour, day
    ) -> Dict[str, Any]:
        """Get performance trends over time."""
        if granularity == "minute":
            table = "metrics_aggregate_1min"
            date_trunc = "minute"
        elif granularity == "hour":
            table = "metrics_aggregate_hourly"
            date_trunc = "hour"
        else:
            table = "metrics_aggregate_hourly"
            date_trunc = "day"
        
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        result = await self.session.execute(
            text(f"""
                SELECT 
                    DATE_TRUNC('{date_trunc}', bucket_time) as time_bucket,
                    SUM(total_requests) as requests,
                    SUM(total_errors) as errors,
                    AVG(avg_duration_ms) as avg_duration,
                    AVG(p95_duration_ms) as p95_duration,
                    SUM(unique_users) as unique_users
                FROM {table}
                WHERE bucket_time >= :start_time
                {"AND organization_id = :org_id" if organization_id else ""}
                GROUP BY time_bucket
                ORDER BY time_bucket
            """),
            {
                "start_time": start_time,
                "org_id": organization_id
            }
        )
        
        trends = []
        for row in result.fetchall():
            trends.append({
                "time": row[0].isoformat(),
                "requests": row[1] or 0,
                "errors": row[2] or 0,
                "error_rate": (row[2] / row[1] * 100) if row[1] and row[1] > 0 else 0,
                "avg_duration": float(row[3]) if row[3] else 0,
                "p95_duration": float(row[4]) if row[4] else 0,
                "unique_users": row[5] or 0
            })
        
        return {
            "granularity": granularity,
            "period_hours": hours,
            "trends": trends
        }
    
    async def get_route_analytics(
        self,
        organization_id: Optional[UUID] = None,
        hours: int = 24,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get analytics for top routes."""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        result = await self.session.execute(
            text("""
                SELECT 
                    route,
                    method,
                    SUM(total_requests) as total_requests,
                    SUM(total_errors) as total_errors,
                    AVG(avg_duration_ms) as avg_duration,
                    AVG(p95_duration_ms) as p95_duration,
                    AVG(p99_duration_ms) as p99_duration
                FROM metrics_aggregate_1min
                WHERE bucket_time >= :start_time
                {"AND organization_id = :org_id" if organization_id else ""}
                GROUP BY route, method
                ORDER BY total_requests DESC
                LIMIT :limit
            """),
            {
                "start_time": start_time,
                "org_id": organization_id,
                "limit": limit
            }
        )
        
        routes = []
        for row in result.fetchall():
            routes.append({
                "route": row[0],
                "method": row[1],
                "total_requests": row[2] or 0,
                "total_errors": row[3] or 0,
                "error_rate": (row[3] / row[2] * 100) if row[2] and row[2] > 0 else 0,
                "avg_duration": float(row[4]) if row[4] else 0,
                "p95_duration": float(row[5]) if row[5] else 0,
                "p99_duration": float(row[6]) if row[6] else 0
            })
        
        return {
            "period_hours": hours,
            "routes": routes
        }
    
    async def get_user_analytics(
        self,
        organization_id: UUID,
        hours: int = 24,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get analytics for top users."""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        result = await self.session.execute(
            text("""
                SELECT 
                    user_id,
                    COUNT(*) as request_count,
                    AVG(duration_ms) as avg_duration,
                    COUNT(*) FILTER (WHERE status_code >= 400) as error_count
                FROM metrics_raw
                WHERE created_at >= :start_time
                AND organization_id = :org_id
                AND user_id IS NOT NULL
                GROUP BY user_id
                ORDER BY request_count DESC
                LIMIT :limit
            """),
            {
                "start_time": start_time,
                "org_id": organization_id,
                "limit": limit
            }
        )
        
        users = []
        for row in result.fetchall():
            users.append({
                "user_id": str(row[0]),
                "request_count": row[1],
                "avg_duration": float(row[2]) if row[2] else 0,
                "error_count": row[3],
                "error_rate": (row[3] / row[1] * 100) if row[1] > 0 else 0
            })
        
        return {
            "period_hours": hours,
            "users": users
        }
    
    # Policy violation metrics
    async def record_policy_violation(
        self,
        organization_id: UUID,
        user_id: Optional[UUID],
        policy_type: str,
        violation_type: str,
        severity: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Record a policy violation metric."""
        await self.session.execute(
            text("""
                INSERT INTO policy_violation_metrics (
                    organization_id, user_id, policy_type, violation_type,
                    severity, resource_type, resource_id, details
                ) VALUES (
                    :organization_id, :user_id, :policy_type, :violation_type,
                    :severity, :resource_type, :resource_id, :details
                )
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "policy_type": policy_type,
                "violation_type": violation_type,
                "severity": severity,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "details": details or {}
            }
        )
        await self.session.commit()
    
    async def get_policy_violation_stats(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get policy violation statistics."""
        start_time = datetime.utcnow() - timedelta(days=days)
        
        # Total violations
        total_result = await self.session.execute(
            text("""
                SELECT COUNT(*) FROM policy_violation_metrics
                WHERE organization_id = :org_id AND created_at >= :start_time
            """),
            {"org_id": organization_id, "start_time": start_time}
        )
        
        # Violations by type
        type_result = await self.session.execute(
            text("""
                SELECT policy_type, violation_type, COUNT(*)
                FROM policy_violation_metrics
                WHERE organization_id = :org_id AND created_at >= :start_time
                GROUP BY policy_type, violation_type
                ORDER BY COUNT(*) DESC
                LIMIT 10
            """),
            {"org_id": organization_id, "start_time": start_time}
        )
        
        # Violations by severity
        severity_result = await self.session.execute(
            text("""
                SELECT severity, COUNT(*)
                FROM policy_violation_metrics
                WHERE organization_id = :org_id AND created_at >= :start_time
                GROUP BY severity
            """),
            {"org_id": organization_id, "start_time": start_time}
        )
        
        return {
            "total_violations": total_result.scalar(),
            "period_days": days,
            "by_type": [
                {"policy_type": row[0], "violation_type": row[1], "count": row[2]}
                for row in type_result.fetchall()
            ],
            "by_severity": [
                {"severity": row[0], "count": row[1]}
                for row in severity_result.fetchall()
            ]
        }
    
    # Legacy compatibility methods
    async def record_metric(
        self,
        metric_data: MetricCreate,
        organization_id: Optional[UUID] = None
    ) -> MetricRead:
        """Record a metric (legacy compatibility)."""
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
    
    # Cleanup and maintenance
    async def cleanup_old_raw_metrics(self, days: int = 7) -> int:
        """Clean up old raw metrics (keep only for X days)."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.session.execute(
            text("SELECT COUNT(*) FROM metrics_raw WHERE created_at < :cutoff"),
            {"cutoff": cutoff_date}
        )
        count = result.scalar()
        
        await self.session.execute(
            text("DELETE FROM metrics_raw WHERE created_at < :cutoff"),
            {"cutoff": cutoff_date}
        )
        await self.session.commit()
        
        return count
    
    async def run_hourly_aggregation(self):
        """Run hourly aggregation process."""
        # Use the database function for aggregation
        last_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
        end_hour = last_hour + timedelta(hours=1)
        
        await self.session.execute(
            text("SELECT rollup_metrics_hourly(:start_time, :end_time)"),
            {"start_time": last_hour, "end_time": end_hour}
        )
        await self.session.commit()
        
        logger.info(f"Completed hourly aggregation for {last_hour}")


# Utility decorators for automatic metrics collection
def collect_metrics(
    metric_name: str,
    dimensions: Optional[Dict[str, str]] = None,
    include_duration: bool = True
):
    """Decorator to automatically collect metrics for function calls."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            metrics_service = None
            organization_id = None
            
            # Try to find metrics service and organization from args
            for arg in args:
                if hasattr(arg, 'session') and hasattr(arg.session, 'execute'):
                    metrics_service = EnhancedMetricsService(arg.session)
                    break
            
            # Try to find organization_id from kwargs or args
            organization_id = kwargs.get('organization_id')
            if not organization_id and args:
                for arg in args:
                    if hasattr(arg, 'organization_id'):
                        organization_id = arg.organization_id
                        break
            
            try:
                result = await func(*args, **kwargs)
                
                if metrics_service and include_duration:
                    duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                    await metrics_service.record_metric(
                        MetricCreate(
                            metric_name=f"{metric_name}.duration",
                            metric_type="gauge",
                            value=duration,
                            unit="ms",
                            dimensions=dimensions or {},
                            tags={"function": func.__name__}
                        ),
                        organization_id=organization_id
                    )
                
                return result
                
            except Exception as e:
                if metrics_service:
                    await metrics_service.record_metric(
                        MetricCreate(
                            metric_name=f"{metric_name}.error",
                            metric_type="counter",
                            value=1,
                            dimensions={**(dimensions or {}), "error_type": type(e).__name__},
                            tags={"function": func.__name__}
                        ),
                        organization_id=organization_id
                    )
                raise
        
        return wrapper
    return decorator