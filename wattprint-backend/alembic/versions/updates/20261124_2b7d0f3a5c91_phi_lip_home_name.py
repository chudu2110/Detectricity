"""Use the requested display name for REFIT House 2."""

import sqlalchemy as sa

from alembic import op

revision = "2b7d0f3a5c91"
down_revision = "1a6c9e2b4f80"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("""
        UPDATE public.tb_home h SET name = 'nhà của Phi Líp'
        FROM public.tb_meter m
        WHERE m.home_id = h.id AND m.serial = 'REFIT-H2'
          AND h.name IN ('REFIT House 2', 'Nhà của Philíp Nguyễn')
    """)
    )


def downgrade() -> None:
    # Preserve names edited by the household.
    pass
