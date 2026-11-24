import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import httpx
from sqlalchemy import text

from app.database import SessionLocal
from app.modules.billing.api import window_amount
from app.modules.copilot.services import tools

NOW = datetime(2026, 11, 15, 5, 0, tzinfo=UTC)  # 12:00 in Vietnam, mid-cycle
FRIDGE, HEATER = uuid.uuid4(), uuid.uuid4()


def per_day(lo: date, hi: date, kwh) -> dict[date, float]:
    return {lo + timedelta(days=i): kwh(lo + timedelta(days=i)) for i in range((hi - lo).days)}


def fake_meter(monkeypatch, kwh_on, devices_on=lambda since: {}):
    """Daily main-meter kWh from kwh_on(day); per-device kWh from devices_on(window start)."""

    async def daily(ctx, lo, hi):
        return {d: v for d, v in per_day(lo, hi, kwh_on).items() if v is not None}

    async def breakdown(session, home_id, since, until):
        return [SimpleNamespace(device_id=d, kwh=k) for d, k in devices_on(since).items()]

    monkeypatch.setattr(tools, "_daily_kwh", daily)
    monkeypatch.setattr(tools, "device_breakdown", breakdown)


async def explain(home_id, period, now=NOW):
    async with SessionLocal() as s:
        outcome, ok, _ = await tools.run_tool(
            tools.Ctx(s, home_id, now, "vi"), "explain_bill_change", {"period": period}
        )
    assert ok, outcome.data
    return outcome.data


def adds_up(d) -> bool:
    return d["calendar_vnd"] + d["tariff_vnd"] + d["usage_vnd"] == d["change_vnd"]


async def test_a_longer_cycle_and_a_new_device_explain_the_change(make_member, monkeypatch):
    me = await make_member("owner", tariff_plan_code="vn_residential", billing_cycle_day=1)
    october = datetime(2026, 9, 30, 17, tzinfo=UTC)  # local midnight of Oct 1
    fake_meter(
        monkeypatch,
        lambda d: 12.0 if d.month == 10 else 10.0,
        lambda since: {FRIDGE: 30.0, HEATER: 62.0} if since == october else {FRIDGE: 30.0},
    )
    d = await explain(me.home_id, "last_cycle")
    assert (d["current"]["days"], d["previous"]["days"]) == (31, 30)  # October against September
    assert d["current"]["kwh"] == 372.0 and d["previous"]["kwh"] == 300.0
    assert adds_up(d)
    assert d["calendar_vnd"] > 0  # one more day at September's use
    assert d["usage_kwh"] == 62.0  # 372 - 300 / 30 * 31
    heater = d["devices"][0]
    assert (heater["kwh_change"], heater["new"]) == (62.0, True)
    fridge = next(r for r in d["devices"] if r["kwh_change"] != 62.0)
    assert fridge["new"] is False and fridge["kwh_change"] == -1.0  # 30 kWh in 31 days, not 30
    assert d["weather"] == {
        "available": False,
        "why": "the home has no province",
        "fix": tools.SET_PROVINCE,
    }


async def test_a_tariff_change_alone_is_the_tariff(make_member, monkeypatch):
    """The same daily use across the tariff change of 2026-11-01: only the tariff moved."""
    me = await make_member("owner", tariff_plan_code="vn_residential", billing_cycle_day=1)
    fake_meter(monkeypatch, lambda d: 10.0)
    d = await explain(me.home_id, "cycle")
    assert d["current"]["days"] == d["previous"]["days"] == 14  # Nov 1-14 against Oct 1-14
    assert adds_up(d)
    assert d["usage_vnd"] == 0 and d["usage_kwh"] == 0
    assert d["calendar_vnd"] == 0
    assert d["tariff_vnd"] == d["change_vnd"]


async def test_days_without_readings_are_scaled_and_said(make_member, monkeypatch):
    me = await make_member("owner", tariff_plan_code="vn_residential", billing_cycle_day=1)
    fake_meter(monkeypatch, lambda d: None if d.month == 11 and d.day <= 4 else 10.0)
    d = await explain(me.home_id, "cycle")
    assert d["current"]["days_with_data"] == 10 and d["current"]["kwh"] == 140.0
    assert adds_up(d)


async def test_the_first_day_of_a_cycle_and_a_home_without_tariff(make_member, monkeypatch):
    fake_meter(monkeypatch, lambda d: 10.0)
    me = await make_member("owner", tariff_plan_code="vn_residential", billing_cycle_day=15)
    async with SessionLocal() as s:
        o, ok, _ = await tools.run_tool(
            tools.Ctx(s, me.home_id, NOW, "vi"), "explain_bill_change", {"period": "cycle"}
        )
    assert not ok and o.data["error"] == "the cycle started today"
    bare = await make_member("owner")
    async with SessionLocal() as s:
        o, ok, _ = await tools.run_tool(
            tools.Ctx(s, bare.home_id, NOW, "vi"), "explain_bill_change", {}
        )
    assert not ok and o.data["fix"] == tools.NO_TARIFF


async def test_the_weather_counts_only_when_use_follows_the_heat(make_member, monkeypatch):
    me = await make_member(
        "owner", tariff_plan_code="vn_residential", billing_cycle_day=1, province_code="79"
    )
    heat = {}  # cooling degree-days per day: October hotter than September

    def hot(d: date) -> float:
        return heat.setdefault(d, (3.0 if d.month == 10 else 1.0) + (d.day % 3))

    fake_meter(monkeypatch, lambda d: 5.0 + 2.0 * hot(d))  # 2 kWh per degree-day

    async def degree_days(ctx, province, lo, hi):
        return per_day(lo, hi, hot)

    monkeypatch.setattr(tools, "_degree_days", degree_days)
    d = await explain(me.home_id, "last_cycle")
    w = d["weather"]
    assert w["available"] and w["fit_r2"] == 1.0
    assert w["kwh"] == round(2.0 * (w["degree_days_current"] - w["degree_days_previous"]), 1)
    assert w["kwh"] > 0

    async def too_few(ctx, province, lo, hi):
        return dict(list(per_day(lo, hi, hot).items())[:10])

    monkeypatch.setattr(tools, "_degree_days", too_few)
    w = (await explain(me.home_id, "last_cycle"))["weather"]
    assert not w["available"] and "needed" in w["why"]

    fake_meter(monkeypatch, lambda d: 10.0 + (d.day % 2))  # use unrelated to the heat
    monkeypatch.setattr(tools, "_degree_days", degree_days)
    w = (await explain(me.home_id, "last_cycle"))["weather"]
    assert not w["available"] and w["why"] == "this home's use does not follow the heat"


async def test_a_whole_cycle_is_priced_on_its_tiers():
    async with SessionLocal() as s:
        version, vat = (
            await s.execute(
                text(
                    "SELECT id, vat_rate FROM public.tb_tariff_version "
                    "WHERE plan_code = 'vn_residential' AND valid_from = '2026-11-01'"
                )
            )
        ).one()
        tiers = (
            await s.execute(
                text(
                    "SELECT from_kwh, to_kwh, price_per_kwh FROM public.tb_tariff_tier "
                    "WHERE version_id = :v ORDER BY tier_no"
                ),
                {"v": version},
            )
        ).all()
        amount = await window_amount(s, "vn_residential", date(2026, 11, 1), 30, 30, Decimal(150))
    first, second = tiers[0], tiers[1]
    expected = (
        (first.to_kwh - first.from_kwh) * first.price_per_kwh
        + (150 - second.from_kwh) * second.price_per_kwh
    ) * (1 + vat)
    assert abs(amount - expected) <= 1


async def test_the_weather_job_keeps_measured_hours_only(make_member, monkeypatch):
    from app.modules.insight.services import jobs

    await make_member("owner", province_code="79")
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    hours = [now - timedelta(hours=1), now + timedelta(hours=1)]

    def respond(request):
        return httpx.Response(
            200,
            json={
                "hourly": {
                    "time": [h.strftime("%Y-%m-%dT%H:%M") for h in hours],
                    "temperature_2m": [31.5, 33.0],
                    "relative_humidity_2m": [70, 65],
                }
            },
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        jobs.httpx,
        "AsyncClient",
        lambda **kw: real_client(**kw, transport=httpx.MockTransport(respond)),
    )
    await jobs.weather(now)
    async with SessionLocal() as s, s.begin():
        rows = (
            await s.execute(
                text(
                    "SELECT ts, temp_c FROM public.tb_weather_hourly "
                    "WHERE province_code = '79' AND ts = ANY(:t) ORDER BY ts"
                ),
                {"t": hours},
            )
        ).all()
        await s.execute(
            text("DELETE FROM public.tb_weather_hourly WHERE ts = ANY(:t)"), {"t": hours}
        )
    assert [(r.ts, r.temp_c) for r in rows] == [(hours[0], 31.5)]
