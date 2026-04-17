"""add video_30_sec_watched_actions to insights

Revision ID: 004
Revises: 003
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaign_insights", sa.Column("video_30_sec_watched_actions", sa.JSON(), nullable=True))
    op.add_column("adset_insights",    sa.Column("video_30_sec_watched_actions", sa.JSON(), nullable=True))
    op.add_column("ad_insights",       sa.Column("video_30_sec_watched_actions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaign_insights", "video_30_sec_watched_actions")
    op.drop_column("adset_insights",    "video_30_sec_watched_actions")
    op.drop_column("ad_insights",       "video_30_sec_watched_actions")
