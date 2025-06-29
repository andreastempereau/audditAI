"""Admin services for API keys, webhooks, and billing."""

import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import APIKey, Webhook, BillingPlan, Usage
from app.schemas.admin import (
    APIKeyCreate, APIKeyRead, APIKeyUpdate,
    WebhookCreate, WebhookRead, WebhookUpdate,
    BillingPlanRead, UsageRead
)


class AdminService:
    """Admin management service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    # API Key management
    async def create_api_key(
        self,
        key_data: APIKeyCreate,
        organization_id: UUID,
        created_by: UUID
    ) -> APIKeyRead:
        """Create new API key."""
        # Generate secure API key
        key_value = f"ca_{secrets.token_urlsafe(32)}"
        
        # Set expiration
        expires_at = None
        if key_data.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days)
        
        api_key = APIKey(
            id=uuid4(),
            organization_id=organization_id,
            name=key_data.name,
            description=key_data.description,
            key_prefix=key_value[:12],  # Store prefix for display
            key_hash=self._hash_key(key_value),  # Store hash for verification
            scopes=key_data.scopes or ["read"],
            is_active=True,
            last_used_at=None,
            expires_at=expires_at,
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(api_key)
        await self.session.commit()
        await self.session.refresh(api_key)
        
        return APIKeyRead(
            id=api_key.id,
            organization_id=api_key.organization_id,
            name=api_key.name,
            description=api_key.description,
            key_prefix=api_key.key_prefix,
            key_value=key_value,  # Only returned on creation
            scopes=api_key.scopes,
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            expires_at=api_key.expires_at,
            created_by=api_key.created_by,
            created_at=api_key.created_at,
            updated_at=api_key.updated_at
        )
    
    async def get_api_keys(
        self,
        organization_id: UUID
    ) -> List[APIKeyRead]:
        """Get all API keys for organization."""
        stmt = (
            select(APIKey)
            .where(APIKey.organization_id == organization_id)
            .order_by(desc(APIKey.created_at))
        )
        
        result = await self.session.execute(stmt)
        keys = result.scalars().all()
        
        return [
            APIKeyRead(
                id=key.id,
                organization_id=key.organization_id,
                name=key.name,
                description=key.description,
                key_prefix=key.key_prefix,
                key_value=None,  # Don't return full key value
                scopes=key.scopes,
                is_active=key.is_active,
                last_used_at=key.last_used_at,
                expires_at=key.expires_at,
                created_by=key.created_by,
                created_at=key.created_at,
                updated_at=key.updated_at
            )
            for key in keys
        ]
    
    async def update_api_key(
        self,
        key_id: UUID,
        key_data: APIKeyUpdate,
        organization_id: UUID
    ) -> APIKeyRead:
        """Update API key."""
        stmt = select(APIKey).where(
            and_(
                APIKey.id == key_id,
                APIKey.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        # Update fields
        if key_data.name is not None:
            api_key.name = key_data.name
        if key_data.description is not None:
            api_key.description = key_data.description
        if key_data.scopes is not None:
            api_key.scopes = key_data.scopes
        if key_data.is_active is not None:
            api_key.is_active = key_data.is_active
        
        api_key.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(api_key)
        
        return APIKeyRead(
            id=api_key.id,
            organization_id=api_key.organization_id,
            name=api_key.name,
            description=api_key.description,
            key_prefix=api_key.key_prefix,
            key_value=None,
            scopes=api_key.scopes,
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            expires_at=api_key.expires_at,
            created_by=api_key.created_by,
            created_at=api_key.created_at,
            updated_at=api_key.updated_at
        )
    
    async def delete_api_key(
        self,
        key_id: UUID,
        organization_id: UUID
    ) -> None:
        """Delete API key."""
        stmt = select(APIKey).where(
            and_(
                APIKey.id == key_id,
                APIKey.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        await self.session.delete(api_key)
        await self.session.commit()
    
    async def verify_api_key(self, key_value: str) -> Optional[APIKey]:
        """Verify and get API key by value."""
        key_hash = self._hash_key(key_value)
        
        stmt = select(APIKey).where(
            and_(
                APIKey.key_hash == key_hash,
                APIKey.is_active == True,
                (APIKey.expires_at.is_(None) | (APIKey.expires_at > datetime.utcnow()))
            )
        )
        result = await self.session.execute(stmt)
        api_key = result.scalar_one_or_none()
        
        if api_key:
            # Update last used timestamp
            api_key.last_used_at = datetime.utcnow()
            await self.session.commit()
        
        return api_key
    
    # Webhook management
    async def create_webhook(
        self,
        webhook_data: WebhookCreate,
        organization_id: UUID,
        created_by: UUID
    ) -> WebhookRead:
        """Create new webhook."""
        # Generate webhook secret
        secret = secrets.token_urlsafe(32)
        
        webhook = Webhook(
            id=uuid4(),
            organization_id=organization_id,
            name=webhook_data.name,
            description=webhook_data.description,
            url=webhook_data.url,
            events=webhook_data.events,
            secret=secret,
            is_active=True,
            retry_count=3,  # Default retry count
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(webhook)
        await self.session.commit()
        await self.session.refresh(webhook)
        
        return WebhookRead(
            id=webhook.id,
            organization_id=webhook.organization_id,
            name=webhook.name,
            description=webhook.description,
            url=webhook.url,
            events=webhook.events,
            secret=webhook.secret,
            is_active=webhook.is_active,
            retry_count=webhook.retry_count,
            last_triggered_at=webhook.last_triggered_at,
            created_by=webhook.created_by,
            created_at=webhook.created_at,
            updated_at=webhook.updated_at
        )
    
    async def get_webhooks(
        self,
        organization_id: UUID
    ) -> List[WebhookRead]:
        """Get all webhooks for organization."""
        stmt = (
            select(Webhook)
            .where(Webhook.organization_id == organization_id)
            .order_by(desc(Webhook.created_at))
        )
        
        result = await self.session.execute(stmt)
        webhooks = result.scalars().all()
        
        return [
            WebhookRead(
                id=webhook.id,
                organization_id=webhook.organization_id,
                name=webhook.name,
                description=webhook.description,
                url=webhook.url,
                events=webhook.events,
                secret=webhook.secret,
                is_active=webhook.is_active,
                retry_count=webhook.retry_count,
                last_triggered_at=webhook.last_triggered_at,
                created_by=webhook.created_by,
                created_at=webhook.created_at,
                updated_at=webhook.updated_at
            )
            for webhook in webhooks
        ]
    
    async def update_webhook(
        self,
        webhook_id: UUID,
        webhook_data: WebhookUpdate,
        organization_id: UUID
    ) -> WebhookRead:
        """Update webhook."""
        stmt = select(Webhook).where(
            and_(
                Webhook.id == webhook_id,
                Webhook.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        webhook = result.scalar_one_or_none()
        
        if not webhook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook not found"
            )
        
        # Update fields
        if webhook_data.name is not None:
            webhook.name = webhook_data.name
        if webhook_data.description is not None:
            webhook.description = webhook_data.description
        if webhook_data.url is not None:
            webhook.url = webhook_data.url
        if webhook_data.events is not None:
            webhook.events = webhook_data.events
        if webhook_data.is_active is not None:
            webhook.is_active = webhook_data.is_active
        
        webhook.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(webhook)
        
        return WebhookRead(
            id=webhook.id,
            organization_id=webhook.organization_id,
            name=webhook.name,
            description=webhook.description,
            url=webhook.url,
            events=webhook.events,
            secret=webhook.secret,
            is_active=webhook.is_active,
            retry_count=webhook.retry_count,
            last_triggered_at=webhook.last_triggered_at,
            created_by=webhook.created_by,
            created_at=webhook.created_at,
            updated_at=webhook.updated_at
        )
    
    # Billing and usage
    async def get_billing_plan(
        self,
        organization_id: UUID
    ) -> Optional[BillingPlanRead]:
        """Get organization's billing plan."""
        stmt = select(BillingPlan).where(BillingPlan.organization_id == organization_id)
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()
        
        if not plan:
            return None
        
        return BillingPlanRead(
            id=plan.id,
            organization_id=plan.organization_id,
            plan_name=plan.plan_name,
            plan_type=plan.plan_type,
            monthly_price=plan.monthly_price,
            limits=plan.limits,
            features=plan.features,
            is_active=plan.is_active,
            trial_ends_at=plan.trial_ends_at,
            billing_cycle_start=plan.billing_cycle_start,
            billing_cycle_end=plan.billing_cycle_end,
            created_at=plan.created_at,
            updated_at=plan.updated_at
        )
    
    async def get_usage_statistics(
        self,
        organization_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[UsageRead]:
        """Get usage statistics for organization."""
        query = select(Usage).where(Usage.organization_id == organization_id)
        
        if start_date:
            query = query.where(Usage.period_start >= start_date)
        
        if end_date:
            query = query.where(Usage.period_end <= end_date)
        
        query = query.order_by(desc(Usage.period_start))
        
        result = await self.session.execute(query)
        usage_records = result.scalars().all()
        
        return [
            UsageRead(
                id=usage.id,
                organization_id=usage.organization_id,
                metric_name=usage.metric_name,
                usage_count=usage.usage_count,
                limit_count=usage.limit_count,
                period_start=usage.period_start,
                period_end=usage.period_end,
                created_at=usage.created_at
            )
            for usage in usage_records
        ]
    
    def _hash_key(self, key_value: str) -> str:
        """Hash API key for secure storage."""
        import hashlib
        return hashlib.sha256(key_value.encode()).hexdigest()