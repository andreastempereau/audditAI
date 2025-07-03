"""Role-Based Access Control service layer with Redis caching."""

import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Set, Union
from uuid import UUID, uuid4
import logging

from fastapi import HTTPException, status
from sqlalchemy import select, and_, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import redis.asyncio as redis

from app.models.rbac import Role, Permission, RolePermission, UserRole, Department
from app.models.auth import User, UserOrganization
from app.schemas.rbac import (
    RoleCreate, RoleRead, RoleUpdate,
    PermissionCreate, PermissionRead,
    DepartmentCreate, DepartmentRead,
    UserRoleAssignment
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RBACService:
    """Enhanced Role-Based Access Control service with Redis caching."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.redis_client: Optional[redis.Redis] = None
        self.cache_ttl = 300  # 5 minutes
        self.permission_cache_ttl = 60  # 1 minute for permission checks
    
    async def initialize_redis(self):
        """Initialize Redis connection for caching."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established for RBAC service")
        except Exception as e:
            logger.warning(f"Redis connection failed, caching disabled: {e}")
            self.redis_client = None
    
    async def close_redis(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    def _cache_key(self, prefix: str, *args) -> str:
        """Generate cache key."""
        return f"rbac:{prefix}:" + ":".join(str(arg) for arg in args)
    
    async def _get_cache(self, key: str) -> Optional[Any]:
        """Get from cache with fallback."""
        if not self.redis_client:
            return None
        try:
            data = await self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.warning(f"Cache get failed for {key}: {e}")
            return None
    
    async def _set_cache(self, key: str, value: Any, ttl: int = None) -> None:
        """Set cache with fallback."""
        if not self.redis_client:
            return
        try:
            ttl = ttl or self.cache_ttl
            await self.redis_client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.warning(f"Cache set failed for {key}: {e}")
    
    async def _delete_cache(self, pattern: str) -> None:
        """Delete cache keys matching pattern."""
        if not self.redis_client:
            return
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache delete failed for {pattern}: {e}")
    
    async def _invalidate_user_cache(self, user_id: UUID, organization_id: UUID = None):
        """Invalidate all cache entries for a user."""
        patterns = [
            self._cache_key("user_permissions", user_id, "*"),
            self._cache_key("user_roles", user_id, "*"),
            self._cache_key("permission_check", user_id, "*")
        ]
        if organization_id:
            patterns.extend([
                self._cache_key("user_permissions", user_id, organization_id),
                self._cache_key("user_roles", user_id, organization_id)
            ])
        
        for pattern in patterns:
            await self._delete_cache(pattern)
    
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
        """Assign role to user and invalidate cache."""
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
        
        # Invalidate user cache
        await self._invalidate_user_cache(user_id, organization_id)
    
    async def remove_role_from_user(
        self,
        user_id: UUID,
        role_id: UUID,
        organization_id: UUID
    ) -> None:
        """Remove role from user and invalidate cache."""
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
            
            # Invalidate user cache
            await self._invalidate_user_cache(user_id, organization_id)
    
    async def get_user_roles(
        self,
        user_id: UUID,
        organization_id: UUID,
        use_cache: bool = True
    ) -> List[RoleRead]:
        """Get all roles for user in organization with caching."""
        cache_key = self._cache_key("user_roles", user_id, organization_id)
        
        # Try cache first
        if use_cache:
            cached = await self._get_cache(cache_key)
            if cached is not None:
                return [RoleRead(**role_data) for role_data in cached]
        
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
        
        role_reads = [
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
        
        # Cache the results
        cache_data = [role.dict() for role in role_reads]
        await self._set_cache(cache_key, cache_data)
        
        return role_reads
    
    async def get_user_permissions(
        self,
        user_id: UUID,
        organization_id: UUID,
        use_cache: bool = True
    ) -> Set[str]:
        """Get all permissions for user in organization with caching."""
        cache_key = self._cache_key("user_permissions", user_id, organization_id)
        
        # Try cache first
        if use_cache:
            cached = await self._get_cache(cache_key)
            if cached is not None:
                return set(cached)
        
        # Check database permission cache table first
        db_cache_result = await self._get_db_permission_cache(user_id, organization_id)
        if db_cache_result:
            permissions = set(db_cache_result)
            await self._set_cache(cache_key, list(permissions), self.permission_cache_ttl)
            return permissions
        
        # Full query from database
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
        permissions = set(result.scalars().all())
        
        # Update database cache
        await self._update_db_permission_cache(user_id, organization_id, permissions)
        
        # Update Redis cache
        await self._set_cache(cache_key, list(permissions), self.permission_cache_ttl)
        
        return permissions
    
    async def check_user_permission(
        self,
        user_id: UUID,
        organization_id: UUID,
        permission: str,
        use_cache: bool = True
    ) -> bool:
        """Check if user has specific permission with ultra-fast caching."""
        # Ultra-fast permission check cache
        cache_key = self._cache_key("permission_check", user_id, organization_id, permission)
        
        if use_cache:
            cached = await self._get_cache(cache_key)
            if cached is not None:
                return bool(cached)
        
        # Get all permissions and check
        user_permissions = await self.get_user_permissions(user_id, organization_id, use_cache)
        has_permission = permission in user_permissions
        
        # Cache the specific permission check result
        await self._set_cache(cache_key, has_permission, self.permission_cache_ttl)
        
        return has_permission
    
    async def check_multiple_permissions(
        self,
        user_id: UUID,
        organization_id: UUID,
        permissions: List[str],
        require_all: bool = False
    ) -> Dict[str, bool]:
        """Check multiple permissions efficiently."""
        user_permissions = await self.get_user_permissions(user_id, organization_id)
        
        results = {}
        for permission in permissions:
            has_perm = permission in user_permissions
            results[permission] = has_perm
            
            # Cache individual permission checks
            cache_key = self._cache_key("permission_check", user_id, organization_id, permission)
            await self._set_cache(cache_key, has_perm, self.permission_cache_ttl)
        
        if require_all:
            all_granted = all(results.values())
            results["_all_granted"] = all_granted
        
        return results
    
    async def _get_db_permission_cache(
        self, 
        user_id: UUID, 
        organization_id: UUID
    ) -> Optional[List[str]]:
        """Get permissions from database cache table."""
        try:
            stmt = text("""
                SELECT permissions FROM permission_cache 
                WHERE user_id = :user_id 
                AND organization_id = :organization_id 
                AND expires_at > NOW()
            """)
            result = await self.session.execute(stmt, {
                "user_id": user_id,
                "organization_id": organization_id
            })
            row = result.fetchone()
            return row[0] if row else None
        except Exception as e:
            logger.warning(f"Database permission cache query failed: {e}")
            return None
    
    async def _update_db_permission_cache(
        self,
        user_id: UUID,
        organization_id: UUID,
        permissions: Set[str]
    ) -> None:
        """Update database permission cache."""
        try:
            stmt = text("""
                INSERT INTO permission_cache (user_id, organization_id, permissions, expires_at)
                VALUES (:user_id, :organization_id, :permissions, :expires_at)
                ON CONFLICT (user_id, organization_id) 
                DO UPDATE SET 
                    permissions = EXCLUDED.permissions,
                    calculated_at = NOW(),
                    expires_at = EXCLUDED.expires_at
            """)
            await self.session.execute(stmt, {
                "user_id": user_id,
                "organization_id": organization_id,
                "permissions": list(permissions),
                "expires_at": datetime.utcnow() + timedelta(seconds=self.permission_cache_ttl)
            })
            await self.session.commit()
        except Exception as e:
            logger.warning(f"Failed to update database permission cache: {e}")
    
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
    
    # Advanced RBAC Features
    
    async def check_conditional_permission(
        self,
        user_id: UUID,
        organization_id: UUID,
        permission: str,
        context: Dict[str, Any] = None
    ) -> bool:
        """Check permission with conditional logic."""
        # Get permission details including conditions
        stmt = (
            select(Permission)
            .join(RolePermission, Permission.id == RolePermission.permission_id)
            .join(Role, RolePermission.role_id == Role.id)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.organization_id == organization_id,
                    Permission.name == permission,
                    Permission.is_active == True,
                    Role.is_active == True
                )
            )
        )
        result = await self.session.execute(stmt)
        permissions = result.scalars().all()
        
        if not permissions:
            return False
        
        # Evaluate conditions
        for perm in permissions:
            if await self._evaluate_permission_conditions(perm.conditions, context, user_id, organization_id):
                return True
        
        return False
    
    async def _evaluate_permission_conditions(
        self,
        conditions: Dict[str, Any],
        context: Dict[str, Any] = None,
        user_id: UUID = None,
        organization_id: UUID = None
    ) -> bool:
        """Evaluate permission conditions."""
        if not conditions:
            return True  # No conditions = always allow
        
        context = context or {}
        
        # Own resource check
        if conditions.get("own_only"):
            resource_owner = context.get("resource_owner_id")
            if resource_owner and str(resource_owner) != str(user_id):
                return False
        
        # Department check
        if "department" in conditions:
            required_dept = conditions["department"]
            user_dept = context.get("user_department_id")
            if str(user_dept) != str(required_dept):
                return False
        
        # Time-based restrictions
        if "time_restrictions" in conditions:
            current_time = datetime.utcnow()
            restrictions = conditions["time_restrictions"]
            
            if "start_time" in restrictions:
                start_time = datetime.fromisoformat(restrictions["start_time"])
                if current_time < start_time:
                    return False
            
            if "end_time" in restrictions:
                end_time = datetime.fromisoformat(restrictions["end_time"])
                if current_time > end_time:
                    return False
        
        # IP restrictions
        if "ip_restrictions" in conditions:
            allowed_ips = conditions["ip_restrictions"]
            client_ip = context.get("client_ip")
            if client_ip and client_ip not in allowed_ips:
                return False
        
        # Classification level check
        if "max_classification" in conditions:
            max_level = conditions["max_classification"]
            resource_level = context.get("resource_classification")
            if resource_level and self._classification_level_value(resource_level) > self._classification_level_value(max_level):
                return False
        
        return True
    
    def _classification_level_value(self, level: str) -> int:
        """Convert classification level to numeric value for comparison."""
        levels = {
            "public": 0,
            "internal": 1,
            "confidential": 2,
            "restricted": 3,
            "secret": 4
        }
        return levels.get(level.lower(), 0)
    
    async def get_effective_permissions(
        self,
        user_id: UUID,
        organization_id: UUID,
        resource_type: str = None,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Get effective permissions with full context."""
        cache_key = self._cache_key("effective_permissions", user_id, organization_id, resource_type or "all")
        
        # Try cache first
        cached = await self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        # Get all user permissions with their conditions
        stmt = (
            select(Permission, Role, UserRole)
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
        
        if resource_type:
            stmt = stmt.where(Permission.resource == resource_type)
        
        result = await self.session.execute(stmt)
        rows = result.all()
        
        effective_perms = {
            "permissions": [],
            "roles": [],
            "conditions": {},
            "hierarchy": {}
        }
        
        for permission, role, user_role in rows:
            perm_data = {
                "name": permission.name,
                "resource": permission.resource,
                "action": permission.action,
                "conditions": permission.conditions,
                "from_role": role.name,
                "department_id": user_role.department_id
            }
            
            # Check if conditions are met
            if await self._evaluate_permission_conditions(permission.conditions, context, user_id, organization_id):
                effective_perms["permissions"].append(perm_data)
                
                # Track conditions for debugging
                if permission.conditions:
                    effective_perms["conditions"][permission.name] = permission.conditions
        
        # Remove duplicates and add role info
        seen_roles = set()
        for _, role, user_role in rows:
            if role.id not in seen_roles:
                effective_perms["roles"].append({
                    "id": str(role.id),
                    "name": role.name,
                    "display_name": role.display_name,
                    "department_id": str(user_role.department_id) if user_role.department_id else None
                })
                seen_roles.add(role.id)
        
        # Cache for 2 minutes (shorter due to context sensitivity)
        await self._set_cache(cache_key, effective_perms, 120)
        
        return effective_perms
    
    async def get_permission_hierarchy(
        self,
        organization_id: UUID
    ) -> Dict[str, List[str]]:
        """Get permission hierarchy for organization."""
        cache_key = self._cache_key("permission_hierarchy", organization_id)
        
        cached = await self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        stmt = (
            select(Permission.resource, func.array_agg(Permission.name))
            .group_by(Permission.resource)
            .where(Permission.is_active == True)
        )
        result = await self.session.execute(stmt)
        
        hierarchy = {}
        for resource, permissions in result.all():
            hierarchy[resource] = permissions
        
        await self._set_cache(cache_key, hierarchy, 600)  # Cache for 10 minutes
        return hierarchy
    
    async def bulk_permission_check(
        self,
        user_id: UUID,
        organization_id: UUID,
        checks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Perform bulk permission checks efficiently."""
        user_permissions = await self.get_user_permissions(user_id, organization_id)
        
        results = []
        for check in checks:
            permission = check["permission"]
            context = check.get("context", {})
            
            # Fast path: check if user has permission at all
            if permission not in user_permissions:
                results.append({
                    "permission": permission,
                    "allowed": False,
                    "reason": "permission_not_granted"
                })
                continue
            
            # Conditional check if context provided
            if context:
                allowed = await self.check_conditional_permission(
                    user_id, organization_id, permission, context
                )
                results.append({
                    "permission": permission,
                    "allowed": allowed,
                    "reason": "conditional_check"
                })
            else:
                results.append({
                    "permission": permission,
                    "allowed": True,
                    "reason": "basic_permission_check"
                })
        
        return results
    
    async def get_rbac_analytics(
        self,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get RBAC analytics and metrics."""
        cache_key = self._cache_key("rbac_analytics", organization_id, days)
        
        cached = await self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        # Get role distribution
        role_stats = await self.session.execute(
            text("""
                SELECT r.name, r.display_name, COUNT(ur.user_id) as user_count
                FROM roles r
                LEFT JOIN user_roles ur ON r.id = ur.role_id
                WHERE r.organization_id = :org_id AND r.is_active = true
                GROUP BY r.id, r.name, r.display_name
                ORDER BY user_count DESC
            """),
            {"org_id": organization_id}
        )
        
        # Get permission usage
        perm_stats = await self.session.execute(
            text("""
                SELECT p.name, p.resource, p.action, COUNT(DISTINCT ur.user_id) as user_count
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.organization_id = :org_id AND p.is_active = true
                GROUP BY p.id, p.name, p.resource, p.action
                ORDER BY user_count DESC
                LIMIT 20
            """),
            {"org_id": organization_id}
        )
        
        # Get department distribution
        dept_stats = await self.session.execute(
            text("""
                SELECT d.name, COUNT(ur.user_id) as user_count
                FROM departments d
                LEFT JOIN user_roles ur ON d.id = ur.department_id
                WHERE d.organization_id = :org_id AND d.is_active = true
                GROUP BY d.id, d.name
                ORDER BY user_count DESC
            """),
            {"org_id": organization_id}
        )
        
        analytics = {
            "role_distribution": [
                {"role": row[0], "display_name": row[1], "user_count": row[2]}
                for row in role_stats.fetchall()
            ],
            "permission_usage": [
                {"permission": row[0], "resource": row[1], "action": row[2], "user_count": row[3]}
                for row in perm_stats.fetchall()
            ],
            "department_distribution": [
                {"department": row[0], "user_count": row[1]}
                for row in dept_stats.fetchall()
            ],
            "generated_at": datetime.utcnow().isoformat()
        }
        
        await self._set_cache(cache_key, analytics, 3600)  # Cache for 1 hour
        return analytics
    
    async def sync_permissions_from_definitions(
        self,
        permission_definitions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Sync permissions from canonical definitions."""
        results = {
            "created": 0,
            "updated": 0,
            "deactivated": 0,
            "errors": []
        }
        
        try:
            # Get existing permissions
            existing_perms = await self.session.execute(
                select(Permission).where(Permission.is_active == True)
            )
            existing_map = {perm.name: perm for perm in existing_perms.scalars().all()}
            
            defined_names = set()
            
            for definition in permission_definitions:
                try:
                    name = definition["name"]
                    defined_names.add(name)
                    
                    if name in existing_map:
                        # Update existing permission
                        perm = existing_map[name]
                        perm.display_name = definition.get("display_name", perm.display_name)
                        perm.description = definition.get("description", perm.description)
                        perm.resource = definition.get("resource", perm.resource)
                        perm.action = definition.get("action", perm.action)
                        perm.conditions = definition.get("conditions", perm.conditions)
                        results["updated"] += 1
                    else:
                        # Create new permission
                        new_perm = Permission(
                            id=uuid4(),
                            name=name,
                            display_name=definition.get("display_name", name),
                            description=definition.get("description", ""),
                            resource=definition.get("resource", ""),
                            action=definition.get("action", ""),
                            conditions=definition.get("conditions", {}),
                            is_active=True,
                            created_at=datetime.utcnow()
                        )
                        self.session.add(new_perm)
                        results["created"] += 1
                        
                except Exception as e:
                    results["errors"].append(f"Error processing {definition.get('name', 'unknown')}: {str(e)}")
            
            # Deactivate permissions not in definitions
            for name, perm in existing_map.items():
                if name not in defined_names:
                    perm.is_active = False
                    results["deactivated"] += 1
            
            await self.session.commit()
            
            # Clear related caches
            await self._delete_cache("rbac:*")
            
        except Exception as e:
            await self.session.rollback()
            results["errors"].append(f"Transaction failed: {str(e)}")
        
        return results
    
    async def cleanup_expired_cache(self):
        """Clean up expired permission cache entries."""
        try:
            await self.session.execute(
                text("SELECT cleanup_expired_permission_cache()")
            )
            await self.session.commit()
        except Exception as e:
            logger.warning(f"Failed to cleanup expired permission cache: {e}")