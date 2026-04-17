"""add retry_count and max_retries to sync_jobs

Revision ID: 002
Revises: 3705dca45203
Create Date: 2026-03-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "3705dca45203"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sync_jobs", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sync_jobs", sa.Column("max_retries", sa.Integer(), nullable=False, server_default="10"))


def downgrade() -> None:
    op.drop_column("sync_jobs", "max_retries")
    op.drop_column("sync_jobs", "retry_count")
