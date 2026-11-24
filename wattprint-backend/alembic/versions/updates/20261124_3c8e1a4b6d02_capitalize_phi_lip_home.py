"""Capitalize the requested home display name."""

import sqlalchemy as sa

from alembic import op

revision = "3c8e1a4b6d02"
down_revision = "2b7d0f3a5c91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("""
        UPDATE public.tb_home h SET name = 'Nhà của Phi Líp'
        FROM public.tb_meter m
        WHERE m.home_id = h.id AND m.serial = 'REFIT-H2'
          AND h.name IN ('REFIT House 2', 'Nhà của Philíp Nguyễn', 'nhà của Phi Líp')
    """)
    )


def downgrade() -> None:
    pass
