"""Celery application configuration for CrossAudit AI."""

import logging
from celery import Celery
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create Celery instance
celery_app = Celery(
    "crossaudit",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.chat_inference",
        "app.tasks.document_processing",
        "app.tasks.analytics",
        "app.tasks.notifications",
        "app.tasks.governance"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        "app.tasks.chat_inference.*": {"queue": "chat"},
        "app.tasks.document_processing.*": {"queue": "documents"},
        "app.tasks.analytics.*": {"queue": "analytics"},
        "app.tasks.notifications.*": {"queue": "notifications"},
        "app.tasks.governance.*": {"queue": "governance"},
    },
    
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task execution
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_compression="gzip",
    result_compression="gzip",
    
    # Task retry configuration
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
    # Result backend settings
    result_expires=3600,  # 1 hour
    
    # Worker settings
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=False,
    
    # Task time limits
    task_soft_time_limit=300,  # 5 minutes
    task_time_limit=600,       # 10 minutes
    
    # Beat schedule for periodic tasks
    beat_schedule={
        "cleanup-expired-tokens": {
            "task": "app.tasks.cleanup.cleanup_expired_tokens",
            "schedule": 3600.0,  # Every hour
        },
        "aggregate-metrics": {
            "task": "app.tasks.analytics.aggregate_metrics",
            "schedule": 300.0,  # Every 5 minutes
        },
        "check-anomalies": {
            "task": "app.tasks.analytics.check_anomalies",
            "schedule": 60.0,  # Every minute
        },
        "send-digest-emails": {
            "task": "app.tasks.notifications.send_digest_emails",
            "schedule": 86400.0,  # Daily
        },
        "cleanup-old-audit-logs": {
            "task": "app.tasks.cleanup.cleanup_old_audit_logs",
            "schedule": 86400.0,  # Daily
        },
    },
)

# Configure logging for Celery
celery_app.conf.worker_log_format = "[%(asctime)s: %(levelname)s/%(processName)s] %(message)s"
celery_app.conf.worker_task_log_format = "[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s"

if __name__ == "__main__":
    celery_app.start()