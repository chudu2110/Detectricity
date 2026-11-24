"""insight: a home's monthly saving goal (kWh or VND per billing cycle)

Revision ID: ff1700a88a75
Revises: 4d1e7b9c2a58
"""

import sqlalchemy as sa

from alembic import op

revision = "ff1700a88a75"
down_revision = "4d1e7b9c2a58"
branch_labels = None
depends_on = None

APP = "wattprint_app"


def upgrade() -> None:
    op.create_table(
        "tb_saving_goal",
        sa.Column("home_id", sa.Uuid, nullable=False),
        sa.Column("kind", sa.String(3), nullable=False),
        sa.Column("target", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("home_id", name="pk_tb_saving_goal"),
        sa.ForeignKeyConstraint(
            ["home_id"],
            ["public.tb_home.id"],
            name="fk_tb_saving_goal_home_id_tb_home",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("kind IN ('kwh','vnd')", name="kind"),
        sa.CheckConstraint("target > 0", name="target"),
        schema="public",
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_saving_goal TO {APP}")


def downgrade() -> None:
    op.drop_table("tb_saving_goal", schema="public")
