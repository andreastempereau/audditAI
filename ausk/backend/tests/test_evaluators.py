"""Tests for evaluator management functionality."""

import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.evaluators import EvaluatorService


class TestEvaluatorService:
    """Test cases for EvaluatorService."""
    
    @pytest_asyncio.fixture
    async def evaluator_service(self, session: AsyncSession):
        """Create evaluator service instance."""
        return EvaluatorService(session)
    
    @pytest_asyncio.fixture
    async def test_organization_id(self):
        """Create test organization ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def test_user_id(self):
        """Create test user ID."""
        return uuid4()
    
    @pytest_asyncio.fixture
    async def sample_evaluator_config(self):
        """Sample evaluator configuration."""
        return {
            "provider": "openai",
            "model": "gpt-4",
            "temperature": 0.1,
            "max_tokens": 1024,
            "system_prompt": "You are a content safety evaluator.",
            "evaluation_criteria": {
                "safety": {"weight": 0.8, "threshold": 0.9},
                "quality": {"weight": 0.2, "threshold": 0.7}
            }
        }
    
    @pytest_asyncio.fixture
    async def sample_evaluator_code(self):
        """Sample evaluator Python code."""
        return """
def evaluate(prompt, response, context=None):
    \"\"\"Evaluate the safety and quality of a response.\"\"\"
    
    # Simple safety check
    unsafe_terms = ['violence', 'hate', 'harm']
    safety_score = 1.0
    
    for term in unsafe_terms:
        if term.lower() in response.lower():
            safety_score -= 0.3
    
    # Simple quality check based on length and coherence
    quality_score = min(1.0, len(response.split()) / 50)
    
    return {
        "safety_score": max(0.0, safety_score),
        "quality_score": quality_score,
        "overall_score": (safety_score * 0.8) + (quality_score * 0.2),
        "passed": safety_score >= 0.7 and quality_score >= 0.5,
        "details": {
            "safety_issues": [term for term in unsafe_terms if term.lower() in response.lower()],
            "word_count": len(response.split())
        }
    }
"""
    
    async def test_create_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test creating a new evaluator."""
        evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Test Safety Evaluator",
            description="A test evaluator for safety checks",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        assert evaluator is not None
        assert evaluator.name == "Test Safety Evaluator"
        assert evaluator.description == "A test evaluator for safety checks"
        assert evaluator.evaluator_type == "custom"
        assert evaluator.organization_id == test_organization_id
        assert evaluator.created_by == test_user_id
        assert evaluator.is_active is True
        assert evaluator.config == sample_evaluator_config
        assert evaluator.code == sample_evaluator_code
    
    async def test_get_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test getting an evaluator by ID."""
        # Create evaluator first
        created_evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Test Evaluator",
            description="Test description",
            evaluator_type="llm",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # Get evaluator
        retrieved_evaluator = await evaluator_service.get_evaluator(
            evaluator_id=created_evaluator.id,
            organization_id=test_organization_id
        )
        
        assert retrieved_evaluator is not None
        assert retrieved_evaluator.id == created_evaluator.id
        assert retrieved_evaluator.name == "Test Evaluator"
        assert retrieved_evaluator.evaluator_type == "llm"
    
    async def test_list_evaluators(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test listing evaluators."""
        # Create multiple evaluators
        await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Evaluator 1",
            description="First evaluator",
            evaluator_type="llm",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Evaluator 2",
            description="Second evaluator",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # List evaluators
        evaluators = await evaluator_service.list_evaluators(
            organization_id=test_organization_id,
            skip=0,
            limit=10
        )
        
        assert len(evaluators) == 2
        assert evaluators[0].name in ["Evaluator 1", "Evaluator 2"]
        assert evaluators[1].name in ["Evaluator 1", "Evaluator 2"]
    
    async def test_list_evaluators_by_type(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test listing evaluators filtered by type."""
        # Create evaluators of different types
        await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="LLM Evaluator",
            description="LLM-based evaluator",
            evaluator_type="llm",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Custom Evaluator",
            description="Custom evaluator",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # List only LLM evaluators
        llm_evaluators = await evaluator_service.list_evaluators(
            organization_id=test_organization_id,
            evaluator_type="llm",
            skip=0,
            limit=10
        )
        
        assert len(llm_evaluators) == 1
        assert llm_evaluators[0].evaluator_type == "llm"
        assert llm_evaluators[0].name == "LLM Evaluator"
    
    async def test_update_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test updating an evaluator."""
        # Create evaluator
        evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Original Name",
            description="Original description",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # Update evaluator
        updated_config = sample_evaluator_config.copy()
        updated_config["temperature"] = 0.5
        
        updated_evaluator = await evaluator_service.update_evaluator(
            evaluator_id=evaluator.id,
            organization_id=test_organization_id,
            name="Updated Name",
            description="Updated description",
            config=updated_config
        )
        
        assert updated_evaluator is not None
        assert updated_evaluator.name == "Updated Name"
        assert updated_evaluator.description == "Updated description"
        assert updated_evaluator.config["temperature"] == 0.5
    
    async def test_delete_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test deleting an evaluator."""
        # Create evaluator
        evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="To Delete",
            description="Evaluator to be deleted",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # Delete evaluator
        success = await evaluator_service.delete_evaluator(
            evaluator_id=evaluator.id,
            organization_id=test_organization_id
        )
        
        assert success is True
        
        # Verify evaluator is deleted
        deleted_evaluator = await evaluator_service.get_evaluator(
            evaluator_id=evaluator.id,
            organization_id=test_organization_id
        )
        assert deleted_evaluator is None
    
    async def test_test_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test evaluator testing functionality."""
        # Create evaluator
        evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Test Evaluator",
            description="Evaluator for testing",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # Test evaluator
        result = await evaluator_service.test_evaluator(
            evaluator_id=evaluator.id,
            organization_id=test_organization_id,
            test_prompt="Hello world",
            test_response="Hi there, how can I help you?",
            test_context={"user_id": str(test_user_id)}
        )
        
        assert "status" in result
        assert "evaluation_result" in result
        assert "evaluated_at" in result
    
    async def test_get_available_types(self, evaluator_service: EvaluatorService):
        """Test getting available evaluator types."""
        types = await evaluator_service.get_available_types()
        
        assert isinstance(types, list)
        assert len(types) > 0
        # Should include common evaluator types
        type_names = [t["name"] for t in types]
        assert "llm" in type_names
        assert "custom" in type_names
    
    async def test_deploy_evaluator(
        self,
        evaluator_service: EvaluatorService,
        test_organization_id,
        test_user_id,
        sample_evaluator_config,
        sample_evaluator_code
    ):
        """Test deploying an evaluator."""
        # Create evaluator
        evaluator = await evaluator_service.create_evaluator(
            organization_id=test_organization_id,
            name="Deploy Test Evaluator",
            description="Evaluator for deployment testing",
            evaluator_type="custom",
            config=sample_evaluator_config,
            code=sample_evaluator_code,
            created_by=test_user_id
        )
        
        # Deploy evaluator
        deployment_config = {
            "environment": "staging",
            "replicas": 2,
            "resources": {
                "cpu": "500m",
                "memory": "512Mi"
            }
        }
        
        result = await evaluator_service.deploy_evaluator(
            evaluator_id=evaluator.id,
            organization_id=test_organization_id,
            deployment_config=deployment_config,
            deployed_by=test_user_id
        )
        
        assert "status" in result
        assert "deployment_id" in result
        assert "deployed_at" in result


class TestEvaluatorAPI:
    """Test cases for Evaluator API endpoints."""
    
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
    
    async def test_create_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/evaluators endpoint."""
        evaluator_data = {
            "name": "API Test Evaluator",
            "description": "Evaluator created via API",
            "evaluator_type": "llm",
            "config": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.1,
                "max_tokens": 1024
            },
            "code": "def evaluate(prompt, response): return {'score': 0.8, 'passed': True}"
        }
        
        response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["data"]["name"] == "API Test Evaluator"
        assert data["message"] == "Evaluator created successfully"
    
    async def test_list_evaluators_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/evaluators endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "List Test Evaluator",
            "description": "Evaluator for list test",
            "evaluator_type": "custom",
            "config": {"test": "config"},
            "code": "def evaluate(prompt, response): return {'score': 0.8}"
        }
        
        await client.post("/api/evaluators", json=evaluator_data, headers=auth_headers)
        
        # List evaluators
        response = await client.get("/api/evaluators", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "evaluators" in data["data"]
        assert len(data["data"]["evaluators"]) >= 1
    
    async def test_get_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/evaluators/{evaluator_id} endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "Get Test Evaluator",
            "description": "Evaluator for get test",
            "evaluator_type": "llm",
            "config": {"provider": "openai"},
            "code": "def evaluate(prompt, response): return {'score': 0.9}"
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        evaluator_id = create_response.json()["data"]["id"]
        
        # Get evaluator
        response = await client.get(f"/api/evaluators/{evaluator_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Get Test Evaluator"
        assert data["data"]["config"] is not None
        assert data["data"]["code"] is not None
    
    async def test_update_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test PUT /api/evaluators/{evaluator_id} endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "Update Test Evaluator",
            "description": "Evaluator for update test",
            "evaluator_type": "custom",
            "config": {"temperature": 0.1},
            "code": "def evaluate(prompt, response): return {'score': 0.7}"
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        evaluator_id = create_response.json()["data"]["id"]
        
        # Update evaluator
        update_data = {
            "name": "Updated Evaluator Name",
            "description": "Updated description",
            "config": {"temperature": 0.5}
        }
        
        response = await client.put(
            f"/api/evaluators/{evaluator_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Updated Evaluator Name"
        assert data["message"] == "Evaluator updated successfully"
    
    async def test_delete_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test DELETE /api/evaluators/{evaluator_id} endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "Delete Test Evaluator",
            "description": "Evaluator for delete test",
            "evaluator_type": "custom",
            "config": {},
            "code": "def evaluate(prompt, response): return {'score': 0.8}"
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        evaluator_id = create_response.json()["data"]["id"]
        
        # Delete evaluator
        response = await client.delete(f"/api/evaluators/{evaluator_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["deleted"] is True
        assert data["message"] == "Evaluator deleted successfully"
    
    async def test_test_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/evaluators/{evaluator_id}/test endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "Test Evaluator",
            "description": "Evaluator for testing",
            "evaluator_type": "custom",
            "config": {},
            "code": "def evaluate(prompt, response): return {'score': 0.8, 'passed': True}"
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        evaluator_id = create_response.json()["data"]["id"]
        
        # Test evaluator
        test_data = {
            "prompt": "Test prompt",
            "response": "Test response",
            "context": {"test": "context"}
        }
        
        response = await client.post(
            f"/api/evaluators/{evaluator_id}/test",
            json=test_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "evaluator_id" in data["data"]
        assert "test_result" in data["data"]
        assert data["message"] == "Evaluator test completed"
    
    async def test_deploy_evaluator_endpoint(self, client: AsyncClient, auth_headers):
        """Test POST /api/evaluators/{evaluator_id}/deploy endpoint."""
        # Create an evaluator first
        evaluator_data = {
            "name": "Deploy Test Evaluator",
            "description": "Evaluator for deployment test",
            "evaluator_type": "custom",
            "config": {},
            "code": "def evaluate(prompt, response): return {'score': 0.8}"
        }
        
        create_response = await client.post(
            "/api/evaluators",
            json=evaluator_data,
            headers=auth_headers
        )
        evaluator_id = create_response.json()["data"]["id"]
        
        # Deploy evaluator
        deployment_data = {
            "config": {
                "environment": "staging",
                "replicas": 1
            }
        }
        
        response = await client.post(
            f"/api/evaluators/{evaluator_id}/deploy",
            json=deployment_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "evaluator_id" in data["data"]
        assert "deployment_status" in data["data"]
        assert data["message"] == "Evaluator deployed successfully"
    
    async def test_get_available_types_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/evaluators/types/available endpoint."""
        response = await client.get("/api/evaluators/types/available", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "evaluator_types" in data["data"]
        assert len(data["data"]["evaluator_types"]) > 0
    
    async def test_list_plugins_endpoint(self, client: AsyncClient, auth_headers):
        """Test GET /api/evaluators/plugins endpoint."""
        response = await client.get("/api/evaluators/plugins", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "plugins" in data["data"]
        assert "total" in data["data"]