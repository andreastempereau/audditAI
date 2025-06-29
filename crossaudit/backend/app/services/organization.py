"""Organization service layer."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import User, UserOrganization
from app.models.organization import Organization
from app.schemas.auth import OrganizationCreate, OrganizationRead


class OrganizationService:
    """Organization management service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_organization(
        self,
        org_data: OrganizationCreate,
        creator_user_id: UUID
    ) -> OrganizationRead:
        """Create new organization."""
        # Check if organization name is already taken
        stmt = select(Organization).where(Organization.name == org_data.name)
        result = await self.session.execute(stmt)
        existing_org = result.scalar_one_or_none()
        
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization with this name already exists"
            )
        
        # Create organization
        organization = Organization(
            id=uuid4(),
            name=org_data.name,
            display_name=org_data.display_name or org_data.name,
            description=org_data.description,
            domain=org_data.domain,
            logo_url=org_data.logo_url,
            website=org_data.website,
            industry=org_data.industry,
            company_size=org_data.company_size,
            headquarters_location=org_data.headquarters_location,
            settings=org_data.settings or {},
            subscription_tier="free",  # Default tier
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(organization)
        await self.session.flush()  # Get the organization ID
        
        # Add creator as organization owner
        user_org = UserOrganization(
            user_id=creator_user_id,
            org_id=organization.id,
            role="owner",
            joined_at=datetime.utcnow()
        )
        
        self.session.add(user_org)
        await self.session.commit()
        await self.session.refresh(organization)
        
        return OrganizationRead(
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
        )
    
    async def get_organization_by_id(self, org_id: UUID) -> Optional[Organization]:
        """Get organization by ID."""
        stmt = select(Organization).where(Organization.id == org_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_organizations(self, user_id: UUID) -> List[OrganizationRead]:
        """Get all organizations for a user."""
        stmt = (
            select(Organization)
            .join(UserOrganization)
            .where(UserOrganization.user_id == user_id)
            .where(Organization.is_active == True)
        )
        result = await self.session.execute(stmt)
        organizations = result.scalars().all()
        
        return [
            OrganizationRead(
                id=org.id,
                name=org.name,
                display_name=org.display_name,
                description=org.description,
                domain=org.domain,
                logo_url=org.logo_url,
                website=org.website,
                industry=org.industry,
                company_size=org.company_size,
                headquarters_location=org.headquarters_location,
                settings=org.settings,
                subscription_tier=org.subscription_tier,
                subscription_status=org.subscription_status,
                is_active=org.is_active,
                created_at=org.created_at,
                updated_at=org.updated_at
            )
            for org in organizations
        ]
    
    async def add_user_to_organization(
        self,
        user_id: UUID,
        org_id: UUID,
        role: str = "member"
    ) -> UserOrganization:
        """Add user to organization."""
        # Check if user is already in organization
        stmt = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this organization"
            )
        
        # Create user-organization relationship
        user_org = UserOrganization(
            user_id=user_id,
            org_id=org_id,
            role=role,
            joined_at=datetime.utcnow()
        )
        
        self.session.add(user_org)
        await self.session.commit()
        await self.session.refresh(user_org)
        
        return user_org
    
    async def remove_user_from_organization(
        self,
        user_id: UUID,
        org_id: UUID
    ) -> None:
        """Remove user from organization."""
        stmt = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id
        )
        result = await self.session.execute(stmt)
        user_org = result.scalar_one_or_none()
        
        if not user_org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this organization"
            )
        
        # Don't allow removing the last owner
        if user_org.role == "owner":
            owner_count_stmt = select(UserOrganization).where(
                UserOrganization.org_id == org_id,
                UserOrganization.role == "owner"
            )
            owner_result = await self.session.execute(owner_count_stmt)
            owner_count = len(owner_result.scalars().all())
            
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner of an organization"
                )
        
        await self.session.delete(user_org)
        await self.session.commit()
    
    async def update_user_role(
        self,
        user_id: UUID,
        org_id: UUID,
        new_role: str
    ) -> UserOrganization:
        """Update user's role in organization."""
        stmt = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id
        )
        result = await self.session.execute(stmt)
        user_org = result.scalar_one_or_none()
        
        if not user_org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this organization"
            )
        
        # Don't allow removing the last owner
        if user_org.role == "owner" and new_role != "owner":
            owner_count_stmt = select(UserOrganization).where(
                UserOrganization.org_id == org_id,
                UserOrganization.role == "owner"
            )
            owner_result = await self.session.execute(owner_count_stmt)
            owner_count = len(owner_result.scalars().all())
            
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change role of the last owner"
                )
        
        user_org.role = new_role
        await self.session.commit()
        await self.session.refresh(user_org)
        
        return user_org