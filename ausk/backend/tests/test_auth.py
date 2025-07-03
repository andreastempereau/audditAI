"""Test authentication endpoints."""

import pytest
from httpx import AsyncClient


class TestAuth:
    """Test authentication functionality."""
    
    @pytest.mark.asyncio
    async def test_register_user(self, client: AsyncClient, test_user_data):
        """Test user registration."""
        response = await client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "user" in data["data"]
        assert data["data"]["user"]["email"] == test_user_data["email"]
    
    @pytest.mark.asyncio
    async def test_register_duplicate_user(self, client: AsyncClient, test_user_data):
        """Test duplicate user registration fails."""
        # Register first user
        await client.post("/api/auth/register", json=test_user_data)
        
        # Try to register same user again
        response = await client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_login_user(self, client: AsyncClient, test_user_data):
        """Test user login."""
        # Register user first
        await client.post("/api/auth/register", json=test_user_data)
        
        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "user" in data["data"]
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, test_user_data):
        """Test getting current user info."""
        # Register and login
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get current user
        response = await client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == test_user_data["email"]
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without token fails."""
        response = await client.get("/api/auth/me")
        assert response.status_code == 401