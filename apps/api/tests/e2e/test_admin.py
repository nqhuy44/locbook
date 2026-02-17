import pytest
from httpx import AsyncClient
from src.core.config import get_settings

# Mock Admin Secret for testing
ADMIN_SECRET = "test-admin-secret"

@pytest.fixture(autouse=True)
def override_admin_secret(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)

@pytest.mark.asyncio
async def test_admin_auth_protection(async_client: AsyncClient):
    # 1. No Token -> 403
    response = await async_client.get("/api/admin/users")
    assert response.status_code == 403
    
    # 2. Wrong Token -> 403
    response = await async_client.get("/api/admin/users", headers={"x-admin-token": "wrong-token"})
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_admin_users_flow(async_client: AsyncClient, test_user):
    headers = {"x-admin-token": ADMIN_SECRET}
    
    # 1. List Users
    response = await async_client.get("/api/admin/users", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    
    # Find our test user
    user_in_list = next((u for u in data["data"] if u["email"] == test_user.email), None)
    assert user_in_list is not None
    assert user_in_list["is_active"] is True
    
    # 2. Ban User
    response = await async_client.put(
        f"/api/admin/users/{test_user.id}/status", 
        params={"is_active": False},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    
    # 3. Verify Ban Effect (Login should fail? - dependent on auth implementation)
    # Ideally check DB state or login endpoint
    
    # 4. Unban User
    response = await async_client.put(
        f"/api/admin/users/{test_user.id}/status", 
        params={"is_active": True},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is True
