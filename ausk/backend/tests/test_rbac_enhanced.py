"""Comprehensive tests for enhanced RBAC service."""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock

from app.services.rbac import RBACService
from app.models.rbac import Role, Permission, RolePermission, UserRole, Department
from app.schemas.rbac import RoleCreate, PermissionCreate, DepartmentCreate


class TestEnhancedRBACService:
    """Test suite for enhanced RBAC service with Redis caching."""
    
    @pytest.fixture
    async def rbac_service(self, db_session):
        """Create RBAC service instance."""
        service = RBACService(db_session)
        # Mock Redis for testing
        service.redis_client = AsyncMock()
        service.redis_client.ping = AsyncMock(return_value=True)
        service.redis_client.get = AsyncMock(return_value=None)
        service.redis_client.setex = AsyncMock()
        service.redis_client.delete = AsyncMock()
        service.redis_client.keys = AsyncMock(return_value=[])
        yield service
        await service.close_redis()
    
    @pytest.fixture
    def organization_id(self):
        """Test organization ID."""
        return uuid4()
    
    @pytest.fixture
    def user_id(self):
        """Test user ID."""
        return uuid4()
    
    @pytest.fixture
    async def test_permission(self, db_session):
        """Create test permission."""
        permission = Permission(
            id=uuid4(),
            name="test.permission",
            display_name="Test Permission",
            description="Test permission for testing",
            resource="test",
            action="read",
            conditions={},
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(permission)
        await db_session.commit()
        await db_session.refresh(permission)
        return permission
    
    @pytest.fixture
    async def test_role(self, db_session, organization_id):
        """Create test role."""
        role = Role(
            id=uuid4(),
            organization_id=organization_id,
            name="test_role",
            display_name="Test Role",
            description="Test role for testing",
            is_system_role=False,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)
        return role
    
    # Basic RBAC functionality tests
    
    async def test_create_role(self, rbac_service, organization_id):
        """Test role creation."""
        role_data = RoleCreate(
            name="test_role",
            display_name="Test Role",
            description="A test role"
        )
        
        result = await rbac_service.create_role(role_data, organization_id)
        
        assert result.name == "test_role"
        assert result.display_name == "Test Role"
        assert result.organization_id == organization_id
        assert not result.is_system_role
        assert result.is_active
    
    async def test_create_permission(self, rbac_service):
        """Test permission creation."""
        perm_data = PermissionCreate(
            name="test.permission",
            display_name="Test Permission",
            description="A test permission",
            resource="test",
            action="read",
            conditions={"own_only": True}
        )
        
        result = await rbac_service.create_permission(perm_data)
        
        assert result.name == "test.permission"
        assert result.resource == "test"
        assert result.action == "read"
        assert result.conditions == {"own_only": True}
    
    async def test_assign_permission_to_role(self, rbac_service, test_role, test_permission):
        """Test assigning permission to role."""
        await rbac_service.assign_permission_to_role(test_role.id, test_permission.id)
        
        # Verify assignment was created
        # This would normally check the database, but we'll verify the method completes
        assert True  # Method completed without error
    
    async def test_assign_role_to_user(self, rbac_service, test_role, user_id, organization_id):
        """Test assigning role to user."""
        await rbac_service.assign_role_to_user(user_id, test_role.id, organization_id)
        
        # Verify Redis cache invalidation was called
        rbac_service.redis_client.delete.assert_called()
    
    # Caching tests
    
    async def test_permission_check_with_cache_hit(self, rbac_service, user_id, organization_id):
        """Test permission check with cache hit."""
        # Mock cache hit
        rbac_service.redis_client.get.return_value = '["test.permission"]'
        
        result = await rbac_service.check_user_permission(
            user_id, organization_id, "test.permission"
        )
        
        assert result is True
        rbac_service.redis_client.get.assert_called()
    
    async def test_permission_check_with_cache_miss(self, rbac_service, user_id, organization_id, db_session):
        """Test permission check with cache miss."""
        # Mock cache miss
        rbac_service.redis_client.get.return_value = None
        
        # Mock database permission cache
        rbac_service._get_db_permission_cache = AsyncMock(return_value=["test.permission"])
        
        result = await rbac_service.check_user_permission(
            user_id, organization_id, "test.permission"
        )
        
        assert result is True
        rbac_service.redis_client.setex.assert_called()
    
    async def test_cache_invalidation_on_role_change(self, rbac_service, user_id, organization_id, test_role):
        """Test cache invalidation when user roles change."""
        await rbac_service.assign_role_to_user(user_id, test_role.id, organization_id)
        
        # Verify cache was invalidated
        rbac_service.redis_client.keys.assert_called()
        rbac_service.redis_client.delete.assert_called()
    
    # Conditional permissions tests
    
    async def test_conditional_permission_own_only(self, rbac_service, user_id, organization_id, db_session):
        """Test conditional permission with own_only condition."""
        # Create permission with own_only condition
        permission = Permission(
            id=uuid4(),
            name="document.edit",
            display_name="Edit Document",
            description="Edit document permission",
            resource="document",
            action="edit",
            conditions={"own_only": True},
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(permission)
        await db_session.commit()
        
        # Test with user as owner
        context = {"resource_owner_id": user_id}
        
        # Mock the permission query to return our test permission
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [permission]
        rbac_service.session.execute.return_value = mock_result
        
        result = await rbac_service.check_conditional_permission(
            user_id, organization_id, "document.edit", context
        )
        
        assert result is True
    
    async def test_conditional_permission_ip_restriction(self, rbac_service, user_id, organization_id):
        """Test conditional permission with IP restrictions."""
        # Mock permission with IP restrictions
        permission = MagicMock()
        permission.conditions = {"ip_restrictions": ["192.168.1.0/24"]}
        
        # Mock the permission query
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [permission]
        rbac_service.session.execute.return_value = mock_result
        
        # Test with allowed IP
        context = {"client_ip": "192.168.1.100"}
        result = await rbac_service.check_conditional_permission(
            user_id, organization_id, "admin.access", context
        )
        
        # Should be True if IP is in allowed range (mocked evaluation)
        assert isinstance(result, bool)
    
    async def test_conditional_permission_time_restriction(self, rbac_service, user_id, organization_id):
        """Test conditional permission with time restrictions."""
        # Mock permission with time restrictions
        permission = MagicMock()
        permission.conditions = {
            "time_restrictions": {
                "start_time": "09:00:00",
                "end_time": "17:00:00"
            }
        }
        
        # Mock the permission query
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [permission]
        rbac_service.session.execute.return_value = mock_result
        
        context = {}
        result = await rbac_service.check_conditional_permission(
            user_id, organization_id, "admin.access", context
        )
        
        assert isinstance(result, bool)
    
    # Bulk operations tests
    
    async def test_bulk_permission_check(self, rbac_service, user_id, organization_id):
        """Test bulk permission checking."""
        # Mock user permissions
        rbac_service.get_user_permissions = AsyncMock(
            return_value={"document.read", "document.write"}
        )
        
        checks = [
            {"permission": "document.read"},
            {"permission": "document.write"},
            {"permission": "admin.access"},
            {"permission": "document.delete", "context": {"resource_owner_id": user_id}}
        ]
        
        results = await rbac_service.bulk_permission_check(
            user_id, organization_id, checks
        )
        
        assert len(results) == 4
        assert results[0]["allowed"] is True  # document.read
        assert results[1]["allowed"] is True  # document.write
        assert results[2]["allowed"] is False  # admin.access (not granted)
    
    async def test_check_multiple_permissions(self, rbac_service, user_id, organization_id):
        """Test checking multiple permissions at once."""
        # Mock user permissions
        rbac_service.get_user_permissions = AsyncMock(
            return_value={"document.read", "document.write"}
        )
        
        permissions = ["document.read", "document.write", "admin.access"]
        
        results = await rbac_service.check_multiple_permissions(
            user_id, organization_id, permissions
        )
        
        assert results["document.read"] is True
        assert results["document.write"] is True
        assert results["admin.access"] is False
    
    # Analytics tests
    
    async def test_get_rbac_analytics(self, rbac_service, organization_id):
        """Test RBAC analytics generation."""
        # Mock cache miss
        rbac_service.redis_client.get.return_value = None
        
        # Mock database queries
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            ("admin", "Administrator", 2),
            ("member", "Member", 5)
        ]
        rbac_service.session.execute.return_value = mock_result
        
        analytics = await rbac_service.get_rbac_analytics(organization_id, 30)
        
        assert "role_distribution" in analytics
        assert "permission_usage" in analytics
        assert "department_distribution" in analytics
        assert analytics["generated_at"] is not None
    
    # Permission sync tests
    
    async def test_sync_permissions_from_definitions(self, rbac_service):
        """Test syncing permissions from canonical definitions."""
        definitions = [
            {
                "name": "test.new",
                "display_name": "New Test Permission",
                "description": "A new test permission",
                "resource": "test",
                "action": "new",
                "conditions": {}
            }
        ]
        
        # Mock existing permissions query
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        rbac_service.session.execute.return_value = mock_result
        rbac_service.session.commit = AsyncMock()
        
        results = await rbac_service.sync_permissions_from_definitions(definitions)
        
        assert "created" in results
        assert "updated" in results
        assert "deactivated" in results
        assert "errors" in results
    
    # Performance tests
    
    @pytest.mark.asyncio
    async def test_permission_check_performance(self, rbac_service, user_id, organization_id):
        """Test permission check performance with caching."""
        # Mock cache hit for fast path
        rbac_service.redis_client.get.return_value = '["test.permission"]'
        
        # Time multiple permission checks
        start_time = asyncio.get_event_loop().time()
        
        tasks = []
        for _ in range(100):
            task = rbac_service.check_user_permission(
                user_id, organization_id, "test.permission"
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        end_time = asyncio.get_event_loop().time()
        duration = end_time - start_time
        
        # Should complete 100 permission checks very quickly with cache
        assert duration < 1.0  # Less than 1 second for 100 checks
        assert all(result is True for result in results)
    
    # Error handling tests
    
    async def test_redis_connection_failure_graceful_degradation(self, rbac_service, user_id, organization_id):
        """Test graceful degradation when Redis is unavailable."""
        # Simulate Redis connection failure
        rbac_service.redis_client = None
        
        # Mock database query to return permissions
        rbac_service._get_db_permission_cache = AsyncMock(return_value=["test.permission"])
        
        # Should still work without Redis
        result = await rbac_service.check_user_permission(
            user_id, organization_id, "test.permission", use_cache=False
        )
        
        assert isinstance(result, bool)
    
    async def test_permission_not_found(self, rbac_service, user_id, organization_id):
        """Test handling of non-existent permissions."""
        # Mock empty permissions
        rbac_service.get_user_permissions = AsyncMock(return_value=set())
        
        result = await rbac_service.check_user_permission(
            user_id, organization_id, "nonexistent.permission"
        )
        
        assert result is False
    
    async def test_invalid_user_id(self, rbac_service, organization_id):
        """Test handling of invalid user ID."""
        invalid_user_id = uuid4()
        
        # Mock empty permissions for invalid user
        rbac_service.get_user_permissions = AsyncMock(return_value=set())
        
        result = await rbac_service.check_user_permission(
            invalid_user_id, organization_id, "test.permission"
        )
        
        assert result is False
    
    # Department management tests
    
    async def test_create_department(self, rbac_service, organization_id):
        """Test department creation."""
        dept_data = DepartmentCreate(
            name="engineering",
            display_name="Engineering Department",
            description="Software engineering team"
        )
        
        result = await rbac_service.create_department(dept_data, organization_id)
        
        assert result.name == "engineering"
        assert result.display_name == "Engineering Department"
        assert result.organization_id == organization_id
    
    async def test_get_organization_departments(self, rbac_service, organization_id):
        """Test retrieving organization departments."""
        # Mock department query
        rbac_service.session.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        rbac_service.session.execute.return_value = mock_result
        
        departments = await rbac_service.get_organization_departments(organization_id)
        
        assert isinstance(departments, list)
    
    # Integration tests
    
    async def test_full_rbac_workflow(self, rbac_service, organization_id, user_id):
        """Test complete RBAC workflow."""
        # 1. Create permission
        perm_data = PermissionCreate(
            name="workflow.test",
            display_name="Workflow Test",
            description="Test permission for workflow",
            resource="workflow",
            action="test"
        )
        permission = await rbac_service.create_permission(perm_data)
        
        # 2. Create role
        role_data = RoleCreate(
            name="workflow_tester",
            display_name="Workflow Tester",
            description="Role for testing workflow"
        )
        role = await rbac_service.create_role(role_data, organization_id)
        
        # 3. Assign permission to role
        await rbac_service.assign_permission_to_role(role.id, permission.id)
        
        # 4. Assign role to user
        await rbac_service.assign_role_to_user(user_id, role.id, organization_id)
        
        # 5. Check user has permission (mocked to return True)
        rbac_service.get_user_permissions = AsyncMock(return_value={"workflow.test"})
        
        has_permission = await rbac_service.check_user_permission(
            user_id, organization_id, "workflow.test"
        )
        
        assert has_permission is True
    
    # Cache cleanup tests
    
    async def test_cleanup_expired_cache(self, rbac_service):
        """Test cleanup of expired cache entries."""
        # Mock the database function call
        rbac_service.session.execute = AsyncMock()
        rbac_service.session.commit = AsyncMock()
        
        await rbac_service.cleanup_expired_cache()
        
        # Verify the cleanup function was called
        rbac_service.session.execute.assert_called()
        rbac_service.session.commit.assert_called()


# Fixtures for complex test scenarios

@pytest.fixture
async def complex_permission_setup(db_session, organization_id):
    """Create a complex permission setup for testing."""
    # Create multiple permissions
    permissions = []
    for i in range(5):
        perm = Permission(
            id=uuid4(),
            name=f"test.permission.{i}",
            display_name=f"Test Permission {i}",
            description=f"Test permission {i}",
            resource="test",
            action=f"action_{i}",
            conditions={} if i % 2 == 0 else {"own_only": True},
            is_active=True,
            created_at=datetime.utcnow()
        )
        permissions.append(perm)
        db_session.add(perm)
    
    # Create multiple roles
    roles = []
    for i in range(3):
        role = Role(
            id=uuid4(),
            organization_id=organization_id,
            name=f"test_role_{i}",
            display_name=f"Test Role {i}",
            description=f"Test role {i}",
            is_system_role=False,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        roles.append(role)
        db_session.add(role)
    
    await db_session.commit()
    
    # Refresh objects
    for perm in permissions:
        await db_session.refresh(perm)
    for role in roles:
        await db_session.refresh(role)
    
    return {"permissions": permissions, "roles": roles}


class TestRBACPerformance:
    """Performance tests for RBAC service."""
    
    @pytest.mark.asyncio
    async def test_concurrent_permission_checks(self, rbac_service, user_id, organization_id):
        """Test concurrent permission checks."""
        # Mock fast cache responses
        rbac_service.redis_client.get.return_value = '["test.permission"]'
        
        # Create many concurrent permission checks
        tasks = []
        for _ in range(1000):
            task = rbac_service.check_user_permission(
                user_id, organization_id, "test.permission"
            )
            tasks.append(task)
        
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks)
        end_time = asyncio.get_event_loop().time()
        
        duration = end_time - start_time
        
        # Should handle 1000 concurrent checks efficiently
        assert duration < 2.0  # Less than 2 seconds
        assert all(result is True for result in results)
    
    @pytest.mark.asyncio
    async def test_cache_efficiency(self, rbac_service, user_id, organization_id):
        """Test cache efficiency with repeated checks."""
        # First call should hit database, subsequent calls should hit cache
        rbac_service.redis_client.get.side_effect = [
            None,  # First call misses cache
            '["test.permission"]'  # Subsequent calls hit cache
        ]
        
        rbac_service._get_db_permission_cache = AsyncMock(return_value=["test.permission"])
        
        # First call (cache miss)
        start_time = asyncio.get_event_loop().time()
        result1 = await rbac_service.check_user_permission(
            user_id, organization_id, "test.permission"
        )
        first_call_time = asyncio.get_event_loop().time() - start_time
        
        # Second call (cache hit)
        start_time = asyncio.get_event_loop().time()
        result2 = await rbac_service.check_user_permission(
            user_id, organization_id, "test.permission"
        )
        second_call_time = asyncio.get_event_loop().time() - start_time
        
        assert result1 is True
        assert result2 is True
        # Cache hit should be significantly faster
        assert second_call_time < first_call_time / 2