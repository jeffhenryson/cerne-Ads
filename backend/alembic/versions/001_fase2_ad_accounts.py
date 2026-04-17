"""fase2 ad_accounts

Revision ID: 001
Revises:
Create Date: 2026-03-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ad_accounts",
        sa.Column("account_id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("app_id", sa.String(100), nullable=False),
        sa.Column("app_secret", sa.String(255), nullable=False),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("timezone_name", sa.String(100), nullable=True),
        sa.Column("account_status", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("ad_accounts")
