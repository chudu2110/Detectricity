"""Show REFIT House 2 raw and aggregate coverage for the current month."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.database import SessionLocal


async def main() -> None:
    now = datetime.now(UTC)
    since = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=7))
    async with SessionLocal() as db:
        series_id = await db.scalar(text("""
            SELECT s.series_id FROM public.tb_series s
            JOIN public.tb_meter m ON m.id = s.meter_id
            WHERE m.serial = 'REFIT-H2' AND s.kind = 'main' AND s.metric = 'power_w'
        """))
        if series_id is None:
            print("REFIT-H2 main series is missing")
            return
        for view, timestamp in (("tb_reading", "ts"), ("reading_1m", "bucket"),
                                ("reading_1h", "bucket"), ("reading_1d", "bucket")):
            rows = (await db.execute(text(f"""
                SELECT ({timestamp} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
                       count(*) AS samples
                FROM public.{view}
                WHERE series_id = :series_id AND {timestamp} >= :since
                GROUP BY 1 ORDER BY 1
            """), {"series_id": series_id, "since": since})).all()
            print(view, [(str(day), count) for day, count in rows])


if __name__ == "__main__":
    asyncio.run(main())
