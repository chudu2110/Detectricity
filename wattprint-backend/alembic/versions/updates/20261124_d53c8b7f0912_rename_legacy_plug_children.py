"""Give legacy plug aliases distinct names from their NILM device.

Revision ID: d53c8b7f0912
Revises: c2f7a91d4e60
"""

import re

import sqlalchemy as sa

from alembic import op

revision = "d53c8b7f0912"
down_revision = "c2f7a91d4e60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT s.id, s.name, d.name AS device_name, d.id AS device_id
            FROM public.tb_data_source s
            JOIN public.tb_device d ON d.id = s.device_id
            WHERE s.kind = 'plug' AND d.origin = 'nilm'
            ORDER BY d.id, s.created_at, s.id
        """
        )
    ).all()
    names_by_device: dict[object, set[str]] = {}
    for row in rows:
        names_by_device.setdefault(row.device_id, set()).add(row.name.casefold())
    for row in rows:
        if row.name.casefold() != row.device_name.casefold():
            continue
        base = re.sub(r"\d+$", "", row.device_name).strip()
        names = names_by_device[row.device_id]
        number = 2
        while f"{base}{number}".casefold() in names:
            number += 1
        name = f"{base}{number}"
        bind.execute(
            sa.text("UPDATE public.tb_data_source SET name=:name WHERE id=:id"),
            {"name": name, "id": row.id},
        )
        names.add(name.casefold())


def downgrade() -> None:
    # Names are user editable, so a downgrade must preserve them.
    pass
