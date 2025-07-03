"""Admin management routes."""

from datetime import datetime
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.admin import (
    APIKeyCreate, APIKeyRead, APIKeyUpdate,
    WebhookCreate, WebhookRead, WebhookUpdate,
    BillingPlanRead, UsageRead
)
from app.services.admin import AdminService

router = APIRouter()
security = HTTPBearer()


# API Key management endpoints
@router.post("/api-keys", response_model=BaseResponse[APIKeyRead])
async def create_api_key(
    key_data: APIKeyCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[APIKeyRead]:
    """Create new API key."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    api_key = await admin_service.create_api_key(key_data, org_id, current_user.id)
    return BaseResponse(data=api_key)


@router.get("/api-keys", response_model=BaseResponse[List[APIKeyRead]])
async def get_api_keys(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[APIKeyRead]]:
    """Get organization API keys."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    api_keys = await admin_service.get_api_keys(org_id)
    return BaseResponse(data=api_keys)


@router.put("/api-keys/{key_id}", response_model=BaseResponse[APIKeyRead])
async def update_api_key(
    key_id: UUID,
    key_data: APIKeyUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[APIKeyRead]:
    """Update API key."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    api_key = await admin_service.update_api_key(key_id, key_data, org_id)
    return BaseResponse(data=api_key)


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Delete API key."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    await admin_service.delete_api_key(key_id, org_id)
    return BaseResponse(data={"message": "API key deleted successfully"})


# Webhook management endpoints
@router.post("/webhooks", response_model=BaseResponse[WebhookRead])
async def create_webhook(
    webhook_data: WebhookCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[WebhookRead]:
    """Create new webhook."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    webhook = await admin_service.create_webhook(webhook_data, org_id, current_user.id)
    return BaseResponse(data=webhook)


@router.get("/webhooks", response_model=BaseResponse[List[WebhookRead]])
async def get_webhooks(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[WebhookRead]]:
    """Get organization webhooks."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    webhooks = await admin_service.get_webhooks(org_id)
    return BaseResponse(data=webhooks)


@router.put("/webhooks/{webhook_id}", response_model=BaseResponse[WebhookRead])
async def update_webhook(
    webhook_id: UUID,
    webhook_data: WebhookUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[WebhookRead]:
    """Update webhook."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has admin permissions
    
    admin_service = AdminService(session)
    webhook = await admin_service.update_webhook(webhook_id, webhook_data, org_id)
    return BaseResponse(data=webhook)


# Billing and usage endpoints
@router.get("/billing/plan", response_model=BaseResponse[BillingPlanRead])
async def get_billing_plan(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[BillingPlanRead]:
    """Get organization billing plan."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has billing permissions
    
    admin_service = AdminService(session)
    plan = await admin_service.get_billing_plan(org_id)
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing plan not found"
        )
    
    return BaseResponse(data=plan)


@router.get("/billing/usage", response_model=BaseResponse[List[UsageRead]])
async def get_usage_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    session: Annotated[AsyncSession, Depends(get_async_session)] = Depends(get_async_session),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)] = Depends(security)
) -> BaseResponse[List[UsageRead]]:
    """Get usage statistics."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has billing permissions
    
    admin_service = AdminService(session)
    usage = await admin_service.get_usage_statistics(org_id, start_date, end_date)
    return BaseResponse(data=usage)