"""Fill the two missing demo days with REFIT House 2's same weekdays one week earlier.

Only the main meter is copied. Existing readings win on conflict. The source label records
that these are replayed demo measurements, rather than observations made on Nov 21-22.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.database import SessionLocal, engine
from app.modules.energy.services.aggregates import backfill_aggregates
from app.modules.ops.api import ReadingRow, ingest_readings

ICT = timezone(timedelta(hours=7))
SOURCE_START = datetime(2026, 11, 14, tzinfo=ICT)
SOURCE_END = datetime(2026, 11, 16, tzinfo=ICT)
SHIFT = timedelta(days=7)


async def main() -> None:
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                text("""
            SELECT r.ts, r.value, r.quality
            FROM public.tb_reading r
            JOIN public.tb_series s ON s.series_id = r.series_id
            JOIN public.tb_meter m ON m.id = s.meter_id
            WHERE m.serial = 'REFIT-H2' AND s.kind = 'main'
              AND s.metric = 'power_w' AND r.ts >= :lo AND r.ts < :hi
            ORDER BY r.ts
        """),
                {"lo": SOURCE_START, "hi": SOURCE_END},
            )
        ).all()
    if not rows:
        raise SystemExit("No REFIT donor readings on Nov 14-15; no changes made")
    added = 0
    for start in range(0, len(rows), 5000):
        batch = [
            ReadingRow(r.ts + SHIFT, "Aggregate", float(r.value), int(r.quality))
            for r in rows[start : start + 5000]
        ]
        async with SessionLocal() as db, db.begin():
            result = await ingest_readings(db, "REFIT-H2", batch, "refit/demo-week-repeat")
            added += result.rows_new
    async with engine.execution_options(isolation_level="AUTOCOMMIT").connect() as conn:
        skipped = await backfill_aggregates(conn, SOURCE_START + SHIFT, SOURCE_END + SHIFT)
    print(
        f"REFIT donor rows: {len(rows)}, new demo readings: {added}, "
        f"skipped aggregate windows: {len(skipped)}"
    )


if __name__ == "__main__":
    asyncio.run(main())
