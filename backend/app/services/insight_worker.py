import time
import logging
from datetime import datetime, date, timedelta, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import SessionLocal
from app.models.sync_job import SyncJob

logger = logging.getLogger(__name__)

RATE_LIMIT_SLEEP = 300  # 5 minutos


class RateLimitError(Exception):
    pass


def run_insight_job(job_id: str) -> None:
    """
    Worker principal executado via BackgroundTasks.
    Cria sua própria sessão DB — não usa a sessão do request.
    """
    db = SessionLocal()
    try:
        _execute_job(job_id, db)
    except Exception as e:
        logger.exception(f"Erro não tratado no job {job_id}: {e}")
        try:
            job = db.get(SyncJob, job_id)
            if job and job.status not in ("completed", "cancelled"):
                job.status = "failed"
                job.error_message = f"Erro inesperado: {e}"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _execute_job(job_id: str, db) -> None:
    job = db.get(SyncJob, job_id)
    if not job:
        logger.error(f"Job {job_id} não encontrado no DB.")
        return

    job.status = "running"
    db.commit()

    # Calcula total_days na primeira execução
    if job.total_days is None:
        job.total_days = (job.date_to - job.date_from).days + 1
        db.commit()

    # Retoma de onde parou (cursor_date) ou do início
    start: date = job.cursor_date or job.date_from
    end: date = job.date_to
    chunk_delta = timedelta(days=job.chunk_size_days)

    current = start
    while current <= end:
        # Verifica cancelamento a cada iteração (re-lê do DB)
        db.refresh(job)
        if job.status == "cancelled":
            logger.info(f"Job {job_id} cancelado.")
            return

        chunk_end = min(current + chunk_delta - timedelta(days=1), end)

        ok = _process_chunk_with_retry(job, db, current, chunk_end)
        if not ok:
            return  # job já marcado como failed dentro da função

        current = chunk_end + timedelta(days=1)

    job.status = "completed"
    db.commit()
    logger.info(f"Job {job_id} concluído. {job.records_synced} registros sincronizados.")


def _process_chunk_with_retry(job: SyncJob, db, date_from: date, date_to: date) -> bool:
    """
    Processa um chunk de dias com retry automático em caso de rate limit.
    Retorna True se sucesso, False se falhou definitivamente.
    """
    while True:
        try:
            records = _fetch_insights(job, db, date_from, date_to)
            _upsert_insights(job, db, records)

            days_in_chunk = (date_to - date_from).days + 1
            job.cursor_date = date_to
            job.days_processed = min(
                job.days_processed + days_in_chunk,
                job.total_days,
            )
            job.records_synced += len(records)
            db.commit()
            return True

        except RateLimitError:
            job.retry_count += 1
            job.retry_after = datetime.now(tz=timezone.utc) + timedelta(seconds=RATE_LIMIT_SLEEP)
            db.commit()

            if job.retry_count > job.max_retries:
                job.status = "failed"
                job.error_message = (
                    f"Rate limit atingido {job.retry_count} vezes "
                    f"(máximo: {job.max_retries}). "
                    f"Use POST /jobs/{job.job_id}/resume para continuar."
                )
                db.commit()
                logger.warning(f"Job {job.job_id} falhou por excesso de rate limits.")
                return False

            logger.info(
                f"Job {job.job_id}: rate limit — aguardando {RATE_LIMIT_SLEEP}s "
                f"(retry {job.retry_count}/{job.max_retries})"
            )
            time.sleep(RATE_LIMIT_SLEEP)

            # Verifica cancelamento após o sleep
            db.refresh(job)
            if job.status == "cancelled":
                return False

        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            db.commit()
            logger.error(f"Job {job.job_id} falhou: {e}")
            return False


def _get_all_entity_ids(job_type: str, account_id: str, db, filter_campaign_id: str | None = None) -> list[str]:
    """
    Retorna todos os IDs de entidades do banco para o job_type dado.
    Usado quando entity_id=None (sincronização de toda a conta).
    filter_campaign_id: quando fornecido, restringe adsets/ads à campanha informada.
    """
    from app.models.ad import Ad
    from app.models.ad_set import AdSet
    from app.models.campaign import Campaign

    if job_type == "insights_campaigns":
        return [
            r[0]
            for r in db.query(Campaign.campaign_id)
            .filter(Campaign.account_id == account_id)
            .all()
        ]
    elif job_type == "insights_adsets":
        q = db.query(AdSet.adset_id).filter(AdSet.account_id == account_id)
        if filter_campaign_id:
            q = q.filter(AdSet.campaign_id == filter_campaign_id)
        return [r[0] for r in q.all()]
    elif job_type in ("insights_ads", "insights_placements"):
        q = db.query(Ad.ad_id).filter(Ad.account_id == account_id)
        if filter_campaign_id:
            q = q.filter(Ad.campaign_id == filter_campaign_id)
        return [r[0] for r in q.all()]
    return []


def _fetch_insights(job: SyncJob, db, date_from: date, date_to: date) -> list[dict]:
    """
    Busca insights na Meta Graph API usando FacebookClient.
    - Se job.entity_id está definido: faz UMA chamada para aquela entidade específica.
    - Se job.entity_id é None: carrega todas as entidades do DB e itera individualmente.
      (Nunca usa act_xxx/insights pois retorna dados agregados sem campaign_id/adset_id/ad_id.)
    Raise RateLimitError se a API retornar erro 80004 ou 613.
    """
    import json
    from app.services.facebook_client import (
        FacebookClient,
        RateLimitError as FBRateLimit,
    )

    # ── Posicionamentos: campos e params diferentes dos outros job types ──
    if job.job_type == "insights_placements":
        fields = "campaign_id,adset_id,ad_id,impressions,reach,clicks,spend,ctr,cpm,cpc,frequency"
        params = {
            "fields": fields,
            "breakdowns": "publisher_platform,platform_position",
            "time_range": json.dumps({"since": str(date_from), "until": str(date_to)}),
            "time_increment": 1,
            "limit": 100,
        }
    else:
        _BASE_FIELDS = (
            "impressions,reach,frequency,clicks,spend,ctr,cpm,cpc,cpp,"
            "inline_link_clicks,inline_link_click_ctr,inline_post_engagement,"
            "social_spend,actions,cost_per_action_type,"
            "video_play_actions,video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,"
            "video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,"
            "video_avg_time_watched_actions,outbound_clicks,"
            "results,cost_per_result,"
            "quality_ranking,engagement_rate_ranking,conversion_rate_ranking,"
            "objective,buying_type,attribution_setting"
        )

        # IDs explícitos por nível — Meta não os inclui na resposta por padrão
        _ENTITY_ID_FIELDS = {
            "insights_campaigns": "campaign_id,",
            "insights_adsets": "campaign_id,adset_id,",
            "insights_ads": "campaign_id,adset_id,ad_id,",
        }

        _EXTRA_FIELDS = {
            "insights_adsets": ",full_view_impressions,full_view_reach",
            "insights_ads": ",cost_per_unique_click,cost_per_outbound_click,cost_per_unique_outbound_click",
        }

        fields = (
            _ENTITY_ID_FIELDS.get(job.job_type, "")
            + _BASE_FIELDS
            + _EXTRA_FIELDS.get(job.job_type, "")
        )
        params = {
            "fields": fields,
            "time_range": json.dumps({"since": str(date_from), "until": str(date_to)}),
            "time_increment": 1,
            "limit": 100,
        }

    client = FacebookClient(job.account_id, job.account.access_token)

    # Determina quais entidades buscar
    if job.entity_id:
        entity_ids = [job.entity_id]
    else:
        filter_campaign_id = None
        if job.params_json:
            try:
                filter_campaign_id = json.loads(job.params_json).get("campaign_id")
            except Exception:
                pass
        entity_ids = _get_all_entity_ids(job.job_type, job.account_id, db, filter_campaign_id)
        if not entity_ids:
            logger.warning(
                f"Job {job.job_id}: nenhuma entidade encontrada no DB para "
                f"{job.job_type} na conta {job.account_id}. "
                "Execute o sync estrutural primeiro."
            )
            return []

    try:
        records: list[dict] = []
        for entity_id in entity_ids:
            for page in client.paginate(f"{entity_id}/insights", params):
                records.extend(page)
        return records
    except FBRateLimit:
        raise RateLimitError()


def _upsert_insights(job: SyncJob, db, records: list[dict]) -> None:
    """
    Upsert em CampaignInsight / AdSetInsight / AdInsight conforme job_type.
    Regra: INSERT ... ON CONFLICT DO UPDATE WHERE meta existente < novo (via synced_at como proxy,
    pois insights não têm meta_updated_time — sempre sobrescreve para manter dados frescos).
    """
    import uuid
    from datetime import datetime, timezone
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.insight import AdInsight, AdPlacementInsight, AdSetInsight, CampaignInsight

    now = datetime.now(tz=timezone.utc)

    def _safe_float(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def _safe_int(val):
        if val is None:
            return None
        try:
            return int(val)
        except (ValueError, TypeError):
            return None

    if job.job_type == "insights_campaigns":
        model = CampaignInsight
        conflict_cols = ["campaign_id", "date_start", "date_stop"]

        def build_row(rec):
            return {
                "id": str(uuid.uuid4()),
                "account_id": rec.get("account_id", job.account_id),
                "campaign_id": rec.get("campaign_id") or job.entity_id,
                "date_start": rec["date_start"],
                "date_stop": rec["date_stop"],
                "impressions": _safe_int(rec.get("impressions")) or 0,
                "reach": _safe_int(rec.get("reach")) or 0,
                "frequency": _safe_float(rec.get("frequency")),
                "clicks": _safe_int(rec.get("clicks")) or 0,
                "spend": _safe_float(rec.get("spend")),
                "ctr": _safe_float(rec.get("ctr")),
                "cpm": _safe_float(rec.get("cpm")),
                "cpc": _safe_float(rec.get("cpc")),
                "cpp": _safe_float(rec.get("cpp")),
                "inline_link_clicks": _safe_int(rec.get("inline_link_clicks")),
                "inline_link_click_ctr": _safe_float(rec.get("inline_link_click_ctr")),
                "inline_post_engagement": _safe_int(rec.get("inline_post_engagement")),
                "social_spend": _safe_float(rec.get("social_spend")),
                "actions": rec.get("actions"),
                "cost_per_action_type": rec.get("cost_per_action_type"),
                "video_play_actions": rec.get("video_play_actions"),
                "video_30_sec_watched_actions": rec.get("video_30_sec_watched_actions"),
                "video_p25_watched_actions": rec.get("video_p25_watched_actions"),
                "video_p50_watched_actions": rec.get("video_p50_watched_actions"),
                "video_p75_watched_actions": rec.get("video_p75_watched_actions"),
                "video_p95_watched_actions": rec.get("video_p95_watched_actions"),
                "video_p100_watched_actions": rec.get("video_p100_watched_actions"),
                "video_avg_time_watched_actions": rec.get("video_avg_time_watched_actions"),
                "outbound_clicks": rec.get("outbound_clicks"),
                "results": rec.get("results"),
                "cost_per_result": rec.get("cost_per_result"),
                "quality_ranking": rec.get("quality_ranking"),
                "engagement_rate_ranking": rec.get("engagement_rate_ranking"),
                "conversion_rate_ranking": rec.get("conversion_rate_ranking"),
                "objective": rec.get("objective"),
                "buying_type": rec.get("buying_type"),
                "attribution_setting": rec.get("attribution_setting"),
                "synced_at": now,
            }

    elif job.job_type == "insights_adsets":
        model = AdSetInsight
        conflict_cols = ["adset_id", "date_start", "date_stop"]

        def build_row(rec):
            return {
                "id": str(uuid.uuid4()),
                "account_id": rec.get("account_id", job.account_id),
                "campaign_id": rec.get("campaign_id", ""),
                "adset_id": rec.get("adset_id") or job.entity_id,
                "date_start": rec["date_start"],
                "date_stop": rec["date_stop"],
                "impressions": _safe_int(rec.get("impressions")) or 0,
                "reach": _safe_int(rec.get("reach")) or 0,
                "frequency": _safe_float(rec.get("frequency")),
                "clicks": _safe_int(rec.get("clicks")) or 0,
                "spend": _safe_float(rec.get("spend")),
                "ctr": _safe_float(rec.get("ctr")),
                "cpm": _safe_float(rec.get("cpm")),
                "cpc": _safe_float(rec.get("cpc")),
                "cpp": _safe_float(rec.get("cpp")),
                "inline_link_clicks": _safe_int(rec.get("inline_link_clicks")),
                "inline_link_click_ctr": _safe_float(rec.get("inline_link_click_ctr")),
                "inline_post_engagement": _safe_int(rec.get("inline_post_engagement")),
                "social_spend": _safe_float(rec.get("social_spend")),
                "full_view_impressions": _safe_int(rec.get("full_view_impressions")),
                "full_view_reach": _safe_int(rec.get("full_view_reach")),
                "actions": rec.get("actions"),
                "cost_per_action_type": rec.get("cost_per_action_type"),
                "video_play_actions": rec.get("video_play_actions"),
                "video_30_sec_watched_actions": rec.get("video_30_sec_watched_actions"),
                "video_p25_watched_actions": rec.get("video_p25_watched_actions"),
                "video_p50_watched_actions": rec.get("video_p50_watched_actions"),
                "video_p75_watched_actions": rec.get("video_p75_watched_actions"),
                "video_p95_watched_actions": rec.get("video_p95_watched_actions"),
                "video_p100_watched_actions": rec.get("video_p100_watched_actions"),
                "video_avg_time_watched_actions": rec.get("video_avg_time_watched_actions"),
                "outbound_clicks": rec.get("outbound_clicks"),
                "results": rec.get("results"),
                "cost_per_result": rec.get("cost_per_result"),
                "quality_ranking": rec.get("quality_ranking"),
                "engagement_rate_ranking": rec.get("engagement_rate_ranking"),
                "conversion_rate_ranking": rec.get("conversion_rate_ranking"),
                "objective": rec.get("objective"),
                "buying_type": rec.get("buying_type"),
                "attribution_setting": rec.get("attribution_setting"),
                "synced_at": now,
            }

    elif job.job_type == "insights_ads":
        model = AdInsight
        conflict_cols = ["ad_id", "date_start", "date_stop"]

        def build_row(rec):
            return {
                "id": str(uuid.uuid4()),
                "account_id": rec.get("account_id", job.account_id),
                "campaign_id": rec.get("campaign_id", ""),
                "adset_id": rec.get("adset_id", ""),
                "ad_id": rec.get("ad_id") or job.entity_id,
                "date_start": rec["date_start"],
                "date_stop": rec["date_stop"],
                "impressions": _safe_int(rec.get("impressions")) or 0,
                "reach": _safe_int(rec.get("reach")) or 0,
                "frequency": _safe_float(rec.get("frequency")),
                "clicks": _safe_int(rec.get("clicks")) or 0,
                "spend": _safe_float(rec.get("spend")),
                "ctr": _safe_float(rec.get("ctr")),
                "cpm": _safe_float(rec.get("cpm")),
                "cpc": _safe_float(rec.get("cpc")),
                "cpp": _safe_float(rec.get("cpp")),
                "inline_link_clicks": _safe_int(rec.get("inline_link_clicks")),
                "inline_link_click_ctr": _safe_float(rec.get("inline_link_click_ctr")),
                "inline_post_engagement": _safe_int(rec.get("inline_post_engagement")),
                "social_spend": _safe_float(rec.get("social_spend")),
                "cost_per_unique_click": _safe_float(rec.get("cost_per_unique_click")),
                "cost_per_outbound_click": rec.get("cost_per_outbound_click"),
                "cost_per_unique_outbound_click": rec.get("cost_per_unique_outbound_click"),
                "actions": rec.get("actions"),
                "cost_per_action_type": rec.get("cost_per_action_type"),
                "video_play_actions": rec.get("video_play_actions"),
                "video_30_sec_watched_actions": rec.get("video_30_sec_watched_actions"),
                "video_p25_watched_actions": rec.get("video_p25_watched_actions"),
                "video_p50_watched_actions": rec.get("video_p50_watched_actions"),
                "video_p75_watched_actions": rec.get("video_p75_watched_actions"),
                "video_p95_watched_actions": rec.get("video_p95_watched_actions"),
                "video_p100_watched_actions": rec.get("video_p100_watched_actions"),
                "video_avg_time_watched_actions": rec.get("video_avg_time_watched_actions"),
                "outbound_clicks": rec.get("outbound_clicks"),
                "results": rec.get("results"),
                "cost_per_result": rec.get("cost_per_result"),
                "quality_ranking": rec.get("quality_ranking"),
                "engagement_rate_ranking": rec.get("engagement_rate_ranking"),
                "conversion_rate_ranking": rec.get("conversion_rate_ranking"),
                "objective": rec.get("objective"),
                "buying_type": rec.get("buying_type"),
                "attribution_setting": rec.get("attribution_setting"),
                "synced_at": now,
            }

    elif job.job_type == "insights_placements":
        model = AdPlacementInsight
        conflict_cols = ["ad_id", "date_start", "date_stop", "publisher_platform", "platform_position"]

        def build_row(rec):
            return {
                "id": str(uuid.uuid4()),
                "account_id": rec.get("account_id", job.account_id),
                "campaign_id": rec.get("campaign_id", ""),
                "adset_id": rec.get("adset_id", ""),
                "ad_id": rec.get("ad_id") or job.entity_id,
                "date_start": rec["date_start"],
                "date_stop": rec["date_stop"],
                "publisher_platform": rec.get("publisher_platform", ""),
                "platform_position": rec.get("platform_position", ""),
                "impressions": _safe_int(rec.get("impressions")) or 0,
                "reach": _safe_int(rec.get("reach")) or 0,
                "clicks": _safe_int(rec.get("clicks")) or 0,
                "spend": _safe_float(rec.get("spend")),
                "ctr": _safe_float(rec.get("ctr")),
                "cpm": _safe_float(rec.get("cpm")),
                "cpc": _safe_float(rec.get("cpc")),
                "frequency": _safe_float(rec.get("frequency")),
                "synced_at": now,
            }

    else:
        logger.warning(f"job_type desconhecido: {job.job_type} — pulando upsert.")
        return

    for rec in records:
        row = build_row(rec)
        stmt = pg_insert(model).values(row)
        update_cols = {k: stmt.excluded[k] for k in row if k != "id"}
        stmt = stmt.on_conflict_do_update(
            index_elements=conflict_cols,
            set_=update_cols,
        )
        db.execute(stmt)

    db.commit()


# ---------------------------------------------------------------------------
# Worker de Sync Estrutural (campaigns / adsets / ads / creatives / full)
# ---------------------------------------------------------------------------

def run_structural_job(job_id: str) -> None:
    """
    Worker para sync estrutural em background.
    Cria sua própria sessão DB — não usa a sessão do request.
    job_type deve ser um de: sync_campaigns, sync_adsets, sync_ads,
                              sync_creatives, sync_full
    """
    from app.models.ad_account import AdAccount
    from app.services.sync_service import (
        sync_campaigns, sync_adsets, sync_ads, sync_creatives,
    )

    db = SessionLocal()
    try:
        job = db.get(SyncJob, job_id)
        if not job:
            logger.error(f"Structural job {job_id} não encontrado.")
            return

        job.status = "running"
        db.commit()

        account = db.get(AdAccount, job.account_id)
        if not account:
            job.status = "failed"
            job.error_message = f"Conta {job.account_id} não encontrada."
            db.commit()
            return

        token = account.access_token
        total_synced = 0

        # date_from/date_to são None quando o job foi criado sem filtro de data
        # (date_from == date_to == date.today() significa "sem filtro")
        has_date_filter = job.date_from != job.date_to
        df = job.date_from if has_date_filter else None
        dt = job.date_to   if has_date_filter else None

        steps = {
            "sync_campaigns":  [("campaigns",  sync_campaigns)],
            "sync_adsets":     [("adsets",     sync_adsets)],
            "sync_ads":        [("ads",        sync_ads)],
            "sync_creatives":  [("creatives",  sync_creatives)],
            "sync_full":       [
                ("campaigns",  sync_campaigns),
                ("adsets",     sync_adsets),
                ("ads",        sync_ads),
                ("creatives",  sync_creatives),
            ],
        }.get(job.job_type, [])

        if not steps:
            job.status = "failed"
            job.error_message = f"Tipo de job desconhecido: {job.job_type}"
            db.commit()
            return

        for step_name, fn in steps:
            db.refresh(job)
            if job.status == "cancelled":
                logger.info(f"Structural job {job_id} cancelado.")
                return
            try:
                result = fn(job.account_id, token, db, date_from=df, date_to=dt)
                total_synced += result.get("synced", 0)
                job.records_synced = total_synced
                db.commit()
                logger.info(f"Structural job {job_id} — {step_name}: {result}")
            except Exception as e:
                job.status = "failed"
                job.error_message = f"Erro em {step_name}: {e}"
                db.commit()
                logger.error(f"Structural job {job_id} falhou em {step_name}: {e}")
                return

        job.status = "completed"
        db.commit()
        logger.info(f"Structural job {job_id} concluído. {total_synced} registros sincronizados.")

    except Exception as e:
        logger.exception(f"Erro não tratado no structural job {job_id}: {e}")

        try:
            job = db.get(SyncJob, job_id)
            if job and job.status not in ("completed", "cancelled"):
                job.status = "failed"
                job.error_message = f"Erro inesperado: {e}"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Worker de Bulk Status de Campanhas
# ---------------------------------------------------------------------------

def run_bulk_status_job(job_id: str) -> None:
    """Worker para bulk status update de campanhas. Executado via BackgroundTasks."""
    db = SessionLocal()
    try:
        _execute_bulk_status_job(job_id, db)
    except Exception as e:
        logger.exception(f"Erro não tratado no bulk job {job_id}: {e}")
        try:
            job = db.get(SyncJob, job_id)
            if job and job.status not in ("completed", "cancelled"):
                job.status = "failed"
                job.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _execute_bulk_status_job(job_id: str, db) -> None:
    import json
    from app.models.campaign import Campaign
    from app.services.facebook_client import FacebookClient, FacebookAPIError

    job = db.get(SyncJob, job_id)
    if not job:
        return

    job.status = "running"
    db.commit()

    params = json.loads(job.params_json)
    campaign_ids: list[str] = params["campaign_ids"]
    action: str = params["action"]

    account = job.account
    client = FacebookClient(account.account_id, account.access_token)

    errors: list[str] = []
    done = 0

    for cid in campaign_ids:
        db.refresh(job)
        if job.status == "cancelled":
            logger.info(f"Bulk job {job_id} cancelado.")
            return
        try:
            if action == "DELETE":
                client.delete_campaign(cid)
                camp = db.query(Campaign).filter_by(campaign_id=cid).first()
                if camp:
                    camp.status = "DELETED"
                    camp.effective_status = "DELETED"
            else:
                client.update_campaign_status(cid, action)
                camp = db.query(Campaign).filter_by(campaign_id=cid).first()
                if camp:
                    camp.status = action
            db.commit()
            done += 1
        except FacebookAPIError as e:
            errors.append(f"{cid}: {e}")
        except Exception as e:
            errors.append(f"{cid}: {e}")

        job.days_processed = done + len(errors)
        job.records_synced = done
        db.commit()
        time.sleep(0.3)  # respeita rate limit Meta API

    if errors and done == 0:
        job.status = "failed"
    else:
        job.status = "completed"
    if errors:
        job.error_message = "\n".join(errors[:50])
    db.commit()
    logger.info(f"Bulk job {job_id} concluído: {done} ok, {len(errors)} erros.")
