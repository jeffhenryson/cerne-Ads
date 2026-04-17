"""
Endpoints de Sincronização — Fase 6.
POST /sync/{account_id}/full
POST /sync/{account_id}/campaigns
POST /sync/{account_id}/adsets
POST /sync/{account_id}/ads
POST /sync/{account_id}/creatives
POST /sync/{account_id}/insights/campaigns
POST /sync/{account_id}/insights/adsets
POST /sync/{account_id}/insights/ads
POST /sync/{account_id}/campaigns/bulk-status
"""
import json
from datetime import date, datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ad_account import AdAccount
from app.models.sync_job import SyncJob
from app.services.insight_worker import run_bulk_status_job, run_insight_job, run_structural_job
from app.services.sync_service import (
    create_insight_job,
    create_structural_job,
    default_date_from,
    sync_ads,
    sync_adsets,
    sync_campaigns,
    sync_creatives,
)

router = APIRouter(prefix="/sync", tags=["Sync"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_account_or_404(account_id: str, db: Session) -> AdAccount:
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Conta '{account_id}' não encontrada.")
    return account


def _insight_response(job, date_from: date, date_to: date, chunk_size_days: int) -> dict:
    total_days = (date_to - date_from).days + 1
    return {
        "job_id": job.job_id,
        "status": "pending",
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_days": total_days,
        "chunk_size_days": chunk_size_days,
        "message": f"Job iniciado. Use GET /jobs/{job.job_id} para acompanhar o progresso.",
    }


def _structural_response(job) -> dict:
    return {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "account_id": job.account_id,
        "status": "pending",
        "message": f"Job iniciado em background. Use GET /jobs/{job.job_id} para acompanhar.",
    }


# ---------------------------------------------------------------------------
# 6.1 Sync Completo (agora assíncrono)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/full", status_code=202)
def sync_full(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None, description="Filtrar por updated_time >= data (YYYY-MM-DD). Omitir para puxar tudo."),
    date_to:   Optional[date] = Query(None, description="Filtrar por updated_time <= data (YYYY-MM-DD). Omitir para puxar tudo."),
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    job = create_structural_job(account_id, "sync_full", db, date_from, date_to)
    background_tasks.add_task(run_structural_job, job.job_id)
    return _structural_response(job)


# ---------------------------------------------------------------------------
# 6.2 Sync Campanhas (assíncrono)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/campaigns", status_code=202)
def sync_campaigns_endpoint(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    job = create_structural_job(account_id, "sync_campaigns", db, date_from, date_to)
    background_tasks.add_task(run_structural_job, job.job_id)
    return _structural_response(job)


# ---------------------------------------------------------------------------
# 6.3 Sync Conjuntos de Anúncios (assíncrono)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/adsets", status_code=202)
def sync_adsets_endpoint(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    job = create_structural_job(account_id, "sync_adsets", db, date_from, date_to)
    background_tasks.add_task(run_structural_job, job.job_id)
    return _structural_response(job)


# ---------------------------------------------------------------------------
# 6.4 Sync Anúncios (assíncrono)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/ads", status_code=202)
def sync_ads_endpoint(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    job = create_structural_job(account_id, "sync_ads", db, date_from, date_to)
    background_tasks.add_task(run_structural_job, job.job_id)
    return _structural_response(job)


# ---------------------------------------------------------------------------
# 6.5 Sync Criativos (assíncrono)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/creatives", status_code=202)
def sync_creatives_endpoint(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    job = create_structural_job(account_id, "sync_creatives", db, date_from, date_to)
    background_tasks.add_task(run_structural_job, job.job_id)
    return _structural_response(job)


# ---------------------------------------------------------------------------
# 6.6 Sync Insights de Campanhas (via Job)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/insights/campaigns", status_code=202)
def sync_insights_campaigns(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    campaign_id: Optional[str] = Query(None),
    chunk_size_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _get_account_or_404(account_id, db)
    resolved_from = date_from or default_date_from(account_id, db)
    resolved_to = date_to or date.today()

    job = create_insight_job(
        account_id, "insights_campaigns", resolved_from, resolved_to,
        chunk_size_days, campaign_id, db,
    )
    background_tasks.add_task(run_insight_job, job.job_id)
    return _insight_response(job, resolved_from, resolved_to, chunk_size_days)


# ---------------------------------------------------------------------------
# 6.7 Sync Insights de Conjuntos (via Job)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/insights/adsets", status_code=202)
def sync_insights_adsets(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    adset_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    chunk_size_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _get_account_or_404(account_id, db)
    resolved_from = date_from or default_date_from(account_id, db)
    resolved_to = date_to or date.today()

    job = create_insight_job(
        account_id, "insights_adsets", resolved_from, resolved_to,
        chunk_size_days, adset_id, db,
        filter_campaign_id=campaign_id,
    )
    background_tasks.add_task(run_insight_job, job.job_id)
    return _insight_response(job, resolved_from, resolved_to, chunk_size_days)


# ---------------------------------------------------------------------------
# 6.8 Sync Insights de Anúncios (via Job)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/insights/ads", status_code=202)
def sync_insights_ads(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    ad_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    chunk_size_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _get_account_or_404(account_id, db)
    resolved_from = date_from or default_date_from(account_id, db)
    resolved_to = date_to or date.today()

    job = create_insight_job(
        account_id, "insights_ads", resolved_from, resolved_to,
        chunk_size_days, ad_id, db,
        filter_campaign_id=campaign_id,
    )
    background_tasks.add_task(run_insight_job, job.job_id)
    return _insight_response(job, resolved_from, resolved_to, chunk_size_days)


# ---------------------------------------------------------------------------
# 6.9 Sync Insights de Posicionamentos (via Job)
# ---------------------------------------------------------------------------

@router.post("/{account_id}/insights/placements", status_code=202)
def sync_insights_placements(
    account_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    ad_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    chunk_size_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """
    Sincroniza insights de posicionamento (breakdown publisher_platform + platform_position).
    Nível: anúncio. Cada linha = 1 ad × 1 dia × 1 posicionamento.
    Filtrar por ad_id para sincronizar apenas um anúncio específico.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _get_account_or_404(account_id, db)
    resolved_from = date_from or default_date_from(account_id, db)
    resolved_to = date_to or date.today()

    job = create_insight_job(
        account_id, "insights_placements", resolved_from, resolved_to,
        chunk_size_days, ad_id, db,
        filter_campaign_id=campaign_id,
    )
    background_tasks.add_task(run_insight_job, job.job_id)
    return _insight_response(job, resolved_from, resolved_to, chunk_size_days)


# ---------------------------------------------------------------------------
# Bulk Status de Campanhas (via Job)
# ---------------------------------------------------------------------------

class BulkStatusBody(BaseModel):
    campaign_ids: List[str]
    action: Literal["ACTIVE", "PAUSED", "DELETE"]


@router.post("/{account_id}/campaigns/bulk-status", status_code=202)
def bulk_status_campaigns(
    account_id: str,
    body: BulkStatusBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _get_account_or_404(account_id, db)
    if not body.campaign_ids:
        raise HTTPException(status_code=422, detail="campaign_ids não pode ser vazio.")

    today = date.today()
    job = SyncJob(
        account_id=account_id,
        job_type="bulk_status_campaigns",
        status="pending",
        date_from=today,
        date_to=today,
        total_days=len(body.campaign_ids),
        days_processed=0,
        params_json=json.dumps({"action": body.action, "campaign_ids": body.campaign_ids}),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_bulk_status_job, job.job_id)
    return {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "status": job.status,
        "total": len(body.campaign_ids),
        "message": f"Job de bulk status criado para {len(body.campaign_ids)} campanhas.",
    }
