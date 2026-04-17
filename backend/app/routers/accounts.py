from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ad_account import AdAccount
from app.schemas.ad_account import (
    AppCredentials,
    AdAccountCreate,
    AdAccountOut,
    AdAccountUpdate,
)
from app.services.meta_client import (
    list_available_accounts,
    list_pages,
    get_account_info,
    InvalidTokenError,
    MetaAPIError,
)

router = APIRouter(prefix="/accounts", tags=["Accounts"])


# ─── Endpoint especial: listar contas disponíveis antes de cadastrar ─────────

@router.post(
    "/available",
    summary="Listar contas de anúncio acessíveis pelo token",
    description=(
        "Envia as credenciais do app Meta e retorna todas as contas de anúncio "
        "que o access_token pode acessar. Nenhum dado é salvo no banco."
    ),
)
def list_available(body: AppCredentials):
    try:
        accounts = list_available_accounts(body.access_token)
    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MetaAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "total": len(accounts),
        "accounts": [
            {
                "account_id": acc.get("id"),
                "name": acc.get("name"),
                "currency": acc.get("currency"),
                "timezone_name": acc.get("timezone_name"),
                "account_status": acc.get("account_status"),
                "business": acc.get("business", {}).get("name") if acc.get("business") else None,
            }
            for acc in accounts
        ],
    }


# ─── Páginas do Facebook vinculadas ao token da conta ────────────────────────

@router.get(
    "/{account_id}/pages",
    summary="Listar páginas do Facebook acessíveis pelo token da conta",
)
def get_account_pages(account_id: str, db: Session = Depends(get_db)):
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    try:
        pages = list_pages(account.access_token)
    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MetaAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "total": len(pages),
        "pages": [
            {"page_id": p.get("id"), "name": p.get("name"), "category": p.get("category")}
            for p in pages
        ],
    }


# ─── CRUD de contas cadastradas ───────────────────────────────────────────────

@router.post("", response_model=AdAccountOut, status_code=201)
def create_account(body: AdAccountCreate, db: Session = Depends(get_db)):
    if db.get(AdAccount, body.account_id):
        raise HTTPException(status_code=409, detail="Conta já cadastrada.")

    try:
        meta_info = get_account_info(body.access_token, body.account_id)
    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=f"Token inválido ou sem permissão ads_read: {e}")
    except MetaAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))

    account = AdAccount(
        account_id=body.account_id,
        app_id=body.app_id,
        app_secret=body.app_secret,
        access_token=body.access_token,
        name=meta_info.get("name"),
        currency=meta_info.get("currency"),
        timezone_name=meta_info.get("timezone_name"),
        account_status=meta_info.get("account_status"),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("", response_model=list[AdAccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(AdAccount).all()


@router.get("/{account_id}", response_model=AdAccountOut)
def get_account(account_id: str, db: Session = Depends(get_db)):
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    return account


@router.put("/{account_id}", response_model=AdAccountOut)
def update_account(account_id: str, body: AdAccountUpdate, db: Session = Depends(get_db)):
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    if body.app_id is not None:
        account.app_id = body.app_id
    if body.app_secret is not None:
        account.app_secret = body.app_secret
    if body.access_token is not None:
        try:
            meta_info = get_account_info(body.access_token, account_id)
        except InvalidTokenError as e:
            raise HTTPException(status_code=400, detail=f"Token inválido: {e}")
        except MetaAPIError as e:
            raise HTTPException(status_code=400, detail=str(e))
        account.access_token = body.access_token
        account.name = meta_info.get("name", account.name)
        account.currency = meta_info.get("currency", account.currency)
        account.timezone_name = meta_info.get("timezone_name", account.timezone_name)
        account.account_status = meta_info.get("account_status", account.account_status)

    account.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: str, db: Session = Depends(get_db)):
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    db.delete(account)
    db.commit()
