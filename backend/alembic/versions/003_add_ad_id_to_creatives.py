"""add ad_id to creatives

Revision ID: 003
Revises: 002
Create Date: 2026-03-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("creatives", sa.Column("ad_id", sa.String(50), nullable=True))
    op.create_index("ix_creatives_ad_id", "creatives", ["ad_id"])
    op.create_foreign_key(
        "fk_creatives_ad_id",
        "creatives", "ads",
        ["ad_id"], ["ad_id"],
        ondelete="SET NULL",
    )
    # Popula ad_id para criativos já existentes no banco
    op.execute("""
        UPDATE creatives c
        SET ad_id = a.ad_id
        FROM ads a
        WHERE a.creative_id = c.creative_id
    """)


def downgrade() -> None:
    op.drop_constraint("fk_creatives_ad_id", "creatives", type_="foreignkey")
    op.drop_index("ix_creatives_ad_id", table_name="creatives")
    op.drop_column("creatives", "ad_id")
