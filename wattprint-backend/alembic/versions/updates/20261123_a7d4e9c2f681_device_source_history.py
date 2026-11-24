"""Preserve device/source assignments over time.

Revision ID: a7d4e9c2f681
Revises: 9b3e6f2a1c74
"""

import sqlalchemy as sa

from alembic import op

revision = "a7d4e9c2f681"
down_revision = "9b3e6f2a1c74"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tb_source_device_assignment",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column(
            "active_from",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("active_to", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["home_id"], ["public.tb_home.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_id"], ["public.tb_data_source.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["device_id"], ["public.tb_device.id"], ondelete="CASCADE"),
        sa.CheckConstraint("active_to IS NULL OR active_to > active_from", name="validity_range"),
        schema="public",
    )
    op.create_index(
        "uq_source_assignment_current_source",
        "tb_source_device_assignment",
        ["source_id"],
        unique=True,
        schema="public",
        postgresql_where=sa.text("active_to IS NULL"),
    )
    op.create_index(
        "uq_source_assignment_current_device",
        "tb_source_device_assignment",
        ["device_id"],
        unique=True,
        schema="public",
        postgresql_where=sa.text("active_to IS NULL"),
    )
    op.execute("""
        INSERT INTO public.tb_source_device_assignment(home_id, source_id, device_id, active_from)
        SELECT home_id, id, device_id, created_at
        FROM public.tb_data_source
        WHERE device_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON "
        "public.tb_source_device_assignment TO wattprint_app"
    )


def downgrade() -> None:
    op.execute(
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON "
        "public.tb_source_device_assignment FROM wattprint_app"
    )
    op.drop_index(
        "uq_source_assignment_current_device",
        table_name="tb_source_device_assignment",
        schema="public",
    )
    op.drop_index(
        "uq_source_assignment_current_source",
        table_name="tb_source_device_assignment",
        schema="public",
    )
    op.drop_table("tb_source_device_assignment", schema="public")
