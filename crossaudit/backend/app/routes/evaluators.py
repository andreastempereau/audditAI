"""Evaluator management routes for CrossAudit AI."""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.exceptions import EvaluatorError, ValidationError, NotFoundError
from app.services.auth import get_current_user
from app.services.evaluators import EvaluatorService
from app.models.auth import User
from app.schemas.base import BaseResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def evaluator_health_check():
    """Health check for evaluator endpoints."""
    return {"status": "healthy", "service": "evaluators"}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_evaluator(
    evaluator_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new evaluator."""
    try:
        service = EvaluatorService(session)
        
        evaluator = await service.create_evaluator(
            organization_id=current_user.organization_id,
            name=evaluator_data.get("name"),
            description=evaluator_data.get("description"),
            evaluator_type=evaluator_data.get("evaluator_type"),
            config=evaluator_data.get("config", {}),
            code=evaluator_data.get("code"),
            created_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "id": str(evaluator.id),
                "name": evaluator.name,
                "description": evaluator.description,
                "evaluator_type": evaluator.evaluator_type,
                "status": "active",
                "created_at": evaluator.created_at.isoformat()
            },
            message="Evaluator created successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create evaluator: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create evaluator"
        )


@router.get("")
async def list_evaluators(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    evaluator_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """List evaluators for the organization."""
    try:
        service = EvaluatorService(session)
        
        evaluators = await service.list_evaluators(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit,
            evaluator_type=evaluator_type,
            search=search
        )
        
        evaluator_list = []
        for evaluator in evaluators:
            evaluator_list.append({
                "id": str(evaluator.id),
                "name": evaluator.name,
                "description": evaluator.description,
                "evaluator_type": evaluator.evaluator_type,
                "is_active": evaluator.is_active,
                "version": evaluator.version,
                "created_at": evaluator.created_at.isoformat(),
                "updated_at": evaluator.updated_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "evaluators": evaluator_list,
                "total": len(evaluator_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to list evaluators: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve evaluators"
        )


@router.get("/{evaluator_id}")
async def get_evaluator(
    evaluator_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific evaluator."""
    try:
        service = EvaluatorService(session)
        
        evaluator = await service.get_evaluator(
            evaluator_id=evaluator_id,
            organization_id=current_user.organization_id
        )
        
        if not evaluator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluator not found"
            )
        
        return BaseResponse(
            data={
                "id": str(evaluator.id),
                "name": evaluator.name,
                "description": evaluator.description,
                "evaluator_type": evaluator.evaluator_type,
                "config": evaluator.config,
                "code": evaluator.code,
                "is_active": evaluator.is_active,
                "version": evaluator.version,
                "created_at": evaluator.created_at.isoformat(),
                "updated_at": evaluator.updated_at.isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get evaluator {evaluator_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve evaluator"
        )


@router.put("/{evaluator_id}")
async def update_evaluator(
    evaluator_id: UUID,
    evaluator_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update an evaluator."""
    try:
        service = EvaluatorService(session)
        
        evaluator = await service.update_evaluator(
            evaluator_id=evaluator_id,
            organization_id=current_user.organization_id,
            **evaluator_data
        )
        
        if not evaluator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluator not found"
            )
        
        return BaseResponse(
            data={
                "id": str(evaluator.id),
                "name": evaluator.name,
                "description": evaluator.description,
                "evaluator_type": evaluator.evaluator_type,
                "is_active": evaluator.is_active,
                "version": evaluator.version,
                "updated_at": evaluator.updated_at.isoformat()
            },
            message="Evaluator updated successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update evaluator {evaluator_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update evaluator"
        )


@router.delete("/{evaluator_id}")
async def delete_evaluator(
    evaluator_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Delete an evaluator."""
    try:
        service = EvaluatorService(session)
        
        success = await service.delete_evaluator(
            evaluator_id=evaluator_id,
            organization_id=current_user.organization_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluator not found"
            )
        
        return BaseResponse(
            data={"deleted": True},
            message="Evaluator deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete evaluator {evaluator_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete evaluator"
        )


@router.post("/{evaluator_id}/test")
async def test_evaluator(
    evaluator_id: UUID,
    test_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Test an evaluator with sample data."""
    try:
        service = EvaluatorService(session)
        
        result = await service.test_evaluator(
            evaluator_id=evaluator_id,
            organization_id=current_user.organization_id,
            test_prompt=test_data.get("prompt", ""),
            test_response=test_data.get("response", ""),
            test_context=test_data.get("context", {})
        )
        
        return BaseResponse(
            data={
                "evaluator_id": str(evaluator_id),
                "test_result": result,
                "timestamp": result.get("evaluated_at")
            },
            message="Evaluator test completed"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EvaluatorError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to test evaluator {evaluator_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test evaluator"
        )


@router.post("/{evaluator_id}/deploy")
async def deploy_evaluator(
    evaluator_id: UUID,
    deployment_data: Dict[str, Any],
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Deploy an evaluator to production."""
    try:
        service = EvaluatorService(session)
        
        result = await service.deploy_evaluator(
            evaluator_id=evaluator_id,
            organization_id=current_user.organization_id,
            deployment_config=deployment_data.get("config", {}),
            deployed_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "evaluator_id": str(evaluator_id),
                "deployment_status": result.get("status"),
                "deployment_id": result.get("deployment_id"),
                "deployed_at": result.get("deployed_at")
            },
            message="Evaluator deployed successfully"
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EvaluatorError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to deploy evaluator {evaluator_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deploy evaluator"
        )


@router.get("/types/available")
async def get_available_evaluator_types(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get available evaluator types."""
    try:
        service = EvaluatorService(session)
        types = await service.get_available_types()
        
        return BaseResponse(
            data={
                "evaluator_types": types,
                "total": len(types)
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get evaluator types: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve evaluator types"
        )


@router.post("/plugins/upload")
async def upload_evaluator_plugin(
    file: UploadFile = File(...),
    metadata: Optional[str] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a custom evaluator plugin."""
    try:
        service = EvaluatorService(session)
        
        # Read file content
        content = await file.read()
        
        # Parse metadata if provided
        import json
        plugin_metadata = json.loads(metadata) if metadata else {}
        
        result = await service.upload_plugin(
            organization_id=current_user.organization_id,
            filename=file.filename,
            content=content,
            metadata=plugin_metadata,
            uploaded_by=current_user.id
        )
        
        return BaseResponse(
            data={
                "plugin_id": result.get("plugin_id"),
                "filename": file.filename,
                "status": result.get("status"),
                "uploaded_at": result.get("uploaded_at")
            },
            message="Plugin uploaded successfully"
        )
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to upload plugin: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload plugin"
        )


@router.get("/plugins")
async def list_evaluator_plugins(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """List evaluator plugins for the organization."""
    try:
        service = EvaluatorService(session)
        
        plugins = await service.list_plugins(
            organization_id=current_user.organization_id,
            skip=skip,
            limit=limit
        )
        
        plugin_list = []
        for plugin in plugins:
            plugin_list.append({
                "id": str(plugin.id),
                "name": plugin.name,
                "filename": plugin.filename,
                "description": plugin.description,
                "status": plugin.status,
                "version": plugin.version,
                "uploaded_at": plugin.created_at.isoformat()
            })
        
        return BaseResponse(
            data={
                "plugins": plugin_list,
                "total": len(plugin_list),
                "skip": skip,
                "limit": limit
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to list plugins: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve plugins"
        )