"""Tests for policy management functionality."""

import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import Policy
from app.services.policies import PolicyService


class TestPolicyService:
    """Test cases for PolicyService."""
    
    @pytest_asyncio.fixture
    async def policy_service(self, session: AsyncSession):
        """Create policy service instance."""
        return PolicyService(session)
    
    @pytest_asyncio.fixture
    async def test_organization_id(self):
        """Create test organization ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def test_user_id(self):
        """Create test user ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def sample_policy_yaml(self):
        """Sample policy YAML configuration."""
        return """
name: "Content Safety Policy"
description: "Prevents generation of harmful content"
version: "1.0"
rules:
  - name: "no_violence"
    description: "Prevent violent content"
    evaluator: "violence_detector"
    threshold: 0.8
    action: "block"
  - name: "no_profanity"
    description: "Prevent profanity"
    evaluator: "profanity_filter"
    threshold: 0.9
    action: "warn"
"""
    
    async def test_create_policy(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test creating a new policy."""
        policy = await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Test Safety Policy",
            description="A test policy for safety",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        assert policy is not None
        assert policy.name == "Test Safety Policy"
        assert policy.description == "A test policy for safety"
        assert policy.organization_id == test_organization_id
        assert policy.created_by == test_user_id
        assert policy.is_active is True
        assert policy.policy_yaml == sample_policy_yaml
    
    async def test_get_policy(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test getting a policy by ID."""
        # Create policy first
        created_policy = await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Test Policy",
            description="Test description",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        # Get policy
        retrieved_policy = await policy_service.get_policy(
            policy_id=created_policy.id,
            organization_id=test_organization_id
        )
        
        assert retrieved_policy is not None
        assert retrieved_policy.id == created_policy.id
        assert retrieved_policy.name == "Test Policy"
    
    async def test_list_policies(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test listing policies."""
        # Create multiple policies
        await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Policy 1",
            description="First policy",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Policy 2", 
            description="Second policy",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        # List policies
        policies = await policy_service.list_policies(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert len(policies) == 2
        assert policies[0].name in ["Policy 1", "Policy 2"]
        assert policies[1].name in ["Policy 1", "Policy 2"]
    
    async def test_update_policy(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test updating a policy."""
        # Create policy
        policy = await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Original Name",
            description="Original description",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        # Update policy
        updated_policy = await policy_service.update_policy(
            policy_id=policy.id,
            organization_id=test_organization_id,
            name="Updated Name",
            description="Updated description"
        )
        
        assert updated_policy is not None
        assert updated_policy.name == "Updated Name"
        assert updated_policy.description == "Updated description"
    
    async def test_delete_policy(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test deleting a policy."""
        # Create policy
        policy = await policy_service.create_policy(
            organization_id=test_organization_id,
            name="To Delete",
            description="Policy to be deleted",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        # Delete policy
        success = await policy_service.delete_policy(
            policy_id=policy.id,
            organization_id=test_organization_id
        )
        
        assert success is True
        
        # Verify policy is deleted
        deleted_policy = await policy_service.get_policy(
            policy_id=policy.id,
            organization_id=test_organization_id
        )
        assert deleted_policy is None
    
    async def test_validate_policy_yaml(self, policy_service: PolicyService):
        """Test policy YAML validation."""
        valid_yaml = """
name: "Test Policy"
description: "Test description"
version: "1.0"
rules:
  - name: "test_rule"
    evaluator: "test_evaluator"
    threshold: 0.8
    action: "block"
"""
        
        result = await policy_service.validate_policy_yaml(valid_yaml)
        
        assert result["valid"] is True
        assert "errors" in result
        assert "parsed_config" in result
    
    async def test_validate_invalid_policy_yaml(self, policy_service: PolicyService):
        """Test validation of invalid policy YAML."""
        invalid_yaml = """
name: "Test Policy"
# Missing required fields
rules:
  - invalid_rule
"""
        
        result = await policy_service.validate_policy_yaml(invalid_yaml)
        
        assert result["valid"] is False
        assert len(result["errors"]) > 0
    
    async def test_test_policy(
        self,
        policy_service: PolicyService,
        test_organization_id,
        test_user_id,
        sample_policy_yaml
    ):
        """Test policy testing functionality."""
        # Create policy
        policy = await policy_service.create_policy(
            organization_id=test_organization_id,
            name="Test Policy",
            description="Policy for testing",
            policy_yaml=sample_policy_yaml,
            created_by=test_user_id
        )
        
        # Test policy
        result = await policy_service.test_policy(
            policy_id=policy.id,
            organization_id=test_organization_id,
            test_prompt="Hello world",
            test_response="Hi there!"
        )
        
        assert "status" in result
        assert "evaluations" in result
        assert "evaluated_at" in result


class TestPolicyAPI:
    """Test cases for Policy API endpoints."""
    
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
    
    async def test_create_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/policies endpoint."""
        policy_data = {
            "name": "API Test Policy",
            "description": "Policy created via API",
            "policy_yaml": """
name: "API Test Policy"
description: "Test policy"
version: "1.0"
rules:
  - name: "test_rule"
    evaluator: "test_evaluator"
    threshold: 0.8
    action: "block"
"""
        }
        
        response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["data"]["name"] == "API Test Policy"
        assert data["message"] == "Policy created successfully"
    
    async def test_list_policies_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/policies endpoint."""
        # Create a policy first
        policy_data = {
            "name": "List Test Policy",
            "description": "Policy for list test",
            "policy_yaml": """
name: "List Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        await client.post("/api/policies", json=policy_data, headers=auth_headers)
        
        # List policies
        response = await client.get("/api/policies", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "policies" in data["data"]
        assert len(data["data"]["policies"]) >= 1
    
    async def test_get_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/policies/{policy_id} endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Get Test Policy",
            "description": "Policy for get test",
            "policy_yaml": """
name: "Get Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Get policy
        response = await client.get(f"/api/policies/{policy_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Get Test Policy"
        assert data["data"]["policy_yaml"] is not None
    
    async def test_update_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test PUT /api/policies/{policy_id} endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Update Test Policy",
            "description": "Policy for update test",
            "policy_yaml": """
name: "Update Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Update policy
        update_data = {
            "name": "Updated Policy Name",
            "description": "Updated description"
        }
        
        response = await client.put(
            f"/api/policies/{policy_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Updated Policy Name"
        assert data["message"] == "Policy updated successfully"
    
    async def test_delete_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test DELETE /api/policies/{policy_id} endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Delete Test Policy",
            "description": "Policy for delete test",
            "policy_yaml": """
name: "Delete Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Delete policy
        response = await client.delete(f"/api/policies/{policy_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["deleted"] is True
        assert data["message"] == "Policy deleted successfully"
    
    async def test_validate_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/policies/validate endpoint."""
        validation_data = {
            "policy_yaml": """
name: "Validation Test"
description: "Test policy validation"
version: "1.0"
rules:
  - name: "test_rule"
    evaluator: "test_evaluator"
    threshold: 0.8
    action: "block"
"""
        }
        
        response = await client.post(
            "/api/policies/validate",
            json=validation_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["valid"] is True
        assert data["message"] == "Policy validation completed"
    
    async def test_test_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/policies/{policy_id}/test endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Test Policy",
            "description": "Policy for testing",
            "policy_yaml": """
name: "Test Policy"
description: "Test policy"
version: "1.0"
rules:
  - name: "test_rule"
    evaluator: "test_evaluator"
    threshold: 0.8
    action: "block"
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Test policy
        test_data = {
            "prompt": "Test prompt",
            "response": "Test response"
        }
        
        response = await client.post(
            f"/api/policies/{policy_id}/test",
            json=test_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "policy_id" in data["data"]
        assert "test_result" in data["data"]
        assert data["message"] == "Policy test completed"
    
    async def test_activate_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/policies/{policy_id}/activate endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Activate Test Policy",
            "description": "Policy for activation test",
            "policy_yaml": """
name: "Activate Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Activate policy
        response = await client.post(f"/api/policies/{policy_id}/activate", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["is_active"] is True
        assert data["message"] == "Policy activated successfully"
    
    async def test_deactivate_policy_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/policies/{policy_id}/deactivate endpoint."""
        # Create a policy first
        policy_data = {
            "name": "Deactivate Test Policy",
            "description": "Policy for deactivation test",
            "policy_yaml": """
name: "Deactivate Test Policy"
description: "Test policy"
version: "1.0"
rules: []
"""
        }
        
        create_response = await client.post(
            "/api/policies",
            json=policy_data,
            headers=auth_headers
        )
        policy_id = create_response.json()["data"]["id"]
        
        # Deactivate policy
        response = await client.post(f"/api/policies/{policy_id}/deactivate", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["is_active"] is False
        assert data["message"] == "Policy deactivated successfully"