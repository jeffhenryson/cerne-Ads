"""
Serviço de sincronização de entidades Meta → PostgreSQL.
Cada função sync_* retorna {"synced": N, "created": N, "updated": N, "errors": N}.
Ordem obrigatória: Campaigns → AdSets → Ads → Creatives.
"""
import json
import logging
from datetime import datetime, date, timezone
from calendar import timegm

import sqlalchemy as sa
from sqlalchemy import or_, func as sa_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.ad_set import AdSet
from app.models.ad import Ad
from app.models.campaign import Campaign
from app.models.creative import Creative
from app.models.sync_job import SyncJob
from app.services.facebook_client import FacebookClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fields por entidade (exatamente os campos do checklist 6.2–6.5)
# ---------------------------------------------------------------------------

CAMPAIGN_FIELDS = (
    "id,name,objective,status,effective_status,configured_status,"
    "buying_type,bid_strategy,daily_budget,lifetime_budget,budget_remaining,"
    "spend_cap,is_budget_schedule_enabled,is_adset_budget_sharing_enabled,"
    "pacing_type,special_ad_category,start_time,stop_time,created_time,updated_time"
)

ADSET_FIELDS = (
    "id,name,campaign_id,status,effective_status,configured_status,"
    "automatic_manual_state,billing_event,optimization_goal,destination_type,"
    "campaign_attribution,campaign_active_time,bid_strategy,bid_amount,"
    "daily_budget,lifetime_budget,lifetime_imps,budget_remaining,"
    "daily_min_spend_target,daily_spend_cap,is_dynamic_creative,"
    "targeting,start_time,end_time,created_time,updated_time"
)

AD_FIELDS = (
    "id,name,campaign_id,adset_id,status,effective_status,configured_status,"
    "creative{id},engagement_audience,ad_active_time,bid_amount,"
    "conversion_domain,display_sequence,"
    "ad_schedule_start_time,ad_schedule_end_time,"
    "created_time,updated_time"
)

CREATIVE_FIELDS = (
    "id,name,title,status,thumbnail_url,body,call_to_action_type,"
    "object_type,object_story_spec,asset_feed_spec,"
    "effective_instagram_media_id,effective_object_story_id,"
    "image_url,video_id,created_time"
)

# ---------------------------------------------------------------------------
# Helpers de conversão
# ---------------------------------------------------------------------------

def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        # Meta retorna "+0000" sem dois-pontos em versões antigas
        if val.endswith("+0000"):
            return datetime.fromisoformat(val[:-5] + "+00:00")
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _build_filtering(date_from: date | None, date_to: date | None) -> str | None:
    """
    Constrói o parâmetro `filtering` da Meta API para filtrar por updated_time.
    Retorna None se nenhuma data for fornecida.
    Exemplo: [{"field":"updated_time","operator":"GREATER_THAN","value":1700000000}]
    """
    rules = []
    if date_from:
        ts = int(timegm(date_from.timetuple()))
        rules.append({"field": "updated_time", "operator": "GREATER_THAN", "value": ts})
    if date_to:
        # date_to inclusive → usa o fim do dia
        from datetime import timedelta
        end = date_to + timedelta(days=1)
        ts = int(timegm(end.timetuple()))
        rules.append({"field": "updated_time", "operator": "LESS_THAN", "value": ts})
    return json.dumps(rules) if rules else None


# ---------------------------------------------------------------------------
# Sync Campanhas
# ---------------------------------------------------------------------------

def sync_campaigns(
    account_id: str,
    access_token: str,
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    client = FacebookClient(account_id, access_token)
    now = datetime.now(tz=timezone.utc)
    errors = 0

    params: dict = {"fields": CAMPAIGN_FIELDS, "limit": 100}
    filtering = _build_filtering(date_from, date_to)
    if filtering:
        params["filtering"] = filtering

    all_records: list[dict] = []
    for page in client.paginate(f"{account_id}/campaigns", params):
        all_records.extend(page)

    existing_ids = {
        r[0]
        for r in db.query(Campaign.campaign_id)
        .filter(Campaign.account_id == account_id)
        .all()
    }

    for rec in all_records:
        try:
            row = {
                "campaign_id": rec["id"],
                "account_id": account_id,
                "name": rec["name"],
                "objective": rec.get("objective"),
                "status": rec.get("status", "UNKNOWN"),
                "effective_status": rec.get("effective_status", "UNKNOWN"),
                "configured_status": rec.get("configured_status"),
                "buying_type": rec.get("buying_type"),
                "bid_strategy": rec.get("bid_strategy"),
                "daily_budget": _safe_int(rec.get("daily_budget")),
                "lifetime_budget": _safe_int(rec.get("lifetime_budget")),
                "budget_remaining": _safe_int(rec.get("budget_remaining")),
                "spend_cap": _safe_int(rec.get("spend_cap")),
                "is_budget_schedule_enabled": rec.get("is_budget_schedule_enabled"),
                "is_adset_budget_sharing_enabled": rec.get("is_adset_budget_sharing_enabled"),
                "special_ad_category": rec.get("special_ad_category"),
                "pacing_type": rec.get("pacing_type"),
                "start_time": _parse_dt(rec.get("start_time")),
                "stop_time": _parse_dt(rec.get("stop_time")),
                "meta_created_time": _parse_dt(rec.get("created_time")),
                "meta_updated_time": _parse_dt(rec.get("updated_time")),
                "synced_at": now,
            }

            stmt = pg_insert(Campaign).values(row)
            update_cols = {k: stmt.excluded[k] for k in row if k != "campaign_id"}
            # Só atualiza se o registro existente é mais antigo que o incoming
            tbl_upd = Campaign.__table__.c.meta_updated_time
            exc_upd = stmt.excluded.meta_updated_time
            stmt = stmt.on_conflict_do_update(
                index_elements=["campaign_id"],
                set_=update_cols,
                where=or_(tbl_upd.is_(None), tbl_upd < exc_upd),
            )
            db.execute(stmt)
        except Exception:
            logger.exception(f"Erro ao fazer upsert da campanha {rec.get('id')}")
            errors += 1

    db.commit()
    synced = len(all_records) - errors
    created = sum(1 for r in all_records if r["id"] not in existing_ids) - errors
    created = max(created, 0)
    return {"synced": synced, "created": created, "updated": synced - created, "errors": errors}


# ---------------------------------------------------------------------------
# Sync Conjuntos de Anúncios
# ---------------------------------------------------------------------------

def sync_adsets(
    account_id: str,
    access_token: str,
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    client = FacebookClient(account_id, access_token)
    now = datetime.now(tz=timezone.utc)
    errors = 0

    params: dict = {"fields": ADSET_FIELDS, "limit": 100}
    filtering = _build_filtering(date_from, date_to)
    if filtering:
        params["filtering"] = filtering

    all_records: list[dict] = []
    for page in client.paginate(f"{account_id}/adsets", params):
        all_records.extend(page)

    existing_ids = {
        r[0]
        for r in db.query(AdSet.adset_id)
        .filter(AdSet.account_id == account_id)
        .all()
    }

    for rec in all_records:
        try:
            row = {
                "adset_id": rec["id"],
                "account_id": account_id,
                "campaign_id": rec["campaign_id"],
                "name": rec["name"],
                "status": rec.get("status", "UNKNOWN"),
                "effective_status": rec.get("effective_status", "UNKNOWN"),
                "configured_status": rec.get("configured_status"),
                "automatic_manual_state": rec.get("automatic_manual_state"),
                "billing_event": rec.get("billing_event"),
                "optimization_goal": rec.get("optimization_goal"),
                "destination_type": rec.get("destination_type"),
                "campaign_attribution": rec.get("campaign_attribution"),
                "campaign_active_time": rec.get("campaign_active_time"),
                "bid_strategy": rec.get("bid_strategy"),
                "bid_amount": _safe_int(rec.get("bid_amount")),
                "daily_budget": _safe_int(rec.get("daily_budget")),
                "lifetime_budget": _safe_int(rec.get("lifetime_budget")),
                "lifetime_imps": _safe_int(rec.get("lifetime_imps")),
                "budget_remaining": _safe_int(rec.get("budget_remaining")),
                "daily_min_spend_target": _safe_int(rec.get("daily_min_spend_target")),
                "daily_spend_cap": _safe_int(rec.get("daily_spend_cap")),
                "targeting": rec.get("targeting"),
                "is_dynamic_creative": rec.get("is_dynamic_creative"),
                "start_time": _parse_dt(rec.get("start_time")),
                "end_time": _parse_dt(rec.get("end_time")),
                "meta_created_time": _parse_dt(rec.get("created_time")),
                "meta_updated_time": _parse_dt(rec.get("updated_time")),
                "synced_at": now,
            }

            stmt = pg_insert(AdSet).values(row)
            update_cols = {k: stmt.excluded[k] for k in row if k != "adset_id"}
            tbl_upd = AdSet.__table__.c.meta_updated_time
            exc_upd = stmt.excluded.meta_updated_time
            stmt = stmt.on_conflict_do_update(
                index_elements=["adset_id"],
                set_=update_cols,
                where=or_(tbl_upd.is_(None), tbl_upd < exc_upd),
            )
            db.execute(stmt)
        except Exception:
            logger.exception(f"Erro ao fazer upsert do adset {rec.get('id')}")
            errors += 1

    db.commit()
    synced = len(all_records) - errors
    created = max(sum(1 for r in all_records if r["id"] not in existing_ids) - errors, 0)
    return {"synced": synced, "created": created, "updated": synced - created, "errors": errors}


# ---------------------------------------------------------------------------
# Sync Anúncios
# ---------------------------------------------------------------------------

def sync_ads(
    account_id: str,
    access_token: str,
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    client = FacebookClient(account_id, access_token)
    now = datetime.now(tz=timezone.utc)
    errors = 0

    params: dict = {"fields": AD_FIELDS, "limit": 100}
    filtering = _build_filtering(date_from, date_to)
    if filtering:
        params["filtering"] = filtering

    all_records: list[dict] = []
    for page in client.paginate(f"{account_id}/ads", params):
        all_records.extend(page)

    existing_ids = {
        r[0]
        for r in db.query(Ad.ad_id)
        .filter(Ad.account_id == account_id)
        .all()
    }

    for rec in all_records:
        try:
            # creative{id} vem como {"creative": {"id": "xxx"}}
            creative_id = (rec.get("creative") or {}).get("id")

            row = {
                "ad_id": rec["id"],
                "account_id": account_id,
                "campaign_id": rec["campaign_id"],
                "adset_id": rec["adset_id"],
                "name": rec["name"],
                "status": rec.get("status", "UNKNOWN"),
                "effective_status": rec.get("effective_status", "UNKNOWN"),
                "configured_status": rec.get("configured_status"),
                "creative_id": creative_id,
                "engagement_audience": rec.get("engagement_audience"),
                "ad_active_time": rec.get("ad_active_time"),
                "bid_amount": _safe_int(rec.get("bid_amount")),
                "conversion_domain": rec.get("conversion_domain"),
                "display_sequence": _safe_int(rec.get("display_sequence")),
                "ad_schedule_start_time": _parse_dt(rec.get("ad_schedule_start_time")),
                "ad_schedule_end_time": _parse_dt(rec.get("ad_schedule_end_time")),
                "meta_created_time": _parse_dt(rec.get("created_time")),
                "meta_updated_time": _parse_dt(rec.get("updated_time")),
                "synced_at": now,
            }

            stmt = pg_insert(Ad).values(row)
            update_cols = {k: stmt.excluded[k] for k in row if k != "ad_id"}
            tbl_upd = Ad.__table__.c.meta_updated_time
            exc_upd = stmt.excluded.meta_updated_time
            stmt = stmt.on_conflict_do_update(
                index_elements=["ad_id"],
                set_=update_cols,
                where=or_(tbl_upd.is_(None), tbl_upd < exc_upd),
            )
            db.execute(stmt)
        except Exception:
            logger.exception(f"Erro ao fazer upsert do ad {rec.get('id')}")
            errors += 1

    db.commit()
    synced = len(all_records) - errors
    created = max(sum(1 for r in all_records if r["id"] not in existing_ids) - errors, 0)
    return {"synced": synced, "created": created, "updated": synced - created, "errors": errors}


# ---------------------------------------------------------------------------
# Sync Criativos
# ---------------------------------------------------------------------------

def sync_creatives(
    account_id: str,
    access_token: str,
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    # Nota: a Meta API não suporta filtro por updated_time no endpoint /adcreatives
    # (code 100: "Filtering field 'updated_time' is not supported"). Os parâmetros
    # date_from/date_to são aceitos por assinatura mas ignorados aqui.
    client = FacebookClient(account_id, access_token)
    now = datetime.now(tz=timezone.utc)
    errors = 0

    params: dict = {"fields": CREATIVE_FIELDS, "limit": 100}

    all_records: list[dict] = []
    for page in client.paginate(f"{account_id}/adcreatives", params):
        all_records.extend(page)

    existing_ids = {
        r[0]
        for r in db.query(Creative.creative_id)
        .filter(Creative.account_id == account_id)
        .all()
    }

    for rec in all_records:
        try:
            row = {
                "creative_id": rec["id"],
                "account_id": account_id,
                "name": rec.get("name"),
                "title": rec.get("title"),
                "body": rec.get("body"),
                "status": rec.get("status"),
                "thumbnail_url": rec.get("thumbnail_url"),
                "call_to_action_type": rec.get("call_to_action_type"),
                "object_type": rec.get("object_type"),
                "effective_instagram_media_id": rec.get("effective_instagram_media_id"),
                "effective_object_story_id": rec.get("effective_object_story_id"),
                "image_url": rec.get("image_url"),
                "video_id": rec.get("video_id"),
                "object_story_spec": rec.get("object_story_spec"),
                "asset_feed_spec": rec.get("asset_feed_spec"),
                "meta_created_time": _parse_dt(rec.get("created_time")),
                "synced_at": now,
            }

            stmt = pg_insert(Creative).values(row)
            update_cols = {k: stmt.excluded[k] for k in row if k != "creative_id"}
            # Criativos não têm meta_updated_time → sempre atualiza no conflito
            stmt = stmt.on_conflict_do_update(
                index_elements=["creative_id"],
                set_=update_cols,
            )
            db.execute(stmt)
        except Exception:
            logger.exception(f"Erro ao fazer upsert do criativo {rec.get('id')}")
            errors += 1

    db.commit()

    # Vincula criativos aos anúncios usando creative_id presente na tabela ads
    db.execute(
        sa.text("""
            UPDATE creatives c
            SET ad_id = a.ad_id
            FROM ads a
            WHERE a.creative_id = c.creative_id
              AND c.account_id = :account_id
              AND c.ad_id IS DISTINCT FROM a.ad_id
        """),
        {"account_id": account_id},
    )
    db.commit()

    synced = len(all_records) - errors
    created = max(sum(1 for r in all_records if r["id"] not in existing_ids) - errors, 0)
    return {"synced": synced, "created": created, "updated": synced - created, "errors": errors}


def sync_single_creative(
    account_id: str,
    creative_id: str,
    access_token: str,
    db: Session,
) -> Creative:
    """Busca um criativo específico na Meta API e faz upsert no banco local."""
    client = FacebookClient(account_id, access_token)
    now = datetime.now(tz=timezone.utc)

    # created_time não é suportado ao buscar criativo por ID (só funciona em /adcreatives)
    fields_single = ",".join(f for f in CREATIVE_FIELDS.split(",") if f.strip() != "created_time")
    rec = client.get(creative_id, params={"fields": fields_single})

    row = {
        "creative_id": rec["id"],
        "account_id": account_id,
        "name": rec.get("name"),
        "title": rec.get("title"),
        "body": rec.get("body"),
        "status": rec.get("status"),
        "thumbnail_url": rec.get("thumbnail_url"),
        "call_to_action_type": rec.get("call_to_action_type"),
        "object_type": rec.get("object_type"),
        "effective_instagram_media_id": rec.get("effective_instagram_media_id"),
        "effective_object_story_id": rec.get("effective_object_story_id"),
        "image_url": rec.get("image_url"),
        "video_id": rec.get("video_id"),
        "object_story_spec": rec.get("object_story_spec"),
        "asset_feed_spec": rec.get("asset_feed_spec"),
        "meta_created_time": _parse_dt(rec.get("created_time")),
        "synced_at": now,
    }

    stmt = pg_insert(Creative).values(row)
    update_cols = {k: stmt.excluded[k] for k in row if k != "creative_id"}
    stmt = stmt.on_conflict_do_update(
        index_elements=["creative_id"],
        set_=update_cols,
    )
    db.execute(stmt)
    db.commit()

    return db.query(Creative).filter(Creative.creative_id == creative_id).first()


# ---------------------------------------------------------------------------
# Helpers para jobs de insights
# ---------------------------------------------------------------------------

def default_date_from(account_id: str, db: Session) -> date:
    """Retorna a start_time mais antiga das campanhas da conta, limitada a no máximo
    1 ano atrás de hoje. Ignora timestamps inválidos (epoch/zero)."""
    one_year_ago = date.today().replace(year=date.today().year - 1)
    result = (
        db.query(sa_func.min(Campaign.start_time))
        .filter(Campaign.account_id == account_id, Campaign.start_time >= one_year_ago)
        .scalar()
    )
    if result:
        return result.date() if hasattr(result, "date") else result
    return one_year_ago


def create_insight_job(
    account_id: str,
    job_type: str,
    date_from: date,
    date_to: date,
    chunk_size_days: int,
    entity_id: str | None,
    db: Session,
    filter_campaign_id: str | None = None,
) -> SyncJob:
    """Cria um SyncJob no DB e retorna a instância (sem disparar o worker).
    filter_campaign_id: quando entity_id=None, restringe adsets/ads à campanha informada.
    """
    import json as _json
    params_json = None
    if filter_campaign_id:
        params_json = _json.dumps({"campaign_id": filter_campaign_id})
    job = SyncJob(
        account_id=account_id,
        job_type=job_type,
        status="pending",
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
        chunk_size_days=chunk_size_days,
        params_json=params_json,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def create_structural_job(
    account_id: str,
    job_type: str,
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SyncJob:
    """
    Cria um SyncJob para sync estrutural em background.
    date_from/date_to filtram quais registros buscar na Meta API (por updated_time).
    Se omitidos, puxa todos os registros da conta (comportamento padrão).
    job_type: sync_campaigns | sync_adsets | sync_ads | sync_creatives | sync_full
    """
    today = date.today()
    job = SyncJob(
        account_id=account_id,
        job_type=job_type,
        status="pending",
        date_from=date_from or today,
        date_to=date_to or today,
        chunk_size_days=1,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
