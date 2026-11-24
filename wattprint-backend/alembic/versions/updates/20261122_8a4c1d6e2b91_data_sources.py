"""User supplied data sources and observations.

Revision ID: 8a4c1d6e2b91
Revises: 4d1e7b9c2a58
"""

import sqlalchemy as sa

from alembic import op

revision = "8a4c1d6e2b91"
down_revision = "4d1e7b9c2a58"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tb_data_source",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["home_id"], ["public.tb_home.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["device_id"], ["public.tb_device.id"], ondelete="SET NULL"),
        sa.CheckConstraint("kind IN ('plug','csv','meter')", name="kind"),
        schema="public",
    )
    op.create_index(
        "ix_data_source_home_kind", "tb_data_source", ["home_id", "kind"], schema="public"
    )
    op.create_table(
        "tb_source_observation",
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kwh", sa.Numeric(16, 4), nullable=False),
        sa.PrimaryKeyConstraint("source_id", "recorded_at"),
        sa.ForeignKeyConstraint(["source_id"], ["public.tb_data_source.id"], ondelete="CASCADE"),
        sa.CheckConstraint("kwh >= 0", name="nonnegative_kwh"),
        schema="public",
    )


def downgrade() -> None:
    op.drop_table("tb_source_observation", schema="public")
    op.drop_index("ix_data_source_home_kind", table_name="tb_data_source", schema="public")
    op.drop_table("tb_data_source", schema="public")
