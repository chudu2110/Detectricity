"""Checks that every figure in an answer comes from the tools the answer was built on.

A figure is a number with a unit (đ, kWh, Wh, W, %). Each one must match a number of a tool result
of the same kind, or the difference or the percent change of two of them, within rounding. Bare
numbers (dates, counts, "bậc 3") are not checked: too many of them are not data.
"""

import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import Any

# The kind of a tool field, read from its key; a field with no telling key may back any unit.
KEY_KINDS = (
    ("money", ("vnd", "amount", "price", "dong")),
    ("kwh", ("kwh",)),
    ("w", ("watts", "peak_w")),
    ("ratio", ("pct", "percent", "coverage", "rate", "chance", "share")),
)
UNIT_KINDS = {
    "đ": "money",
    "đồng": "money",
    "vnd": "money",
    "vnđ": "money",
    "kwh": "kwh",
    "số điện": "kwh",
    "wh": "kwh",
    "kw": "w",
    "w": "w",
    "watt": "w",
    "oát": "w",
    "%": "ratio",
    "phần trăm": "ratio",
    "percent": "ratio",
}
SCALES = {"nghìn": 1e3, "ngàn": 1e3, "k": 1e3, "triệu": 1e6, "tr": 1e6}
FIGURE = re.compile(
    r"(?<![\w.,])(?P<num>\d+(?:[.,]\d+)*)\s*"
    r"(?P<scale>nghìn|ngàn|triệu|tr|k(?!wh|w\b))?\s*"
    r"(?P<unit>kwh|số điện|wh|kw(?!h)|watt|oát|w(?!h)|%|phần trăm|percent|vnđ|vnd|đồng|đ)"
    r"(?!\w)",
    re.IGNORECASE,
)
CITATION = re.compile(r"\[\d+(?:\s*,\s*\d+)*\]")
WEEK = re.compile(r"tuần (?:trước|này|qua)|last week|this week|previous week", re.IGNORECASE)
CYCLE = re.compile(
    r"(?:kỳ|tháng) (?:trước|này)|previous (?:cycle|month)|last month|this month", re.IGNORECASE
)
REL_TOL = 0.015  # "khoảng 650.000 đ" for 647.018 đ
MAX_POOL = 200  # numbers paired for derived figures (pairs grow as n²)


@dataclass
class Figure:
    text: str
    value: float
    kind: str
    decimals: int


@dataclass
class Verdict:
    figures: int = 0
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def parse_number(raw: str) -> tuple[float, int]:
    """(value, decimals shown) of "647.018", "1,5", "1.234,5", "1,234.5", "0.125".

    One kind of separator before groups of exactly three digits (not after a lone 0) groups
    thousands; otherwise the last separator is the decimal point and the others group thousands.
    """
    seps = re.findall(r"[.,]", raw)
    if not seps:
        return float(raw), 0
    groups = re.split(r"[.,]", raw)
    if len(set(seps)) == 1 and groups[0] != "0" and all(len(g) == 3 for g in groups[1:]):
        return float("".join(groups)), 0
    return float("".join(groups[:-1]) + "." + groups[-1]), len(groups[-1])


def figures(text: str) -> list[Figure]:
    out = []
    for m in FIGURE.finditer(CITATION.sub(" ", text)):
        value, decimals = parse_number(m["num"])
        unit = m["unit"].lower()
        if m["scale"]:
            value, decimals = value * SCALES[m["scale"].lower()], 0
        if unit == "kw":
            value *= 1000
        if unit == "wh":
            value /= 1000
        out.append(Figure(m[0].strip(), value, UNIT_KINDS[unit], decimals))
    return out


def _key_kind(path: tuple[str, ...]) -> str | None:
    for key in reversed(path):
        k = key.lower()
        for kind, marks in KEY_KINDS:
            if any(mark in k for mark in marks):
                return kind
    return None


def tool_numbers(data: Any, path: tuple[str, ...] = ()) -> list[tuple[float, str | None]]:
    """(value, kind) of every number in a tool result; the kind comes from the nearest key."""
    if isinstance(data, bool) or data is None:
        return []
    if isinstance(data, int | float):
        return [(float(data), _key_kind(path))]
    if isinstance(data, dict):
        return [n for k, v in data.items() for n in tool_numbers(v, (*path, str(k)))]
    if isinstance(data, list):
        return [n for v in data for n in tool_numbers(v, path)]
    return []


def _close(shown: Figure, value: float) -> bool:
    half_step = 0.5 * 10 ** (-shown.decimals)
    return abs(shown.value - value) <= max(half_step, REL_TOL * abs(value))


def _candidates(numbers: list[tuple[float, str | None]], kind: str) -> list[float]:
    """What a figure of `kind` may quote: a number of that kind (or of no known kind), the
    difference of two, and for a percent a ratio field or the percent change of two numbers."""
    same = [v for v, k in numbers if k == kind]
    loose = [v for v, k in numbers if k is None]
    out = same + loose
    # ponytail: pairs only (difference, percent change); sums of 3+ figures are not derived
    out += [abs(a - b) for a, b in combinations((same or loose)[:MAX_POOL], 2)]
    if kind == "ratio":
        out += [v * 100 for v in same if abs(v) <= 1]  # coverage 0.9 -> "90%"
        base = [v for v, k in numbers if k != "ratio" and v][:MAX_POOL]
        for a, b in combinations(base, 2):
            out += [abs(a - b) / abs(a) * 100, abs(a - b) / abs(b) * 100]
    return out


def check(text: str, results: list[Any], periods: set[str] | None = None) -> Verdict:
    """The figures of `text` that no tool result in `results` backs. `periods`: the `period`
    arguments compare_periods was called with (an answer about last week from a comparison of
    billing cycles quotes the wrong period)."""
    numbers = [n for r in results for n in tool_numbers(r)]
    found = figures(text)
    verdict = Verdict(figures=len(found))
    for f in found:
        if not any(_close(f, v) for v in _candidates(numbers, f.kind)):
            verdict.problems.append(f.text)
    if periods:
        if WEEK.search(text) and "week" not in periods:
            verdict.problems.append("compares weeks, but the figures are of billing cycles")
        if CYCLE.search(text) and "cycle" not in periods:
            verdict.problems.append("compares cycles or months, but the figures are of weeks")
    return verdict


def drop_sentences(text: str, bad: list[str]) -> str:
    """The answer without the sentences that quote an unbacked figure."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(s for s in sentences if not any(b in s for b in bad)).strip()
