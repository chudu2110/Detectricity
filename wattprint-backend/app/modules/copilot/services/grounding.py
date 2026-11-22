"""Checks that every figure in an answer comes from the tools the answer was built on.

A figure is a number with a unit (đ, kWh, Wh, W, %, giờ), optionally per day or per month. Each
one must match a number of a tool result of the same kind, or the difference or the percent change
of two of them, within rounding; a figure per day must not be a tool's per-month number, and the
other way round. Bare numbers (dates, counts, "bậc 3") are not checked: too many are not data.
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
    ("hours", ("hours", "hour")),
)
# The period a tool field is per, read from its key (kwh_per_month, today, by_day...).
KEY_PERIODS = (("month", ("month",)), ("day", ("day", "daily")))
OTHER_PERIOD = {"day": "month", "month": "day"}
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
    "giờ": "hours",
    "tiếng": "hours",
    "h": "hours",
}
PERIODS = {"ngày": "day", "day": "day", "tháng": "month", "month": "month"}
SCALES = {"nghìn": 1e3, "ngàn": 1e3, "k": 1e3, "triệu": 1e6, "tr": 1e6}
FIGURE = re.compile(
    r"(?<![\w.,])(?P<num>\d+(?:[.,]\d+)*)\s*"
    r"(?P<scale>nghìn|ngàn|triệu|tr|k(?!wh|w\b))?\s*"
    r"(?P<unit>kwh|số điện|wh|kw(?!h)|watt|oát|w(?!h)|%|phần trăm|percent|vnđ|vnd|đồng|đ"
    r"|giờ|tiếng|h)(?!\w)"
    r"(?:\s*(?:/|mỗi|một|per|a|each)\s*(?P<per>ngày|tháng|day|month)(?!\w))?",
    re.IGNORECASE,
)
CITATION = re.compile(r"\[\d+(?:\s*,\s*\d+)*\]")
WEEK = re.compile(r"tuần (?:trước|này|qua)|last week|this week|previous week", re.IGNORECASE)
CYCLE = re.compile(
    r"(?:kỳ|tháng) (?:trước|này)|previous (?:cycle|month)|last month|this month", re.IGNORECASE
)
SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\n")
# "lúc 7h", "từ 0 giờ đến 5 giờ", "7 giờ tối": a time of day, not a duration
CLOCK_BEFORE = re.compile(r"(?:lúc|từ|đến|tới|at|from|to|until)\s*$", re.IGNORECASE)
CLOCK_AFTER = re.compile(r"\s*(?:sáng|trưa|chiều|tối|đêm|khuya|am|pm)(?!\w)", re.IGNORECASE)
REL_TOL = 0.015  # "khoảng 650.000 đ" for 647.018 đ
MAX_POOL = 200  # numbers paired for derived figures (pairs grow as n²)


@dataclass
class Figure:
    text: str
    value: float
    kind: str
    decimals: int
    per: str | None = None


@dataclass
class Number:
    value: float
    kind: str | None
    per: str | None


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
    text = CITATION.sub(" ", text)
    for m in FIGURE.finditer(text):
        value, decimals = parse_number(m["num"])
        unit = m["unit"].lower()
        if UNIT_KINDS[unit] == "hours" and (
            CLOCK_BEFORE.search(text[: m.start()]) or CLOCK_AFTER.match(text, m.end())
        ):
            continue
        if m["scale"]:
            value, decimals = value * SCALES[m["scale"].lower()], 0
        if unit == "kw":
            value *= 1000
        if unit == "wh":
            value /= 1000
        per = PERIODS[m["per"].lower()] if m["per"] else None
        out.append(Figure(m[0].strip(), value, UNIT_KINDS[unit], decimals, per))
    return out


def _from_key(path: tuple[str, ...], table: tuple) -> str | None:
    for key in reversed(path):
        k = key.lower()
        for name, marks in table:
            if any(mark in k for mark in marks):
                return name
    return None


def tool_numbers(data: Any, path: tuple[str, ...] = ()) -> list[Number]:
    """Every number in a tool result, with the kind and period its nearest telling key gives."""
    if isinstance(data, bool) or data is None:
        return []
    if isinstance(data, int | float):
        return [Number(float(data), _from_key(path, KEY_KINDS), _from_key(path, KEY_PERIODS))]
    if isinstance(data, dict):
        return [n for k, v in data.items() for n in tool_numbers(v, (*path, str(k)))]
    if isinstance(data, list):
        return [n for v in data for n in tool_numbers(v, path)]
    return []


def _close(shown: Figure, value: float) -> bool:
    half_step = 0.5 * 10 ** (-shown.decimals)
    return abs(shown.value - value) <= max(half_step, REL_TOL * abs(value))


def _candidates(numbers: list[Number], kind: str) -> list[Number]:
    """What a figure of `kind` may quote: a number of that kind (or of no known kind), the
    difference of two, and for a percent a ratio field or the percent change of two numbers."""
    same = [n for n in numbers if n.kind == kind]
    out = same + [n for n in numbers if n.kind is None]
    # ponytail: pairs only (difference, percent change); sums of 3+ figures are not derived
    pool = (same or [n for n in numbers if n.kind is None])[:MAX_POOL]
    out += [
        Number(abs(a.value - b.value), kind, a.per if a.per == b.per else None)
        for a, b in combinations(pool, 2)
    ]
    if kind == "ratio":
        out += [Number(n.value * 100, kind, None) for n in same if abs(n.value) <= 1]
        base = [n.value for n in numbers if n.kind != "ratio" and n.value][:MAX_POOL]
        for a, b in combinations(base, 2):
            out += [Number(abs(a - b) / abs(a) * 100, kind, None)]
            out += [Number(abs(a - b) / abs(b) * 100, kind, None)]
    return out


def _backed(f: Figure, candidates: list[Number]) -> bool:
    wrong = OTHER_PERIOD.get(f.per) if f.per else None
    return any(_close(f, n.value) and (wrong is None or n.per != wrong) for n in candidates)


def check(text: str, results: list[Any], periods: set[str] | None = None) -> Verdict:
    """The figures of `text` that no tool result in `results` backs. `periods`: the `period`
    arguments compare_periods was called with (an answer about last week from a comparison of
    billing cycles quotes the wrong period)."""
    numbers = [n for r in results for n in tool_numbers(r)]
    found = figures(text)
    verdict = Verdict(figures=len(found))
    for f in found:
        if not _backed(f, _candidates(numbers, f.kind)):
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


class Gate:
    """Lets a streamed answer through one whole sentence at a time, each checked first: from the
    first sentence with an unbacked figure on, nothing more is shown until the answer is fixed."""

    def __init__(self, verdict) -> None:
        self.verdict = verdict  # sentence -> Verdict, against the tool results so far
        self.buf = ""
        self.held = False

    def feed(self, chunk: str) -> str:
        self.buf += chunk
        if self.held:
            return ""
        out = ""
        while m := SENTENCE_END.search(self.buf):
            sentence = self.buf[: m.end()]
            if not self.verdict(sentence).ok:
                self.held = True
                return out
            out, self.buf = out + sentence, self.buf[m.end() :]
        return out

    def close(self) -> str:
        """The last sentence, if it ends the answer unchecked and passes."""
        if self.held or not self.buf.strip() or not self.verdict(self.buf).ok:
            self.held = self.held or bool(self.buf.strip())
            return ""
        out, self.buf = self.buf, ""
        return out
