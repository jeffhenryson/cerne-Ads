from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class CreativeOut(BaseModel):
    model_config = {"from_attributes": True}

    creative_id: str
    account_id: str
    ad_id: str | None
    name: str | None
    title: str | None
    body: str | None
    status: str | None
    thumbnail_url: str | None
    call_to_action_type: str | None
    object_type: str | None
    effective_instagram_media_id: str | None
    effective_object_story_id: str | None
    image_url: str | None
    video_id: str | None
    object_story_spec: dict | None
    asset_feed_spec: dict | None
    meta_created_time: datetime | None
    synced_at: datetime


class CreativeCreate(BaseModel):
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


class CreativeUpdate(BaseModel):
    name: str | None = None
    status: Literal["ACTIVE", "DELETED"] | None = None
