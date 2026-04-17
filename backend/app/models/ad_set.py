from datetime import datetime
from sqlalchemy import String, BigInteger, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AdSet(Base):
    __tablename__ = "ad_sets"

    adset_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_accounts.account_id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("campaigns.campaign_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_status: Mapped[str] = mapped_column(String(50), nullable=False)
    configured_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    automatic_manual_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    billing_event: Mapped[str | None] = mapped_column(String(100), nullable=True)
    optimization_goal: Mapped[str | None] = mapped_column(String(100), nullable=True)
    destination_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    campaign_attribution: Mapped[str | None] = mapped_column(String(50), nullable=True)
    campaign_active_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bid_strategy: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bid_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    daily_budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    lifetime_budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    lifetime_imps: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    budget_remaining: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    daily_min_spend_target: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    daily_spend_cap: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    targeting: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_dynamic_creative: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_created_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_updated_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", backref="ad_sets")  # noqa: F821
