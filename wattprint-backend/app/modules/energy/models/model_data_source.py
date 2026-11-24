import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import Base


class DataSource(Base):
    """A source of readings the user added: a smart plug, a CSV upload or a meter."""

    __tablename__ = "tb_data_source"
    __table_args__ = (
        CheckConstraint("kind IN ('plug','csv','meter')", name="kind"),
        Index("ix_data_source_home_kind", "home_id", "kind"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    home_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.tb_home.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(255))
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("public.tb_device.id", ondelete="SET NULL")
    )
    room: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SourceObservation(Base):
    """A cumulative kWh reading of a data source at a time."""

    __tablename__ = "tb_source_observation"
    __table_args__ = (
        CheckConstraint("kwh >= 0", name="nonnegative_kwh"),
        {"schema": "public"},
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.tb_data_source.id", ondelete="CASCADE"), primary_key=True
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    kwh: Mapped[Decimal] = mapped_column(Numeric(16, 4))


class SourceDeviceAssignment(Base):
    """Which device a source measured, and when; at most one current row per source and device."""

    __tablename__ = "tb_source_device_assignment"
    __table_args__ = (
        CheckConstraint("active_to IS NULL OR active_to > active_from", name="validity_range"),
        Index(
            "uq_source_assignment_current_source",
            "source_id",
            unique=True,
            postgresql_where=text("active_to IS NULL"),
        ),
        Index(
            "uq_source_assignment_current_device",
            "device_id",
            unique=True,
            postgresql_where=text("active_to IS NULL"),
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    home_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("public.tb_home.id", ondelete="CASCADE"))
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.tb_data_source.id", ondelete="CASCADE")
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("public.tb_device.id", ondelete="CASCADE")
    )
    active_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    active_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
