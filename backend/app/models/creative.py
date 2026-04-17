from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Creative(Base):
    __tablename__ = "creatives"

    creative_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_accounts.account_id", ondelete="CASCADE"), nullable=False, index=True
    )
    ad_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("ads.ad_id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    call_to_action_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    object_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    effective_instagram_media_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    effective_object_story_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    video_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    object_story_spec: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    asset_feed_spec: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    meta_created_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["AdAccount"] = relationship("AdAccount", backref="creatives")  # noqa: F821
