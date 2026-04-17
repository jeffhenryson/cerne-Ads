from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sync_job import SyncJob
from app.schemas.sync_job import SyncJobOut
from app.services.insight_worker import run_insight_job

router = APIRouter(prefix="/jobs", tags=["Jobs"])

_TERMINAL = {"completed", "failed", "cancelled"}


@router.get("", response_model=list[SyncJobOut])
def list_jobs(
    account_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(SyncJob)
    if account_id:
        q = q.filter(SyncJob.account_id == account_id)
    if status:
        q = q.filter(SyncJob.status == status)
    if job_type:
        q = q.filter(SyncJob.job_type == job_type)
    return q.order_by(SyncJob.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/{job_id}", response_model=SyncJobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(SyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    return job


@router.post("/{job_id}/resume")
def resume_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = db.get(SyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    if job.status != "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível retomar jobs com status 'failed'. Status atual: '{job.status}'.",
        )

    resumed_from = str(job.cursor_date or job.date_from)
    job.status = "pending"
    job.retry_count = 0
    job.error_message = None
    job.retry_after = None
    db.commit()

    background_tasks.add_task(run_insight_job, job_id)

    return {"job_id": job.job_id, "status": "running", "resumed_from": resumed_from}


@router.post("/{job_id}/cancel")
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(SyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    if job.status in _TERMINAL:
        raise HTTPException(
            status_code=400,
            detail=f"Job já está em estado terminal: '{job.status}'.",
        )

    job.status = "cancelled"
    db.commit()

    return {"job_id": job.job_id, "status": "cancelled"}
