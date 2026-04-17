"""
Router de escrita — Fase 2.
Todos os endpoints POST / PATCH / DELETE que chamam a Meta API e atualizam o banco local.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ad_account import AdAccount
from app.models.ad import Ad
from app.models.ad_set import AdSet
from app.models.campaign import Campaign
from app.models.creative import Creative
from app.schemas.campaign import CampaignCreate, CampaignOut, CampaignUpdate
from app.schemas.ad_set import AdSetCreate, AdSetOut, AdSetUpdate
from app.schemas.ad import AdCreate, AdOut, AdUpdate
from app.schemas.creative import CreativeCreate, CreativeOut, CreativeUpdate
from app.services.facebook_client import FacebookClient, FacebookAPIError, RateLimitError
from app.services.sync_service import (
    CAMPAIGN_FIELDS,
    ADSET_FIELDS,
    AD_FIELDS,
    CREATIVE_FIELDS,
    _parse_dt,
    _safe_int,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Write"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_account_or_404(account_id: str, db: Session) -> AdAccount:
    account = db.get(AdAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    return account


def _facebook_error_to_http(exc: FacebookAPIError) -> HTTPException:
    code = exc.code
    if code == 190:
        return HTTPException(status_code=401, detail=str(exc))
    if code == 200:
        return HTTPException(status_code=403, detail=str(exc))
    if code in (613, 80004):
        return HTTPException(status_code=429, detail=str(exc))
    if code == 100:
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


# ---------------------------------------------------------------------------
# Campanhas
# ---------------------------------------------------------------------------

@router.post("/accounts/{account_id}/campaigns", response_model=CampaignOut, status_code=201, tags=["Write"])
def create_campaign(account_id: str, body: CampaignCreate, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)

    if body.daily_budget is not None and body.lifetime_budget is not None:
        raise HTTPException(status_code=400, detail="Informe daily_budget OU lifetime_budget, não ambos.")

    payload: dict[str, Any] = {
        "name": body.name,
        "objective": body.objective,
        "special_ad_categories": json.dumps(body.special_ad_categories),
        "status": body.status,
        "buying_type": body.buying_type,
    }
    if body.daily_budget is not None:
        payload["daily_budget"] = body.daily_budget
    if body.lifetime_budget is not None:
        payload["lifetime_budget"] = body.lifetime_budget
    if body.bid_strategy is not None:
        payload["bid_strategy"] = body.bid_strategy
    if body.spend_cap is not None:
        payload["spend_cap"] = body.spend_cap
    if body.start_time is not None:
        payload["start_time"] = body.start_time.isoformat()
    if body.stop_time is not None:
        payload["stop_time"] = body.stop_time.isoformat()

    client = FacebookClient(account_id, account.access_token)
    try:
        result = client.post(f"{account_id}/campaigns", payload)
        campaign_id = result["id"]
        rec = client.get(campaign_id, {"fields": CAMPAIGN_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
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
    stmt = stmt.on_conflict_do_update(index_elements=["campaign_id"], set_=update_cols)
    db.execute(stmt)
    db.commit()

    campaign = db.get(Campaign, rec["id"])
    return campaign


@router.patch("/accounts/{account_id}/campaigns/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    account_id: str,
    campaign_id: str,
    body: CampaignUpdate,
    db: Session = Depends(get_db),
):
    account = _get_account_or_404(account_id, db)
    campaign = db.get(Campaign, campaign_id)
    if not campaign or campaign.account_id != account_id:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")

    if body.daily_budget is not None and body.lifetime_budget is not None:
        raise HTTPException(status_code=400, detail="Informe daily_budget OU lifetime_budget, não ambos.")

    payload: dict[str, Any] = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.status is not None:
        payload["status"] = body.status
    if body.daily_budget is not None:
        payload["daily_budget"] = body.daily_budget
    if body.lifetime_budget is not None:
        payload["lifetime_budget"] = body.lifetime_budget
    if body.bid_strategy is not None:
        payload["bid_strategy"] = body.bid_strategy
    if body.spend_cap is not None:
        payload["spend_cap"] = body.spend_cap
    if body.start_time is not None:
        payload["start_time"] = body.start_time.isoformat()
    if body.stop_time is not None:
        payload["stop_time"] = body.stop_time.isoformat()

    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.post(campaign_id, payload)
        rec = client.get(campaign_id, {"fields": CAMPAIGN_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
    campaign.name = rec["name"]
    campaign.status = rec.get("status", campaign.status)
    campaign.effective_status = rec.get("effective_status", campaign.effective_status)
    campaign.configured_status = rec.get("configured_status", campaign.configured_status)
    campaign.bid_strategy = rec.get("bid_strategy", campaign.bid_strategy)
    campaign.daily_budget = _safe_int(rec.get("daily_budget"))
    campaign.lifetime_budget = _safe_int(rec.get("lifetime_budget"))
    campaign.budget_remaining = _safe_int(rec.get("budget_remaining"))
    campaign.spend_cap = _safe_int(rec.get("spend_cap"))
    campaign.start_time = _parse_dt(rec.get("start_time"))
    campaign.stop_time = _parse_dt(rec.get("stop_time"))
    campaign.meta_updated_time = _parse_dt(rec.get("updated_time"))
    campaign.synced_at = now
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/accounts/{account_id}/campaigns/{campaign_id}", status_code=204)
def delete_campaign(account_id: str, campaign_id: str, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)
    campaign = db.get(Campaign, campaign_id)
    if not campaign or campaign.account_id != account_id:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.delete(campaign_id)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    campaign.status = "DELETED"
    campaign.effective_status = "DELETED"
    campaign.synced_at = datetime.now(tz=timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# AdSets
# ---------------------------------------------------------------------------

@router.post("/accounts/{account_id}/adsets", response_model=AdSetOut, status_code=201)
def create_adset(account_id: str, body: AdSetCreate, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)

    campaign = db.get(Campaign, body.campaign_id)
    if not campaign or campaign.account_id != account_id:
        raise HTTPException(status_code=404, detail="Campanha não encontrada no banco local. Sincronize primeiro.")

    if body.lifetime_budget is not None and body.end_time is None:
        raise HTTPException(status_code=400, detail="end_time é obrigatório quando lifetime_budget é informado.")

    if body.bid_strategy in ("LOWEST_COST_WITH_BID_CAP", "COST_CAP") and body.bid_amount is None:
        raise HTTPException(
            status_code=400,
            detail=f"bid_amount é obrigatório quando bid_strategy={body.bid_strategy}.",
        )

    payload: dict[str, Any] = {
        "name": body.name,
        "campaign_id": body.campaign_id,
        "billing_event": body.billing_event,
        "optimization_goal": body.optimization_goal,
        "targeting": json.dumps(body.targeting),
        "status": body.status,
    }
    if body.daily_budget is not None:
        payload["daily_budget"] = body.daily_budget
    if body.lifetime_budget is not None:
        payload["lifetime_budget"] = body.lifetime_budget
    if body.end_time is not None:
        payload["end_time"] = body.end_time.isoformat()
    if body.bid_strategy is not None:
        payload["bid_strategy"] = body.bid_strategy
    if body.bid_amount is not None:
        payload["bid_amount"] = body.bid_amount
    if body.destination_type is not None:
        payload["destination_type"] = body.destination_type
    if body.start_time is not None:
        payload["start_time"] = body.start_time.isoformat()
    if body.dsa_beneficiary is not None:
        payload["dsa_beneficiary"] = body.dsa_beneficiary
    if body.dsa_payor is not None:
        payload["dsa_payor"] = body.dsa_payor
    if body.promoted_object is not None:
        payload["promoted_object"] = json.dumps(body.promoted_object)

    client = FacebookClient(account_id, account.access_token)
    try:
        result = client.post(f"{account_id}/adsets", payload)
        adset_id = result["id"]
        rec = client.get(adset_id, {"fields": ADSET_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
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
    stmt = stmt.on_conflict_do_update(index_elements=["adset_id"], set_=update_cols)
    db.execute(stmt)
    db.commit()

    adset = db.get(AdSet, rec["id"])
    return adset


@router.patch("/accounts/{account_id}/adsets/{adset_id}", response_model=AdSetOut)
def update_adset(
    account_id: str,
    adset_id: str,
    body: AdSetUpdate,
    db: Session = Depends(get_db),
):
    account = _get_account_or_404(account_id, db)
    adset = db.get(AdSet, adset_id)
    if not adset or adset.account_id != account_id:
        raise HTTPException(status_code=404, detail="Conjunto de anúncios não encontrado.")

    payload: dict[str, Any] = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.status is not None:
        payload["status"] = body.status
    if body.daily_budget is not None:
        payload["daily_budget"] = body.daily_budget
    if body.lifetime_budget is not None:
        payload["lifetime_budget"] = body.lifetime_budget
    if body.bid_amount is not None:
        payload["bid_amount"] = body.bid_amount
    if body.targeting is not None:
        payload["targeting"] = json.dumps(body.targeting)
    if body.end_time is not None:
        payload["end_time"] = body.end_time.isoformat()
    if body.start_time is not None:
        payload["start_time"] = body.start_time.isoformat()
    if body.dsa_beneficiary is not None:
        payload["dsa_beneficiary"] = body.dsa_beneficiary
    if body.dsa_payor is not None:
        payload["dsa_payor"] = body.dsa_payor

    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.post(adset_id, payload)
        rec = client.get(adset_id, {"fields": ADSET_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
    adset.name = rec["name"]
    adset.status = rec.get("status", adset.status)
    adset.effective_status = rec.get("effective_status", adset.effective_status)
    adset.configured_status = rec.get("configured_status", adset.configured_status)
    adset.bid_strategy = rec.get("bid_strategy", adset.bid_strategy)
    adset.bid_amount = _safe_int(rec.get("bid_amount"))
    adset.daily_budget = _safe_int(rec.get("daily_budget"))
    adset.lifetime_budget = _safe_int(rec.get("lifetime_budget"))
    adset.budget_remaining = _safe_int(rec.get("budget_remaining"))
    adset.targeting = rec.get("targeting", adset.targeting)
    adset.end_time = _parse_dt(rec.get("end_time"))
    adset.start_time = _parse_dt(rec.get("start_time"))
    adset.meta_updated_time = _parse_dt(rec.get("updated_time"))
    adset.synced_at = now
    db.commit()
    db.refresh(adset)
    return adset


@router.delete("/accounts/{account_id}/adsets/{adset_id}", status_code=204)
def delete_adset(account_id: str, adset_id: str, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)
    adset = db.get(AdSet, adset_id)
    if not adset or adset.account_id != account_id:
        raise HTTPException(status_code=404, detail="Conjunto de anúncios não encontrado.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.delete(adset_id)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    adset.status = "DELETED"
    adset.effective_status = "DELETED"
    adset.synced_at = datetime.now(tz=timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Ads
# ---------------------------------------------------------------------------

@router.post("/accounts/{account_id}/ads", response_model=AdOut, status_code=201)
def create_ad(account_id: str, body: AdCreate, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)

    adset = db.get(AdSet, body.adset_id)
    if not adset or adset.account_id != account_id:
        raise HTTPException(status_code=404, detail="Conjunto de anúncios não encontrado no banco local.")

    # ── Criativo inline: cria o criativo antes do anúncio ──
    creative_id_resolved = body.creative_id
    if body.creative_data is not None:
        cd = body.creative_data
        cr_payload: dict[str, Any] = {"name": cd.name}
        if cd.object_story_id is not None:
            cr_payload["object_story_id"] = cd.object_story_id
        if cd.object_story_spec is not None:
            cr_payload["object_story_spec"] = json.dumps(cd.object_story_spec)
        if cd.body is not None:
            cr_payload["body"] = cd.body
        if cd.title is not None:
            cr_payload["title"] = cd.title
        if cd.call_to_action_type is not None:
            cr_payload["call_to_action_type"] = cd.call_to_action_type
        if cd.image_url is not None:
            cr_payload["image_url"] = cd.image_url
        if cd.image_hash is not None:
            cr_payload["image_hash"] = cd.image_hash
        if cd.video_id is not None:
            cr_payload["video_id"] = cd.video_id
        if cd.url_tags is not None:
            cr_payload["url_tags"] = cd.url_tags
        if cd.authorization_category is not None:
            cr_payload["authorization_category"] = cd.authorization_category

        client_pre = FacebookClient(account_id, account.access_token)
        try:
            cr_result = client_pre.post(f"{account_id}/adcreatives", cr_payload)
            creative_id_resolved = cr_result["id"]
            cr_rec = client_pre.get(creative_id_resolved, {"fields": CREATIVE_FIELDS})
        except RateLimitError as e:
            raise HTTPException(status_code=429, detail=str(e))
        except FacebookAPIError as e:
            raise _facebook_error_to_http(e)

        # Persiste o criativo no banco
        now_cr = datetime.now(tz=timezone.utc)
        cr_row = {
            "creative_id": cr_rec["id"],
            "account_id": account_id,
            "ad_id": None,
            "name": cr_rec.get("name"),
            "title": cr_rec.get("title"),
            "body": cr_rec.get("body"),
            "status": cr_rec.get("status"),
            "thumbnail_url": cr_rec.get("thumbnail_url"),
            "call_to_action_type": cr_rec.get("call_to_action_type"),
            "object_type": cr_rec.get("object_type"),
            "effective_instagram_media_id": cr_rec.get("effective_instagram_media_id"),
            "effective_object_story_id": cr_rec.get("effective_object_story_id"),
            "image_url": cr_rec.get("image_url"),
            "video_id": cr_rec.get("video_id"),
            "object_story_spec": cr_rec.get("object_story_spec"),
            "asset_feed_spec": cr_rec.get("asset_feed_spec"),
            "meta_created_time": _parse_dt(cr_rec.get("created_time")),
            "synced_at": now_cr,
        }
        cr_stmt = pg_insert(Creative).values(cr_row)
        cr_update = {k: cr_stmt.excluded[k] for k in cr_row if k != "creative_id"}
        cr_stmt = cr_stmt.on_conflict_do_update(index_elements=["creative_id"], set_=cr_update)
        db.execute(cr_stmt)
        db.flush()
    else:
        creative = db.get(Creative, body.creative_id)
        if not creative or creative.account_id != account_id:
            raise HTTPException(status_code=404, detail="Criativo não encontrado no banco local.")

    payload: dict[str, Any] = {
        "name": body.name,
        "adset_id": body.adset_id,
        "creative": json.dumps({"creative_id": creative_id_resolved}),
        "status": body.status,
    }
    if body.conversion_domain is not None:
        payload["conversion_domain"] = body.conversion_domain
    if body.engagement_audience is not None:
        payload["engagement_audience"] = body.engagement_audience
    if body.ad_schedule_start_time is not None:
        payload["ad_schedule_start_time"] = body.ad_schedule_start_time.isoformat()
    if body.ad_schedule_end_time is not None:
        payload["ad_schedule_end_time"] = body.ad_schedule_end_time.isoformat()

    client = FacebookClient(account_id, account.access_token)
    try:
        result = client.post(f"{account_id}/ads", payload)
        ad_id = result["id"]
        rec = client.get(ad_id, {"fields": AD_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
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
    stmt = stmt.on_conflict_do_update(index_elements=["ad_id"], set_=update_cols)
    db.execute(stmt)
    db.commit()

    ad = db.get(Ad, rec["id"])
    return ad


@router.patch("/accounts/{account_id}/ads/{ad_id}", response_model=AdOut)
def update_ad(
    account_id: str,
    ad_id: str,
    body: AdUpdate,
    db: Session = Depends(get_db),
):
    account = _get_account_or_404(account_id, db)
    ad = db.get(Ad, ad_id)
    if not ad or ad.account_id != account_id:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado.")

    payload: dict[str, Any] = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.status is not None:
        payload["status"] = body.status
    if body.creative_id is not None:
        payload["creative"] = json.dumps({"creative_id": body.creative_id})
    if body.conversion_domain is not None:
        payload["conversion_domain"] = body.conversion_domain
    if body.ad_schedule_start_time is not None:
        payload["ad_schedule_start_time"] = body.ad_schedule_start_time.isoformat()
    if body.ad_schedule_end_time is not None:
        payload["ad_schedule_end_time"] = body.ad_schedule_end_time.isoformat()

    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.post(ad_id, payload)
        rec = client.get(ad_id, {"fields": AD_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
    creative_id = (rec.get("creative") or {}).get("id")
    ad.name = rec["name"]
    ad.status = rec.get("status", ad.status)
    ad.effective_status = rec.get("effective_status", ad.effective_status)
    ad.configured_status = rec.get("configured_status", ad.configured_status)
    ad.creative_id = creative_id or ad.creative_id
    ad.conversion_domain = rec.get("conversion_domain", ad.conversion_domain)
    ad.ad_schedule_start_time = _parse_dt(rec.get("ad_schedule_start_time"))
    ad.ad_schedule_end_time = _parse_dt(rec.get("ad_schedule_end_time"))
    ad.meta_updated_time = _parse_dt(rec.get("updated_time"))
    ad.synced_at = now
    db.commit()
    db.refresh(ad)
    return ad


@router.delete("/accounts/{account_id}/ads/{ad_id}", status_code=204)
def delete_ad(account_id: str, ad_id: str, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)
    ad = db.get(Ad, ad_id)
    if not ad or ad.account_id != account_id:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.delete(ad_id)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    ad.status = "DELETED"
    ad.effective_status = "DELETED"
    ad.synced_at = datetime.now(tz=timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Criativos
# ---------------------------------------------------------------------------

@router.post("/accounts/{account_id}/creatives", response_model=CreativeOut, status_code=201)
def create_creative(account_id: str, body: CreativeCreate, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)

    if body.object_story_id is None and body.object_story_spec is None:
        raise HTTPException(
            status_code=400,
            detail="Informe object_story_id (post existente) ou object_story_spec (criação inline).",
        )

    payload: dict[str, Any] = {"name": body.name}
    if body.object_story_id is not None:
        payload["object_story_id"] = body.object_story_id
    if body.object_story_spec is not None:
        payload["object_story_spec"] = json.dumps(body.object_story_spec)
    if body.body is not None:
        payload["body"] = body.body
    if body.title is not None:
        payload["title"] = body.title
    if body.call_to_action_type is not None:
        payload["call_to_action_type"] = body.call_to_action_type
    if body.image_url is not None:
        payload["image_url"] = body.image_url
    if body.image_hash is not None:
        payload["image_hash"] = body.image_hash
    if body.video_id is not None:
        payload["video_id"] = body.video_id
    if body.url_tags is not None:
        payload["url_tags"] = body.url_tags
    if body.authorization_category is not None:
        payload["authorization_category"] = body.authorization_category

    client = FacebookClient(account_id, account.access_token)
    try:
        result = client.post(f"{account_id}/adcreatives", payload)
        creative_id = result["id"]
        rec = client.get(creative_id, {"fields": CREATIVE_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    now = datetime.now(tz=timezone.utc)
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
    stmt = stmt.on_conflict_do_update(index_elements=["creative_id"], set_=update_cols)
    db.execute(stmt)
    db.commit()

    creative = db.get(Creative, rec["id"])
    return creative


@router.patch("/accounts/{account_id}/creatives/{creative_id}", response_model=CreativeOut)
def update_creative(
    account_id: str,
    creative_id: str,
    body: CreativeUpdate,
    db: Session = Depends(get_db),
):
    account = _get_account_or_404(account_id, db)
    creative = db.get(Creative, creative_id)
    if not creative or creative.account_id != account_id:
        raise HTTPException(status_code=404, detail="Criativo não encontrado.")

    payload: dict[str, Any] = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.status is not None:
        payload["status"] = body.status

    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar. Criativos só permitem alteração de name e status.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.post(creative_id, payload)
        rec = client.get(creative_id, {"fields": CREATIVE_FIELDS})
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        raise _facebook_error_to_http(e)

    creative.name = rec.get("name", creative.name)
    creative.status = rec.get("status", creative.status)
    creative.synced_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(creative)
    return creative


@router.delete("/accounts/{account_id}/creatives/{creative_id}", status_code=204)
def delete_creative(account_id: str, creative_id: str, db: Session = Depends(get_db)):
    account = _get_account_or_404(account_id, db)
    creative = db.get(Creative, creative_id)
    if not creative or creative.account_id != account_id:
        raise HTTPException(status_code=404, detail="Criativo não encontrado.")

    client = FacebookClient(account_id, account.access_token)
    try:
        client.delete(creative_id)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FacebookAPIError as e:
        # Código 100 pode indicar criativo vinculado a anúncio ativo
        if e.code == 100:
            raise HTTPException(
                status_code=400,
                detail=f"Não foi possível deletar o criativo (pode estar vinculado a anúncios ativos): {e}",
            )
        raise _facebook_error_to_http(e)

    creative.status = "DELETED"
    creative.synced_at = datetime.now(tz=timezone.utc)
    db.commit()
