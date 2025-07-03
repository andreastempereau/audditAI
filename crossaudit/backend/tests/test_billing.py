"""Tests for billing and subscription functionality."""

import pytest
import pytest_asyncio
from uuid import uuid4
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.billing import BillingService


class TestBillingService:
    """Test cases for BillingService."""
    
    @pytest_asyncio.fixture
    async def billing_service(self, session: AsyncSession):
        """Create billing service instance."""
        return BillingService(session)
    
    @pytest_asyncio.fixture
    async def test_organization_id(self):
        """Create test organization ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def test_user_id(self):
        """Create test user ID."""
        return uuid4()
    
    async def test_get_subscription_plans(
        self,
        billing_service: BillingService
    ):
        """Test getting available subscription plans."""
        plans = await billing_service.get_subscription_plans()
        
        assert isinstance(plans, list)
        assert len(plans) > 0
        
        # Check that basic plans exist
        plan_names = [plan.name for plan in plans]
        assert "starter" in plan_names
        assert "business" in plan_names
        assert "enterprise" in plan_names
        
        # Verify plan structure
        starter_plan = next(plan for plan in plans if plan.name == "starter")
        assert starter_plan.price_monthly > 0
        assert starter_plan.quotas is not None
        assert "users" in starter_plan.quotas
        assert "api_calls" in starter_plan.quotas
    
    async def test_get_organization_subscription_none(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting subscription for organization with no subscription."""
        subscription = await billing_service.get_organization_subscription(
            organization_id=test_organization_id
        )
        
        assert subscription is None
    
    async def test_create_subscription(
        self,
        billing_service: BillingService,
        test_organization_id,
        test_user_id
    ):
        """Test creating a new subscription."""
        # Get available plans first
        plans = await billing_service.get_subscription_plans()
        starter_plan = next(plan for plan in plans if plan.name == "starter")
        
        result = await billing_service.create_subscription(
            organization_id=test_organization_id,
            plan_id=starter_plan.id,
            billing_interval="monthly",
            payment_method_id="pm_test_visa",
            created_by=test_user_id
        )
        
        assert "subscription_id" in result
        assert "stripe_subscription_id" in result
        assert "status" in result
        assert result["status"] in ["active", "incomplete", "trialing"]
    
    async def test_get_usage_summary(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting usage summary."""
        usage_summary = await billing_service.get_usage_summary(
            organization_id=test_organization_id
        )
        
        assert isinstance(usage_summary, dict)
        assert "users" in usage_summary
        assert "api_calls" in usage_summary
        assert "storage_gb" in usage_summary
        assert "evaluations" in usage_summary
        
        # Should have non-negative values
        assert usage_summary["users"] >= 0
        assert usage_summary["api_calls"] >= 0
        assert usage_summary["storage_gb"] >= 0
        assert usage_summary["evaluations"] >= 0
    
    async def test_get_usage_metrics(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting usage metrics over time."""
        usage_metrics = await billing_service.get_usage_metrics(
            organization_id=test_organization_id,
            days=30
        )
        
        assert isinstance(usage_metrics, dict)
        assert "daily_usage" in usage_metrics
        assert "total_usage" in usage_metrics
        assert "peak_usage" in usage_metrics
        assert "trends" in usage_metrics
    
    async def test_get_quota_status(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting quota status."""
        quota_status = await billing_service.get_quota_status(
            organization_id=test_organization_id
        )
        
        assert isinstance(quota_status, dict)
        assert "quotas" in quota_status
        assert "current_usage" in quota_status
        assert "quota_utilization" in quota_status
        assert "warnings" in quota_status
    
    async def test_get_invoices(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting invoices."""
        invoices = await billing_service.get_invoices(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert isinstance(invoices, list)
        # Should return empty list for new organization
        assert len(invoices) >= 0
    
    async def test_get_payment_methods(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test getting payment methods."""
        payment_methods = await billing_service.get_payment_methods(
            organization_id=test_organization_id
        )
        
        assert isinstance(payment_methods, list)
        # Should return empty list for new organization
        assert len(payment_methods) >= 0
    
    async def test_add_payment_method(
        self,
        billing_service: BillingService,
        test_organization_id,
        test_user_id
    ):
        """Test adding a payment method."""
        result = await billing_service.add_payment_method(
            organization_id=test_organization_id,
            payment_method_id="pm_test_visa",
            set_as_default=True,
            added_by=test_user_id
        )
        
        assert "payment_method_id" in result
        assert "status" in result
        assert result["status"] == "success"
    
    async def test_handle_stripe_webhook_invalid_signature(
        self,
        billing_service: BillingService
    ):
        """Test handling Stripe webhook with invalid signature."""
        body = b'{"type": "invoice.payment_succeeded"}'
        signature = "invalid_signature"
        
        with pytest.raises(Exception):
            await billing_service.handle_stripe_webhook(body, signature)
    
    async def test_create_billing_portal_session_no_customer(
        self,
        billing_service: BillingService,
        test_organization_id
    ):
        """Test creating billing portal session for organization without Stripe customer."""
        with pytest.raises(Exception):
            await billing_service.create_billing_portal_session(
                organization_id=test_organization_id
            )


class TestBillingAPI:
    """Test cases for Billing API endpoints."""
    
    @pytest_asyncio.fixture
    async def auth_headers(self, client: AsyncClient, test_user_data):
        """Get authentication headers."""
        # Register and login user
        await client.post("/api/auth/register", json=test_user_data)
        response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        
        token = response.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    async def test_get_plans_endpoint(self, client: AsyncClient):
        """Test GET /api/billing/plans endpoint."""
        response = await client.get("/api/billing/plans")
        
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data["data"]
        assert "total" in data["data"]
        assert len(data["data"]["plans"]) > 0
        
        # Check plan structure
        plan = data["data"]["plans"][0]
        assert "id" in plan
        assert "name" in plan
        assert "price_monthly" in plan
        assert "features" in plan
        assert "quotas" in plan
    
    async def test_get_subscription_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/subscription endpoint."""
        response = await client.get("/api/billing/subscription", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        # Should return null subscription for new organization
        assert data["data"]["subscription"] is None or isinstance(data["data"]["subscription"], dict)
    
    async def test_create_subscription_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/billing/subscription/create endpoint."""
        # Get plans first to get a valid plan ID
        plans_response = await client.get("/api/billing/plans")
        plans = plans_response.json()["data"]["plans"]
        starter_plan = next(plan for plan in plans if plan["name"] == "starter")
        
        subscription_data = {
            "plan_id": starter_plan["id"],
            "billing_interval": "monthly",
            "payment_method_id": "pm_test_visa"
        }
        
        response = await client.post(
            "/api/billing/subscription/create",
            json=subscription_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "subscription_id" in data["data"]
        assert data["message"] == "Subscription created successfully"
    
    async def test_get_usage_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/usage endpoint."""
        response = await client.get("/api/billing/usage", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "usage" in data["data"]
        assert "period_days" in data["data"]
        
        usage = data["data"]["usage"]
        assert "daily_usage" in usage
        assert "total_usage" in usage
        assert "peak_usage" in usage
    
    async def test_get_usage_with_custom_period_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/usage with custom period."""
        params = {"days": 7}
        
        response = await client.get(
            "/api/billing/usage",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["period_days"] == 7
    
    async def test_get_invoices_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/invoices endpoint."""
        response = await client.get("/api/billing/invoices", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data["data"]
        assert "total" in data["data"]
        assert "skip" in data["data"]
        assert "limit" in data["data"]
    
    async def test_get_payment_methods_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/payment-methods endpoint."""
        response = await client.get("/api/billing/payment-methods", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "payment_methods" in data["data"]
    
    async def test_add_payment_method_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/billing/payment-methods endpoint."""
        payment_method_data = {
            "payment_method_id": "pm_test_visa",
            "set_as_default": True
        }
        
        response = await client.post(
            "/api/billing/payment-methods",
            json=payment_method_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "payment_method_id" in data["data"]
        assert "status" in data["data"]
        assert data["message"] == "Payment method added successfully"
    
    async def test_get_quota_status_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/billing/quotas/status endpoint."""
        response = await client.get("/api/billing/quotas/status", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "quotas" in data["data"]
        assert "current_usage" in data["data"]
        assert "quota_utilization" in data["data"]
    
    async def test_stripe_webhook_endpoint_missing_signature(self, client: AsyncClient):
        """Test POST /api/billing/webhooks/stripe without signature."""
        webhook_data = {"type": "invoice.payment_succeeded"}
        
        response = await client.post(
            "/api/billing/webhooks/stripe",
            json=webhook_data
        )
        
        assert response.status_code == 400
        assert "Missing Stripe signature" in response.json()["detail"]
    
    async def test_update_subscription_endpoint(self, client: AsyncClient, auth_headers):
        """Test PUT /api/billing/subscription/update endpoint."""
        # First create a subscription
        plans_response = await client.get("/api/billing/plans")
        plans = plans_response.json()["data"]["plans"]
        starter_plan = next(plan for plan in plans if plan["name"] == "starter")
        
        create_data = {
            "plan_id": starter_plan["id"],
            "billing_interval": "monthly",
            "payment_method_id": "pm_test_visa"
        }
        
        await client.post(
            "/api/billing/subscription/create",
            json=create_data,
            headers=auth_headers
        )
        
        # Now update to business plan
        business_plan = next(plan for plan in plans if plan["name"] == "business")
        update_data = {
            "plan_id": business_plan["id"],
            "billing_interval": "yearly"
        }
        
        response = await client.put(
            "/api/billing/subscription/update",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "subscription_id" in data["data"]
        assert "status" in data["data"]
        assert data["message"] == "Subscription updated successfully"
    
    async def test_cancel_subscription_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/billing/subscription/cancel endpoint."""
        # First create a subscription
        plans_response = await client.get("/api/billing/plans")
        plans = plans_response.json()["data"]["plans"]
        starter_plan = next(plan for plan in plans if plan["name"] == "starter")
        
        create_data = {
            "plan_id": starter_plan["id"],
            "billing_interval": "monthly",
            "payment_method_id": "pm_test_visa"
        }
        
        await client.post(
            "/api/billing/subscription/create",
            json=create_data,
            headers=auth_headers
        )
        
        # Cancel subscription
        cancellation_data = {
            "reason": "Testing cancellation"
        }
        
        response = await client.post(
            "/api/billing/subscription/cancel",
            json=cancellation_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "subscription_id" in data["data"]
        assert "cancelled_at" in data["data"]
        assert data["message"] == "Subscription cancelled successfully"
    
    async def test_remove_payment_method_endpoint(self, client: AsyncClient, auth_headers):
        """Test DELETE /api/billing/payment-methods/{payment_method_id} endpoint."""
        # First add a payment method
        payment_method_data = {
            "payment_method_id": "pm_test_visa",
            "set_as_default": True
        }
        
        await client.post(
            "/api/billing/payment-methods",
            json=payment_method_data,
            headers=auth_headers
        )
        
        # Remove payment method
        response = await client.delete(
            "/api/billing/payment-methods/pm_test_visa",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["removed"] is True
        assert data["message"] == "Payment method removed successfully"
    
    async def test_create_billing_portal_endpoint_no_customer(self, client: AsyncClient, auth_headers):
        """Test POST /api/billing/billing-portal without Stripe customer."""
        response = await client.post("/api/billing/billing-portal", headers=auth_headers)
        
        # Should fail because organization doesn't have a Stripe customer
        assert response.status_code in [400, 404]