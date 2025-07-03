"""Policy management routes for CrossAudit AI."""

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.exceptions import PolicyError, ValidationError, NotFoundError
from app.services.auth import get_current_user
from app.services.policies import PolicyService
from app.models.auth import User
from app.schemas.base import BaseResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def policy_health_check():
    """Health check for policy endpoints."""
    return {"status": "healthy", "service": "policies"}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_data: dict,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new policy."""
    try:
        service = PolicyService(session)
        
        policy = await service.create_policy(
            organization_id=current_user.organization_id,
            name=policy_data.get("name"),
            description=policy_data.get("description"),
            policy_yaml=policy_data.get("policy_yaml"),
            created_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "id": str(policy.id),
                "name": policy.name,
                "description": policy.description,
                "status": "active",
                "created_at": policy.created_at.isoformat()
            },
            message="Policy created successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create policy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create policy"
        )


@router.get("")
async def list_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """List policies for the organization."""
    try:
        service = PolicyService(session)
        
        policies = await service.list_policies(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit,
            search=search
        )
        
        policy_list = []
        for policy in policies:
            policy_list.append({
                "id": str(policy.id),
                "name": policy.name,
                "description": policy.description,
                "priority": policy.priority,
                "is_active": policy.is_active,
                "created_at": policy.created_at.isoformat(),
                "updated_at": policy.updated_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "policies": policy_list,
                "total": len(policy_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to list policies: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve policies"
        )


@router.get("/{policy_id}")
async def get_policy(
    policy_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific policy."""
    try:
        service = PolicyService(session)
        
        policy = await service.get_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id
        )
        
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return BaseResponse(
            data={
                "id": str(policy.id),
                "name": policy.name,
                "description": policy.description,
                "policy_yaml": policy.policy_yaml,
                "parsed_config": policy.parsed_config,
                "priority": policy.priority,
                "is_active": policy.is_active,
                "created_at": policy.created_at.isoformat(),
                "updated_at": policy.updated_at.isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve policy"
        )


@router.put("/{policy_id}")
async def update_policy(
    policy_id: UUID,
    policy_data: dict,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update a policy."""
    try:
        service = PolicyService(session)
        
        policy = await service.update_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id,
            **policy_data
        )
        
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return BaseResponse(
            data={
                "id": str(policy.id),
                "name": policy.name,
                "description": policy.description,
                "priority": policy.priority,
                "is_active": policy.is_active,
                "updated_at": policy.updated_at.isoformat()
            },
            message="Policy updated successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update policy"
        )


@router.delete("/{policy_id}")
async def delete_policy(
    policy_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a policy."""
    try:
        service = PolicyService(session)
        
        success = await service.delete_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return BaseResponse(
            data={"deleted": True},
            message="Policy deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete policy"
        )


@router.post("/{policy_id}/test")
async def test_policy(
    policy_id: UUID,
    test_data: dict,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Test a policy with sample data."""
    try:
        service = PolicyService(session)
        
        result = await service.test_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id,
            test_prompt=test_data.get("prompt", ""),
            test_response=test_data.get("response", "")
        )
        
        return BaseResponse(
            data={
                "policy_id": str(policy_id),
                "test_result": result,
                "timestamp": result.get("evaluated_at")
            },
            message="Policy test completed"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PolicyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to test policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test policy"
        )


@router.post("/validate")
async def validate_policy_yaml(
    validation_data: dict,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Validate policy YAML configuration."""
    try:
        service = PolicyService(session)
        
        result = await service.validate_policy_yaml(
            policy_yaml=validation_data.get("policy_yaml", "")
        )
        
        return BaseResponse(
            data={
                "valid": result["valid"],
                "errors": result.get("errors", []),
                "warnings": result.get("warnings", []),
                "parsed_config": result.get("parsed_config", {})
            },
            message="Policy validation completed"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to validate policy YAML: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate policy"
        )


@router.post("/{policy_id}/activate")
async def activate_policy(
    policy_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Activate a policy."""
    try:
        service = PolicyService(session)
        
        policy = await service.update_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id,
            is_active=True
        )
        
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return BaseResponse(
            data={
                "id": str(policy.id),
                "name": policy.name,
                "is_active": policy.is_active
            },
            message="Policy activated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to activate policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate policy"
        )


@router.post("/{policy_id}/deactivate")
async def deactivate_policy(
    policy_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Deactivate a policy."""
    try:
        service = PolicyService(session)
        
        policy = await service.update_policy(
            policy_id=policy_id,
            organization_id=current_user.organization_id,
            is_active=False
        )
        
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return BaseResponse(
            data={
                "id": str(policy.id),
                "name": policy.name,
                "is_active": policy.is_active
            },
            message="Policy deactivated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to deactivate policy {policy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate policy"
        )