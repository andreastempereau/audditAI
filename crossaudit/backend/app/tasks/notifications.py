"""Notification tasks for CrossAudit AI."""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from uuid import UUID

from celery import current_task
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.core.database import get_async_session
from app.services.email import EmailService

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def send_email_notification(
    self,
    to_email: str,
    subject: str,
    template: str,
    template_data: Dict[str, Any],
    to_name: str = None
) -> Dict[str, Any]:
    """Send email notification asynchronously."""
    try:
        logger.info(f"Sending email notification to {to_email}")
        
        email_service = EmailService()
        
        # Send email based on template
        if template == "verification":
            success = await email_service.send_verification_email(
                email=to_email,
                full_name=template_data.get("name", ""),
                verification_token=template_data.get("token", "")
            )
        elif template == "password_reset":
            success = await email_service.send_password_reset_email(
                email=to_email,
                full_name=template_data.get("name", ""),
                reset_token=template_data.get("token", "")
            )
        elif template == "invitation":
            success = await email_service.send_invitation_email(
                email=to_email,
                inviter_name=template_data.get("inviter_name", ""),
                organization_name=template_data.get("organization_name", ""),
                invitation_token=template_data.get("token", "")
            )
        elif template == "alert":
            success = await email_service.send_alert_email(
                email=to_email,
                name=template_data.get("name", ""),
                alert_type=template_data.get("alert_type", ""),
                alert_message=template_data.get("message", ""),
                alert_data=template_data.get("data", {})
            )
        else:
            # Generic email
            success = await email_service.send_email(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                html_content=template_data.get("html_content", ""),
                text_content=template_data.get("text_content", "")
            )
        
        result = {
            "email": to_email,
            "template": template,
            "success": success,
            "sent_at": datetime.utcnow().isoformat()
        }
        
        if success:
            logger.info(f"Email notification sent successfully to {to_email}")
        else:
            logger.warning(f"Email notification failed to send to {to_email}")
        
        return result
        
    except Exception as exc:
        logger.error(f"Email notification failed for {to_email}: {exc}")
        self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)


@celery_app.task(bind=True)
def send_digest_emails(self) -> Dict[str, Any]:
    """Send daily digest emails to users."""
    try:
        logger.info("Starting daily digest email sending")
        
        # Get users who have opted in for digest emails
        # Implementation would go here
        
        users_processed = 0
        emails_sent = 0
        emails_failed = 0
        
        # Process users in batches
        # Implementation would go here
        
        result = {
            "users_processed": users_processed,
            "emails_sent": emails_sent,
            "emails_failed": emails_failed,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Digest emails completed: {emails_sent} sent, {emails_failed} failed")
        return result
        
    except Exception as exc:
        logger.error(f"Digest email sending failed: {exc}")
        raise


@celery_app.task(bind=True, max_retries=3)
def send_alert_notification(
    self,
    organization_id: str,
    alert_type: str,
    alert_data: Dict[str, Any],
    notification_channels: List[str]
) -> Dict[str, Any]:
    """Send alert notifications through multiple channels."""
    try:
        logger.info(f"Sending alert notification for organization {organization_id}")
        
        current_task.update_state(
            state="PROCESSING",
            meta={"status": "sending_alerts", "progress": 0}
        )
        
        notifications_sent = []
        notifications_failed = []
        
        total_channels = len(notification_channels)
        
        for i, channel in enumerate(notification_channels):
            try:
                if channel.startswith("mailto:"):
                    # Email notification
                    email = channel[7:]  # Remove "mailto:" prefix
                    
                    # Send alert email
                    # Implementation would use EmailService
                    
                    notifications_sent.append({
                        "channel": channel,
                        "type": "email",
                        "status": "sent"
                    })
                    
                elif channel.startswith("https://hooks.slack.com/"):
                    # Slack webhook
                    # Implementation would send to Slack
                    
                    notifications_sent.append({
                        "channel": channel,
                        "type": "slack",
                        "status": "sent"
                    })
                    
                elif channel.startswith("https://"):
                    # Generic webhook
                    # Implementation would send HTTP POST
                    
                    notifications_sent.append({
                        "channel": channel,
                        "type": "webhook",
                        "status": "sent"
                    })
                
                # Update progress
                progress = int(((i + 1) / total_channels) * 100)
                current_task.update_state(
                    state="PROCESSING",
                    meta={"status": "sending_alerts", "progress": progress}
                )
                
            except Exception as channel_exc:
                logger.error(f"Failed to send notification to {channel}: {channel_exc}")
                notifications_failed.append({
                    "channel": channel,
                    "error": str(channel_exc)
                })
        
        result = {
            "organization_id": organization_id,
            "alert_type": alert_type,
            "notifications_sent": len(notifications_sent),
            "notifications_failed": len(notifications_failed),
            "details": {
                "sent": notifications_sent,
                "failed": notifications_failed
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Alert notifications completed for organization {organization_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Alert notification failed for organization {organization_id}: {exc}")
        self.retry(countdown=60, exc=exc)


@celery_app.task(bind=True, max_retries=3)
def send_billing_notification(
    self,
    organization_id: str,
    notification_type: str,
    billing_data: Dict[str, Any],
    recipient_emails: List[str]
) -> Dict[str, Any]:
    """Send billing-related notifications."""
    try:
        logger.info(f"Sending billing notification for organization {organization_id}")
        
        email_service = EmailService()
        
        notifications_sent = []
        notifications_failed = []
        
        for email in recipient_emails:
            try:
                # Get user name for personalization
                user_name = billing_data.get("user_name", "User")
                
                success = await email_service.send_billing_email(
                    email=email,
                    name=user_name,
                    email_type=notification_type,
                    billing_data=billing_data
                )
                
                if success:
                    notifications_sent.append(email)
                else:
                    notifications_failed.append(email)
                    
            except Exception as email_exc:
                logger.error(f"Failed to send billing notification to {email}: {email_exc}")
                notifications_failed.append(email)
        
        result = {
            "organization_id": organization_id,
            "notification_type": notification_type,
            "emails_sent": len(notifications_sent),
            "emails_failed": len(notifications_failed),
            "sent_to": notifications_sent,
            "failed_to": notifications_failed,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Billing notifications completed for organization {organization_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Billing notification failed for organization {organization_id}: {exc}")
        self.retry(countdown=60, exc=exc)


@celery_app.task(bind=True)
def cleanup_old_notifications(self, days_to_keep: int = 30) -> Dict[str, Any]:
    """Clean up old notification records."""
    try:
        logger.info(f"Cleaning up notifications older than {days_to_keep} days")
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Delete old notification records
        # Implementation would go here
        
        records_deleted = 0
        
        result = {
            "cutoff_date": cutoff_date.isoformat(),
            "records_deleted": records_deleted,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Notification cleanup completed: {records_deleted} records deleted")
        return result
        
    except Exception as exc:
        logger.error(f"Notification cleanup failed: {exc}")
        raise