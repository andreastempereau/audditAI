"""Stripe billing integration with quota enforcement."""

import stripe
import logging
import hashlib
import hmac
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import (
    Subscription, SubscriptionPlan, UsageRecord, 
    QuotaUsage, Organization
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize Stripe
stripe.api_key = settings.stripe_secret_key


class BillingError(Exception):
    """Base billing exception."""
    pass


class QuotaExceededError(BillingError):
    """Quota exceeded exception."""
    pass


class BillingService:
    """Service for managing Stripe billing and quotas."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stripe_webhook_secret = settings.stripe_webhook_secret
        
        # Quota types and their units
        self.quota_types = {
            "tokens": "tokens",
            "storage": "bytes",
            "evaluator_calls": "calls",
            "api_calls": "calls"
        }
        
        # Grace percentage for soft limits
        self.grace_percentage = 0.1  # 10% grace
    
    # Subscription Management
    
    async def create_subscription(
        self,
        organization_id: UUID,
        plan_name: str,
        payment_method_id: Optional[str] = None,
        trial_days: int = 14
    ) -> Subscription:
        """Create a new subscription for organization."""
        # Get plan
        stmt = select(SubscriptionPlan).where(
            SubscriptionPlan.name == plan_name,
            SubscriptionPlan.is_active == True
        )
        result = await self.session.execute(stmt)
        plan = result.scalar_one_or_none()
        
        if not plan:
            raise BillingError(f"Plan not found: {plan_name}")
        
        # Get organization
        org = await self.session.get(Organization, organization_id)
        if not org:
            raise BillingError("Organization not found")
        
        # Create or get Stripe customer
        if org.stripe_customer_id:
            customer = stripe.Customer.retrieve(org.stripe_customer_id)
        else:
            customer = stripe.Customer.create(
                email=org.email,
                name=org.name,
                metadata={
                    "organization_id": str(organization_id)
                }
            )
            org.stripe_customer_id = customer.id
        
        # Attach payment method if provided
        if payment_method_id:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer.id
            )
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method_id
                }
            )
        
        # Create Stripe subscription
        stripe_sub = stripe.Subscription.create(
            customer=customer.id,
            items=[
                {
                    "price": self._get_stripe_price_id(plan_name),
                    "quantity": 1
                }
            ],
            trial_period_days=trial_days,
            metadata={
                "organization_id": str(organization_id),
                "plan_name": plan_name
            }
        )
        
        # Create local subscription record
        subscription = Subscription(
            organization_id=organization_id,
            plan_id=plan.id,
            stripe_subscription_id=stripe_sub.id,
            stripe_customer_id=customer.id,
            status=stripe_sub.status,
            current_period_start=datetime.fromtimestamp(stripe_sub.current_period_start),
            current_period_end=datetime.fromtimestamp(stripe_sub.current_period_end),
            trial_start=datetime.fromtimestamp(stripe_sub.trial_start) if stripe_sub.trial_start else None,
            trial_end=datetime.fromtimestamp(stripe_sub.trial_end) if stripe_sub.trial_end else None,
            metadata={
                "stripe_status": stripe_sub.status,
                "created_via": "api"
            }
        )
        
        self.session.add(subscription)
        
        # Initialize quotas for the plan
        await self._initialize_quotas(organization_id, plan)
        
        await self.session.commit()
        await self.session.refresh(subscription)
        
        logger.info(f"Created subscription for org {organization_id}: {plan_name}")
        return subscription
    
    async def update_subscription(
        self,
        organization_id: UUID,
        new_plan_name: str
    ) -> Subscription:
        """Update organization's subscription plan."""
        # Get current subscription
        stmt = select(Subscription).where(
            Subscription.organization_id == organization_id
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        
        if not subscription or not subscription.stripe_subscription_id:
            raise BillingError("No active subscription found")
        
        # Get new plan
        plan_stmt = select(SubscriptionPlan).where(
            SubscriptionPlan.name == new_plan_name,
            SubscriptionPlan.is_active == True
        )
        plan_result = await self.session.execute(plan_stmt)
        new_plan = plan_result.scalar_one_or_none()
        
        if not new_plan:
            raise BillingError(f"Plan not found: {new_plan_name}")
        
        # Update Stripe subscription
        stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
        
        # Update subscription item with new price
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            items=[{
                "id": stripe_sub["items"]["data"][0].id,
                "price": self._get_stripe_price_id(new_plan_name)
            }],
            proration_behavior="always_invoice"
        )
        
        # Update local subscription
        subscription.plan_id = new_plan.id
        subscription.updated_at = datetime.utcnow()
        
        # Update quotas
        await self._update_quotas(organization_id, new_plan)
        
        await self.session.commit()
        await self.session.refresh(subscription)
        
        logger.info(f"Updated subscription for org {organization_id}: {new_plan_name}")
        return subscription
    
    async def cancel_subscription(
        self,
        organization_id: UUID,
        at_period_end: bool = True
    ) -> Subscription:
        """Cancel organization's subscription."""
        # Get subscription
        stmt = select(Subscription).where(
            Subscription.organization_id == organization_id
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        
        if not subscription or not subscription.stripe_subscription_id:
            raise BillingError("No active subscription found")
        
        # Cancel in Stripe
        stripe_sub = stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=at_period_end
        )
        
        # Update local subscription
        subscription.status = "canceled" if not at_period_end else stripe_sub.status
        subscription.updated_at = datetime.utcnow()
        subscription.metadata["canceled_at"] = datetime.utcnow().isoformat()
        subscription.metadata["cancel_at_period_end"] = at_period_end
        
        await self.session.commit()
        
        logger.info(f"Canceled subscription for org {organization_id}")
        return subscription
    
    # Quota Management
    
    async def check_quota(
        self,
        organization_id: UUID,
        usage_type: str,
        requested_amount: Decimal = Decimal("1")
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check if organization has quota available."""
        current_period = self._get_current_billing_period()
        
        stmt = select(QuotaUsage).where(
            QuotaUsage.organization_id == organization_id,
            QuotaUsage.usage_type == usage_type,
            QuotaUsage.period_start == current_period["start"],
            QuotaUsage.period_end == current_period["end"]
        )
        
        result = await self.session.execute(stmt)
        quota = result.scalar_one_or_none()
        
        if not quota:
            # No quota record - allow by default
            return True, {
                "current_usage": 0,
                "quota_limit": 0,
                "requested": requested_amount,
                "would_exceed": False
            }
        
        # Calculate if request would exceed quota (with grace)
        new_usage = quota.current_usage + requested_amount
        limit_with_grace = quota.quota_limit * (1 + self.grace_percentage)
        would_exceed = new_usage > limit_with_grace
        
        return not would_exceed, {
            "current_usage": float(quota.current_usage),
            "quota_limit": float(quota.quota_limit),
            "requested": float(requested_amount),
            "new_usage": float(new_usage),
            "would_exceed": would_exceed,
            "percentage_used": float(quota.current_usage / quota.quota_limit * 100) if quota.quota_limit > 0 else 0
        }
    
    async def record_usage(
        self,
        organization_id: UUID,
        usage_type: str,
        quantity: Decimal,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UsageRecord:
        """Record usage for billing."""
        # Get subscription
        stmt = select(Subscription).where(
            Subscription.organization_id == organization_id,
            Subscription.status == "active"
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise BillingError("No active subscription found")
        
        current_period = self._get_current_billing_period()
        
        # Create usage record
        usage_record = UsageRecord(
            organization_id=organization_id,
            subscription_id=subscription.id,
            usage_type=usage_type,
            quantity=quantity,
            unit=self.quota_types.get(usage_type, "units"),
            period_start=current_period["start"],
            period_end=current_period["end"],
            metadata=metadata or {}
        )
        
        self.session.add(usage_record)
        
        # Update quota usage
        await self._update_quota_usage(
            organization_id,
            usage_type,
            quantity,
            current_period
        )
        
        # Report to Stripe for metered billing
        if usage_type in ["tokens", "api_calls"]:
            await self._report_usage_to_stripe(
                subscription.stripe_subscription_id,
                usage_type,
                quantity
            )
        
        await self.session.commit()
        await self.session.refresh(usage_record)
        
        return usage_record
    
    async def _update_quota_usage(
        self,
        organization_id: UUID,
        usage_type: str,
        quantity: Decimal,
        period: Dict[str, Any]
    ):
        """Update quota usage tracking."""
        stmt = select(QuotaUsage).where(
            QuotaUsage.organization_id == organization_id,
            QuotaUsage.usage_type == usage_type,
            QuotaUsage.period_start == period["start"],
            QuotaUsage.period_end == period["end"]
        )
        
        result = await self.session.execute(stmt)
        quota = result.scalar_one_or_none()
        
        if quota:
            quota.current_usage += quantity
            quota.last_updated = datetime.utcnow()
        else:
            # Get quota limit from plan
            sub_stmt = select(Subscription, SubscriptionPlan).join(
                SubscriptionPlan
            ).where(
                Subscription.organization_id == organization_id
            )
            
            sub_result = await self.session.execute(sub_stmt)
            sub_row = sub_result.first()
            
            if sub_row:
                subscription, plan = sub_row
                quota_limit = Decimal(str(plan.quotas.get(usage_type, 0)))
            else:
                quota_limit = Decimal("0")
            
            quota = QuotaUsage(
                organization_id=organization_id,
                usage_type=usage_type,
                current_usage=quantity,
                quota_limit=quota_limit,
                period_start=period["start"],
                period_end=period["end"]
            )
            self.session.add(quota)
    
    async def _report_usage_to_stripe(
        self,
        stripe_subscription_id: str,
        usage_type: str,
        quantity: Decimal
    ):
        """Report usage to Stripe for metered billing."""
        try:
            # Get subscription item for metered price
            subscription = stripe.Subscription.retrieve(stripe_subscription_id)
            
            # Find the subscription item for this usage type
            metered_item_id = None
            for item in subscription["items"]["data"]:
                if usage_type in item.price.metadata:
                    metered_item_id = item.id
                    break
            
            if metered_item_id:
                # Create usage record in Stripe
                stripe.SubscriptionItem.create_usage_record(
                    metered_item_id,
                    quantity=int(quantity),
                    timestamp=int(datetime.utcnow().timestamp()),
                    action="increment"
                )
        except Exception as e:
            logger.error(f"Failed to report usage to Stripe: {e}")
    
    # Webhook Handling
    
    async def handle_stripe_webhook(
        self,
        payload: bytes,
        signature: str
    ) -> Dict[str, Any]:
        """Handle Stripe webhook events."""
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature, self.stripe_webhook_secret
            )
        except ValueError:
            raise BillingError("Invalid webhook payload")
        except stripe.error.SignatureVerificationError:
            raise BillingError("Invalid webhook signature")
        
        # Handle different event types
        if event.type == "customer.subscription.updated":
            await self._handle_subscription_updated(event.data.object)
        
        elif event.type == "customer.subscription.deleted":
            await self._handle_subscription_deleted(event.data.object)
        
        elif event.type == "invoice.payment_succeeded":
            await self._handle_payment_succeeded(event.data.object)
        
        elif event.type == "invoice.payment_failed":
            await self._handle_payment_failed(event.data.object)
        
        elif event.type == "customer.subscription.trial_will_end":
            await self._handle_trial_ending(event.data.object)
        
        logger.info(f"Processed Stripe webhook: {event.type}")
        
        return {
            "event_id": event.id,
            "event_type": event.type,
            "processed": True
        }
    
    async def _handle_subscription_updated(self, stripe_sub):
        """Handle subscription update from Stripe."""
        stmt = select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub.id
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        
        if subscription:
            subscription.status = stripe_sub.status
            subscription.current_period_start = datetime.fromtimestamp(stripe_sub.current_period_start)
            subscription.current_period_end = datetime.fromtimestamp(stripe_sub.current_period_end)
            subscription.updated_at = datetime.utcnow()
            
            await self.session.commit()
    
    async def _handle_subscription_deleted(self, stripe_sub):
        """Handle subscription cancellation from Stripe."""
        stmt = select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub.id
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()
        
        if subscription:
            subscription.status = "canceled"
            subscription.updated_at = datetime.utcnow()
            subscription.metadata["canceled_at"] = datetime.utcnow().isoformat()
            
            await self.session.commit()
    
    async def _handle_payment_succeeded(self, invoice):
        """Handle successful payment."""
        # Update subscription status if needed
        if invoice.subscription:
            stmt = select(Subscription).where(
                Subscription.stripe_subscription_id == invoice.subscription
            )
            result = await self.session.execute(stmt)
            subscription = result.scalar_one_or_none()
            
            if subscription and subscription.status == "past_due":
                subscription.status = "active"
                subscription.updated_at = datetime.utcnow()
                await self.session.commit()
    
    async def _handle_payment_failed(self, invoice):
        """Handle failed payment."""
        if invoice.subscription:
            stmt = select(Subscription).where(
                Subscription.stripe_subscription_id == invoice.subscription
            )
            result = await self.session.execute(stmt)
            subscription = result.scalar_one_or_none()
            
            if subscription:
                subscription.status = "past_due"
                subscription.updated_at = datetime.utcnow()
                subscription.metadata["last_payment_failed"] = datetime.utcnow().isoformat()
                
                await self.session.commit()
    
    async def _handle_trial_ending(self, stripe_sub):
        """Handle trial ending notification."""
        # Send email notification to organization
        logger.info(f"Trial ending for subscription: {stripe_sub.id}")
    
    # Helper Methods
    
    def _get_stripe_price_id(self, plan_name: str) -> str:
        """Get Stripe price ID for plan."""
        price_mapping = {
            "starter": settings.stripe_starter_price_id,
            "business": settings.stripe_business_price_id,
            "enterprise": settings.stripe_enterprise_price_id
        }
        return price_mapping.get(plan_name, "")
    
    def _get_current_billing_period(self) -> Dict[str, datetime]:
        """Get current billing period (monthly)."""
        now = datetime.utcnow()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Next month
        if now.month == 12:
            end = start.replace(year=now.year + 1, month=1)
        else:
            end = start.replace(month=now.month + 1)
        
        return {"start": start, "end": end}
    
    async def _initialize_quotas(self, organization_id: UUID, plan: SubscriptionPlan):
        """Initialize quotas for a new subscription."""
        current_period = self._get_current_billing_period()
        
        for usage_type, limit in plan.quotas.items():
            quota = QuotaUsage(
                organization_id=organization_id,
                usage_type=usage_type,
                current_usage=Decimal("0"),
                quota_limit=Decimal(str(limit)),
                period_start=current_period["start"],
                period_end=current_period["end"]
            )
            self.session.add(quota)
    
    async def _update_quotas(self, organization_id: UUID, plan: SubscriptionPlan):
        """Update quotas when plan changes."""
        current_period = self._get_current_billing_period()
        
        for usage_type, limit in plan.quotas.items():
            stmt = select(QuotaUsage).where(
                QuotaUsage.organization_id == organization_id,
                QuotaUsage.usage_type == usage_type,
                QuotaUsage.period_start == current_period["start"],
                QuotaUsage.period_end == current_period["end"]
            )
            
            result = await self.session.execute(stmt)
            quota = result.scalar_one_or_none()
            
            if quota:
                quota.quota_limit = Decimal(str(limit))
                quota.last_updated = datetime.utcnow()
            else:
                quota = QuotaUsage(
                    organization_id=organization_id,
                    usage_type=usage_type,
                    current_usage=Decimal("0"),
                    quota_limit=Decimal(str(limit)),
                    period_start=current_period["start"],
                    period_end=current_period["end"]
                )
                self.session.add(quota)
    
    # Analytics
    
    async def get_usage_analytics(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get usage analytics for organization."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get usage by type
        stmt = text("""
            SELECT 
                usage_type,
                SUM(quantity) as total_usage,
                COUNT(*) as usage_count,
                DATE(timestamp) as usage_date
            FROM usage_records
            WHERE organization_id = :org_id
            AND timestamp >= :start_date
            GROUP BY usage_type, DATE(timestamp)
            ORDER BY usage_date DESC
        """)
        
        result = await self.session.execute(stmt, {
            "org_id": organization_id,
            "start_date": start_date
        })
        
        usage_by_type = {}
        for row in result.fetchall():
            usage_type = row[0]
            if usage_type not in usage_by_type:
                usage_by_type[usage_type] = []
            
            usage_by_type[usage_type].append({
                "date": row[3].isoformat(),
                "usage": float(row[1]),
                "count": row[2]
            })
        
        # Get current quotas
        current_period = self._get_current_billing_period()
        quota_stmt = select(QuotaUsage).where(
            QuotaUsage.organization_id == organization_id,
            QuotaUsage.period_start == current_period["start"]
        )
        
        quota_result = await self.session.execute(quota_stmt)
        quotas = quota_result.scalars().all()
        
        quota_status = []
        for quota in quotas:
            percentage_used = float(quota.current_usage / quota.quota_limit * 100) if quota.quota_limit > 0 else 0
            
            quota_status.append({
                "type": quota.usage_type,
                "current": float(quota.current_usage),
                "limit": float(quota.quota_limit),
                "percentage": percentage_used,
                "status": "ok" if percentage_used < 80 else "warning" if percentage_used < 100 else "exceeded"
            })
        
        return {
            "usage_by_type": usage_by_type,
            "quota_status": quota_status,
            "period": {
                "start": current_period["start"].isoformat(),
                "end": current_period["end"].isoformat()
            },
            "generated_at": datetime.utcnow().isoformat()
        }