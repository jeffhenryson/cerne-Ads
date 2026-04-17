from datetime import datetime, date
from pydantic import BaseModel, computed_field


class SyncJobOut(BaseModel):
    model_config = {"from_attributes": True}

    job_id: str
    account_id: str
    job_type: str
    status: str
    entity_id: str | None
    date_from: date
    date_to: date
    chunk_size_days: int
    cursor_date: date | None
    total_days: int | None
    days_processed: int
    records_synced: int
    retry_count: int
    max_retries: int
    retry_after: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def progress_pct(self) -> float | None:
        if self.total_days and self.total_days > 0:
            return round(self.days_processed / self.total_days * 100, 1)
        return None
