"""Rename the existing REFIT House 2 demo home for its owner."""

import sqlalchemy as sa
from alembic import op

revision = "1a6c9e2b4f80"
down_revision = "f83a72b1c094"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text("""
        UPDATE public.tb_home h SET name = 'Nhà của Philíp Nguyễn'
        FROM public.tb_meter m
        WHERE m.home_id = h.id AND m.serial = 'REFIT-H2'
          AND h.name = 'REFIT House 2'
    """))


def downgrade() -> None:
    # Keep names edited by the household.
    pass
