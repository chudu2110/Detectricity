"""Items 20-22: monthly goals, "what if" simulations, and plans measured before/after."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import text

from app.database import SessionLocal
from app.modules.billing.api import Margin
from app.modules.copilot.services import plans as plan_service
from app.modules.copilot.services import tools
from app.modules.insight.services import savings

NOW = datetime(2026, 11, 20, 5, 0, tzinfo=UTC)
TIERS = [  # 1000 đ/kWh to 100 kWh, then 2000 đ/kWh; no VAT, to read the sums easily
    SimpleNamespace(from_kwh=Decimal(0), to_kwh=Decimal(100), price_per_kwh=Decimal(1000)),
    SimpleNamespace(from_kwh=Decimal(100), to_kwh=None, price_per_kwh=Decimal(2000)),
]


async def _device_with_runs(home_id, runs=10, hours=2, wh=2000) -> uuid.UUID:
    """A device that ran `runs` times `hours` h for `wh` Wh each over the last 30 days."""
    now = datetime.now(UTC)
    async with SessionLocal() as s, s.begin():
        did = await s.scalar(
            text(
                "INSERT INTO public.tb_device (home_id, device_type_code, name, origin) "
                "VALUES (:h, 'fridge', 'Máy lạnh', 'nilm') RETURNING id"
            ),
            {"h": home_id},
        )
        for i in range(runs):
            start = now - timedelta(days=2 * i + 1)
            await s.execute(
                text(
                    "INSERT INTO public.tb_device_cycle "
                    "(home_id, device_id, start_ts, end_ts, energy_wh, peak_w) "
                    "VALUES (:h, :d, :s, :e, :wh, 1200)"
                ),
                {"h": home_id, "d": did, "s": start, "e": start + timedelta(hours=hours), "wh": wh},
            )
    return did


def test_a_margin_prices_saved_kwh_on_the_top_tier_and_inverts():
    m = Margin(TIERS, Decimal("0"), top_kwh=150.0)
    assert m.vnd(30) == 60_000  # all 30 come off the 2000 đ tier
    assert m.vnd(80) == 100_000 + 30_000  # 50 at 2000, then 30 at 1000
    assert abs(m.kwh(130_000) - 80) < 0.01
    assert m.kwh(0) == 0 and m.kwh(10**9) is None  # not even cutting all of it


# --- 20: monthly goal ---


async def test_a_goal_is_set_read_and_removed(client, make_member):
    me = await make_member("owner", tariff_plan_code="vn_residential")
    url = "/api/v1/insights/goal"
    assert (await client.get(url, headers=me.headers)).json() is None
    bad = await client.put(url, json={"kind": "kwh", "target": 0}, headers=me.headers)
    assert bad.status_code == 422
    r = await client.put(url, json={"kind": "kwh", "target": 300}, headers=me.headers)
    assert r.status_code == 200
    body = r.json()
    assert (body["kind"], body["target"], body["used"]) == ("kwh", 300, 0)
    assert body["status"] == "no_forecast" and body["devices"] == []  # no readings yet
    r = await client.put(url, json={"kind": "vnd", "target": "750000"}, headers=me.headers)
    assert r.json()["kind"] == "vnd" and r.json()["target"] == 750000
    assert (await client.delete(url, headers=me.headers)).status_code == 204
    assert (await client.get(url, headers=me.headers)).json() is None
    assert (await client.delete(url, headers=me.headers)).status_code == 404


async def test_a_goal_needs_a_tariff_to_be_tracked(client, make_member):
    me = await make_member("owner")
    url = "/api/v1/insights/goal"
    r = await client.put(url, json={"kind": "kwh", "target": 300}, headers=me.headers)
    assert r.status_code == 422
    r = await client.get(url, headers=me.headers)
    assert (r.status_code, r.json()["code"]) == (422, "tariff_missing")


async def test_an_over_goal_says_what_to_cut_and_where(make_member, monkeypatch):
    me = await make_member("owner")
    bill = SimpleNamespace(
        kwh=Decimal(90),
        amount_total=Decimal(90_000),
        period_start=date(2026, 11, 1),
        period_end=date(2026, 11, 30),
    )

    async def current(s, h, now):
        return bill

    async def forecast(s, h, now):
        return SimpleNamespace(kwh=Decimal(150), amount=Decimal(200_000))

    async def breakdown(s, h, since, until):
        return [SimpleNamespace(device_id=uuid.uuid4(), kwh=40.0, share=0.6)]

    async def margin(s, h, now):
        return Margin(TIERS, Decimal(0), 150.0)

    for name, fn in (
        ("current_bill", current),
        ("forecast_bill", forecast),
        ("device_breakdown", breakdown),
        ("margin", margin),
    ):
        monkeypatch.setattr(savings, name, fn)
    async with SessionLocal() as s:
        await savings.set_goal(s, me.home_id, "kwh", Decimal(120))
        g = await savings.goal_progress(s, me.home_id, NOW)
        assert (g["status"], g["excess"], g["cut_kwh"]) == ("over", 30, 30)
        assert g["days_left"] == 10 and g["left_per_day"] == 3.0  # (120 - 90) / 10
        assert g["devices"][0]["share"] == 0.6
        await savings.set_goal(s, me.home_id, "vnd", Decimal(160_000))
        g = await savings.goal_progress(s, me.home_id, NOW)
        assert (g["status"], g["excess"]) == ("over", 40_000)
        assert g["cut_kwh"] == 20  # 40 000 đ off the 2000 đ tier
        await savings.set_goal(s, me.home_id, "vnd", Decimal(250_000))
        assert (await savings.goal_progress(s, me.home_id, NOW))["status"] == "on_track"


# --- 21: what if ---


async def test_a_simulation_starts_from_measured_use(client, make_member):
    me = await make_member("owner", tariff_plan_code="vn_residential")
    did = await _device_with_runs(me.home_id)  # 1000 W, 0.67 h a day
    url = "/api/v1/insights/simulate"
    r = await client.post(
        url, json={"device_id": str(did), "hours_per_day_less": 5}, headers=me.headers
    )
    body = r.json()
    assert (body["watts_when_on"], body["hours_per_day"], body["hours_per_day_cut"]) == (
        1000,
        0.7,
        0.7,
    )
    assert body["kwh_per_month_saved"] == body["kwh_per_month_before"] == 20.0  # capped
    r = await client.post(
        url,
        json={"device_id": str(did), "new_watts": 500, "price_vnd": 1_000_000},
        headers=me.headers,
    )
    body = r.json()
    assert body["kwh_per_month_after"] == 10.0 and body["kwh_per_month_saved"] == 10.0
    if body["vnd_per_month_saved"]:  # a tariff and some kWh this cycle to price it on
        assert body["payback_months"] == round(1_000_000 / body["vnd_per_month_saved"], 1)


async def test_a_simulation_needs_the_homes_device_and_its_runs(client, make_member):
    me = await make_member("owner")
    other = await make_member("owner")
    theirs = await _device_with_runs(other.home_id)
    url = "/api/v1/insights/simulate"
    r = await client.post(url, json={"device_id": str(theirs)}, headers=me.headers)
    assert (r.status_code, r.json()["code"]) == (404, "device_not_found")
    idle = await _device_with_runs(me.home_id, runs=0)
    r = await client.post(url, json={"device_id": str(idle)}, headers=me.headers)
    assert (r.status_code, r.json()["code"]) == (422, "device_runs_missing")


# --- 22: plans measured before/after ---


def fake_days(monkeypatch, before, after):
    async def daily(s, h, lo, hi):
        return before if hi <= NOW.date() - timedelta(days=13) else after

    monkeypatch.setattr(plan_service, "_daily_kwh", daily)


async def test_a_plan_saving_comes_with_its_margin(monkeypatch):
    started = NOW - timedelta(days=20)
    fake_days(monkeypatch, [10.0, 11.0, 9.0, 10.5, 9.5] * 3, [8.0, 8.5, 7.5, 8.2, 7.8] * 3)
    async with SessionLocal() as s:
        m = await plan_service.measure(s, uuid.uuid4(), started, NOW)
    assert m["status"] == "measured" and m["trial_day"] == 14
    assert m["kwh_per_month_saved"] == 60.0  # 2 kWh a day less
    assert 0 < m["kwh_per_month_margin"] < 60 and m["clear"] is True


async def test_a_plan_with_thin_data_says_so(monkeypatch):
    fake_days(monkeypatch, [10.0] * 14, [8.0] * 4)
    async with SessionLocal() as s:
        m = await plan_service.measure(s, uuid.uuid4(), NOW - timedelta(days=20), NOW)
        assert m["status"] == "not_enough_data" and m["min_days"] == plan_service.MIN_DAYS
        m = await plan_service.measure(s, uuid.uuid4(), NOW - timedelta(days=5), NOW)
        assert m["status"] == "measuring" and m["trial_day"] == 4


async def test_plans_are_listed_with_their_measure(client, make_member):
    me = await make_member("owner")
    async with SessionLocal() as s, s.begin():
        await s.execute(
            text(
                "INSERT INTO public.tb_suggestion (home_id, kind, title, body, expected_kwh) "
                "VALUES (:h, 'plan', 'Tắt điện chờ', '[{\"label\": \"Rút sạc\"}]', 12)"
            ),
            {"h": me.home_id},
        )
    r = await client.get("/api/v1/copilot/plans", headers=me.headers)
    [plan] = r.json()
    assert (plan["title"], plan["tasks"], plan["expected_kwh_per_month"]) == (
        "Tắt điện chờ",
        ["Rút sạc"],
        12.0,
    )
    assert plan["started_at"] is None and plan["measure"] is None
    url = f"/api/v1/copilot/plans/{plan['id']}/accept"
    assert (await client.post(url, headers=me.headers)).json()["status"] == "accepted"
    [plan] = (await client.get("/api/v1/copilot/plans", headers=me.headers)).json()
    assert plan["started_at"] and plan["measure"]["status"] == "measuring"


# --- the assistant's tools ---


async def test_the_assistant_sets_and_reads_the_goal(make_member):
    me = await make_member("owner", tariff_plan_code="vn_residential")
    async with SessionLocal() as s:
        ctx = tools.Ctx(s, me.home_id, datetime.now(UTC), "vi")
        o, ok, _ = await tools.run_tool(ctx, "goal_status", {})
        assert not ok and o.data["fix"] == tools.NO_GOAL
        o, ok, _ = await tools.run_tool(ctx, "set_monthly_goal", {"unit": "kwh", "target": 280})
        assert ok and o.data["target_kwh"] == 280 and o.data["goal_unit"] == "kwh"
        o, ok, _ = await tools.run_tool(ctx, "set_monthly_goal", {"unit": "kwh", "target": -1})
        assert not ok
