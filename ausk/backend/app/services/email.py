"""Email service for CrossAudit AI notifications."""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    """Service for sending emails with templates."""
    
    def __init__(self):
        self.smtp_server = settings.smtp_server
        self.smtp_port = settings.smtp_port
        self.smtp_username = settings.smtp_username
        self.smtp_password = settings.smtp_password
        self.smtp_use_tls = settings.smtp_use_tls
        self.from_email = settings.from_email
        self.from_name = settings.from_name
        
        # Setup Jinja2 template environment
        template_dir = Path(__file__).parent.parent / "templates" / "email"
        self.template_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        to_name: Optional[str] = None
    ) -> bool:
        """Send an email."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = f"{to_name} <{to_email}>" if to_name else to_email
            
            # Add text content
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()
                
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    async def send_verification_email(
        self,
        email: str,
        full_name: str,
        verification_token: str
    ) -> bool:
        """Send email verification email."""
        verification_url = f"{settings.frontend_url}/verify-email?token={verification_token}"
        
        try:
            template = self.template_env.get_template('verification.html')
            html_content = template.render(
                name=full_name,
                verification_url=verification_url,
                support_email=self.from_email
            )
            
            text_template = self.template_env.get_template('verification.txt')
            text_content = text_template.render(
                name=full_name,
                verification_url=verification_url,
                support_email=self.from_email
            )
            
            return await self.send_email(
                to_email=email,
                to_name=full_name,
                subject="Verify your CrossAudit AI account",
                html_content=html_content,
                text_content=text_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")
            # Fallback to simple email
            html_content = f"""
            <h2>Welcome to CrossAudit AI!</h2>
            <p>Hi {full_name},</p>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verification_url}">Verify Email Address</a></p>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>CrossAudit AI Team</p>
            """
            
            return await self.send_email(
                to_email=email,
                to_name=full_name,
                subject="Verify your CrossAudit AI account",
                html_content=html_content
            )
    
    async def send_password_reset_email(
        self,
        email: str,
        full_name: str,
        reset_token: str
    ) -> bool:
        """Send password reset email."""
        reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
        
        try:
            template = self.template_env.get_template('password_reset.html')
            html_content = template.render(
                name=full_name,
                reset_url=reset_url,
                support_email=self.from_email
            )
            
            text_template = self.template_env.get_template('password_reset.txt')
            text_content = text_template.render(
                name=full_name,
                reset_url=reset_url,
                support_email=self.from_email
            )
            
            return await self.send_email(
                to_email=email,
                to_name=full_name,
                subject="Reset your CrossAudit AI password",
                html_content=html_content,
                text_content=text_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            # Fallback to simple email
            html_content = f"""
            <h2>Password Reset Request</h2>
            <p>Hi {full_name},</p>
            <p>You requested to reset your password. Click the link below to set a new password:</p>
            <p><a href="{reset_url}">Reset Password</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>CrossAudit AI Team</p>
            """
            
            return await self.send_email(
                to_email=email,
                to_name=full_name,
                subject="Reset your CrossAudit AI password",
                html_content=html_content
            )
    
    async def send_invitation_email(
        self,
        email: str,
        inviter_name: str,
        organization_name: str,
        invitation_token: str
    ) -> bool:
        """Send organization invitation email."""
        invitation_url = f"{settings.frontend_url}/invite?token={invitation_token}"
        
        try:
            template = self.template_env.get_template('invitation.html')
            html_content = template.render(
                inviter_name=inviter_name,
                organization_name=organization_name,
                invitation_url=invitation_url,
                support_email=self.from_email
            )
            
            text_template = self.template_env.get_template('invitation.txt')
            text_content = text_template.render(
                inviter_name=inviter_name,
                organization_name=organization_name,
                invitation_url=invitation_url,
                support_email=self.from_email
            )
            
            return await self.send_email(
                to_email=email,
                subject=f"You're invited to join {organization_name} on CrossAudit AI",
                html_content=html_content,
                text_content=text_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send invitation email: {e}")
            # Fallback to simple email
            html_content = f"""
            <h2>You're Invited!</h2>
            <p>Hi there,</p>
            <p>{inviter_name} has invited you to join <strong>{organization_name}</strong> on CrossAudit AI.</p>
            <p><a href="{invitation_url}">Accept Invitation</a></p>
            <p>CrossAudit AI helps organizations govern and audit AI systems with confidence.</p>
            <p>Best regards,<br>CrossAudit AI Team</p>
            """
            
            return await self.send_email(
                to_email=email,
                subject=f"You're invited to join {organization_name} on CrossAudit AI",
                html_content=html_content
            )
    
    async def send_alert_email(
        self,
        email: str,
        name: str,
        alert_type: str,
        alert_message: str,
        alert_data: Dict[str, Any]
    ) -> bool:
        """Send alert notification email."""
        try:
            template = self.template_env.get_template('alert.html')
            html_content = template.render(
                name=name,
                alert_type=alert_type,
                alert_message=alert_message,
                alert_data=alert_data,
                dashboard_url=f"{settings.frontend_url}/dashboard"
            )
            
            return await self.send_email(
                to_email=email,
                to_name=name,
                subject=f"CrossAudit AI Alert: {alert_type}",
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")
            # Fallback to simple email
            html_content = f"""
            <h2>CrossAudit AI Alert</h2>
            <p>Hi {name},</p>
            <p><strong>Alert Type:</strong> {alert_type}</p>
            <p><strong>Message:</strong> {alert_message}</p>
            <p><a href="{settings.frontend_url}/dashboard">View Dashboard</a></p>
            <p>Best regards,<br>CrossAudit AI Team</p>
            """
            
            return await self.send_email(
                to_email=email,
                to_name=name,
                subject=f"CrossAudit AI Alert: {alert_type}",
                html_content=html_content
            )
    
    async def send_billing_email(
        self,
        email: str,
        name: str,
        email_type: str,
        billing_data: Dict[str, Any]
    ) -> bool:
        """Send billing-related email."""
        subject_map = {
            "payment_succeeded": "Payment Successful",
            "payment_failed": "Payment Failed",
            "subscription_canceled": "Subscription Canceled",
            "trial_ending": "Trial Ending Soon",
            "quota_exceeded": "Usage Quota Exceeded"
        }
        
        subject = f"CrossAudit AI: {subject_map.get(email_type, 'Billing Update')}"
        
        try:
            template = self.template_env.get_template(f'billing_{email_type}.html')
            html_content = template.render(
                name=name,
                billing_data=billing_data,
                billing_url=f"{settings.frontend_url}/billing"
            )
            
            return await self.send_email(
                to_email=email,
                to_name=name,
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send billing email: {e}")
            # Fallback to simple email
            html_content = f"""
            <h2>{subject}</h2>
            <p>Hi {name},</p>
            <p>This is a billing notification for your CrossAudit AI account.</p>
            <p><a href="{settings.frontend_url}/billing">Manage Billing</a></p>
            <p>Best regards,<br>CrossAudit AI Team</p>
            """
            
            return await self.send_email(
                to_email=email,
                to_name=name,
                subject=subject,
                html_content=html_content
            )