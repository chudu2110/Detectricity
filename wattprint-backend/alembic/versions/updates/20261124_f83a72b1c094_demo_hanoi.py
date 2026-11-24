"""Set Hanoi for the REFIT House 2 demo when its location is unset."""

import sqlalchemy as sa
from alembic import op

revision = "f83a72b1c094"
down_revision = "e71f8b2c4a90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text("""
        UPDATE public.tb_home h SET province_code = '01'
        FROM public.tb_meter m
        WHERE m.home_id = h.id AND m.serial = 'REFIT-H2' AND h.province_code IS NULL
    """))


def downgrade() -> None:
    # Preserve changes made by the household after the migration.
    pass
