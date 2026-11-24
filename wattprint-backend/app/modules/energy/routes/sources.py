import csv
import io
import re
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, time
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.dependencies import DbSession

from ..dependencies import CurrentHome

router = APIRouter()


class PlugSelection(BaseModel):
    device_id: uuid.UUID
    name: str = Field(default="", max_length=255)


class SourceName(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    room: str | None = Field(default=None, max_length=128)


class CsvInput(BaseModel):
    csv_text: str = Field(min_length=1, max_length=2_000_000)
    device_name: str | None = Field(default=None, max_length=255)


class MeterEntry(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    reading_kwh: Decimal = Field(ge=0)
    recorded_on: date


def _bad(message: str) -> HTTPException:
    return HTTPException(status_code=422, detail=message)


def _timestamp(value: str) -> datetime:
    value = value.strip()
    try:
        if re.fullmatch(r"\d{10}(?:\.\d+)?", value):
            return datetime.fromtimestamp(float(value), tz=UTC)
        if re.fullmatch(r"\d{13}", value):
            return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return (
            parsed.replace(tzinfo=UTC)
            if parsed.tzinfo is None
            else parsed.astimezone(UTC)
        )
    except (ValueError, OverflowError):
        raise _bad(f"Ngày/giờ không hợp lệ: {value[:40]}") from None


def _kwh(value: str) -> Decimal:
    try:
        number = Decimal(value.strip())
    except (InvalidOperation, AttributeError):
        raise _bad("Cột điện năng phải chứa số kWh") from None
    if not number.is_finite() or number < 0:
        raise _bad("Điện năng kWh phải là số không âm và hữu hạn")
    return number


def parse_csv(
    content: str, device_name: str | None = None
) -> dict[str, list[tuple[datetime, Decimal]]]:
    """Validate and normalize long-form or wide-form consumption CSV."""
    if len(content.encode("utf-8")) > 2_000_000:
        raise _bad("CSV vượt quá giới hạn 2 MB")
    try:
        reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff"), newline=""))
        fields = reader.fieldnames or []
        normalized = {f.strip().lower(): f for f in fields if f}
        time_key = normalized.get("timestamp") or normalized.get("date")
        if not time_key:
            raise _bad("CSV phải có cột timestamp hoặc date")
        device_key = (
            normalized.get("device")
            or normalized.get("device_name")
            or normalized.get("appliance")
        )
        generic = next(
            (
                normalized[k]
                for k in ("energy_kwh", "consumption_kwh", "kwh", "energy_consumed_kwh")
                if k in normalized
            ),
            None,
        )
        wide = [f for f in fields if f and f.lower().endswith("_kwh") and f != generic]
        if not generic and not wide:
            raise _bad("CSV phải có cột điện năng tiêu thụ kWh")
        if generic and wide:
            raise _bad("CSV chỉ nên dùng một cột kWh chung hoặc các cột thiết bị _kwh")
        result: dict[str, list[tuple[datetime, Decimal]]] = defaultdict(list)
        count = 0
        for row in reader:
            count += 1
            if count > 10_000:
                raise _bad("CSV tối đa 10.000 dòng")
            if None in row:
                raise _bad(f"Dòng {count + 1} thừa cột")
            ts = _timestamp(row.get(time_key) or "")
            if generic:
                name = (row.get(device_key) or "").strip() if device_key else ""
                name = name or (device_name or "").strip()
                if not name:
                    name = "__needs_device__"
                result[name].append((ts, _kwh(row.get(generic) or "")))
            else:
                for column in wide:
                    value = (row.get(column) or "").strip()
                    if value:
                        result[column[:-4].replace("_", " ").strip()].append(
                            (ts, _kwh(value))
                        )
        if not count or not result:
            raise _bad("CSV không có dòng dữ liệu")
        return dict(result)
    except (csv.Error, UnicodeError):
        raise _bad("Không đọc được CSV") from None


def _preview(content: str, device_name: str | None = None) -> dict:
    parsed = parse_csv(content, device_name)
    return {
        "devices": [name for name in parsed if name != "__needs_device__"],
        "needs_device_name": "__needs_device__" in parsed,
        "rows": sum(map(len, parsed.values())),
    }


@router.get("/sources", summary="User-added data sources for the current home")
async def list_sources(home_id: CurrentHome, db: DbSession) -> list[dict]:
    rows = await db.execute(
        text(
            """
        SELECT s.id, s.kind, s.name, s.room, s.device_id, s.created_at,
               (SELECT o.kwh FROM public.tb_source_observation o
                WHERE o.source_id=s.id ORDER BY o.recorded_at DESC LIMIT 1) AS latest_kwh,
               (SELECT o.recorded_at FROM public.tb_source_observation o
                WHERE o.source_id=s.id ORDER BY o.recorded_at DESC LIMIT 1) AS latest_at,
               (SELECT count(*) FROM public.tb_source_observation o
                WHERE o.source_id=s.id) AS readings,
               (SELECT CASE WHEN s.kind IN ('csv','plug') THEN sum(o.kwh)
                            WHEN s.kind='meter' AND count(*) > 1 THEN max(o.kwh)-min(o.kwh)
                            ELSE NULL END
                FROM public.tb_source_observation o WHERE o.source_id=s.id) AS consumed_kwh
        FROM public.tb_data_source s WHERE s.home_id=:home ORDER BY s.created_at DESC
    """
        ),
        {"home": home_id},
    )
    return [dict(row._mapping) for row in rows]


@router.get(
    "/sources/plugs/discover",
    summary="Smart plugs simulated from the REFIT demo dataset",
)
async def discover_plugs(home_id: CurrentHome, db: DbSession) -> list[dict]:
    rows = await db.execute(
        text(
            """
        SELECT d.id, d.name, d.room,
               (SELECT count(*) FROM public.tb_data_source x
                WHERE x.home_id=:home AND x.kind='plug' AND x.device_id=d.id
               ) AS plug_count
        FROM public.tb_device d
        WHERE d.home_id=:home AND d.deleted_at IS NULL AND d.origin='nilm'
        ORDER BY d.name, d.id
    """
        ),
        {"home": home_id},
    )
    found = list(rows)
    return [
        {
            "device_id": row.id,
            "plug_name": f"Plug {row.plug_count + 1}",
            "device_name": row.name,
            "assigned_name": None,
            "room": row.room,
            "online": i % 3 != 2,
            "simulated": True,
        }
        for i, row in enumerate(found)
    ]


@router.post("/sources/plugs", status_code=201)
async def add_plug(body: PlugSelection, home_id: CurrentHome, db: DbSession) -> dict:
    device = (
        await db.execute(
            text(
                """
        SELECT d.name, d.device_type_code FROM public.tb_device d
        WHERE d.home_id=:home AND d.id=:device AND d.deleted_at IS NULL
        LIMIT 1
    """
            ),
            {"home": home_id, "device": body.device_id},
        )
    ).one_or_none()
    if device is None:
        raise HTTPException(404, "Smart plug demo không tồn tại trong nhà này")
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
        {"key": f"plug-name:{home_id}:{body.device_id}"},
    )
    name = body.name.strip()
    if not name:
        base = re.sub(r"\d+$", "", device.name).strip()
        existing_names = (
            (
                await db.execute(
                    text(
                        """
                SELECT name FROM public.tb_data_source
                WHERE home_id=:home AND kind='plug' AND device_id=:device
            """
                    ),
                    {"home": home_id, "device": body.device_id},
                )
            )
            .scalars()
            .all()
        )
        numbers = [
            int(match.group(1))
            for value in [device.name, *existing_names]
            if (match := re.fullmatch(re.escape(base) + r"(\d+)", value, re.I))
        ]
        name = f"{base}{max(numbers, default=0) + 1}"
    source_id = await db.scalar(
        text(
            """
        INSERT INTO public.tb_data_source(home_id,kind,name,room,device_id)
        VALUES (:home,'plug',:name,(SELECT room FROM public.tb_device WHERE id=:device),:device) RETURNING id
    """
        ),
        {"home": home_id, "name": name, "device": body.device_id},
    )
    await db.commit()
    return {"id": source_id, "name": name, "kind": "plug"}


@router.patch("/sources/{source_id}")
async def rename_source(
    source_id: uuid.UUID, body: SourceName, home_id: CurrentHome, db: DbSession
) -> dict:
    name = body.name.strip()
    if not name:
        raise _bad("Tên thiết bị không được để trống")
    row = (
        await db.execute(
            text(
                """
            UPDATE public.tb_data_source SET name=:name, room=:room
            WHERE id=:id AND home_id=:home AND kind='plug'
            RETURNING id, name, room
        """
            ),
            {"id": source_id, "home": home_id, "name": name, "room": body.room.strip() if body.room and body.room.strip() else None},
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404, "Plug không tồn tại trong nhà này")
    await db.commit()
    return {"id": row.id, "name": row.name, "room": row.room}


@router.post("/sources/csv/preview")
async def preview_csv(body: CsvInput, home_id: CurrentHome) -> dict:
    return _preview(body.csv_text, body.device_name)


@router.post("/sources/csv/import", status_code=201)
async def import_csv(body: CsvInput, home_id: CurrentHome, db: DbSession) -> dict:
    parsed = parse_csv(body.csv_text, body.device_name)
    if "__needs_device__" in parsed:
        raise _bad("Hãy nhập tên thiết bị cho file CSV này")
    source_ids = []
    for name, readings in parsed.items():
        if len(name) > 255:
            raise _bad("Tên thiết bị trong CSV quá dài")
        source_id = await db.scalar(
            text(
                """
            INSERT INTO public.tb_data_source(home_id,kind,name)
            VALUES (:home,'csv',:name) RETURNING id
        """
            ),
            {"home": home_id, "name": name},
        )
        source_ids.append(source_id)
        insert = text(
            """
            INSERT INTO public.tb_source_observation(source_id,recorded_at,kwh)
            VALUES (:source,:ts,:kwh)
            ON CONFLICT (source_id,recorded_at) DO UPDATE SET kwh=excluded.kwh
        """
        )
        for start in range(0, len(readings), 500):
            batch = [
                {"source": source_id, "ts": ts, "kwh": kwh}
                for ts, kwh in readings[start : start + 500]
            ]
            await db.execute(insert, batch)
    await db.commit()
    return {"sources": len(source_ids), "rows": sum(len(r) for r in parsed.values())}


@router.post("/sources/meters", status_code=201)
async def record_meter(body: MeterEntry, home_id: CurrentHome, db: DbSession) -> dict:
    name = body.name.strip()
    if not name:
        raise _bad("Hãy nhập tên công tơ")
    source = await db.scalar(
        text(
            """
        SELECT id FROM public.tb_data_source
        WHERE home_id=:home AND kind='meter' AND lower(name)=lower(:name)
    """
        ),
        {"home": home_id, "name": name},
    )
    if source is None:
        source = await db.scalar(
            text(
                """
            INSERT INTO public.tb_data_source(home_id,kind,name)
            VALUES (:home,'meter',:name) RETURNING id
        """
            ),
            {"home": home_id, "name": name},
        )
        previous = None
    else:
        previous = (
            await db.execute(
                text(
                    """
            SELECT recorded_at, kwh FROM public.tb_source_observation
            WHERE source_id=:source ORDER BY recorded_at DESC LIMIT 1
        """
                ),
                {"source": source},
            )
        ).first()
    ts = datetime.combine(body.recorded_on, time.min, UTC)
    if previous and ts <= previous.recorded_at:
        raise _bad("Ngày ghi nhận phải sau lần ghi trước")
    if previous and body.reading_kwh < previous.kwh:
        raise _bad("Chỉ số hiện tại phải lớn hơn hoặc bằng lần ghi trước")
    await db.execute(
        text(
            """
        INSERT INTO public.tb_source_observation(source_id,recorded_at,kwh)
        VALUES (:source,:ts,:kwh)
    """
        ),
        {"source": source, "ts": ts, "kwh": body.reading_kwh},
    )
    await db.commit()
    return {
        "id": source,
        "name": name,
        "reading_kwh": body.reading_kwh,
        "usage_kwh": body.reading_kwh - previous.kwh if previous else None,
    }


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(
    source_id: uuid.UUID, home_id: CurrentHome, db: DbSession
) -> None:
    deleted = await db.scalar(
        text(
            "DELETE FROM public.tb_data_source WHERE id=:id AND home_id=:home RETURNING id"
        ),
        {"id": source_id, "home": home_id},
    )
    if deleted is None:
        raise HTTPException(404, "Nguồn dữ liệu không tồn tại")
    await db.commit()
