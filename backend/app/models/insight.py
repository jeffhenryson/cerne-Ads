import uuid
from datetime import datetime, date
from sqlalchemy import String, BigInteger, Numeric, Date, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class CampaignInsight(Base):
    __tablename__ = "campaign_insights"
    __table_args__ = (
        UniqueConstraint("campaign_id", "date_start", "date_stop", name="uq_campaign_insight_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    campaign_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("campaigns.campaign_id", ondelete="CASCADE"), nullable=False, index=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date] = mapped_column(Date, nullable=False)
    impressions: Mapped[int] = mapped_column(BigInteger, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, default=0)
    frequency: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    clicks: Mapped[int] = mapped_column(BigInteger, default=0)
    spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    cpm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpc: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    inline_link_clicks: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inline_link_click_ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    inline_post_engagement: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    social_spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_action_type: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_play_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_30_sec_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p25_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p50_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p75_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p95_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p100_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_avg_time_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outbound_clicks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quality_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engagement_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    conversion_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)
    buying_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attribution_setting: Mapped[str | None] = mapped_column(String(100), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AdSetInsight(Base):
    __tablename__ = "adset_insights"
    __table_args__ = (
        UniqueConstraint("adset_id", "date_start", "date_stop", name="uq_adset_insight_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    campaign_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    adset_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_sets.adset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date] = mapped_column(Date, nullable=False)
    impressions: Mapped[int] = mapped_column(BigInteger, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, default=0)
    frequency: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    clicks: Mapped[int] = mapped_column(BigInteger, default=0)
    spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    cpm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpc: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    inline_link_clicks: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inline_link_click_ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    inline_post_engagement: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    social_spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    full_view_impressions: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    full_view_reach: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_action_type: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_play_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_30_sec_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p25_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p50_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p75_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p95_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p100_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_avg_time_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outbound_clicks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quality_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engagement_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    conversion_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)
    buying_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attribution_setting: Mapped[str | None] = mapped_column(String(100), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AdInsight(Base):
    __tablename__ = "ad_insights"
    __table_args__ = (
        UniqueConstraint("ad_id", "date_start", "date_stop", name="uq_ad_insight_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    campaign_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    adset_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ad_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ads.ad_id", ondelete="CASCADE"), nullable=False, index=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date] = mapped_column(Date, nullable=False)
    impressions: Mapped[int] = mapped_column(BigInteger, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, default=0)
    frequency: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    clicks: Mapped[int] = mapped_column(BigInteger, default=0)
    spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    cpm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpc: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    inline_link_clicks: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inline_link_click_ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    inline_post_engagement: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    social_spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    cost_per_unique_click: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cost_per_outbound_click: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_unique_outbound_click: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_action_type: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_play_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_30_sec_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p25_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p50_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p75_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p95_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_p100_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    video_avg_time_watched_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outbound_clicks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_per_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quality_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engagement_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    conversion_rate_ranking: Mapped[str | None] = mapped_column(String(50), nullable=True)
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)
    buying_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attribution_setting: Mapped[str | None] = mapped_column(String(100), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AdPlacementInsight(Base):
    """
    Insights por posicionamento (breakdown publisher_platform + platform_position).
    Nível: anúncio. Cada linha = 1 ad × 1 dia × 1 posicionamento.
    Permite visualizar como o criativo está sendo distribuído entre
    Facebook Feed, Instagram Reels, Stories, etc.
    """
    __tablename__ = "ad_placement_insights"
    __table_args__ = (
        UniqueConstraint(
            "ad_id", "date_start", "date_stop", "publisher_platform", "platform_position",
            name="uq_ad_placement_insight",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    campaign_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    adset_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ad_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ads.ad_id", ondelete="CASCADE"), nullable=False, index=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date] = mapped_column(Date, nullable=False)
    publisher_platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_position: Mapped[str] = mapped_column(String(80), nullable=False)
    impressions: Mapped[int] = mapped_column(BigInteger, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, default=0)
    clicks: Mapped[int] = mapped_column(BigInteger, default=0)
    spend: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    ctr: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    cpm: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cpc: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    frequency: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
