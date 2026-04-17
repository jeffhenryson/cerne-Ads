from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import SessionLocal
from app.models.sync_job import SyncJob
from app.routers import accounts, jobs, query, sync, write


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: recupera jobs travados pelo shutdown anterior (SIGKILL/crash)
    db = SessionLocal()
    try:
        stuck = db.query(SyncJob).filter(
            SyncJob.status.in_(["running", "pending"])
        ).all()
        for job in stuck:
            job.status = "failed"
            job.error_message = (
                "Servidor reiniciado antes de completar o job. "
                "Use POST /jobs/{id}/resume para retomar."
            )
        if stuck:
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title="Meta Ads Monolith",
    description="Protótipo incremental — Meta Ads API",
    version="0.8.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(jobs.router)
app.include_router(sync.router)
app.include_router(query.router)
app.include_router(write.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
