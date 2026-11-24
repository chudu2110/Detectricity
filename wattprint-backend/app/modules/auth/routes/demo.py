from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.dependencies import DbSession

from ..schemas import Me, UserRead
from ..services import decode_access_token, provision_user, realm_roles

router = APIRouter(prefix="/auth", tags=["users"])


class DemoSession(BaseModel):
    access_token: str = Field(alias="accessToken")
    user: Me


async def demo_token() -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            settings.jwks_url.rsplit("/protocol/openid-connect/certs", 1)[0]
            + "/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": settings.local_demo_client_id,
                "username": settings.local_demo_email,
                "password": settings.demo_password,
            },
        )
    response.raise_for_status()
    return response.json()["access_token"]


@router.post("/demo", response_model=DemoSession)
async def local_demo_login(request: Request, db: DbSession) -> DemoSession:
    # A public/production deployment has no demo login. adb reverse reaches this host via loopback.
    if not settings.local_demo_enabled:
        raise HTTPException(404, "Not found")
    allowed = {"127.0.0.1", "::1"}
    if settings.local_demo_proxy_ip:
        allowed.add(settings.local_demo_proxy_ip)
    if request.client is None or request.client.host not in allowed:
        raise HTTPException(403, "Local demo is available on loopback only")
    if not settings.demo_password:
        raise HTTPException(503, "Local demo is not configured")
    try:
        token = await demo_token()
        claims: dict[str, Any] = await run_in_threadpool(decode_access_token, token)
    except Exception:
        # Do not expose provider responses, credentials or tokens in errors.
        raise HTTPException(503, "Local demo sign-in is unavailable") from None
    roles = realm_roles(claims)
    if (
        claims.get("azp") != settings.local_demo_client_id
        or claims.get("email") != settings.local_demo_email
        or "admin" in roles
    ):
        raise HTTPException(403, "Invalid demo identity")
    user = await provision_user(db, claims)
    if not user.is_active:
        raise HTTPException(403, "Demo account is disabled")
    return DemoSession(
        accessToken=token, user=Me(**UserRead.model_validate(user).model_dump(), roles=roles)
    )
