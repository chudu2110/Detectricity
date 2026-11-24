import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import Base


class SavingGoal(Base):
    """A home's monthly goal: the most kWh, or VND, a billing cycle should take."""

    __tablename__ = "tb_saving_goal"
    __table_args__ = (
        CheckConstraint("kind IN ('kwh','vnd')", name="kind"),
        CheckConstraint("target > 0", name="target"),
        {"schema": "public"},
    )

    home_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.tb_home.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(3))
    target: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
