from datetime import datetime
from pydantic import BaseModel


class AppCredentials(BaseModel):
    """Usado em POST /accounts/available — lista contas sem salvar no DB."""
    app_id: str
    app_secret: str
    access_token: str


class AdAccountCreate(BaseModel):
    account_id: str  # ex: act_1174873874116143
    app_id: str
    app_secret: str
    access_token: str


class AdAccountUpdate(BaseModel):
    app_id: str | None = None
    app_secret: str | None = None
    access_token: str | None = None


class AdAccountOut(BaseModel):
    model_config = {"from_attributes": True}

    account_id: str
    name: str | None
    currency: str | None
    timezone_name: str | None
    account_status: int | None
    created_at: datetime
    updated_at: datetime
