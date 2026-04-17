from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class CampaignInsightRow(BaseModel):
    campaign_id: str
    campaign_name: str | None
    date_start: date
    date_stop: date
    impressions: int
    reach: int
    clicks: int
    spend: Decimal | None
    ctr: Decimal | None
    cpm: Decimal | None
    cpc: Decimal | None
    cpp: Decimal | None
    inline_link_clicks: int | None
    inline_post_engagement: int | None
    actions: list | None
    frequency: float | None = None
    inline_link_click_ctr: float | None = None
    social_spend: float | None = None
    cost_per_action_type: list | None = None
    video_play_actions: list | None = None
    video_30_sec_watched_actions: list | None = None
    video_p25_watched_actions: list | None = None
    video_p50_watched_actions: list | None = None
    video_p75_watched_actions: list | None = None
    video_p95_watched_actions: list | None = None
    video_p100_watched_actions: list | None = None
    video_avg_time_watched_actions: list | None = None
    outbound_clicks: list | None = None
    results: list | None = None
    cost_per_result: list | None = None
    quality_ranking: str | None = None
    engagement_rate_ranking: str | None = None
    conversion_rate_ranking: str | None = None
    objective: str | None = None
    buying_type: str | None = None
    attribution_setting: str | None = None


class CampaignInsightResponse(BaseModel):
    account_id: str
    granularity: str
    date_from: date | None
    date_to: date | None
    total: int
    data: list[CampaignInsightRow]


class AdSetInsightRow(BaseModel):
    adset_id: str
    adset_name: str | None
    campaign_id: str
    date_start: date
    date_stop: date
    impressions: int
    reach: int
    clicks: int
    spend: Decimal | None
    ctr: Decimal | None
    cpm: Decimal | None
    cpc: Decimal | None
    cpp: Decimal | None
    inline_link_clicks: int | None
    inline_post_engagement: int | None
    full_view_impressions: int | None
    full_view_reach: int | None
    actions: list | None
    frequency: float | None = None
    inline_link_click_ctr: float | None = None
    social_spend: float | None = None
    cost_per_action_type: list | None = None
    video_play_actions: list | None = None
    video_30_sec_watched_actions: list | None = None
    video_p25_watched_actions: list | None = None
    video_p50_watched_actions: list | None = None
    video_p75_watched_actions: list | None = None
    video_p95_watched_actions: list | None = None
    video_p100_watched_actions: list | None = None
    video_avg_time_watched_actions: list | None = None
    outbound_clicks: list | None = None
    results: list | None = None
    cost_per_result: list | None = None
    quality_ranking: str | None = None
    engagement_rate_ranking: str | None = None
    conversion_rate_ranking: str | None = None
    objective: str | None = None
    buying_type: str | None = None
    attribution_setting: str | None = None


class AdSetInsightResponse(BaseModel):
    account_id: str
    granularity: str
    date_from: date | None
    date_to: date | None
    total: int
    data: list[AdSetInsightRow]


class AdInsightRow(BaseModel):
    ad_id: str
    ad_name: str | None
    adset_id: str
    campaign_id: str
    date_start: date
    date_stop: date
    impressions: int
    reach: int
    clicks: int
    spend: Decimal | None
    ctr: Decimal | None
    cpm: Decimal | None
    cpc: Decimal | None
    cpp: Decimal | None
    inline_link_clicks: int | None
    inline_post_engagement: int | None
    cost_per_unique_click: Decimal | None
    actions: list | None
    frequency: float | None = None
    inline_link_click_ctr: float | None = None
    social_spend: float | None = None
    cost_per_action_type: list | None = None
    video_play_actions: list | None = None
    video_30_sec_watched_actions: list | None = None
    video_p25_watched_actions: list | None = None
    video_p50_watched_actions: list | None = None
    video_p75_watched_actions: list | None = None
    video_p95_watched_actions: list | None = None
    video_p100_watched_actions: list | None = None
    video_avg_time_watched_actions: list | None = None
    outbound_clicks: list | None = None
    cost_per_outbound_click: list | None = None
    cost_per_unique_outbound_click: list | None = None
    results: list | None = None
    cost_per_result: list | None = None
    quality_ranking: str | None = None
    engagement_rate_ranking: str | None = None
    conversion_rate_ranking: str | None = None
    objective: str | None = None
    buying_type: str | None = None
    attribution_setting: str | None = None


class AdInsightResponse(BaseModel):
    account_id: str
    granularity: str
    date_from: date | None
    date_to: date | None
    total: int
    data: list[AdInsightRow]


class PlacementInsightRow(BaseModel):
    ad_id: str
    date_start: date
    date_stop: date
    publisher_platform: str
    platform_position: str
    impressions: int
    reach: int
    clicks: int
    spend: Decimal | None
    ctr: Decimal | None
    cpm: Decimal | None
    cpc: Decimal | None
    frequency: float | None = None


class PlacementInsightResponse(BaseModel):
    account_id: str
    ad_id: str
    date_from: date | None
    date_to: date | None
    total: int
    data: list[PlacementInsightRow]
