"""Organization management routes."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.auth import OrganizationRead
from app.schemas.base import BaseResponse
from app.services.organization import OrganizationService

router = APIRouter()
security = HTTPBearer()


@router.get("/", response_model=BaseResponse[List[OrganizationRead]])
async def get_user_organizations(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[OrganizationRead]]:
    """Get all organizations for the current user."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    org_service = OrganizationService(session)
    organizations = await org_service.get_user_organizations(current_user.id)
    return BaseResponse(data=organizations)


@router.get("/{org_id}", response_model=BaseResponse[OrganizationRead])
async def get_organization(
    org_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[OrganizationRead]:
    """Get organization by ID."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    org_service = OrganizationService(session)
    organization = await org_service.get_organization_by_id(org_id)
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # TODO: Check if user has access to this organization
    # For now, return the organization
    
    return BaseResponse(data=OrganizationRead(
        id=organization.id,
        name=organization.name,
        display_name=organization.display_name,
        description=organization.description,
        domain=organization.domain,
        logo_url=organization.logo_url,
        website=organization.website,
        industry=organization.industry,
        company_size=organization.company_size,
        headquarters_location=organization.headquarters_location,
        settings=organization.settings,
        subscription_tier=organization.subscription_tier,
        subscription_status=organization.subscription_status,
        is_active=organization.is_active,
        created_at=organization.created_at,
        updated_at=organization.updated_at
    ))


@router.post("/{org_id}/members/{user_id}")
async def add_user_to_organization(
    org_id: UUID,
    user_id: UUID,
    role: str = "member",
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Add user to organization."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if current user has permission to add members
    
    org_service = OrganizationService(session)
    await org_service.add_user_to_organization(user_id, org_id, role)
    
    return BaseResponse(data={"message": "User added to organization successfully"})


@router.delete("/{org_id}/members/{user_id}")
async def remove_user_from_organization(
    org_id: UUID,
    user_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Remove user from organization."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if current user has permission to remove members
    
    org_service = OrganizationService(session)
    await org_service.remove_user_from_organization(user_id, org_id)
    
    return BaseResponse(data={"message": "User removed from organization successfully"})


@router.put("/{org_id}/members/{user_id}/role")
async def update_user_role(
    org_id: UUID,
    user_id: UUID,
    new_role: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Update user's role in organization."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if current user has permission to update roles
    
    org_service = OrganizationService(session)
    await org_service.update_user_role(user_id, org_id, new_role)
    
    return BaseResponse(data={"message": "User role updated successfully"})