"""Name existing NILM rows as child 1 without changing their series/history."""

from alembic import op

revision = "c2f7a91d4e60"
down_revision = "a7d4e9c2f681"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE public.tb_device d
        SET name = CASE d.device_type_code
            WHEN 'fridge_freezer' THEN 'Fridge-Freezer1'
            WHEN 'dishwasher' THEN 'Dishwasher1'
            WHEN 'washing_machine' THEN 'Washing-Machine1'
            WHEN 'tumble_dryer' THEN 'Tumble-Dryer1'
            ELSE replace(initcap(d.device_type_code), '_', '-') || '1'
        END
        WHERE d.origin = 'nilm' AND d.deleted_at IS NULL
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE public.tb_device d
        SET name = t.label_vi
        FROM public.cat_device_type t
        WHERE d.device_type_code = t.code AND d.origin = 'nilm'
          AND d.deleted_at IS NULL
    """)
