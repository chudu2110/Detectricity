from datetime import UTC, datetime

from fastapi import APIRouter

from app.common.exceptions import NotFoundError, UnprocessableError
from app.dependencies import DbSession
from app.modules.energy.api import CurrentHome

from .. import services
from ..schemas import GoalIn, GoalRead, SimulateIn, SimulateRead

router = APIRouter()


@router.get("/goal", summary="The home's monthly goal against the running cycle (null: none)")
async def goal(home_id: CurrentHome, db: DbSession) -> GoalRead | None:
    try:
        progress = await services.goal_progress(db, home_id, datetime.now(UTC))
    except LookupError as e:
        raise UnprocessableError("The home has no tariff plan", code="tariff_missing") from e
    return GoalRead.model_validate(progress) if progress else None


@router.put("/goal", summary="Set the home's monthly goal in kWh or VND (any member)")
async def put_goal(body: GoalIn, home_id: CurrentHome, db: DbSession) -> GoalRead:
    await services.set_goal(db, home_id, body.kind, body.target)
    return await goal(home_id, db)


@router.delete("/goal", status_code=204, summary="Remove the home's monthly goal")
async def delete_goal(home_id: CurrentHome, db: DbSession) -> None:
    if not await services.clear_goal(db, home_id):
        raise NotFoundError("The home has no goal", code="goal_not_found")


@router.post("/simulate", summary="What using a device less, or replacing it, would save")
async def simulate(body: SimulateIn, home_id: CurrentHome, db: DbSession) -> SimulateRead:
    result = await services.simulate(
        db,
        home_id,
        body.device_id,
        datetime.now(UTC),
        body.hours_per_day_less,
        body.new_watts,
        body.price_vnd,
    )
    if result.get("error") == "no such device in this home":
        raise NotFoundError("No such device in this home", code="device_not_found")
    if "error" in result:
        raise UnprocessableError(
            "The device has no recognised runs in the last 30 days", code="device_runs_missing"
        )
    return SimulateRead.model_validate(result)
