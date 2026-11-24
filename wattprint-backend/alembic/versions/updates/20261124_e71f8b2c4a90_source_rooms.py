"""Store a separate room for each plug source and fill demo device rooms."""

import sqlalchemy as sa

from alembic import op

revision = "e71f8b2c4a90"
down_revision = "d53c8b7f0912"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tb_data_source", sa.Column("room", sa.String(128)), schema="public")
    bind = op.get_bind()
    bind.execute(
        sa.text("""
        UPDATE public.tb_device
        SET room = CASE mod(abs(hashtext(id::text)::bigint), 5)
            WHEN 0 THEN 'Phòng bếp'
            WHEN 1 THEN 'Phòng khách'
            WHEN 2 THEN 'Phòng ngủ'
            WHEN 3 THEN 'Phòng giặt'
            ELSE 'Ban công' END
        WHERE room IS NULL AND origin = 'nilm'
    """)
    )
    bind.execute(
        sa.text("""
        UPDATE public.tb_data_source s SET room = d.room
        FROM public.tb_device d WHERE s.device_id = d.id AND s.kind = 'plug' AND s.room IS NULL
    """)
    )


def downgrade() -> None:
    op.drop_column("tb_data_source", "room", schema="public")
