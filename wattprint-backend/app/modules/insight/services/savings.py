"""A home's monthly saving goal and its progress, and "what if" simulations of using a device less
or replacing it. Every figure comes from the home's own readings and tariff."""

import uuid
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.api import current_bill, forecast_bill, margin
from app.modules.energy.api import device_breakdown
from app.modules.home.api import Device

from ..models import SavingGoal

ICT = timezone(timedelta(hours=7))
USE_DAYS = 30  # the recent use a simulation starts from
PRIORITY_DEVICES = 3


async def device_use(
    s: AsyncSession, home_id: uuid.UUID, device_id: uuid.UUID, now: datetime, days: int = USE_DAYS
) -> tuple[float, float] | None:
    """(average watts while on, hours on per day) of a device of this home over the last `days`
    days, from its recognised on/off cycles; None without a cycle."""
    row = (
        await s.execute(
            text(
                "SELECT sum(energy_wh) AS wh, "
                "sum(extract(epoch FROM end_ts - start_ts)) / 3600 AS hours "
                "FROM public.tb_device_cycle WHERE home_id = :h AND device_id = :d "
                "AND start_ts >= :lo"
            ),
            {"h": home_id, "d": device_id, "lo": now - timedelta(days=days)},
        )
    ).one()
    if not row.hours:
        return None
    return float(row.wh) / float(row.hours), float(row.hours) / days


async def set_goal(s: AsyncSession, home_id: uuid.UUID, kind: str, target: Decimal) -> None:
    goal = await s.get(SavingGoal, home_id)
    if goal is None:
        s.add(SavingGoal(home_id=home_id, kind=kind, target=target))
    else:
        goal.kind, goal.target, goal.updated_at = kind, target, datetime.now(UTC)
    await s.commit()


async def clear_goal(s: AsyncSession, home_id: uuid.UUID) -> bool:
    goal = await s.get(SavingGoal, home_id)
    if goal is None:
        return False
    await s.delete(goal)
    await s.commit()
    return True


async def goal_progress(s: AsyncSession, home_id: uuid.UUID, now: datetime) -> dict | None:
    """The goal against the running billing cycle: used so far, projected at its end, whether
    that stays within the goal, the kWh to cut when it does not, and the devices to start with.
    None without a goal; LookupError without a tariff plan."""
    goal = await s.get(SavingGoal, home_id)
    if goal is None:
        return None
    bill = await current_bill(s, home_id, now)
    forecast = await forecast_bill(s, home_id, now)
    in_kwh = goal.kind == "kwh"
    used = float(bill.kwh if in_kwh else bill.amount_total)
    projected = float(forecast.kwh if in_kwh else forecast.amount) if forecast else None
    target = float(goal.target)
    today = now.astimezone(ICT).date()
    days_left = max(0, (bill.period_end - today).days)  # whole days after today
    excess = projected - target if projected is not None and projected > target else 0.0
    if in_kwh:
        cut_kwh = excess
    else:
        m = await margin(s, home_id, now)
        cut_kwh = (m.kwh(excess) if m else None) if excess else 0.0
    since = datetime(bill.period_start.year, bill.period_start.month, bill.period_start.day)
    parts = await device_breakdown(s, home_id, since.replace(tzinfo=ICT).astimezone(UTC), now)
    names = dict(
        (await s.execute(select(Device.id, Device.name).where(Device.home_id == home_id))).all()
    )
    return {
        "kind": goal.kind,
        "target": target,
        "period_start": bill.period_start,
        "period_end": bill.period_end,
        "used": round(used, 1),
        "projected": round(projected, 1) if projected is not None else None,
        "status": "no_forecast"
        if projected is None
        else "on_track"
        if projected <= target
        else "over",
        "excess": round(excess, 1),
        "cut_kwh": round(cut_kwh, 1) if cut_kwh is not None else None,
        "days_left": days_left,
        "left_per_day": round((target - used) / days_left, 2) if days_left else None,
        "devices": [
            {
                "id": p.device_id,
                "name": names.get(p.device_id, "?"),
                "kwh": round(float(p.kwh), 1),
                "share": round(float(p.share), 3),
            }
            for p in parts[:PRIORITY_DEVICES]
        ],
    }


async def simulate(
    s: AsyncSession,
    home_id: uuid.UUID,
    device_id: uuid.UUID,
    now: datetime,
    hours_per_day_less: float = 0.0,
    new_watts: float | None = None,
    price_vnd: float | None = None,
) -> dict[str, Any]:
    """What running a device fewer hours a day, or replacing it with one drawing `new_watts`,
    would save a month at its last 30 days' use, and how long a `price_vnd` purchase takes to
    pay back. The hours cut are capped at the hours it actually runs."""
    name = await s.scalar(
        select(Device.name).where(Device.id == device_id, Device.home_id == home_id)
    )
    if name is None:
        return {"error": "no such device in this home"}
    use = await device_use(s, home_id, device_id, now)
    if use is None:
        return {
            "error": "no recognised runs of this device in the last 30 days",
            "fix": "it appears once the system has seen the device run",
        }
    watts, hours = use
    cut = min(max(0.0, hours_per_day_less), hours)
    after_watts = watts if new_watts is None else max(0.0, new_watts)
    before = watts * hours * USE_DAYS / 1000
    after = after_watts * (hours - cut) * USE_DAYS / 1000
    saved = before - after
    m = await margin(s, home_id, now)
    vnd = m.vnd(saved) if m else None
    payback = price_vnd / vnd if price_vnd and vnd and vnd > 0 else None
    return {
        "device": name,
        "watts_when_on": round(watts),
        "hours_per_day": round(hours, 1),
        "hours_per_day_cut": round(cut, 1),
        "new_watts": round(new_watts) if new_watts is not None else None,
        "kwh_per_month_before": round(before, 1),
        "kwh_per_month_after": round(after, 1),
        "kwh_per_month_saved": round(saved, 1),
        "vnd_per_month_saved": round(vnd) if vnd is not None else None,
        "price_vnd": round(price_vnd) if price_vnd else None,
        "payback_months": round(payback, 1) if payback is not None else None,
        "note": "a month is 30 days at the last 30 days' use; VND on this cycle's top tiers",
    }
