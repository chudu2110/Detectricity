import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.modules.auth.routes import demo


async def test_demo_is_absent_by_default(client, monkeypatch):
    monkeypatch.setattr(settings, "local_demo_enabled", False)
    assert (await client.post("/api/v1/auth/demo")).status_code == 404


async def test_disabling_demo_rejects_existing_demo_tokens(client, monkeypatch, make_token):
    monkeypatch.setattr(settings, "local_demo_enabled", False)
    token = make_token(azp=settings.local_demo_client_id)
    response = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


async def test_demo_rejects_non_loopback_and_missing_credentials(monkeypatch):
    monkeypatch.setattr(settings, "local_demo_enabled", True)
    async with AsyncClient(
        transport=ASGITransport(app=app, client=("192.168.1.2", 1234)), base_url="http://test"
    ) as remote:
        assert (await remote.post("/api/v1/auth/demo")).status_code == 403
    monkeypatch.setattr(settings, "demo_password", "")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as local:
        assert (await local.post("/api/v1/auth/demo")).status_code == 503


@pytest.mark.parametrize("admin", [False, True])
async def test_demo_uses_verified_non_admin_identity(client, monkeypatch, make_token, admin):
    email = f"demo-{uuid.uuid4().hex}@example.com"
    monkeypatch.setattr(settings, "local_demo_enabled", True)
    monkeypatch.setattr(settings, "local_demo_email", email)
    monkeypatch.setattr(settings, "demo_password", "configured")
    token = make_token(
        email=email,
        azp=settings.local_demo_client_id,
        roles=["admin"] if admin else ["user"],
    )
    monkeypatch.setattr(demo, "demo_token", AsyncMock(return_value=token))
    response = await client.post("/api/v1/auth/demo")
    assert response.status_code == (403 if admin else 200)
    if not admin:
        assert response.json()["accessToken"] == token
        assert response.json()["user"]["email"] == email
        me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200


async def test_demo_does_not_leak_provider_errors(client, monkeypatch):
    monkeypatch.setattr(settings, "local_demo_enabled", True)
    monkeypatch.setattr(settings, "demo_password", "configured")
    monkeypatch.setattr(demo, "demo_token", AsyncMock(side_effect=ValueError("private token")))
    response = await client.post("/api/v1/auth/demo")
    assert response.status_code == 503
    assert "private token" not in response.text
