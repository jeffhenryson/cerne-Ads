from datetime import datetime
from sqlalchemy import String, BigInteger, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    campaign_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("ad_accounts.account_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_status: Mapped[str] = mapped_column(String(50), nullable=False)
    configured_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    buying_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bid_strategy: Mapped[str | None] = mapped_column(String(100), nullable=True)
    daily_budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    lifetime_budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    budget_remaining: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    spend_cap: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_budget_schedule_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_adset_budget_sharing_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    special_ad_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pacing_type: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stop_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_created_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_updated_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["AdAccount"] = relationship("AdAccount", backref="campaigns")  # noqa: F821
