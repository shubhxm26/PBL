import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

# Ensure backend/app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app


@pytest.mark.asyncio
async def test_health_check_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "services" in data
        assert "database" in data["services"]
        assert data["services"]["database"]["status"] in ["connected", "fallback_in_memory"]
        assert "redis" in data["services"]
        assert data["services"]["redis"]["status"] in ["connected", "fallback_in_memory"]
        assert "version" in data
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_persona_header_injection_director():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/persona/profile",
            headers={"X-Persona-Role": "director"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "director"
        assert data["title"] == "Supply Chain Director"
        assert "forecasting" in data["permissions"]["views"]
        assert "twin" in data["permissions"]["views"]


@pytest.mark.asyncio
async def test_persona_header_injection_dispatcher():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/persona/profile",
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "dispatcher"
        assert data["title"] == "Fleet Dispatcher"
        assert "routing" in data["permissions"]["views"]


@pytest.mark.asyncio
async def test_persona_header_injection_customs():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/persona/profile",
            headers={"X-Persona-Role": "customs"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "customs"
        assert data["title"] == "Customs Officer"
        assert "compliance" in data["permissions"]["views"]


@pytest.mark.asyncio
async def test_persona_header_injection_admin():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/persona/profile",
            headers={"X-Persona-Role": "admin"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert data["title"] == "Enterprise IT Administrator"
        assert "system" in data["permissions"]["views"]


@pytest.mark.asyncio
async def test_rbac_permission_enforcement_forbidden():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Director attempting admin-only endpoint
        response = await client.get(
            "/api/v1/admin/system-status",
            headers={"X-Persona-Role": "director"}
        )
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data


@pytest.mark.asyncio
async def test_rbac_permission_enforcement_allowed():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Admin accessing admin-only endpoint
        response = await client.get(
            "/api/v1/admin/system-status",
            headers={"X-Persona-Role": "admin"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "services" in data


@pytest.mark.asyncio
async def test_persona_roles_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/persona/roles")
        assert response.status_code == 200
        data = response.json()
        assert "roles" in data
        assert "director" in data["roles"]
        assert "dispatcher" in data["roles"]
        assert "customs" in data["roles"]
        assert "admin" in data["roles"]

