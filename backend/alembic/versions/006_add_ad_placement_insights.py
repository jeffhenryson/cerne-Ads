"""add ad_placement_insights table

Revision ID: 006
Revises: 005
Create Date: 2026-04-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ad_placement_insights",
        sa.Column("id",                 sa.String(36),    nullable=False),
        sa.Column("account_id",         sa.String(50),    nullable=False),
        sa.Column("campaign_id",        sa.String(50),    nullable=False),
        sa.Column("adset_id",           sa.String(50),    nullable=False),
        sa.Column("ad_id",              sa.String(50),    nullable=False),
        sa.Column("date_start",         sa.Date(),        nullable=False),
        sa.Column("date_stop",          sa.Date(),        nullable=False),
        sa.Column("publisher_platform", sa.String(50),    nullable=False),
        sa.Column("platform_position",  sa.String(80),    nullable=False),
        sa.Column("impressions",        sa.BigInteger(),  nullable=False, server_default="0"),
        sa.Column("reach",              sa.BigInteger(),  nullable=False, server_default="0"),
        sa.Column("clicks",             sa.BigInteger(),  nullable=False, server_default="0"),
        sa.Column("spend",              sa.Numeric(12, 2), nullable=True),
        sa.Column("ctr",                sa.Numeric(10, 4), nullable=True),
        sa.Column("cpm",                sa.Numeric(10, 2), nullable=True),
        sa.Column("cpc",                sa.Numeric(10, 2), nullable=True),
        sa.Column("frequency",          sa.Numeric(10, 4), nullable=True),
        sa.Column("synced_at",          sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ad_id"], ["ads.ad_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ad_id", "date_start", "date_stop", "publisher_platform", "platform_position",
            name="uq_ad_placement_insight",
        ),
    )
    op.create_index("ix_ad_placement_insights_account_id",   "ad_placement_insights", ["account_id"])
    op.create_index("ix_ad_placement_insights_campaign_id",  "ad_placement_insights", ["campaign_id"])
    op.create_index("ix_ad_placement_insights_adset_id",     "ad_placement_insights", ["adset_id"])
    op.create_index("ix_ad_placement_insights_ad_id",        "ad_placement_insights", ["ad_id"])


def downgrade() -> None:
    op.drop_index("ix_ad_placement_insights_ad_id",       "ad_placement_insights")
    op.drop_index("ix_ad_placement_insights_adset_id",    "ad_placement_insights")
    op.drop_index("ix_ad_placement_insights_campaign_id", "ad_placement_insights")
    op.drop_index("ix_ad_placement_insights_account_id",  "ad_placement_insights")
    op.drop_table("ad_placement_insights")
