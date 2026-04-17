from datetime import datetime
from sqlalchemy import String, BigInteger, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Ad(Base):
    __tablename__ = "ads"

    ad_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_accounts.account_id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("campaigns.campaign_id", ondelete="CASCADE"), nullable=False, index=True
    )
    adset_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_sets.adset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_status: Mapped[str] = mapped_column(String(50), nullable=False)
    configured_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    creative_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engagement_audience: Mapped[bool | None] = mapped_column(nullable=True)
    ad_active_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bid_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    conversion_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ad_schedule_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ad_schedule_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_created_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_updated_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    ad_set: Mapped["AdSet"] = relationship("AdSet", backref="ads")  # noqa: F821
