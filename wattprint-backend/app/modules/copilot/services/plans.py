"""The home's savings plans and what each one saved: the main meter's daily kWh after a plan was
started against the days before it, with the margin day-to-day variation leaves."""

import json
import math
import statistics
import uuid
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.api import margin

from ..models import Suggestion, SuggestionFeedback

ICT = timezone(timedelta(hours=7))
TRIAL_DAYS = 14  # a plan is measured over the 14 days after it was started, against the 14 before
MIN_DAYS = 10  # fewer days with readings on either side: not enough data to say
Z95 = 1.96


def _midnight(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=ICT).astimezone(UTC)


async def _daily_kwh(s: AsyncSession, home_id: uuid.UUID, lo: date, hi: date) -> list[float]:
    """The main meter's kWh of each local day in [lo, hi) that has readings."""
    rows = await s.execute(
        text(
            "SELECT sum(r.energy_wh) / 1000 AS kwh FROM public.reading_1d r "
            "JOIN public.tb_series s USING (series_id) WHERE s.home_id = :h AND s.kind = 'main' "
            "AND s.metric = 'power_w' AND r.bucket >= :lo AND r.bucket < :hi GROUP BY r.bucket"
        ),
        {"h": home_id, "lo": _midnight(lo), "hi": _midnight(hi)},
    )
    return [float(r.kwh) for r in rows]


async def measure(
    s: AsyncSession, home_id: uuid.UUID, started: datetime, now: datetime
) -> dict[str, Any]:
    """Before/after of a plan started at `started`: kWh per day on each side, the saving per
    month and its 95 % margin; says when the trial is still running or the data is too thin."""
    first = started.astimezone(ICT).date() + timedelta(days=1)  # the first whole day of trying
    today = now.astimezone(ICT).date()
    before = await _daily_kwh(s, home_id, first - timedelta(days=TRIAL_DAYS), first)
    after = await _daily_kwh(s, home_id, first, min(first + timedelta(days=TRIAL_DAYS), today))
    day = max(0, min((today - first).days, TRIAL_DAYS))
    out: dict[str, Any] = {
        "trial_day": day,
        "trial_days": TRIAL_DAYS,
        "days_with_data_before": len(before),
        "days_with_data_after": len(after),
    }
    if len(before) < MIN_DAYS or len(after) < MIN_DAYS:
        status = "measuring" if day < TRIAL_DAYS else "not_enough_data"
        return out | {"status": status, "min_days": MIN_DAYS}
    per_day = statistics.fmean(before) - statistics.fmean(after)
    spread = math.sqrt(
        statistics.variance(before) / len(before) + statistics.variance(after) / len(after)
    )
    saved, plus_minus = per_day * 30, Z95 * spread * 30
    m = await margin(s, home_id, now)
    return out | {
        "status": "measuring" if day < TRIAL_DAYS else "measured",
        "kwh_per_day_before": round(statistics.fmean(before), 2),
        "kwh_per_day_after": round(statistics.fmean(after), 2),
        "kwh_per_month_saved": round(saved, 1),
        "kwh_per_month_margin": round(plus_minus, 1),  # 95 %: the saving is saved ± this
        "clear": abs(saved) > plus_minus,  # the change is bigger than day-to-day noise
        "vnd_per_month_saved": round(m.vnd(saved)) if m and saved > 0 else None,
        "note": "main meter before and after, not adjusted for weather or guests",
    }


async def list_plans(s: AsyncSession, home_id: uuid.UUID, now: datetime) -> list[dict[str, Any]]:
    """The home's plans, newest first: what each was expected to save and, once started, what
    it measured."""
    started = func.min(SuggestionFeedback.at)
    rows = (
        await s.execute(
            select(Suggestion, started)
            .outerjoin(
                SuggestionFeedback,
                and_(
                    SuggestionFeedback.suggestion_id == Suggestion.id,
                    SuggestionFeedback.action == "accept",
                ),
            )
            .where(Suggestion.home_id == home_id, Suggestion.kind == "plan")
            .group_by(Suggestion.id)
            .order_by(Suggestion.created_at.desc())
            .limit(20)
        )
    ).all()
    out = []
    for plan, at in rows:
        try:
            tasks = [t.get("label", "") for t in json.loads(plan.body)]
        except ValueError, AttributeError:
            tasks = []
        out.append(
            {
                "id": plan.id,
                "title": plan.title,
                "status": plan.status,
                "created_at": plan.created_at,
                "started_at": at,
                "tasks": tasks,
                "expected_kwh_per_month": float(plan.expected_kwh)
                if plan.expected_kwh is not None
                else None,
                "expected_vnd_per_month": float(plan.expected_amount)
                if plan.expected_amount is not None
                else None,
                "measure": await measure(s, home_id, at, now) if at else None,
            }
        )
    return out
