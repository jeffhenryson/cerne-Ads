from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class AdBrief(BaseModel):
    model_config = {"from_attributes": True}

    ad_id: str
    name: str
    status: str
    effective_status: str


class AdSetBrief(BaseModel):
    model_config = {"from_attributes": True}

    adset_id: str
    name: str
    status: str
    effective_status: str
    ads: list[AdBrief] = []


class CampaignOut(BaseModel):
    model_config = {"from_attributes": True}

    campaign_id: str
    account_id: str
    name: str
    objective: str | None
    status: str
    effective_status: str
    configured_status: str | None
    buying_type: str | None
    bid_strategy: str | None
    daily_budget: int | None
    lifetime_budget: int | None
    budget_remaining: int | None
    spend_cap: int | None
    is_budget_schedule_enabled: bool | None
    is_adset_budget_sharing_enabled: bool | None
    special_ad_category: str | None
    pacing_type: list | None
    start_time: datetime | None
    stop_time: datetime | None
    meta_created_time: datetime | None
    meta_updated_time: datetime | None
    synced_at: datetime


class CampaignDetail(CampaignOut):
    adset_count: int
    ad_count: int
    adsets: list[AdSetBrief] = []


class CampaignCreate(BaseModel):
    name: str
    objective: str
    special_ad_categories: list[str] = []
    status: Literal["ACTIVE", "PAUSED"] = "PAUSED"
    daily_budget: int | None = None
    lifetime_budget: int | None = None
    bid_strategy: str | None = None
    buying_type: str = "AUCTION"
    spend_cap: int | None = None
    start_time: datetime | None = None
    stop_time: datetime | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    status: Literal["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"] | None = None
    daily_budget: int | None = None
    lifetime_budget: int | None = None
    bid_strategy: str | None = None
    spend_cap: int | None = None
    start_time: datetime | None = None
    stop_time: datetime | None = None
