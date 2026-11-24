"""Grant the application role access to user data sources.

Revision ID: 9b3e6f2a1c74
Revises: 8a4c1d6e2b91
"""

from alembic import op

revision = "9b3e6f2a1c74"
down_revision = "8a4c1d6e2b91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON "
        "public.tb_data_source, public.tb_source_observation TO wattprint_app"
    )


def downgrade() -> None:
    op.execute(
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON "
        "public.tb_data_source, public.tb_source_observation FROM wattprint_app"
    )
