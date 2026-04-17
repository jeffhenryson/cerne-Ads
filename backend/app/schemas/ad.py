from datetime import datetime
from typing import Literal
from pydantic import BaseModel, model_validator


class CreativeInlineCreate(BaseModel):
    """Dados para criação inline de um criativo junto com o anúncio."""
    name: str
    object_story_id: str | None = None
    object_story_spec: dict | None = None
    body: str | None = None
    title: str | None = None
    call_to_action_type: str | None = None
    image_url: str | None = None
    image_hash: str | None = None
    video_id: str | None = None
    url_tags: str | None = None
    authorization_category: str | None = None


class AdOut(BaseModel):
    model_config = {"from_attributes": True}

    ad_id: str
    account_id: str
    campaign_id: str
    adset_id: str
    name: str
    status: str
    effective_status: str
    configured_status: str | None
    creative_id: str | None
    engagement_audience: bool | None
    ad_active_time: str | None
    bid_amount: int | None
    conversion_domain: str | None
    display_sequence: int | None
    ad_schedule_start_time: datetime | None
    ad_schedule_end_time: datetime | None
    meta_created_time: datetime | None
    meta_updated_time: datetime | None
    synced_at: datetime


class AdCreate(BaseModel):
    name: str
    adset_id: str
    creative_id: str | None = None
    creative_data: CreativeInlineCreate | None = None
    status: Literal["ACTIVE", "PAUSED"] = "PAUSED"
    conversion_domain: str | None = None
    engagement_audience: bool | None = None
    ad_schedule_start_time: datetime | None = None
    ad_schedule_end_time: datetime | None = None

    @model_validator(mode="after")
    def check_creative(self) -> "AdCreate":
        if not self.creative_id and not self.creative_data:
            raise ValueError("Informe creative_id (criativo existente) ou creative_data (criativo inline).")
        return self


class AdUpdate(BaseModel):
    name: str | None = None
    status: Literal["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"] | None = None
    creative_id: str | None = None
    conversion_domain: str | None = None
    ad_schedule_start_time: datetime | None = None
    ad_schedule_end_time: datetime | None = None
