from fastapi import APIRouter

from .alerts import router as alerts_router
from .cohort import router as cohort_router
from .savings import router as savings_router

router = APIRouter(prefix="/insights", tags=["insights"])
router.include_router(alerts_router)
router.include_router(cohort_router)
router.include_router(savings_router)

__all__ = ["router"]
