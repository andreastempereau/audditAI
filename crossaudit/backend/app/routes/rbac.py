"""RBAC management routes."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.middleware import get_current_user
from app.schemas.base import BaseResponse
from app.schemas.rbac import (
    RoleCreate, RoleRead, RoleUpdate,
    PermissionCreate, PermissionRead,
    DepartmentCreate, DepartmentRead,
    UserRoleAssignment
)
from app.services.rbac import RBACService

router = APIRouter()
security = HTTPBearer()


# Role management endpoints
@router.post("/roles", response_model=BaseResponse[RoleRead])
async def create_role(
    role_data: RoleCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[RoleRead]:
    """Create new role."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to create roles
    
    rbac_service = RBACService(session)
    role = await rbac_service.create_role(role_data, org_id)
    return BaseResponse(data=role)


@router.get("/roles", response_model=BaseResponse[List[RoleRead]])
async def get_roles(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[RoleRead]]:
    """Get organization roles."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    rbac_service = RBACService(session)
    roles = await rbac_service.get_organization_roles(org_id)
    return BaseResponse(data=roles)


@router.put("/roles/{role_id}", response_model=BaseResponse[RoleRead])
async def update_role(
    role_id: UUID,
    role_data: RoleUpdate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[RoleRead]:
    """Update role."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to update roles
    
    rbac_service = RBACService(session)
    role = await rbac_service.update_role(role_id, role_data)
    return BaseResponse(data=role)


# Permission management endpoints
@router.post("/permissions", response_model=BaseResponse[PermissionRead])
async def create_permission(
    perm_data: PermissionCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[PermissionRead]:
    """Create new permission."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has admin permissions
    
    rbac_service = RBACService(session)
    permission = await rbac_service.create_permission(perm_data)
    return BaseResponse(data=permission)


@router.get("/permissions", response_model=BaseResponse[List[PermissionRead]])
async def get_permissions(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[PermissionRead]]:
    """Get all permissions."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    rbac_service = RBACService(session)
    permissions = await rbac_service.get_all_permissions()
    return BaseResponse(data=permissions)


@router.post("/roles/{role_id}/permissions/{permission_id}")
async def assign_permission_to_role(
    role_id: UUID,
    permission_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Assign permission to role."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to manage roles
    
    rbac_service = RBACService(session)
    await rbac_service.assign_permission_to_role(role_id, permission_id)
    return BaseResponse(data={"message": "Permission assigned to role successfully"})


@router.delete("/roles/{role_id}/permissions/{permission_id}")
async def remove_permission_from_role(
    role_id: UUID,
    permission_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Remove permission from role."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to manage roles
    
    rbac_service = RBACService(session)
    await rbac_service.remove_permission_from_role(role_id, permission_id)
    return BaseResponse(data={"message": "Permission removed from role successfully"})


# User role assignment endpoints
@router.post("/users/{user_id}/roles/{role_id}")
async def assign_role_to_user(
    user_id: UUID,
    role_id: UUID,
    assignment_data: UserRoleAssignment,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Assign role to user."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to assign roles
    
    rbac_service = RBACService(session)
    await rbac_service.assign_role_to_user(
        user_id,
        role_id,
        assignment_data.organization_id,
        assignment_data.department_id
    )
    return BaseResponse(data={"message": "Role assigned to user successfully"})


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    organization_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[dict]:
    """Remove role from user."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # TODO: Check if user has permission to manage user roles
    
    rbac_service = RBACService(session)
    await rbac_service.remove_role_from_user(user_id, role_id, organization_id)
    return BaseResponse(data={"message": "Role removed from user successfully"})


@router.get("/users/{user_id}/roles", response_model=BaseResponse[List[RoleRead]])
async def get_user_roles(
    user_id: UUID,
    organization_id: UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[RoleRead]]:
    """Get user's roles."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Users can view their own roles, admins can view any user's roles
    if current_user.id != user_id:
        # TODO: Check if user has permission to view other users' roles
        pass
    
    rbac_service = RBACService(session)
    roles = await rbac_service.get_user_roles(user_id, organization_id)
    return BaseResponse(data=roles)


# Department management endpoints
@router.post("/departments", response_model=BaseResponse[DepartmentRead])
async def create_department(
    dept_data: DepartmentCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[DepartmentRead]:
    """Create new department."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    # TODO: Check if user has permission to create departments
    
    rbac_service = RBACService(session)
    department = await rbac_service.create_department(dept_data, org_id)
    return BaseResponse(data=department)


@router.get("/departments", response_model=BaseResponse[List[DepartmentRead]])
async def get_departments(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> BaseResponse[List[DepartmentRead]]:
    """Get organization departments."""
    current_user = await get_current_user(credentials, session)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get organization from token (simplified for now)
    org_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: Get from JWT
    
    rbac_service = RBACService(session)
    departments = await rbac_service.get_organization_departments(org_id)
    return BaseResponse(data=departments)