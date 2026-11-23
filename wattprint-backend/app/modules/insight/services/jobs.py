import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.modules.billing.api import MODEL_VERSION, forecast_bill, refresh_bills
from app.modules.copilot.api import measure_plans, prune_scope_tokens, prune_speech
from app.modules.energy.api import WeatherHourly
from app.modules.home.api import Home, Province

from ..models import ForecastSnapshot
from .cohort import refresh_cohorts
from .detectors import detect
from .mail import mail_alerts, mail_weekly

log = logging.getLogger("insight.jobs")
# Hourly weather of the last days, no key needed; 92 is the most past days it serves.
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_DAYS = 92


async def each_home(work: Callable[[AsyncSession, uuid.UUID], Awaitable[None]]) -> None:
    """Run `work` per home in its own transaction: one home failing does not stop the others."""
    async with SessionLocal() as s:
        homes = list(await s.scalars(select(Home.id).order_by(Home.id)))
    for home_id in homes:
        try:
            async with SessionLocal() as s, s.begin():
                await work(s, home_id)
        except Exception:
            log.exception("home %s failed", home_id)


async def bills(now: datetime) -> None:
    await each_home(lambda s, h: refresh_bills(s, h, now))


async def _snapshot(session: AsyncSession, home_id: uuid.UUID, now: datetime) -> None:
    try:
        f = await forecast_bill(session, home_id, now)
    except LookupError:  # no tariff plan: nothing to price
        return
    if f is None:
        return
    await session.execute(
        insert(ForecastSnapshot)
        .values(
            home_id=home_id,
            generated_at=now,
            horizon_date=f.period_end,
            kwh=f.kwh,
            amount=f.amount,
            tier_cross_date=f.next.on if f.next else None,
            model_version=MODEL_VERSION,
        )
        .on_conflict_do_nothing()
    )


async def forecasts(now: datetime) -> None:
    """One forecast of the running cycle per home per run (daily), kept to track its accuracy."""
    await each_home(lambda s, h: _snapshot(s, h, now))


async def cohorts(now: datetime) -> None:
    async with SessionLocal() as s, s.begin():
        await refresh_cohorts(s, now)


async def alerts(now: datetime) -> None:
    await each_home(lambda s, h: detect(s, h, now))


async def mail(now: datetime) -> None:
    await mail_alerts(now)
    await mail_weekly(now)


async def upkeep(now: datetime) -> None:
    """Expired copilot scope tokens out; plans tried for 14 days measured."""
    async with SessionLocal() as s, s.begin():
        await prune_scope_tokens(s)
        await prune_speech(s)
        await measure_plans(s, now)


async def weather(now: datetime) -> None:
    """Hourly temperature and humidity of the last 92 days at every province that has a home, kept
    so that a change in the bill can be set against the weather (Open-Meteo, no key)."""
    async with SessionLocal() as s:
        used = select(Home.province_code).where(Home.province_code.is_not(None))
        provinces = list(await s.scalars(select(Province).where(Province.code.in_(used))))
    async with httpx.AsyncClient(timeout=30) as client:
        for p in provinces:
            try:
                r = await client.get(
                    WEATHER_URL,
                    params={
                        "latitude": float(p.lat),
                        "longitude": float(p.lon),
                        "hourly": "temperature_2m,relative_humidity_2m",
                        "past_days": WEATHER_DAYS,
                        "forecast_days": 1,
                        "timezone": "UTC",
                    },
                )
                r.raise_for_status()
                hourly = r.json()["hourly"]
            except httpx.HTTPError, KeyError, ValueError:
                log.exception("weather of province %s failed", p.code)
                continue
            rows = [
                {"province_code": p.code, "ts": ts, "temp_c": temp, "humidity_pct": humidity}
                for ts, temp, humidity in zip(
                    (datetime.fromisoformat(t).replace(tzinfo=UTC) for t in hourly["time"]),
                    hourly["temperature_2m"],
                    hourly["relative_humidity_2m"],
                    strict=True,
                )
                if temp is not None and ts <= now  # measured hours only, not the forecast
            ]
            if not rows:
                continue
            stmt = insert(WeatherHourly).values(rows)
            async with SessionLocal() as s, s.begin():
                await s.execute(
                    stmt.on_conflict_do_update(
                        index_elements=["province_code", "ts"],
                        set_={
                            "temp_c": stmt.excluded.temp_c,
                            "humidity_pct": stmt.excluded.humidity_pct,
                        },
                    )
                )
