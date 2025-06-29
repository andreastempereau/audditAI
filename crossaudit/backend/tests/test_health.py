"""Test health and basic endpoints."""

import pytest
from httpx import AsyncClient


class TestHealth:
    """Test health and basic functionality."""
    
    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """Test root endpoint."""
        response = await client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "CrossAudit AI API" in data["message"]
    
    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Test health check endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_openapi_spec(self, client: AsyncClient):
        """Test OpenAPI spec is generated."""
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        
        spec = response.json()
        assert "openapi" in spec
        assert "info" in spec
        assert spec["info"]["title"] == "CrossAudit AI API"
    
    @pytest.mark.asyncio
    async def test_docs_endpoint(self, client: AsyncClient):
        """Test docs endpoint is accessible."""
        response = await client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]