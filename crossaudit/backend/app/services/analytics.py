"""Analytics and alerting system with anomaly detection."""

import asyncio
import statistics
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
from decimal import Decimal

import aiohttp
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import AlertRule, AlertInstance
from app.models.audit import MetricData
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AnalyticsService:
    """Service for analytics and anomaly detection."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        
        # Anomaly detection thresholds
        self.latency_multiplier = 3.0  # Alert if latency > 3x P95
        self.error_rate_threshold = 0.05  # Alert if error rate > 5%
        self.usage_spike_threshold = 2.0  # Alert if usage > 2x normal
        
        # Time windows for analysis
        self.baseline_hours = 24
        self.anomaly_window_minutes = 5
    
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
        """Collect detailed request metrics."""
        # Create metric records
        metrics = []
        
        # Response time metric
        metrics.append(MetricData(
            organization_id=organization_id,
            metric_name="api.request.duration",
            metric_type="histogram",
            value=Decimal(str(duration_ms)),
            unit="ms",
            dimensions={
                "route": route,
                "method": method,
                "status_code": status_code
            }
        ))
        
        # Request count metric
        metrics.append(MetricData(
            organization_id=organization_id,
            metric_name="api.request.count",
            metric_type="counter",
            value=Decimal("1"),
            unit="requests",
            dimensions={
                "route": route,
                "method": method,
                "status_code": status_code,
                "error_type": error_type
            }
        ))
        
        # Error rate metric
        if status_code >= 400:
            metrics.append(MetricData(
                organization_id=organization_id,
                metric_name="api.error.rate",
                metric_type="gauge",
                value=Decimal("1"),
                unit="errors",
                dimensions={
                    "route": route,
                    "method": method,
                    "error_type": error_type
                }
            ))
        
        # Request/response size metrics
        if request_size:
            metrics.append(MetricData(
                organization_id=organization_id,
                metric_name="api.request.size",
                metric_type="histogram",
                value=Decimal(str(request_size)),
                unit="bytes",
                dimensions={"route": route}
            ))
        
        if response_size:
            metrics.append(MetricData(
                organization_id=organization_id,
                metric_name="api.response.size",
                metric_type="histogram",
                value=Decimal(str(response_size)),
                unit="bytes",
                dimensions={"route": route}
            ))
        
        # Store metrics
        for metric in metrics:
            self.session.add(metric)
        
        await self.session.commit()
        
        # Check for anomalies in real-time
        await self._check_real_time_anomalies(
            organization_id, route, duration_ms, status_code
        )
    
    async def detect_anomalies(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Detect anomalies in metrics."""
        anomalies = []
        
        # Check latency anomalies
        latency_anomalies = await self._detect_latency_anomalies(organization_id)
        anomalies.extend(latency_anomalies)
        
        # Check error rate anomalies
        error_anomalies = await self._detect_error_rate_anomalies(organization_id)
        anomalies.extend(error_anomalies)
        
        # Check usage spike anomalies
        usage_anomalies = await self._detect_usage_anomalies(organization_id)
        anomalies.extend(usage_anomalies)
        
        # Check policy violation spikes
        policy_anomalies = await self._detect_policy_anomalies(organization_id)
        anomalies.extend(policy_anomalies)
        
        return anomalies
    
    async def _detect_latency_anomalies(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Detect latency anomalies (latency > 3x P95)."""
        current_time = datetime.utcnow()
        baseline_start = current_time - timedelta(hours=self.baseline_hours)
        recent_start = current_time - timedelta(minutes=self.anomaly_window_minutes)
        
        # Get baseline P95 latency
        baseline_stmt = text("""
            SELECT 
                dimensions->>'route' as route,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95_latency
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.duration'
            AND created_at BETWEEN :baseline_start AND :recent_start
            GROUP BY dimensions->>'route'
        """)
        
        baseline_result = await self.session.execute(baseline_stmt, {
            "org_id": organization_id,
            "baseline_start": baseline_start,
            "recent_start": recent_start
        })
        
        baseline_latencies = {row[0]: row[1] for row in baseline_result.fetchall()}
        
        # Get recent latencies
        recent_stmt = text("""
            SELECT 
                dimensions->>'route' as route,
                AVG(value) as avg_latency,
                MAX(value) as max_latency,
                COUNT(*) as request_count
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.duration'
            AND created_at >= :recent_start
            GROUP BY dimensions->>'route'
        """)
        
        recent_result = await self.session.execute(recent_stmt, {
            "org_id": organization_id,
            "recent_start": recent_start
        })
        
        anomalies = []
        for row in recent_result.fetchall():
            route, avg_latency, max_latency, count = row
            baseline_p95 = baseline_latencies.get(route, 0)
            
            if baseline_p95 > 0 and avg_latency > baseline_p95 * self.latency_multiplier:
                anomalies.append({
                    "type": "latency_spike",
                    "route": route,
                    "current_avg": float(avg_latency),
                    "baseline_p95": float(baseline_p95),
                    "multiplier": float(avg_latency / baseline_p95),
                    "max_latency": float(max_latency),
                    "request_count": count,
                    "severity": "high" if avg_latency > baseline_p95 * 5 else "medium",
                    "detected_at": current_time.isoformat()
                })
        
        return anomalies
    
    async def _detect_error_rate_anomalies(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Detect error rate anomalies (error rate > 5%)."""
        current_time = datetime.utcnow()
        window_start = current_time - timedelta(minutes=self.anomaly_window_minutes)
        
        # Calculate error rate by route
        stmt = text("""
            WITH request_counts AS (
                SELECT 
                    dimensions->>'route' as route,
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN (dimensions->>'status_code')::int >= 400 THEN 1 END) as error_requests
                FROM metric_data
                WHERE organization_id = :org_id
                AND metric_name = 'api.request.count'
                AND created_at >= :window_start
                GROUP BY dimensions->>'route'
            )
            SELECT 
                route,
                total_requests,
                error_requests,
                CASE WHEN total_requests > 0 
                     THEN error_requests::float / total_requests::float 
                     ELSE 0 END as error_rate
            FROM request_counts
            WHERE total_requests >= 10  -- Minimum requests for statistical significance
        """)
        
        result = await self.session.execute(stmt, {
            "org_id": organization_id,
            "window_start": window_start
        })
        
        anomalies = []
        for row in result.fetchall():
            route, total, errors, error_rate = row
            
            if error_rate > self.error_rate_threshold:
                anomalies.append({
                    "type": "error_rate_spike",
                    "route": route,
                    "error_rate": float(error_rate),
                    "total_requests": total,
                    "error_requests": errors,
                    "threshold": self.error_rate_threshold,
                    "severity": "critical" if error_rate > 0.2 else "high",
                    "detected_at": current_time.isoformat()
                })
        
        return anomalies
    
    async def _detect_usage_anomalies(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Detect usage spike anomalies."""
        current_time = datetime.utcnow()
        baseline_start = current_time - timedelta(hours=self.baseline_hours)
        recent_start = current_time - timedelta(minutes=self.anomaly_window_minutes)
        
        # Compare recent usage to baseline
        stmt = text("""
            WITH baseline AS (
                SELECT 
                    metric_name,
                    AVG(value) as avg_value,
                    STDDEV(value) as stddev_value
                FROM metric_data
                WHERE organization_id = :org_id
                AND metric_name IN ('api.request.count', 'api.request.duration')
                AND created_at BETWEEN :baseline_start AND :recent_start
                GROUP BY metric_name
            ),
            recent AS (
                SELECT 
                    metric_name,
                    AVG(value) as avg_value,
                    COUNT(*) as sample_count
                FROM metric_data
                WHERE organization_id = :org_id
                AND metric_name IN ('api.request.count', 'api.request.duration')
                AND created_at >= :recent_start
                GROUP BY metric_name
            )
            SELECT 
                r.metric_name,
                r.avg_value as recent_avg,
                b.avg_value as baseline_avg,
                b.stddev_value as baseline_stddev,
                r.sample_count
            FROM recent r
            JOIN baseline b ON r.metric_name = b.metric_name
        """)
        
        result = await self.session.execute(stmt, {
            "org_id": organization_id,
            "baseline_start": baseline_start,
            "recent_start": recent_start
        })
        
        anomalies = []
        for row in result.fetchall():
            metric, recent_avg, baseline_avg, baseline_stddev, count = row
            
            if baseline_avg > 0 and recent_avg > baseline_avg * self.usage_spike_threshold:
                spike_ratio = recent_avg / baseline_avg
                
                # Check if it's statistically significant
                z_score = (recent_avg - baseline_avg) / (baseline_stddev or 1)
                
                if z_score > 2:  # 95% confidence
                    anomalies.append({
                        "type": "usage_spike",
                        "metric": metric,
                        "recent_avg": float(recent_avg),
                        "baseline_avg": float(baseline_avg),
                        "spike_ratio": float(spike_ratio),
                        "z_score": float(z_score),
                        "sample_count": count,
                        "severity": "high" if spike_ratio > 3 else "medium",
                        "detected_at": current_time.isoformat()
                    })
        
        return anomalies
    
    async def _detect_policy_anomalies(self, organization_id: UUID) -> List[Dict[str, Any]]:
        """Detect policy violation spikes."""
        current_time = datetime.utcnow()
        window_start = current_time - timedelta(minutes=self.anomaly_window_minutes)
        
        # Get policy violation counts
        stmt = text("""
            SELECT 
                violation_type,
                severity,
                COUNT(*) as violation_count
            FROM policy_violations
            WHERE organization_id = :org_id
            AND created_at >= :window_start
            GROUP BY violation_type, severity
            HAVING COUNT(*) >= 5  -- Minimum violations for alerting
        """)
        
        result = await self.session.execute(stmt, {
            "org_id": organization_id,
            "window_start": window_start
        })
        
        anomalies = []
        for row in result.fetchall():
            violation_type, severity, count = row
            
            # Alert on any policy violation spike
            anomalies.append({
                "type": "policy_violation_spike",
                "violation_type": violation_type,
                "violation_severity": severity,
                "violation_count": count,
                "time_window_minutes": self.anomaly_window_minutes,
                "severity": "critical" if severity == "critical" else "high",
                "detected_at": current_time.isoformat()
            })
        
        return anomalies
    
    async def _check_real_time_anomalies(
        self,
        organization_id: Optional[UUID],
        route: str,
        duration_ms: int,
        status_code: int
    ):
        """Check for real-time anomalies on individual requests."""
        # Quick checks for immediate alerts
        
        # Extremely high latency (>10 seconds)
        if duration_ms > 10000:
            await self._fire_alert(
                organization_id,
                "extreme_latency",
                {
                    "route": route,
                    "duration_ms": duration_ms,
                    "threshold_ms": 10000
                },
                "critical"
            )
        
        # 5xx errors
        if status_code >= 500:
            await self._fire_alert(
                organization_id,
                "server_error",
                {
                    "route": route,
                    "status_code": status_code
                },
                "high"
            )
    
    async def _fire_alert(
        self,
        organization_id: Optional[UUID],
        alert_type: str,
        data: Dict[str, Any],
        severity: str
    ):
        """Fire an alert instance."""
        if not organization_id:
            return
        
        # Check if we have alert rules for this type
        stmt = select(AlertRule).where(
            AlertRule.organization_id == organization_id,
            AlertRule.is_active == True
        )
        
        result = await self.session.execute(stmt)
        alert_rules = result.scalars().all()
        
        for rule in alert_rules:
            if self._rule_matches_alert(rule, alert_type, data):
                await self._create_alert_instance(rule, alert_type, data, severity)
    
    def _rule_matches_alert(
        self,
        rule: AlertRule,
        alert_type: str,
        data: Dict[str, Any]
    ) -> bool:
        """Check if alert rule matches the alert."""
        # Simple matching - could be more sophisticated
        if alert_type == "extreme_latency" and "latency" in rule.metric_name:
            return True
        elif alert_type == "server_error" and "error" in rule.metric_name:
            return True
        elif alert_type == "policy_violation_spike" and "policy" in rule.metric_name:
            return True
        
        return False
    
    async def _create_alert_instance(
        self,
        rule: AlertRule,
        alert_type: str,
        data: Dict[str, Any],
        severity: str
    ):
        """Create an alert instance and send notifications."""
        # Check if we already have a recent alert for this rule
        recent_cutoff = datetime.utcnow() - timedelta(minutes=15)
        
        stmt = select(AlertInstance).where(
            AlertInstance.alert_rule_id == rule.id,
            AlertInstance.resolved_at.is_(None),
            AlertInstance.fired_at > recent_cutoff
        )
        
        result = await self.session.execute(stmt)
        existing_alert = result.scalar_one_or_none()
        
        if existing_alert:
            # Don't spam alerts
            return
        
        # Create alert instance
        alert_instance = AlertInstance(
            organization_id=rule.organization_id,
            alert_rule_id=rule.id,
            severity=severity,
            metric_value=Decimal(str(data.get("duration_ms", 0))),
            message=self._build_alert_message(alert_type, data),
            metadata=data,
            notification_status={}
        )
        
        self.session.add(alert_instance)
        await self.session.commit()
        await self.session.refresh(alert_instance)
        
        # Send notifications
        await self._send_alert_notifications(rule, alert_instance)
    
    def _build_alert_message(self, alert_type: str, data: Dict[str, Any]) -> str:
        """Build human-readable alert message."""
        if alert_type == "extreme_latency":
            return f"Extreme latency detected on {data['route']}: {data['duration_ms']}ms"
        elif alert_type == "server_error":
            return f"Server error on {data['route']}: HTTP {data['status_code']}"
        elif alert_type == "policy_violation_spike":
            return f"Policy violation spike: {data['violation_count']} {data['violation_type']} violations"
        else:
            return f"Anomaly detected: {alert_type}"
    
    async def _send_alert_notifications(
        self,
        rule: AlertRule,
        alert_instance: AlertInstance
    ):
        """Send alert notifications to configured channels."""
        notification_status = {}
        
        for channel in rule.notification_channels:
            try:
                if channel.startswith("https://hooks.slack.com/"):
                    success = await self._send_slack_notification(channel, rule, alert_instance)
                    notification_status[channel] = "sent" if success else "failed"
                
                elif channel.startswith("mailto:"):
                    email = channel[7:]  # Remove mailto: prefix
                    success = await self._send_email_notification(email, rule, alert_instance)
                    notification_status[channel] = "sent" if success else "failed"
                
                elif channel.startswith("https://"):
                    success = await self._send_webhook_notification(channel, rule, alert_instance)
                    notification_status[channel] = "sent" if success else "failed"
                
            except Exception as e:
                logger.error(f"Failed to send notification to {channel}: {e}")
                notification_status[channel] = f"error: {str(e)}"
        
        # Update notification status
        alert_instance.notification_status = notification_status
        await self.session.commit()
    
    async def _send_slack_notification(
        self,
        webhook_url: str,
        rule: AlertRule,
        alert_instance: AlertInstance
    ) -> bool:
        """Send Slack notification."""
        color = {
            "info": "#36a64f",
            "warning": "#ff9500", 
            "critical": "#ff0000"
        }.get(alert_instance.severity, "#cccccc")
        
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"🚨 {rule.name}",
                    "text": alert_instance.message,
                    "fields": [
                        {
                            "title": "Severity",
                            "value": alert_instance.severity.upper(),
                            "short": True
                        },
                        {
                            "title": "Time",
                            "value": alert_instance.fired_at.isoformat(),
                            "short": True
                        }
                    ],
                    "footer": "CrossAudit AI Monitoring",
                    "ts": int(alert_instance.fired_at.timestamp())
                }
            ]
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Slack notification failed: {e}")
            return False
    
    async def _send_email_notification(
        self,
        email: str,
        rule: AlertRule,
        alert_instance: AlertInstance
    ) -> bool:
        """Send email notification."""
        # Would integrate with email service
        logger.info(f"Would send email alert to {email}: {alert_instance.message}")
        return True
    
    async def _send_webhook_notification(
        self,
        webhook_url: str,
        rule: AlertRule,
        alert_instance: AlertInstance
    ) -> bool:
        """Send webhook notification."""
        payload = {
            "alert_type": "anomaly_detected",
            "rule_name": rule.name,
            "severity": alert_instance.severity,
            "message": alert_instance.message,
            "metric_value": float(alert_instance.metric_value) if alert_instance.metric_value else None,
            "metadata": alert_instance.metadata,
            "fired_at": alert_instance.fired_at.isoformat(),
            "organization_id": str(rule.organization_id)
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status < 400
        except Exception as e:
            logger.error(f"Webhook notification failed: {e}")
            return False
    
    # Analytics Dashboard Data
    
    async def get_dashboard_metrics(
        self,
        organization_id: UUID,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get metrics for analytics dashboard."""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Request volume over time
        volume_stmt = text("""
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as request_count
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.count'
            AND created_at >= :start_time
            GROUP BY hour
            ORDER BY hour
        """)
        
        volume_result = await self.session.execute(volume_stmt, {
            "org_id": organization_id,
            "start_time": start_time
        })
        
        volume_data = [
            {"time": row[0].isoformat(), "requests": row[1]}
            for row in volume_result.fetchall()
        ]
        
        # Latency percentiles
        latency_stmt = text("""
            SELECT 
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value) as p50,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
                PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99,
                AVG(value) as mean
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.duration'
            AND created_at >= :start_time
        """)
        
        latency_result = await self.session.execute(latency_stmt, {
            "org_id": organization_id,
            "start_time": start_time
        })
        
        latency_row = latency_result.fetchone()
        latency_stats = {
            "p50": float(latency_row[0]) if latency_row[0] else 0,
            "p95": float(latency_row[1]) if latency_row[1] else 0,
            "p99": float(latency_row[2]) if latency_row[2] else 0,
            "mean": float(latency_row[3]) if latency_row[3] else 0
        }
        
        # Error rate over time
        error_stmt = text("""
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as total_requests,
                COUNT(CASE WHEN (dimensions->>'status_code')::int >= 400 THEN 1 END) as error_requests
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.count'
            AND created_at >= :start_time
            GROUP BY hour
            ORDER BY hour
        """)
        
        error_result = await self.session.execute(error_stmt, {
            "org_id": organization_id,
            "start_time": start_time
        })
        
        error_data = []
        for row in error_result.fetchall():
            hour, total, errors = row
            error_rate = (errors / total * 100) if total > 0 else 0
            error_data.append({
                "time": hour.isoformat(),
                "error_rate": error_rate,
                "total_requests": total,
                "error_requests": errors
            })
        
        # Top routes by volume
        top_routes_stmt = text("""
            SELECT 
                dimensions->>'route' as route,
                COUNT(*) as request_count,
                AVG(value) as avg_latency
            FROM metric_data
            WHERE organization_id = :org_id
            AND metric_name = 'api.request.duration'
            AND created_at >= :start_time
            GROUP BY route
            ORDER BY request_count DESC
            LIMIT 10
        """)
        
        routes_result = await self.session.execute(top_routes_stmt, {
            "org_id": organization_id,
            "start_time": start_time
        })
        
        top_routes = [
            {
                "route": row[0],
                "request_count": row[1],
                "avg_latency": float(row[2]) if row[2] else 0
            }
            for row in routes_result.fetchall()
        ]
        
        return {
            "request_volume": volume_data,
            "latency_stats": latency_stats,
            "error_rates": error_data,
            "top_routes": top_routes,
            "period_hours": hours,
            "generated_at": datetime.utcnow().isoformat()
        }