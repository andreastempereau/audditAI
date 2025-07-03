"""Billing and subscription management routes for CrossAudit AI."""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.exceptions import BillingError, ValidationError, NotFoundError
from app.services.auth import get_current_user
from app.services.billing import BillingService
from app.models.auth import User
from app.schemas.base import BaseResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def billing_health_check():
    """Health check for billing endpoints."""
    return {"status": "healthy", "service": "billing"}


@router.get("/plans")
async def get_subscription_plans(
    session: AsyncSession = Depends(get_async_session)
):
    """Get available subscription plans."""
    try:
        service = BillingService(session)
        plans = await service.get_subscription_plans()
        
        plan_list = []
        for plan in plans:
            plan_list.append({
                "id": str(plan.id),
                "name": plan.name,
                "display_name": plan.display_name,
                "description": plan.description,
                "price_monthly": float(plan.price_monthly),
                "price_yearly": float(plan.price_yearly) if plan.price_yearly else None,
                "features": plan.features,
                "quotas": plan.quotas,
                "stripe_price_id_monthly": plan.stripe_price_id_monthly,
                "stripe_price_id_yearly": plan.stripe_price_id_yearly,
                "is_active": plan.is_active
            })
        
        return BaseResponse(
            data={
                "plans": plan_list,
                "total": len(plan_list)
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get subscription plans: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription plans"
        )


@router.get("/subscription")
async def get_current_subscription(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get current subscription details."""
    try:
        service = BillingService(session)
        
        subscription = await service.get_organization_subscription(
            organization_id=current_user.organization_id
        )
        
        if not subscription:
            return BaseResponse(
                data={
                    "subscription": None,
                    "message": "No active subscription found"
                }
            )
        
        return BaseResponse(
            data={
                "subscription": {
                    "id": str(subscription.id),
                    "plan_name": subscription.plan.name,
                    "plan_display_name": subscription.plan.display_name,
                    "status": subscription.status,
                    "current_period_start": subscription.current_period_start.isoformat(),
                    "current_period_end": subscription.current_period_end.isoformat(),
                    "stripe_subscription_id": subscription.stripe_subscription_id,
                    "quotas": subscription.plan.quotas,
                    "usage": await service.get_usage_summary(current_user.organization_id)
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription"
        )


@router.post("/subscription/create")
async def create_subscription(
    subscription_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new subscription."""
    try:
        service = BillingService(session)
        
        result = await service.create_subscription(
            organization_id=current_user.organization_id,
            plan_id=UUID(subscription_data.get("plan_id")),
            billing_interval=subscription_data.get("billing_interval", "monthly"),
            payment_method_id=subscription_data.get("payment_method_id"),
            created_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "subscription_id": str(result.get("subscription_id")),
                "stripe_subscription_id": result.get("stripe_subscription_id"),
                "client_secret": result.get("client_secret"),
                "status": result.get("status")
            },
            message="Subscription created successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )


@router.put("/subscription/update")
async def update_subscription(
    update_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update current subscription."""
    try:
        service = BillingService(session)
        
        result = await service.update_subscription(
            organization_id=current_user.organization_id,
            plan_id=UUID(update_data.get("plan_id")) if update_data.get("plan_id") else None,
            billing_interval=update_data.get("billing_interval"),
            updated_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "subscription_id": str(result.get("subscription_id")),
                "status": result.get("status"),
                "updated_at": result.get("updated_at")
            },
            message="Subscription updated successfully"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update subscription"
        )


@router.post("/subscription/cancel")
async def cancel_subscription(
    cancellation_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Cancel current subscription."""
    try:
        service = BillingService(session)
        
        result = await service.cancel_subscription(
            organization_id=current_user.organization_id,
            cancellation_reason=cancellation_data.get("reason", ""),
            cancelled_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "subscription_id": str(result.get("subscription_id")),
                "cancelled_at": result.get("cancelled_at"),
                "ends_at": result.get("ends_at")
            },
            message="Subscription cancelled successfully"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


@router.get("/usage")
async def get_usage_metrics(
    days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get usage metrics for the organization."""
    try:
        service = BillingService(session)
        
        usage_data = await service.get_usage_metrics(
            organization_id=current_user.organization_id,
            days=days
        )
        
        return BaseResponse(
            data={
                "usage": usage_data,
                "period_days": days
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get usage metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage metrics"
        )


@router.get("/invoices")
async def get_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get billing invoices."""
    try:
        service = BillingService(session)
        
        invoices = await service.get_invoices(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit
        )
        
        invoice_list = []
        for invoice in invoices:
            invoice_list.append({
                "id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "stripe_invoice_id": invoice.stripe_invoice_id,
                "amount": float(invoice.amount),
                "currency": invoice.currency,
                "status": invoice.status,
                "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
                "invoice_url": invoice.invoice_url,
                "created_at": invoice.created_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "invoices": invoice_list,
                "total": len(invoice_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get invoices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve invoices"
        )


@router.get("/payment-methods")
async def get_payment_methods(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get payment methods for the organization."""
    try:
        service = BillingService(session)
        
        payment_methods = await service.get_payment_methods(
            organization_id=current_user.organization_id
        )
        
        return BaseResponse(
            data={
                "payment_methods": payment_methods
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get payment methods: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment methods"
        )


@router.post("/payment-methods")
async def add_payment_method(
    payment_method_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Add a new payment method."""
    try:
        service = BillingService(session)
        
        result = await service.add_payment_method(
            organization_id=current_user.organization_id,
            payment_method_id=payment_method_data.get("payment_method_id"),
            set_as_default=payment_method_data.get("set_as_default", False),
            added_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "payment_method_id": result.get("payment_method_id"),
                "status": result.get("status")
            },
            message="Payment method added successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to add payment method: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add payment method"
        )


@router.delete("/payment-methods/{payment_method_id}")
async def remove_payment_method(
    payment_method_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Remove a payment method."""
    try:
        service = BillingService(session)
        
        success = await service.remove_payment_method(
            organization_id=current_user.organization_id,
            payment_method_id=payment_method_id,
            removed_by=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment method not found"
            )
        
        return BaseResponse(
            data={"removed": True},
            message="Payment method removed successfully"
        )
        
    except HTTPException:
        raise
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to remove payment method: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove payment method"
        )


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session)
):
    """Handle Stripe webhooks."""
    try:
        service = BillingService(session)
        
        # Get the raw body and signature
        body = await request.body()
        signature = request.headers.get("stripe-signature")
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Stripe signature"
            )
        
        result = await service.handle_stripe_webhook(body, signature)
        
        return {"status": "success", "handled": result}
        
    except ValidationError as e:
        logger.error(f"Invalid Stripe webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )
    except Exception as e:
        logger.error(f"Failed to process Stripe webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook"
        )


@router.get("/quotas/status")
async def get_quota_status(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get current quota status and usage."""
    try:
        service = BillingService(session)
        
        quota_status = await service.get_quota_status(
            organization_id=current_user.organization_id
        )
        
        return BaseResponse(
            data=quota_status
        )
        
    except Exception as e:
        logger.error(f"Failed to get quota status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve quota status"
        )


@router.post("/billing-portal")
async def create_billing_portal_session(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe billing portal session."""
    try:
        service = BillingService(session)
        
        portal_session = await service.create_billing_portal_session(
            organization_id=current_user.organization_id
        )
        
        return BaseResponse(
            data={
                "portal_url": portal_session.get("url")
            },
            message="Billing portal session created"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BillingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create billing portal session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create billing portal session"
        )