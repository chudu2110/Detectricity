import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class GoalIn(BaseModel):
    """The most kWh, or VND (VAT included), a billing cycle should take."""

    kind: Literal["kwh", "vnd"]
    target: Decimal = Field(gt=0, le=1_000_000_000, max_digits=14, decimal_places=2)


class GoalDevice(BaseModel):
    id: uuid.UUID
    name: str
    kwh: float  # this cycle so far
    share: float  # of the recognised devices' kWh


class GoalRead(BaseModel):
    """The goal against the running cycle, in the goal's own unit (kWh or VND)."""

    kind: Literal["kwh", "vnd"]
    target: float
    period_start: date
    period_end: date
    used: float
    projected: float | None  # at the end of the cycle; null before 7 days of readings
    status: Literal["on_track", "over", "no_forecast"]
    excess: float  # projected beyond the target, 0 when within it
    cut_kwh: float | None  # kWh to cut this cycle to stay within the goal
    days_left: int
    left_per_day: float | None  # what each remaining day may take to stay within the goal
    devices: list[GoalDevice]  # the biggest users this cycle: where to start


class SimulateIn(BaseModel):
    device_id: uuid.UUID
    hours_per_day_less: float = Field(default=0, ge=0, le=24)
    new_watts: float | None = Field(default=None, ge=0, le=50_000)  # a replacement's power
    price_vnd: float | None = Field(default=None, ge=0, le=10_000_000_000)  # its price


class SimulateRead(BaseModel):
    device: str
    watts_when_on: int
    hours_per_day: float
    hours_per_day_cut: float
    new_watts: int | None
    kwh_per_month_before: float
    kwh_per_month_after: float
    kwh_per_month_saved: float  # negative: the change uses more
    vnd_per_month_saved: int | None  # null without a tariff plan
    price_vnd: int | None
    payback_months: float | None  # null without a price or a saving
    note: str
