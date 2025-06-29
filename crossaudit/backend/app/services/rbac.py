"""Role-Based Access Control service layer."""

from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rbac import Role, Permission, RolePermission, UserRole, Department
from app.models.auth import User, UserOrganization
from app.schemas.rbac import (
    RoleCreate, RoleRead, RoleUpdate,
    PermissionCreate, PermissionRead,
    DepartmentCreate, DepartmentRead,
    UserRoleAssignment
)


class RBACService:
    """Role-Based Access Control service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    # Role management
    async def create_role(
        self,
        role_data: RoleCreate,
        organization_id: UUID
    ) -> RoleRead:
        """Create new role."""
        role = Role(
            id=uuid4(),
            organization_id=organization_id,
            name=role_data.name,
            display_name=role_data.display_name or role_data.name,
            description=role_data.description,
            is_system_role=False,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(role)
        await self.session.commit()
        await self.session.refresh(role)
        
        return RoleRead(
            id=role.id,
            organization_id=role.organization_id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            is_system_role=role.is_system_role,
            is_active=role.is_active,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
    
    async def get_role_by_id(self, role_id: UUID) -> Optional[Role]:
        """Get role by ID."""
        stmt = select(Role).where(Role.id == role_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_organization_roles(self, organization_id: UUID) -> List[RoleRead]:
        """Get all roles for organization."""
        stmt = (
            select(Role)
            .where(Role.organization_id == organization_id)
            .where(Role.is_active == True)
        )
        result = await self.session.execute(stmt)
        roles = result.scalars().all()
        
        return [
            RoleRead(
                id=role.id,
                organization_id=role.organization_id,
                name=role.name,
                display_name=role.display_name,
                description=role.description,
                is_system_role=role.is_system_role,
                is_active=role.is_active,
                created_at=role.created_at,
                updated_at=role.updated_at
            )
            for role in roles
        ]
    
    async def update_role(
        self,
        role_id: UUID,
        role_data: RoleUpdate
    ) -> RoleRead:
        """Update role."""
        role = await self.get_role_by_id(role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
        
        if role.is_system_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify system role"
            )
        
        # Update fields
        if role_data.display_name is not None:
            role.display_name = role_data.display_name
        if role_data.description is not None:
            role.description = role_data.description
        if role_data.is_active is not None:
            role.is_active = role_data.is_active
        
        role.updated_at = datetime.utcnow()
        
        await self.session.commit()
        await self.session.refresh(role)
        
        return RoleRead(
            id=role.id,
            organization_id=role.organization_id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            is_system_role=role.is_system_role,
            is_active=role.is_active,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
    
    # Permission management
    async def create_permission(
        self,
        perm_data: PermissionCreate
    ) -> PermissionRead:
        """Create new permission."""
        permission = Permission(
            id=uuid4(),
            name=perm_data.name,
            display_name=perm_data.display_name or perm_data.name,
            description=perm_data.description,
            resource=perm_data.resource,
            action=perm_data.action,
            conditions=perm_data.conditions or {},
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        self.session.add(permission)
        await self.session.commit()
        await self.session.refresh(permission)
        
        return PermissionRead(
            id=permission.id,
            name=permission.name,
            display_name=permission.display_name,
            description=permission.description,
            resource=permission.resource,
            action=permission.action,
            conditions=permission.conditions,
            is_active=permission.is_active,
            created_at=permission.created_at
        )
    
    async def get_all_permissions(self) -> List[PermissionRead]:
        """Get all available permissions."""
        stmt = select(Permission).where(Permission.is_active == True)
        result = await self.session.execute(stmt)
        permissions = result.scalars().all()
        
        return [
            PermissionRead(
                id=perm.id,
                name=perm.name,
                display_name=perm.display_name,
                description=perm.description,
                resource=perm.resource,
                action=perm.action,
                conditions=perm.conditions,
                is_active=perm.is_active,
                created_at=perm.created_at
            )
            for perm in permissions
        ]
    
    async def assign_permission_to_role(
        self,
        role_id: UUID,
        permission_id: UUID
    ) -> None:
        """Assign permission to role."""
        # Check if assignment already exists
        stmt = select(RolePermission).where(
            and_(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id
            )
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            return  # Already assigned
        
        role_permission = RolePermission(
            role_id=role_id,
            permission_id=permission_id,
            granted_at=datetime.utcnow()
        )
        
        self.session.add(role_permission)
        await self.session.commit()
    
    async def remove_permission_from_role(
        self,
        role_id: UUID,
        permission_id: UUID
    ) -> None:
        """Remove permission from role."""
        stmt = select(RolePermission).where(
            and_(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id
            )
        )
        result = await self.session.execute(stmt)
        role_permission = result.scalar_one_or_none()
        
        if role_permission:
            await self.session.delete(role_permission)
            await self.session.commit()
    
    # User role management
    async def assign_role_to_user(
        self,
        user_id: UUID,
        role_id: UUID,
        organization_id: UUID,
        department_id: Optional[UUID] = None
    ) -> None:
        """Assign role to user."""
        # Check if assignment already exists
        stmt = select(UserRole).where(
            and_(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
                UserRole.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            return  # Already assigned
        
        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            organization_id=organization_id,
            department_id=department_id,
            assigned_at=datetime.utcnow()
        )
        
        self.session.add(user_role)
        await self.session.commit()
    
    async def remove_role_from_user(
        self,
        user_id: UUID,
        role_id: UUID,
        organization_id: UUID
    ) -> None:
        """Remove role from user."""
        stmt = select(UserRole).where(
            and_(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
                UserRole.organization_id == organization_id
            )
        )
        result = await self.session.execute(stmt)
        user_role = result.scalar_one_or_none()
        
        if user_role:
            await self.session.delete(user_role)
            await self.session.commit()
    
    async def get_user_roles(
        self,
        user_id: UUID,
        organization_id: UUID
    ) -> List[RoleRead]:
        """Get all roles for user in organization."""
        stmt = (
            select(Role)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.organization_id == organization_id,
                    Role.is_active == True
                )
            )
        )
        result = await self.session.execute(stmt)
        roles = result.scalars().all()
        
        return [
            RoleRead(
                id=role.id,
                organization_id=role.organization_id,
                name=role.name,
                display_name=role.display_name,
                description=role.description,
                is_system_role=role.is_system_role,
                is_active=role.is_active,
                created_at=role.created_at,
                updated_at=role.updated_at
            )
            for role in roles
        ]
    
    async def get_user_permissions(
        self,
        user_id: UUID,
        organization_id: UUID
    ) -> Set[str]:
        """Get all permissions for user in organization."""
        stmt = (
            select(Permission.name)
            .join(RolePermission, Permission.id == RolePermission.permission_id)
            .join(Role, RolePermission.role_id == Role.id)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.organization_id == organization_id,
                    Permission.is_active == True,
                    Role.is_active == True
                )
            )
        )
        result = await self.session.execute(stmt)
        permissions = result.scalars().all()
        
        return set(permissions)
    
    async def check_user_permission(
        self,
        user_id: UUID,
        organization_id: UUID,
        permission: str
    ) -> bool:
        """Check if user has specific permission."""
        user_permissions = await self.get_user_permissions(user_id, organization_id)
        return permission in user_permissions
    
    # Department management
    async def create_department(
        self,
        dept_data: DepartmentCreate,
        organization_id: UUID
    ) -> DepartmentRead:
        """Create new department."""
        department = Department(
            id=uuid4(),
            organization_id=organization_id,
            name=dept_data.name,
            display_name=dept_data.display_name or dept_data.name,
            description=dept_data.description,
            parent_department_id=dept_data.parent_department_id,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.session.add(department)
        await self.session.commit()
        await self.session.refresh(department)
        
        return DepartmentRead(
            id=department.id,
            organization_id=department.organization_id,
            name=department.name,
            display_name=department.display_name,
            description=department.description,
            parent_department_id=department.parent_department_id,
            is_active=department.is_active,
            created_at=department.created_at,
            updated_at=department.updated_at
        )
    
    async def get_organization_departments(
        self,
        organization_id: UUID
    ) -> List[DepartmentRead]:
        """Get all departments for organization."""
        stmt = (
            select(Department)
            .where(Department.organization_id == organization_id)
            .where(Department.is_active == True)
        )
        result = await self.session.execute(stmt)
        departments = result.scalars().all()
        
        return [
            DepartmentRead(
                id=dept.id,
                organization_id=dept.organization_id,
                name=dept.name,
                display_name=dept.display_name,
                description=dept.description,
                parent_department_id=dept.parent_department_id,
                is_active=dept.is_active,
                created_at=dept.created_at,
                updated_at=dept.updated_at
            )
            for dept in departments
        ]
    
    async def initialize_default_roles_and_permissions(
        self,
        organization_id: UUID
    ) -> None:
        """Initialize default roles and permissions for new organization."""
        # Create default permissions
        default_permissions = [
            ("documents.read", "documents", "read", "Read documents"),
            ("documents.write", "documents", "write", "Create and edit documents"),
            ("documents.delete", "documents", "delete", "Delete documents"),
            ("chat.read", "chat", "read", "Read chat messages"),
            ("chat.write", "chat", "write", "Send chat messages"),
            ("users.read", "users", "read", "View user information"),
            ("users.manage", "users", "manage", "Manage users"),
            ("admin.full", "admin", "*", "Full administrative access"),
        ]
        
        permissions = {}
        for name, resource, action, description in default_permissions:
            perm = Permission(
                id=uuid4(),
                name=name,
                display_name=description,
                description=description,
                resource=resource,
                action=action,
                conditions={},
                is_active=True,
                created_at=datetime.utcnow()
            )
            self.session.add(perm)
            permissions[name] = perm
        
        # Create default roles
        default_roles = [
            ("admin", "Administrator", "Full system access"),
            ("manager", "Manager", "Management access"),
            ("member", "Member", "Standard user access"),
            ("viewer", "Viewer", "Read-only access"),
        ]
        
        roles = {}
        for name, display_name, description in default_roles:
            role = Role(
                id=uuid4(),
                organization_id=organization_id,
                name=name,
                display_name=display_name,
                description=description,
                is_system_role=True,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.session.add(role)
            roles[name] = role
        
        await self.session.flush()  # Get IDs
        
        # Assign permissions to roles
        role_permissions = {
            "admin": ["admin.full"],
            "manager": ["documents.read", "documents.write", "chat.read", "chat.write", "users.read"],
            "member": ["documents.read", "documents.write", "chat.read", "chat.write"],
            "viewer": ["documents.read", "chat.read"],
        }
        
        for role_name, perm_names in role_permissions.items():
            role = roles[role_name]
            for perm_name in perm_names:
                if perm_name in permissions:
                    role_perm = RolePermission(
                        role_id=role.id,
                        permission_id=permissions[perm_name].id,
                        granted_at=datetime.utcnow()
                    )
                    self.session.add(role_perm)
        
        await self.session.commit()