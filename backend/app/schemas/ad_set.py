from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class AdSetOut(BaseModel):
    model_config = {"from_attributes": True}

    adset_id: str
    account_id: str
    campaign_id: str
    name: str
    status: str
    effective_status: str
    configured_status: str | None
    automatic_manual_state: str | None
    billing_event: str | None
    optimization_goal: str | None
    destination_type: str | None
    campaign_attribution: str | None
    campaign_active_time: str | None
    bid_strategy: str | None
    bid_amount: int | None
    daily_budget: int | None
    lifetime_budget: int | None
    lifetime_imps: int | None
    budget_remaining: int | None
    daily_min_spend_target: int | None
    daily_spend_cap: int | None
    targeting: dict | None
    is_dynamic_creative: bool | None
    start_time: datetime | None
    end_time: datetime | None
    meta_created_time: datetime | None
    meta_updated_time: datetime | None
    synced_at: datetime


class AdSetCreate(BaseModel):
    name: str
    campaign_id: str
    billing_event: str
    optimization_goal: str
    targeting: dict
    status: Literal["ACTIVE", "PAUSED"] = "PAUSED"
    daily_budget: int | None = None
    lifetime_budget: int | None = None
    end_time: datetime | None = None
    bid_strategy: str | None = None
    bid_amount: int | None = None
    destination_type: str | None = None
    start_time: datetime | None = None
    dsa_beneficiary: str | None = None
    dsa_payor: str | None = None
    # Objeto promovido — obrigatório em vários cenários:
    # destination_type=APP → {"application_id": "..."}
    # optimization_goal=OFFSITE_CONVERSIONS → {"pixel_id": "..."}
    # optimization_goal=PAGE_LIKES → {"page_id": "..."}
    promoted_object: dict | None = None


class AdSetUpdate(BaseModel):
    name: str | None = None
    status: Literal["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"] | None = None
    daily_budget: int | None = None
    lifetime_budget: int | None = None
    bid_amount: int | None = None
    targeting: dict | None = None
    end_time: datetime | None = None
    start_time: datetime | None = None
    dsa_beneficiary: str | None = None
    dsa_payor: str | None = None
