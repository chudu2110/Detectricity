import calendar
import inspect
import json
import logging
import statistics
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.modules.billing.api import bill_history, current_bill, forecast_bill, window_amount
from app.modules.energy.api import device_breakdown, weather_at
from app.modules.home.api import Device, Home, Province
from app.modules.insight.api import cohort_for, list_alerts

from ..models import ScopeToken, Suggestion

log = logging.getLogger("copilot.tools")
ICT = timezone(timedelta(hours=7))
TIERS = ("measured", "estimated", "inferred")  # most to least certain
MAX_ROWS_TO_LLM = 30
# What the user can do about missing data; the model says it in the user's language.
SET_PROVINCE = "set the province or city in Account > Home settings"
NO_TARIFF = "the tariff is set by the system, not in the app: contact support"
WAIT_DAYS = "it appears after 7 full days of meter readings"
WEATHER_BASE_C = 26.0  # cooling degree-days count the heat above this (fans, air conditioning)
WEATHER_MIN_DAYS = 28  # days with both readings and weather before the weather is weighed
WEATHER_MIN_R2 = 0.3  # how closely daily use must follow the heat to credit the weather
WAIT_NIGHT = "it appears after one full night (00:00-05:00) of meter readings"


@dataclass
class Ctx:
    session: AsyncSession
    home_id: uuid.UUID
    now: datetime
    lang: str


@dataclass
class Outcome:
    """A tool's result: `data` goes to the model; the rest builds the reply, never the model."""

    data: Any
    detail: str  # the trace's line under the step
    tier: str = "measured"
    sources: list[str] = field(default_factory=list)
    widgets: list[dict[str, Any]] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    sql: str | None = None


def _today(ctx: Ctx) -> date:
    return ctx.now.astimezone(ICT).date()


def _midnight(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=ICT).astimezone(UTC)


def _f(x: Decimal | float | None, digits: int = 2) -> float | None:
    return None if x is None else round(float(x), digits)


def _vi(ctx: Ctx, vi: str, en: str) -> str:
    return vi if ctx.lang == "vi" else en


async def _daily_kwh(ctx: Ctx, lo: date, hi: date) -> dict[date, float]:
    """Main-meter kWh per local day in [lo, hi)."""
    rows = await ctx.session.execute(
        text(
            "SELECT r.bucket, sum(r.energy_wh) / 1000 AS kwh FROM public.reading_1d r "
            "JOIN public.tb_series s USING (series_id) WHERE s.home_id = :h AND s.kind = 'main' "
            "AND s.metric = 'power_w' AND r.bucket >= :lo AND r.bucket < :hi GROUP BY r.bucket"
        ),
        {"h": ctx.home_id, "lo": _midnight(lo), "hi": _midnight(hi)},
    )
    return {r.bucket.astimezone(ICT).date(): float(r.kwh) for r in rows}


async def devices_breakdown(ctx: Ctx, days: int = 30) -> Outcome:
    days = max(1, min(int(days), 90))
    since = _midnight(_today(ctx) - timedelta(days=days - 1))
    parts = await device_breakdown(ctx.session, ctx.home_id, since, ctx.now)
    names = dict(
        (
            await ctx.session.execute(
                select(Device.id, Device.name).where(Device.home_id == ctx.home_id)
            )
        ).all()
    )
    rows = [
        {"id": str(p.device_id), "name": names.get(p.device_id, "?"), "kwh": _f(p.kwh, 1)}
        for p in parts
    ]
    return Outcome(
        data={
            "days": days,
            "devices": rows,
            "note": "estimates of the device recognition model; 'Other' = not recognised",
        },
        detail=_vi(
            ctx,
            f"Mô hình nhận diện thiết bị · {days} ngày",
            f"Device recognition model · {days} days",
        ),
        tier="estimated",
        sources=["nilm"],
        widgets=[
            {
                "kind": "devices",
                "slices": [{"id": r["id"], "label": r["name"], "value": r["kwh"]} for r in rows],
            }
        ],
        links=["devices"],
    )


async def bill_now(ctx: Ctx) -> Outcome:
    try:
        b = await current_bill(ctx.session, ctx.home_id, ctx.now)
    except LookupError:
        return Outcome({"error": "the home has no tariff plan", "fix": NO_TARIFF}, "tb_bill")
    return Outcome(
        data={
            "period": [str(b.period_start), str(b.period_end)],
            "kwh": _f(b.kwh, 1),
            "amount_vnd_with_vat": _f(b.amount_total, 0),
            "vat_rate": _f(b.vat_rate, 3),
            "current_tier": b.tier_no,
            "tiers": [
                {
                    "tier": t.tier_no,
                    "from_kwh": _f(t.from_kwh, 0),
                    "to_kwh": _f(t.to_kwh, 0),
                    "price_per_kwh": _f(t.price_per_kwh, 0),
                    "kwh_used": _f(t.kwh, 1),
                }
                for t in b.tiers
            ],
            "today": {"kwh": _f(b.today_kwh, 2), "vnd": _f(b.today_amount, 0)},
            "data_coverage": _f(b.coverage, 2),
        },
        detail=_vi(ctx, "Công tơ tổng · biểu giá bậc thang", "Main meter · tiered tariff"),
        sources=["tariff", "meter"],
        links=["bill"],
    )


async def bill_forecast(ctx: Ctx) -> Outcome:
    try:
        b = await current_bill(ctx.session, ctx.home_id, ctx.now)
        f = await forecast_bill(ctx.session, ctx.home_id, ctx.now)
    except LookupError:
        return Outcome({"error": "the home has no tariff plan", "fix": NO_TARIFF}, "forecast")
    if f is None:
        return Outcome(
            {"error": "fewer than 7 full days of readings", "fix": WAIT_DAYS}, "forecast"
        )
    current = next(t for t in b.tiers if t.tier_no == b.tier_no)
    limit = f.next.from_kwh if f.next else current.to_kwh
    return Outcome(
        data={
            "period_end": str(f.period_end),
            "kwh_so_far": _f(b.kwh, 1),
            "kwh_at_end": _f(f.kwh, 1),
            "amount_vnd_with_vat_at_end": _f(f.amount, 0),
            "tier_at_end": f.tier_no,
            "next_tier": (
                {"tier": f.next.tier_no, "from_kwh": _f(f.next.from_kwh, 0), "on": str(f.next.on)}
                if f.next
                else None
            ),
            "method": f"same weekday average of the last {f.basis_days} full days",
        },
        detail=_vi(ctx, "Trung bình theo thứ · biểu giá", "Weekday average · tariff"),
        tier="estimated",
        sources=["tariff", "meter"],
        widgets=[
            {
                "kind": "forecast",
                "used": _f(b.kwh, 1),
                "limit": _f(limit, 0),
                "kwh": _f(f.kwh, 1),
                "vnd": _f(f.amount, 0),
            }
        ],
        links=["bill"],
    )


async def bills_past(ctx: Ctx) -> Outcome:
    bills = (await bill_history(ctx.session, ctx.home_id, ctx.now))[-12:]
    return Outcome(
        data=[
            {
                "period": [str(b.period_start), str(b.period_end)],
                "kwh": _f(b.kwh_total, 1),
                "amount_vnd_with_vat": _f(b.amount_total, 0),
                "data_coverage": _f(b.coverage, 2),
            }
            for b in bills
        ]
        or {"error": "no ended billing cycle yet"},
        detail=_vi(ctx, "Hóa đơn các kỳ trước", "Past bills"),
        sources=["tariff", "meter"],
        links=["bill"],
    )


async def compare_periods(ctx: Ctx, period: str = "week") -> Outcome:
    today = _today(ctx)
    if period == "cycle":
        day = await ctx.session.scalar(select(Home.billing_cycle_day).where(Home.id == ctx.home_id))
        start = (
            today.replace(day=day)
            if today.day >= day
            else ((today.replace(day=1) - timedelta(days=1)).replace(day=day))
        )
        prev = (start.replace(day=1) - timedelta(days=1)).replace(day=day)
        n = (today - start).days  # whole days so far
    else:
        period, n = "week", 7
        start, prev = today - timedelta(days=7), today - timedelta(days=14)
    cur = await _daily_kwh(ctx, start, start + timedelta(days=n))
    old = await _daily_kwh(ctx, prev, prev + timedelta(days=n))
    # A day without readings is null, not 0 kWh: "used nothing" and "no data" read differently.
    data = [
        {
            "key": str(start + timedelta(days=i)),
            "current": _f(cur.get(start + timedelta(days=i))),
            "previous": _f(old.get(prev + timedelta(days=i))),
        }
        for i in range(n)
    ]

    def total(side: str) -> float | None:
        days = [d[side] for d in data if d[side] is not None]
        return round(sum(days), 1) if days else None

    return Outcome(
        data={
            "period": period,
            "days": n,
            "current_from": str(start),
            "previous_from": str(prev),
            "kwh_current": total("current"),
            "kwh_previous": total("previous"),
            "days_with_data_current": sum(d["current"] is not None for d in data),
            "days_with_data_previous": sum(d["previous"] is not None for d in data),
            "by_day": data,
        },
        detail=_vi(ctx, f"Công tơ tổng · {n} ngày", f"Main meter · {n} days"),
        sources=["meter"],
        widgets=[
            {
                "kind": "compare",
                "period": period,
                "data": [
                    {**d, "current": d["current"] or 0.0, "previous": d["previous"] or 0.0}
                    for d in data
                ],
            }
        ]
        if n
        else [],
        links=["statistics"],
    )


async def weather(ctx: Ctx) -> Outcome:
    home = await ctx.session.get(Home, ctx.home_id)
    province = await ctx.session.get(Province, home.province_code) if home.province_code else None
    if province is None:
        return Outcome({"error": "the home has no province", "fix": SET_PROVINCE}, "OpenWeather")
    try:
        w = await weather_at(province.lat, province.lon, ctx.lang)
    except Exception:  # WeatherUnavailableError, or no key
        return Outcome({"error": "weather is unavailable right now"}, "OpenWeather")
    return Outcome(
        data={
            "place": province.name,
            "now": {
                "temp_c": w.now.temp,
                "feels_like_c": w.now.feels_like,
                "humidity_pct": w.now.humidity,
                "sky": w.now.sky.description,
            },
            "next_24h": [
                {
                    "at": datetime.fromtimestamp(s.dt, ICT).strftime("%H:%M"),
                    "temp_c": s.temp,
                    "rain_chance": s.pop,
                }
                for s in w.next
            ],
        },
        detail=f"OpenWeather · {province.name}",
        tier="inferred",
        sources=["weather"],
        widgets=[
            {
                "kind": "weather",
                "temp": round(w.now.temp),
                "feels": round(w.now.feels_like),
                "humidity": w.now.humidity,
            }
        ],
    )


async def cohort(ctx: Ctx) -> Outcome:
    c = await cohort_for(ctx.session, ctx.home_id)
    if c is None or c.kwh is None:
        why = "fewer than 10 comparable homes" if c is None else "this home lacks data"
        return Outcome({"error": f"no comparison: {why}"}, "cohort_stat")
    median = (float(c.p33) + float(c.p66)) / 2
    return Outcome(
        data={
            "days": c.days,
            "homes": c.homes,
            "compared_with": c.cohort_key,
            "this_home_kwh": _f(c.kwh, 1),
            "percentiles_kwh": {"p10": _f(c.p10, 1), "p90": _f(c.p90, 1)},
            "median_kwh": round(median, 1),
        },
        detail=_vi(ctx, f"Nhà tương tự · {c.homes} hộ", f"Similar homes · {c.homes} homes"),
        sources=["cohort"],
        widgets=[
            {
                "kind": "peers",
                "you": _f(c.kwh, 1),
                "median": round(median, 1),
                "days": c.days,
                "homes": c.homes,
            }
        ],
        links=["statistics"],
    )


async def alerts(ctx: Ctx) -> Outcome:
    rows = [
        (a, d)
        for a, d in await list_alerts(ctx.session, ctx.home_id, None, 10)
        if a.status != "resolved"
    ]
    return Outcome(
        data=[
            {
                "kind": a.kind,
                "severity": a.severity,
                "since": a.ts.astimezone(ICT).isoformat(timespec="minutes"),
                "device": d.name if d else None,
                "figures": a.payload,
            }
            for a, d in rows
        ]
        or {"note": "no open alerts"},
        detail=_vi(ctx, "Cảnh báo của hệ thống", "System alerts"),
        tier="estimated",
        sources=["nilm"],
        links=["devices"],
    )


async def standby(ctx: Ctx, nights: int = 14) -> Outcome:
    nights = max(3, min(int(nights), 30))
    last = (ctx.now.astimezone(ICT) - timedelta(hours=5)).date()  # the last night fully over
    rows = await ctx.session.execute(
        text(
            "WITH m AS (SELECT r.bucket, sum(r.avg_w) AS w FROM public.reading_1m r "
            "JOIN public.tb_series s USING (series_id) WHERE s.home_id = :h AND s.kind = 'main' "
            "AND s.metric = 'power_w' AND r.bucket >= :lo AND r.bucket < :hi "
            "AND extract(hour FROM r.bucket AT TIME ZONE 'Asia/Ho_Chi_Minh') < 5 "
            "GROUP BY r.bucket) "
            "SELECT (bucket AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS night, "
            "percentile_cont(0.05) WITHIN GROUP (ORDER BY w) AS p5, count(*) AS n "
            "FROM m GROUP BY night ORDER BY night"
        ),
        {
            "h": ctx.home_id,
            "lo": _midnight(last - timedelta(days=nights - 1)),
            "hi": _midnight(last + timedelta(days=1)),
        },
    )
    watts = [(r.night, float(r.p5)) for r in rows if r.n >= 0.8 * 300]
    if not watts:
        return Outcome({"error": "no full night of readings yet", "fix": WAIT_NIGHT}, "reading_1m")
    base = statistics.median(w for _, w in watts)
    kwh_month = base * 24 * 30 / 1000
    vnd = await _saving_vnd(ctx, kwh_month)
    return Outcome(
        data={
            "method": "5th percentile of whole-home power, 00:00-05:00, per night",
            "nights": [{"night": str(d), "watts": round(w)} for d, w in watts],
            "typical_watts": round(base),
            "kwh_per_month": round(kwh_month, 1),
            "vnd_per_month": round(vnd) if vnd else None,
        },
        detail=_vi(ctx, f"Công tơ tổng · {len(watts)} đêm", f"Main meter · {len(watts)} nights"),
        tier="estimated",
        sources=["meter", "tariff"],
        widgets=[
            {
                "kind": "standby",
                "watts": [round(w) for _, w in watts],
                "kwh": round(kwh_month, 1),
                "vnd": round(vnd) if vnd else None,
            }
        ],
        links=["statistics"],
    )


async def query_data(ctx: Ctx, question: str) -> Outcome:
    """Free-form data question through text2sql, limited to this home by a 5-minute scope token."""
    if not settings.text2sql_connection_id:
        return Outcome({"error": "free-form data questions are not configured"}, "text2sql")
    token = ScopeToken(home_id=ctx.home_id)
    ctx.session.add(token)
    await ctx.session.commit()  # text2sql reads it from its own connection
    headers = (
        {"X-Service-Key": settings.text2sql_service_key} if settings.text2sql_service_key else {}
    )
    body = {
        "connection_id": settings.text2sql_connection_id,
        "question": question[:2000],
        "scope_token": str(token.token),
        "time_zone": "Asia/Ho_Chi_Minh",  # tb_home.timezone is CHECKed to it
    }
    sql, columns, rows, answer, status = None, [], [], "", "error"
    try:
        async with (
            httpx.AsyncClient(base_url=settings.text2sql_url, timeout=60) as client,
            client.stream("POST", "/api/v1/text2sql/chat", json=body, headers=headers) as res,
        ):
            if res.status_code != 200:
                await res.aread()
                return Outcome({"error": f"text2sql answered {res.status_code}"}, "text2sql")
            event = None
            async for line in res.aiter_lines():
                if line.startswith("event: "):
                    event = line[7:]
                elif line.startswith("data: "):
                    d = json.loads(line[6:])
                    if event == "data":
                        sql, columns, rows = d.get("sql"), d.get("columns", []), d.get("rows", [])
                    elif event == "token":
                        answer += d.get("text", "")
                    elif event == "done":
                        status = d.get("status", "error")
    except httpx.HTTPError:
        return Outcome({"error": "text2sql is unreachable"}, "text2sql")
    return Outcome(
        data={
            "status": status,
            "columns": [
                c.get("label") or c.get("name") if isinstance(c, dict) else c for c in columns
            ],
            "rows": rows[:MAX_ROWS_TO_LLM],
            "row_count": len(rows),
            "summary": answer,
        },
        detail=_vi(ctx, "Truy vấn chỉ đọc dữ liệu nhà bạn", "Read-only query of your home's data"),
        tier="estimated",
        sources=["meter"],
        sql=sql,
    )


async def _device_use(ctx: Ctx, device_id: str, days: int = 30) -> tuple[float, float] | None:
    """(average watts while on, hours on per day) of a device of this home over `days` days, from
    its recognised on/off cycles; None without a cycle."""
    try:
        did = uuid.UUID(str(device_id))
    except ValueError:
        return None
    row = (
        await ctx.session.execute(
            text(
                "SELECT sum(energy_wh) AS wh, "
                "sum(extract(epoch FROM end_ts - start_ts)) / 3600 AS hours "
                "FROM public.tb_device_cycle WHERE home_id = :h AND device_id = :d "
                "AND start_ts >= :lo"
            ),
            {"h": ctx.home_id, "d": did, "lo": ctx.now - timedelta(days=days)},
        )
    ).one()
    if not row.hours:
        return None
    return float(row.wh) / float(row.hours), float(row.hours) / days


async def _saving(
    ctx: Ctx, task: dict[str, Any], standby_w: float | None
) -> tuple[float, dict[str, Any]]:
    """(kWh per month, the measured figures behind it) the task saves, from this home's own
    readings. The model only chooses the action and its size; a size beyond what was measured is
    capped. The figures are numbers, not prose, so that an answer quoting them can be checked."""
    kind = task.get("kind")
    if kind == "standby" and standby_w:
        watts = min(max(0.0, float(task.get("watts") or 0)), standby_w)
        basis = {"standby_watts_cut": round(watts), "standby_watts_measured": round(standby_w)}
        return watts * 24 * 30 / 1000, basis
    if kind == "device_hours" and (use := await _device_use(ctx, task.get("device_id", ""))):
        avg_w, hours_day = use
        hours = min(max(0.0, float(task.get("hours_per_day") or 0)), hours_day)
        basis = {
            "hours_per_day_cut": round(hours, 1),
            "hours_per_day_measured": round(hours_day, 1),
            "watts_when_on": round(avg_w),
        }
        return avg_w * hours * 30 / 1000, basis
    return 0.0, {"measurable": False}


def _tiered(tiers: list[Any], kwh: float) -> float:
    return sum(
        max(0.0, min(kwh, float(t.to_kwh) if t.to_kwh is not None else kwh) - float(t.from_kwh))
        * float(t.price_per_kwh)
        for t in tiers
    )


async def _saving_vnd(ctx: Ctx, kwh: float) -> float | None:
    """VND per month that `kwh` less per month saves, VAT included: priced on the top tiers of
    the cycle's projected kWh (where the saved kWh come off), not at the average price."""
    try:
        b = await current_bill(ctx.session, ctx.home_id, ctx.now)
    except LookupError:
        return None
    f = await forecast_bill(ctx.session, ctx.home_id, ctx.now)
    top = float(f.kwh if f else b.kwh)
    if not top:
        return None
    cut = _tiered(b.tiers, top) - _tiered(b.tiers, max(0.0, top - kwh))
    return cut * (1 + float(b.vat_rate))


async def propose_plan(ctx: Ctx, title: str, tasks: list[dict[str, Any]]) -> Outcome:
    tasks = [t for t in tasks[:6] if t.get("label")]
    if not tasks:
        return Outcome({"error": "a plan needs at least one task"}, "tb_suggestion")
    standby_w = None
    if any(t.get("kind") == "standby" for t in tasks):
        measured = await standby(ctx)
        standby_w = measured.data.get("typical_watts") if "error" not in measured.data else None
    saved = []
    for t in tasks:
        kwh_month, basis = await _saving(ctx, t, standby_w)
        saved.append(
            {
                "label": str(t["label"])[:120],
                "detail": str(t.get("detail", ""))[:300],
                "kwh_month": round(kwh_month, 1),
                "basis": basis,
            }
        )
    tasks = saved
    kwh = round(sum(t["kwh_month"] for t in tasks), 1)
    price = await _saving_vnd(ctx, kwh) if kwh else None
    vnd = round(price) if price is not None else None
    plan = Suggestion(
        home_id=ctx.home_id,
        kind="plan",
        title=title[:200] or "Plan",
        body=json.dumps(tasks, ensure_ascii=False),
        expected_kwh=Decimal(str(kwh)),
        expected_amount=Decimal(vnd) if vnd is not None else None,
    )
    ctx.session.add(plan)
    await ctx.session.commit()  # the reply names it: a later failing tool must not roll it back
    return Outcome(
        data={
            "plan_id": str(plan.id),
            "tasks": [
                {"label": t["label"], "kwh_per_month": t["kwh_month"], "basis": t["basis"]}
                for t in tasks
            ],
            "kwh_per_month": kwh,
            "vnd_per_month": vnd,
            "note": "computed from this home's readings and tariff; 0 = not measurable",
        },
        detail=_vi(ctx, "Kế hoạch tiết kiệm", "Savings plan"),
        tier="estimated",
        sources=["meter", "tariff"],
        widgets=[
            {
                "kind": "plan",
                "id": str(plan.id),
                "tasks": [{"label": t["label"], "detail": t["detail"]} for t in tasks],
                "kwh": kwh,
                "vnd": vnd,
                "status": "proposed",
            }
        ],
    )


def _add_month(d: date) -> date:
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _cycle_start(day_of_month: int, today: date) -> date:
    if today.day >= day_of_month:
        return today.replace(day=day_of_month)
    return (today.replace(day=1) - timedelta(days=1)).replace(day=day_of_month)  # day <= 28


@dataclass
class _Window:
    start: date
    days: int
    cycle_days: int
    days_with_data: int = 0
    kwh: float = 0.0  # scaled up to all its days when some have no readings

    @property
    def end(self) -> date:
        return self.start + timedelta(days=self.days)


async def _filled(ctx: Ctx, w: _Window) -> _Window:
    daily = await _daily_kwh(ctx, w.start, w.end)
    w.days_with_data = len(daily)
    w.kwh = sum(daily.values()) / len(daily) * w.days if daily else 0.0
    return w


async def _device_runs(ctx: Ctx, w: _Window) -> dict[uuid.UUID, tuple[float, float]]:
    """Per device: (hours on per day, average watts while on) over the window, from its cycles."""
    rows = await ctx.session.execute(
        text(
            "SELECT device_id, sum(energy_wh) AS wh, "
            "sum(extract(epoch FROM end_ts - start_ts)) / 3600 AS hours "
            "FROM public.tb_device_cycle WHERE home_id = :h AND start_ts >= :lo AND start_ts < :hi "
            "GROUP BY device_id"
        ),
        {"h": ctx.home_id, "lo": _midnight(w.start), "hi": _midnight(w.end)},
    )
    return {
        r.device_id: (float(r.hours) / max(w.days_with_data, 1), float(r.wh) / float(r.hours))
        for r in rows
        if r.hours
    }


async def _degree_days(ctx: Ctx, province: str, lo: date, hi: date) -> dict[date, float]:
    """Cooling degree-days per local day in [lo, hi): how far above WEATHER_BASE_C it was."""
    rows = await ctx.session.execute(
        text(
            "SELECT (ts AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, "
            "avg(greatest(temp_c - :base, 0)) AS cdd, count(*) AS n "
            "FROM public.tb_weather_hourly WHERE province_code = :p AND ts >= :lo AND ts < :hi "
            "GROUP BY day"
        ),
        {"p": province, "base": WEATHER_BASE_C, "lo": _midnight(lo), "hi": _midnight(hi)},
    )
    return {r.day: float(r.cdd) for r in rows if r.n >= 20}  # a day with most of its hours


async def _weather_part(ctx: Ctx, home: Home, cur: _Window, prev: _Window) -> dict[str, Any]:
    """kWh of the change the weather explains, when this home's daily use follows the heat:
    daily kWh against cooling degree-days over the last 90 days, then that slope times how much
    hotter the current period was. Otherwise why not."""
    if not home.province_code:
        return {"available": False, "why": "the home has no province", "fix": SET_PROVINCE}
    today = _today(ctx)
    kwh = await _daily_kwh(ctx, today - timedelta(days=90), today)
    cdd = await _degree_days(ctx, home.province_code, prev.start, today)
    days = [d for d in kwh if d in cdd]
    if len(days) < WEATHER_MIN_DAYS:
        return {
            "available": False,
            "why": f"{len(days)} days with both readings and weather, {WEATHER_MIN_DAYS} needed",
        }
    x, y = [cdd[d] for d in days], [kwh[d] for d in days]
    if statistics.pvariance(x) == 0:
        return {"available": False, "why": "the temperature did not vary over those days"}
    slope = statistics.linear_regression(x, y).slope
    r2 = statistics.correlation(x, y) ** 2
    if slope <= 0 or r2 < WEATHER_MIN_R2:
        return {"available": False, "why": "this home's use does not follow the heat", "r2": r2}

    def mean(w: _Window) -> float | None:
        seen = [
            cdd[w.start + timedelta(days=i)]
            for i in range(w.days)
            if w.start + timedelta(days=i) in cdd
        ]
        return statistics.fmean(seen) if seen else None

    now_cdd, before_cdd = mean(cur), mean(prev)
    if now_cdd is None or before_cdd is None:
        return {"available": False, "why": "no weather for one of the two periods"}
    return {
        "available": True,
        "kwh": round(slope * (now_cdd - before_cdd) * cur.days, 1),
        "degree_days_current": round(now_cdd * cur.days, 1),
        "degree_days_previous": round(before_cdd * cur.days, 1),
        "fit_r2": round(r2, 2),
        "days_used": len(days),
    }


async def explain_bill_change(ctx: Ctx, period: str = "cycle") -> Outcome:
    """Why the bill moved: the change in VND split into calendar days, tariff and usage (adding
    up to it), the usage into devices (new ones, longer runs, higher power) and the weather."""
    home = await ctx.session.get(Home, ctx.home_id)
    if home.tariff_plan_code is None:
        return Outcome({"error": "the home has no tariff plan", "fix": NO_TARIFF}, "tb_bill")
    day = home.billing_cycle_day or 1
    today = _today(ctx)
    start = _cycle_start(day, today)
    prev_start = _cycle_start(day, start - timedelta(days=1))
    if period == "last_cycle":
        before = _cycle_start(day, prev_start - timedelta(days=1))
        cur = _Window(prev_start, (start - prev_start).days, (start - prev_start).days)
        prev = _Window(before, (prev_start - before).days, (prev_start - before).days)
    else:
        period, n = "cycle", (today - start).days
        if n < 1:
            return Outcome(
                {"error": "the cycle started today", "fix": "ask again tomorrow"}, "reading_1d"
            )
        cur = _Window(start, n, (_add_month(start) - start).days)
        prev = _Window(prev_start, n, (start - prev_start).days)
    cur, prev = await _filled(ctx, cur), await _filled(ctx, prev)
    if not cur.days_with_data or not prev.days_with_data:
        return Outcome(
            {
                "error": "no readings in one of the two periods",
                "days_with_data_current": cur.days_with_data,
                "days_with_data_previous": prev.days_with_data,
            },
            "reading_1d",
        )

    async def price(w: _Window, kwh: float) -> float:
        amount = await window_amount(
            ctx.session, home.tariff_plan_code, w.start, w.days, w.cycle_days, Decimal(f"{kwh:.3f}")
        )
        return float(amount)

    # Each step changes one thing, so the three add up to the change exactly.
    same_rate = prev.kwh / prev.days * cur.days  # the previous daily use over this period's days
    before, after = await price(prev, prev.kwh), await price(cur, cur.kwh)
    old_tariff, new_tariff = await price(prev, same_rate), await price(cur, same_rate)
    calendar_vnd, tariff_vnd, usage_vnd = (
        old_tariff - before,
        new_tariff - old_tariff,
        after - new_tariff,
    )
    usage_kwh = cur.kwh - same_rate

    span = (_midnight(cur.start), _midnight(cur.end)), (_midnight(prev.start), _midnight(prev.end))

    def scaled(w: _Window, parts) -> dict[uuid.UUID, float]:
        """kWh per device, scaled up like the meter's when some days have no readings."""
        return {p.device_id: float(p.kwh) * w.days / w.days_with_data for p in parts}

    now_kwh = scaled(cur, await device_breakdown(ctx.session, ctx.home_id, *span[0]))
    old_kwh = scaled(prev, await device_breakdown(ctx.session, ctx.home_id, *span[1]))
    now_runs, old_runs = await _device_runs(ctx, cur), await _device_runs(ctx, prev)
    devices = {
        d.id: d
        for d in await ctx.session.scalars(select(Device).where(Device.home_id == ctx.home_id))
    }
    rows = []
    for did in set(now_kwh) | set(old_kwh):
        then = old_kwh.get(did, 0.0) / prev.days * cur.days
        change = now_kwh.get(did, 0.0) - then
        row: dict[str, Any] = {
            "name": devices[did].name if did in devices else "?",
            "kwh_change": round(change, 1),
            "vnd_change": round(usage_vnd * change / usage_kwh) if abs(usage_kwh) > 0.05 else None,
            "new": old_kwh.get(did, 0.0) < 0.1 and now_kwh.get(did, 0.0) >= 0.5,
        }
        if did in now_runs and did in old_runs:
            (h0, w0), (h1, w1) = old_runs[did], now_runs[did]
            row["runtime"] = {
                "hours_per_day_before": round(h0, 1),
                "hours_per_day_now": round(h1, 1),
                "watts_before": round(w0),
                "watts_now": round(w1),
                "kwh_from_longer_runs": round((h1 - h0) * w0 * cur.days / 1000, 1),
                "kwh_from_higher_power": round(h1 * (w1 - w0) * cur.days / 1000, 1),
            }
        rows.append(row)
    rows.sort(key=lambda r: abs(r["kwh_change"]), reverse=True)
    weather_part = await _weather_part(ctx, home, cur, prev)

    def side(w: _Window, vnd: float) -> dict[str, Any]:
        return {
            "from": str(w.start),
            "days": w.days,
            "days_with_data": w.days_with_data,
            "kwh": round(w.kwh, 1),
            "amount_vnd_with_vat": round(vnd),
        }

    return Outcome(
        data={
            "period": period,
            "current": side(cur, after),
            "previous": side(prev, before),
            "change_vnd": round(after - before),
            "change_kwh": round(cur.kwh - prev.kwh, 1),
            "calendar_vnd": round(calendar_vnd),
            "tariff_vnd": round(tariff_vnd),
            "usage_vnd": round(usage_vnd),
            "usage_kwh": round(usage_kwh, 1),
            "devices": rows[:6],
            "unexplained_kwh": round(usage_kwh - sum(r["kwh_change"] for r in rows), 1),
            "weather": weather_part,
            "note": (
                "calendar_vnd + tariff_vnd + usage_vnd = change_vnd. Device figures are estimates; "
                "unexplained_kwh is use no device explains; runtime is given only for a device "
                "with recognised on/off cycles in both periods. A period whose days_with_data is "
                "below its days was scaled up from the days with readings."
            ),
        },
        detail=_vi(
            ctx,
            f"Công tơ tổng, biểu giá, thiết bị · {cur.days} ngày",
            f"Main meter, tariff, devices · {cur.days} days",
        ),
        tier="estimated",
        sources=["meter", "tariff", "nilm"] + (["weather"] if weather_part["available"] else []),
        links=["bill", "devices"],
    )


def _fn(name: str, description: str, properties: dict | None = None, required=()) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties or {},
                "required": list(required),
                "additionalProperties": False,
            },
        },
    }


Tool = Callable[..., Awaitable[Outcome]]
TOOLS: dict[str, tuple[Tool, dict]] = {
    "devices_breakdown": (
        devices_breakdown,
        _fn(
            "devices_breakdown",
            "kWh per device over the last N days (NILM estimates from the main meter).",
            {"days": {"type": "integer", "minimum": 1, "maximum": 90}},
        ),
    ),
    "current_bill": (
        bill_now,
        _fn("current_bill", "The running billing cycle so far: kWh, VND, tiers, today."),
    ),
    "bill_forecast": (
        bill_forecast,
        _fn("bill_forecast", "The bill at the end of this cycle and when the next tier starts."),
    ),
    "bill_history": (bills_past, _fn("bill_history", "Ended cycles' bills.")),
    "compare_periods": (
        compare_periods,
        _fn(
            "compare_periods",
            "Daily kWh of this week (last 7 days) or this billing cycle against the previous one.",
            {"period": {"type": "string", "enum": ["week", "cycle"]}},
            ["period"],
        ),
    ),
    "explain_bill_change": (
        explain_bill_change,
        _fn(
            "explain_bill_change",
            "Why the bill went up or down: this billing cycle so far against the same days of the "
            "previous one (cycle), or the last ended cycle against the one before (last_cycle). "
            "Splits the change in VND into calendar days, tariff and usage, the usage into "
            "devices (new devices, longer runs, higher power) and, with enough data, weather.",
            {"period": {"type": "string", "enum": ["cycle", "last_cycle"]}},
        ),
    ),
    "weather": (weather, _fn("weather", "Weather now and the next 24 h at the home's province.")),
    "cohort": (cohort, _fn("cohort", "This home's last 30 days against similar homes.")),
    "alerts": (alerts, _fn("alerts", "Open alerts: devices running long, standby, tiers.")),
    "standby": (
        standby,
        _fn(
            "standby",
            "Always-on power: the lowest night-time load per night, its kWh and VND per month.",
            {"nights": {"type": "integer", "minimum": 3, "maximum": 30}},
        ),
    ),
    "query_data": (
        query_data,
        _fn(
            "query_data",
            "Any other question about this home's own data that the other tools do not answer: "
            "a specific day or hour, a device's runs (how many, how long, when), peaks, trends. "
            "Answered by a read-only SQL query; ask one precise question.",
            {"question": {"type": "string", "maxLength": 500}},
            ["question"],
        ),
    ),
    "propose_plan": (
        propose_plan,
        _fn(
            "propose_plan",
            "Save a savings plan the user can start: 2-5 concrete tasks from this home's data. "
            "Give each task's action, never its savings: the system measures the kWh and VND. "
            "kind standby: cut `watts` of always-on load (from the standby tool); device_hours: "
            "run `device_id` (from devices_breakdown) `hours_per_day` less; tip: anything else.",
            {
                "title": {"type": "string", "maxLength": 200},
                "tasks": {
                    "type": "array",
                    "maxItems": 6,
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "detail": {"type": "string"},
                            "kind": {"type": "string", "enum": ["standby", "device_hours", "tip"]},
                            "watts": {"type": "number", "minimum": 0},
                            "device_id": {"type": "string"},
                            "hours_per_day": {"type": "number", "minimum": 0, "maximum": 24},
                        },
                        "required": ["label", "detail", "kind"],
                        "additionalProperties": False,
                    },
                },
            },
            ["title", "tasks"],
        ),
    ),
}
SPECS = [spec for _, spec in TOOLS.values()]


async def run_tool(ctx: Ctx, name: str, args: dict[str, Any]) -> tuple[Outcome, bool, int]:
    """(outcome, ok, ms). A bad call or a failing tool gives the model an error, not the user a
    500; the failure is logged."""
    started = time.monotonic()
    fn = TOOLS.get(name, (None,))[0]
    try:
        if fn is None:
            raise TypeError(f"no tool {name}")
        inspect.signature(fn).bind(ctx, **args)
    except TypeError as e:  # the model named a tool or arguments that do not exist
        return Outcome({"error": f"invalid call: {e}"}, name), False, 0
    try:
        outcome = await fn(ctx, **args)
    except Exception:
        log.exception("copilot tool %s failed", name)
        await ctx.session.rollback()
        outcome = Outcome({"error": "this tool failed; answer without it"}, name)
    ok = not (isinstance(outcome.data, dict) and "error" in outcome.data)
    return outcome, ok, int((time.monotonic() - started) * 1000)
