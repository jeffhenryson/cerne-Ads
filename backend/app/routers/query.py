import calendar
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import cast, func
from sqlalchemy import Date as SADate
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ad import Ad
from app.models.ad_account import AdAccount
from app.models.ad_set import AdSet
from app.models.campaign import Campaign
from app.models.creative import Creative
from app.models.insight import AdInsight, AdPlacementInsight, AdSetInsight, CampaignInsight
from app.schemas.ad import AdOut
from app.schemas.ad_set import AdSetOut
from app.schemas.campaign import AdBrief, AdSetBrief, CampaignDetail, CampaignOut
from app.schemas.creative import CreativeOut
from app.services.sync_service import sync_single_creative
from app.schemas.insight import (
    AdInsightResponse,
    AdInsightRow,
    AdSetInsightResponse,
    AdSetInsightRow,
    CampaignInsightResponse,
    CampaignInsightRow,
    PlacementInsightResponse,
    PlacementInsightRow,
)

router = APIRouter(tags=["Query"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _period_date_stop(period_start: date, granularity: str) -> date:
    if granularity == "weekly":
        return period_start + timedelta(days=6)
    # monthly
    last_day = calendar.monthrange(period_start.year, period_start.month)[1]
    return date(period_start.year, period_start.month, last_day)


def _require_account(account_id: str, db: Session) -> AdAccount:
    acc = db.get(AdAccount, account_id)
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return acc


# ---------------------------------------------------------------------------
# 7.1 Campaigns
# ---------------------------------------------------------------------------

@router.get(
    "/accounts/{account_id}/campaigns",
    response_model=list[CampaignOut],
    summary="Lista campanhas de uma conta",
)
def list_campaigns(
    account_id: str,
    status: str | None = Query(None, description="Filtrar por status (ex: ACTIVE, PAUSED)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    q = db.query(Campaign).filter(Campaign.account_id == account_id)
    if status:
        q = q.filter(Campaign.status == status.upper())
    campaigns = q.order_by(Campaign.meta_created_time.desc()).offset(offset).limit(limit).all()
    return [CampaignOut.model_validate(c) for c in campaigns]


@router.get(
    "/accounts/{account_id}/campaigns/{campaign_id}",
    response_model=CampaignDetail,
    summary="Detalhe de campanha com contadores de conjuntos e anúncios",
)
def get_campaign(
    account_id: str,
    campaign_id: str,
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    campaign = (
        db.query(Campaign)
        .filter(Campaign.account_id == account_id, Campaign.campaign_id == campaign_id)
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")

    adsets_db = (
        db.query(AdSet)
        .filter(AdSet.campaign_id == campaign_id)
        .order_by(AdSet.meta_created_time)
        .all()
    )

    adset_ids = [a.adset_id for a in adsets_db]
    ads_db = (
        db.query(Ad)
        .filter(Ad.adset_id.in_(adset_ids))
        .order_by(Ad.meta_created_time)
        .all()
    ) if adset_ids else []

    # Agrupa os anúncios por adset_id
    ads_by_adset: dict[str, list[AdBrief]] = {}
    for ad in ads_db:
        ads_by_adset.setdefault(ad.adset_id, []).append(AdBrief.model_validate(ad))

    adsets = [
        AdSetBrief(
            adset_id=a.adset_id,
            name=a.name,
            status=a.status,
            effective_status=a.effective_status,
            ads=ads_by_adset.get(a.adset_id, []),
        )
        for a in adsets_db
    ]

    base = CampaignOut.model_validate(campaign).model_dump()
    base["adset_count"] = len(adsets_db)
    base["ad_count"] = len(ads_db)
    base["adsets"] = [a.model_dump() for a in adsets]
    return CampaignDetail(**base)


# ---------------------------------------------------------------------------
# 7.2 AdSets
# ---------------------------------------------------------------------------

@router.get(
    "/accounts/{account_id}/adsets",
    response_model=list[AdSetOut],
    summary="Lista conjuntos de anúncios de uma conta",
)
def list_adsets(
    account_id: str,
    campaign_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    q = db.query(AdSet).filter(AdSet.account_id == account_id)
    if campaign_id:
        q = q.filter(AdSet.campaign_id == campaign_id)
    if status:
        q = q.filter(AdSet.status == status.upper())
    adsets = q.order_by(AdSet.meta_created_time.desc()).offset(offset).limit(limit).all()
    return [AdSetOut.model_validate(a) for a in adsets]


@router.get(
    "/accounts/{account_id}/adsets/{adset_id}",
    response_model=AdSetOut,
    summary="Detalhe de um conjunto de anúncios",
)
def get_adset(
    account_id: str,
    adset_id: str,
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    adset = (
        db.query(AdSet)
        .filter(AdSet.account_id == account_id, AdSet.adset_id == adset_id)
        .first()
    )
    if not adset:
        raise HTTPException(status_code=404, detail="Conjunto de anúncios não encontrado")
    return AdSetOut.model_validate(adset)


# ---------------------------------------------------------------------------
# 7.3 Ads
# ---------------------------------------------------------------------------

@router.get(
    "/accounts/{account_id}/ads",
    response_model=list[AdOut],
    summary="Lista anúncios de uma conta",
)
def list_ads(
    account_id: str,
    adset_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    q = db.query(Ad).filter(Ad.account_id == account_id)
    if adset_id:
        q = q.filter(Ad.adset_id == adset_id)
    if campaign_id:
        q = q.filter(Ad.campaign_id == campaign_id)
    if status:
        q = q.filter(Ad.status == status.upper())
    ads = q.order_by(Ad.meta_created_time.desc()).offset(offset).limit(limit).all()
    return [AdOut.model_validate(a) for a in ads]


@router.get(
    "/accounts/{account_id}/ads/{ad_id}",
    response_model=AdOut,
    summary="Detalhe de um anúncio",
)
def get_ad(
    account_id: str,
    ad_id: str,
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    ad = (
        db.query(Ad)
        .filter(Ad.account_id == account_id, Ad.ad_id == ad_id)
        .first()
    )
    if not ad:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return AdOut.model_validate(ad)


# ---------------------------------------------------------------------------
# Criativos
# ---------------------------------------------------------------------------

@router.get(
    "/accounts/{account_id}/creatives",
    response_model=list[CreativeOut],
    summary="Lista criativos de uma conta",
)
def list_creatives(
    account_id: str,
    ad_id: str | None = Query(None, description="Filtrar pelo anúncio vinculado"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    q = db.query(Creative).filter(Creative.account_id == account_id)
    if ad_id:
        q = q.filter(Creative.ad_id == ad_id)
    creatives = q.order_by(Creative.meta_created_time.desc()).offset(offset).limit(limit).all()
    return [CreativeOut.model_validate(c) for c in creatives]


@router.get(
    "/accounts/{account_id}/creatives/{creative_id}",
    response_model=CreativeOut,
    summary="Detalhe de um criativo",
)
def get_creative(
    account_id: str,
    creative_id: str,
    db: Session = Depends(get_db),
):
    _require_account(account_id, db)
    creative = (
        db.query(Creative)
        .filter(Creative.account_id == account_id, Creative.creative_id == creative_id)
        .first()
    )
    if not creative:
        raise HTTPException(status_code=404, detail="Criativo não encontrado")
    return CreativeOut.model_validate(creative)


@router.post(
    "/accounts/{account_id}/creatives/{creative_id}/sync",
    response_model=CreativeOut,
    summary="Sincroniza um criativo específico com a Meta API",
)
def sync_creative(
    account_id: str,
    creative_id: str,
    db: Session = Depends(get_db),
):
    acc = _require_account(account_id, db)
    creative = sync_single_creative(account_id, creative_id, acc.access_token, db)
    if not creative:
        raise HTTPException(status_code=404, detail="Criativo não encontrado na Meta API")
    return CreativeOut.model_validate(creative)


# ---------------------------------------------------------------------------
# 7.4 Insights — helpers
# ---------------------------------------------------------------------------

_TRUNC_UNIT = {"weekly": "week", "monthly": "month"}


def _apply_date_filters(q, model, date_from, date_to):
    if date_from:
        q = q.filter(model.date_start >= date_from)
    if date_to:
        q = q.filter(model.date_stop <= date_to)
    return q


# ---------------------------------------------------------------------------
# 7.4 Insights — Campanhas
# ---------------------------------------------------------------------------

@router.get(
    "/insights/campaigns",
    response_model=CampaignInsightResponse,
    summary="Insights de campanhas com agregação daily | weekly | monthly",
)
def get_campaign_insights(
    account_id: str = Query(...),
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _require_account(account_id, db)

    if granularity == "daily":
        q = (
            db.query(CampaignInsight, Campaign.name.label("campaign_name"))
            .join(Campaign, Campaign.campaign_id == CampaignInsight.campaign_id, isouter=True)
            .filter(CampaignInsight.account_id == account_id)
        )
        if campaign_id:
            q = q.filter(CampaignInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, CampaignInsight, date_from, date_to)
        rows = q.order_by(CampaignInsight.campaign_id, CampaignInsight.date_start).all()

        data = [
            CampaignInsightRow(
                campaign_id=row.CampaignInsight.campaign_id,
                campaign_name=row.campaign_name,
                date_start=row.CampaignInsight.date_start,
                date_stop=row.CampaignInsight.date_stop,
                impressions=row.CampaignInsight.impressions or 0,
                reach=row.CampaignInsight.reach or 0,
                clicks=row.CampaignInsight.clicks or 0,
                spend=row.CampaignInsight.spend,
                ctr=row.CampaignInsight.ctr,
                cpm=row.CampaignInsight.cpm,
                cpc=row.CampaignInsight.cpc,
                cpp=row.CampaignInsight.cpp,
                inline_link_clicks=row.CampaignInsight.inline_link_clicks,
                inline_post_engagement=row.CampaignInsight.inline_post_engagement,
                actions=row.CampaignInsight.actions,
                frequency=float(row.CampaignInsight.frequency) if row.CampaignInsight.frequency is not None else None,
                inline_link_click_ctr=float(row.CampaignInsight.inline_link_click_ctr) if row.CampaignInsight.inline_link_click_ctr is not None else None,
                social_spend=float(row.CampaignInsight.social_spend) if row.CampaignInsight.social_spend is not None else None,
                cost_per_action_type=row.CampaignInsight.cost_per_action_type,
                video_play_actions=row.CampaignInsight.video_play_actions,
                video_30_sec_watched_actions=row.CampaignInsight.video_30_sec_watched_actions,
                video_p25_watched_actions=row.CampaignInsight.video_p25_watched_actions,
                video_p50_watched_actions=row.CampaignInsight.video_p50_watched_actions,
                video_p75_watched_actions=row.CampaignInsight.video_p75_watched_actions,
                video_p95_watched_actions=row.CampaignInsight.video_p95_watched_actions,
                video_p100_watched_actions=row.CampaignInsight.video_p100_watched_actions,
                video_avg_time_watched_actions=row.CampaignInsight.video_avg_time_watched_actions,
                outbound_clicks=row.CampaignInsight.outbound_clicks,
                results=row.CampaignInsight.results,
                cost_per_result=row.CampaignInsight.cost_per_result,
                quality_ranking=row.CampaignInsight.quality_ranking,
                engagement_rate_ranking=row.CampaignInsight.engagement_rate_ranking,
                conversion_rate_ranking=row.CampaignInsight.conversion_rate_ranking,
                objective=row.CampaignInsight.objective,
                buying_type=row.CampaignInsight.buying_type,
                attribution_setting=row.CampaignInsight.attribution_setting,
            )
            for row in rows
        ]
    else:
        unit = _TRUNC_UNIT[granularity]
        period_col = cast(func.date_trunc(unit, CampaignInsight.date_start), SADate).label("period_start")
        q = (
            db.query(
                CampaignInsight.campaign_id,
                Campaign.name.label("campaign_name"),
                period_col,
                func.sum(CampaignInsight.impressions).label("impressions"),
                func.sum(CampaignInsight.reach).label("reach"),
                func.sum(CampaignInsight.clicks).label("clicks"),
                func.sum(CampaignInsight.spend).label("spend"),
                func.avg(CampaignInsight.ctr).label("ctr"),
                func.avg(CampaignInsight.cpm).label("cpm"),
                func.avg(CampaignInsight.cpc).label("cpc"),
                func.avg(CampaignInsight.cpp).label("cpp"),
                func.sum(CampaignInsight.inline_link_clicks).label("inline_link_clicks"),
                func.sum(CampaignInsight.inline_post_engagement).label("inline_post_engagement"),
                func.avg(CampaignInsight.frequency).label("frequency"),
                func.avg(CampaignInsight.inline_link_click_ctr).label("inline_link_click_ctr"),
                func.sum(CampaignInsight.social_spend).label("social_spend"),
            )
            .join(Campaign, Campaign.campaign_id == CampaignInsight.campaign_id, isouter=True)
            .filter(CampaignInsight.account_id == account_id)
        )
        if campaign_id:
            q = q.filter(CampaignInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, CampaignInsight, date_from, date_to)
        rows = q.group_by(CampaignInsight.campaign_id, Campaign.name, period_col).order_by(
            CampaignInsight.campaign_id, period_col
        ).all()

        data = [
            CampaignInsightRow(
                campaign_id=row.campaign_id,
                campaign_name=row.campaign_name,
                date_start=row.period_start,
                date_stop=_period_date_stop(row.period_start, granularity),
                impressions=row.impressions or 0,
                reach=row.reach or 0,
                clicks=row.clicks or 0,
                spend=row.spend,
                ctr=row.ctr,
                cpm=row.cpm,
                cpc=row.cpc,
                cpp=row.cpp,
                inline_link_clicks=row.inline_link_clicks,
                inline_post_engagement=row.inline_post_engagement,
                actions=None,
                frequency=float(row.frequency) if row.frequency is not None else None,
                inline_link_click_ctr=float(row.inline_link_click_ctr) if row.inline_link_click_ctr is not None else None,
                social_spend=float(row.social_spend) if row.social_spend is not None else None,
            )
            for row in rows
        ]

    total = len(data)
    data = data[offset: offset + limit]
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return CampaignInsightResponse(
        account_id=account_id,
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        total=total,
        data=data,
    )


# ---------------------------------------------------------------------------
# 7.4 Insights — Conjuntos de Anúncios
# ---------------------------------------------------------------------------

@router.get(
    "/insights/adsets",
    response_model=AdSetInsightResponse,
    summary="Insights de conjuntos de anúncios com agregação daily | weekly | monthly",
)
def get_adset_insights(
    account_id: str = Query(...),
    adset_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _require_account(account_id, db)

    if granularity == "daily":
        q = (
            db.query(AdSetInsight, AdSet.name.label("adset_name"))
            .join(AdSet, AdSet.adset_id == AdSetInsight.adset_id, isouter=True)
            .filter(AdSetInsight.account_id == account_id)
        )
        if adset_id:
            q = q.filter(AdSetInsight.adset_id == adset_id)
        if campaign_id:
            q = q.filter(AdSetInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, AdSetInsight, date_from, date_to)
        rows = q.order_by(AdSetInsight.adset_id, AdSetInsight.date_start).all()

        data = [
            AdSetInsightRow(
                adset_id=row.AdSetInsight.adset_id,
                adset_name=row.adset_name,
                campaign_id=row.AdSetInsight.campaign_id,
                date_start=row.AdSetInsight.date_start,
                date_stop=row.AdSetInsight.date_stop,
                impressions=row.AdSetInsight.impressions or 0,
                reach=row.AdSetInsight.reach or 0,
                clicks=row.AdSetInsight.clicks or 0,
                spend=row.AdSetInsight.spend,
                ctr=row.AdSetInsight.ctr,
                cpm=row.AdSetInsight.cpm,
                cpc=row.AdSetInsight.cpc,
                cpp=row.AdSetInsight.cpp,
                inline_link_clicks=row.AdSetInsight.inline_link_clicks,
                inline_post_engagement=row.AdSetInsight.inline_post_engagement,
                full_view_impressions=row.AdSetInsight.full_view_impressions,
                full_view_reach=row.AdSetInsight.full_view_reach,
                actions=row.AdSetInsight.actions,
                frequency=float(row.AdSetInsight.frequency) if row.AdSetInsight.frequency is not None else None,
                inline_link_click_ctr=float(row.AdSetInsight.inline_link_click_ctr) if row.AdSetInsight.inline_link_click_ctr is not None else None,
                social_spend=float(row.AdSetInsight.social_spend) if row.AdSetInsight.social_spend is not None else None,
                cost_per_action_type=row.AdSetInsight.cost_per_action_type,
                video_play_actions=row.AdSetInsight.video_play_actions,
                video_30_sec_watched_actions=row.AdSetInsight.video_30_sec_watched_actions,
                video_p25_watched_actions=row.AdSetInsight.video_p25_watched_actions,
                video_p50_watched_actions=row.AdSetInsight.video_p50_watched_actions,
                video_p75_watched_actions=row.AdSetInsight.video_p75_watched_actions,
                video_p95_watched_actions=row.AdSetInsight.video_p95_watched_actions,
                video_p100_watched_actions=row.AdSetInsight.video_p100_watched_actions,
                video_avg_time_watched_actions=row.AdSetInsight.video_avg_time_watched_actions,
                outbound_clicks=row.AdSetInsight.outbound_clicks,
                results=row.AdSetInsight.results,
                cost_per_result=row.AdSetInsight.cost_per_result,
                quality_ranking=row.AdSetInsight.quality_ranking,
                engagement_rate_ranking=row.AdSetInsight.engagement_rate_ranking,
                conversion_rate_ranking=row.AdSetInsight.conversion_rate_ranking,
                objective=row.AdSetInsight.objective,
                buying_type=row.AdSetInsight.buying_type,
                attribution_setting=row.AdSetInsight.attribution_setting,
            )
            for row in rows
        ]
    else:
        unit = _TRUNC_UNIT[granularity]
        period_col = cast(func.date_trunc(unit, AdSetInsight.date_start), SADate).label("period_start")
        q = (
            db.query(
                AdSetInsight.adset_id,
                AdSet.name.label("adset_name"),
                AdSetInsight.campaign_id,
                period_col,
                func.sum(AdSetInsight.impressions).label("impressions"),
                func.sum(AdSetInsight.reach).label("reach"),
                func.sum(AdSetInsight.clicks).label("clicks"),
                func.sum(AdSetInsight.spend).label("spend"),
                func.avg(AdSetInsight.ctr).label("ctr"),
                func.avg(AdSetInsight.cpm).label("cpm"),
                func.avg(AdSetInsight.cpc).label("cpc"),
                func.avg(AdSetInsight.cpp).label("cpp"),
                func.sum(AdSetInsight.inline_link_clicks).label("inline_link_clicks"),
                func.sum(AdSetInsight.inline_post_engagement).label("inline_post_engagement"),
                func.sum(AdSetInsight.full_view_impressions).label("full_view_impressions"),
                func.sum(AdSetInsight.full_view_reach).label("full_view_reach"),
                func.avg(AdSetInsight.frequency).label("frequency"),
                func.avg(AdSetInsight.inline_link_click_ctr).label("inline_link_click_ctr"),
                func.sum(AdSetInsight.social_spend).label("social_spend"),
            )
            .join(AdSet, AdSet.adset_id == AdSetInsight.adset_id, isouter=True)
            .filter(AdSetInsight.account_id == account_id)
        )
        if adset_id:
            q = q.filter(AdSetInsight.adset_id == adset_id)
        if campaign_id:
            q = q.filter(AdSetInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, AdSetInsight, date_from, date_to)
        rows = q.group_by(
            AdSetInsight.adset_id, AdSet.name, AdSetInsight.campaign_id, period_col
        ).order_by(AdSetInsight.adset_id, period_col).all()

        data = [
            AdSetInsightRow(
                adset_id=row.adset_id,
                adset_name=row.adset_name,
                campaign_id=row.campaign_id,
                date_start=row.period_start,
                date_stop=_period_date_stop(row.period_start, granularity),
                impressions=row.impressions or 0,
                reach=row.reach or 0,
                clicks=row.clicks or 0,
                spend=row.spend,
                ctr=row.ctr,
                cpm=row.cpm,
                cpc=row.cpc,
                cpp=row.cpp,
                inline_link_clicks=row.inline_link_clicks,
                inline_post_engagement=row.inline_post_engagement,
                full_view_impressions=row.full_view_impressions,
                full_view_reach=row.full_view_reach,
                actions=None,
                frequency=float(row.frequency) if row.frequency is not None else None,
                inline_link_click_ctr=float(row.inline_link_click_ctr) if row.inline_link_click_ctr is not None else None,
                social_spend=float(row.social_spend) if row.social_spend is not None else None,
            )
            for row in rows
        ]

    total = len(data)
    data = data[offset: offset + limit]
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return AdSetInsightResponse(
        account_id=account_id,
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        total=total,
        data=data,
    )


# ---------------------------------------------------------------------------
# 7.4 Insights — Anúncios
# ---------------------------------------------------------------------------

@router.get(
    "/insights/ads",
    response_model=AdInsightResponse,
    summary="Insights de anúncios com agregação daily | weekly | monthly",
)
def get_ad_insights(
    account_id: str = Query(...),
    ad_id: str | None = Query(None),
    adset_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _require_account(account_id, db)

    if granularity == "daily":
        q = (
            db.query(AdInsight, Ad.name.label("ad_name"))
            .join(Ad, Ad.ad_id == AdInsight.ad_id, isouter=True)
            .filter(AdInsight.account_id == account_id)
        )
        if ad_id:
            q = q.filter(AdInsight.ad_id == ad_id)
        if adset_id:
            q = q.filter(AdInsight.adset_id == adset_id)
        if campaign_id:
            q = q.filter(AdInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, AdInsight, date_from, date_to)
        rows = q.order_by(AdInsight.ad_id, AdInsight.date_start).all()

        data = [
            AdInsightRow(
                ad_id=row.AdInsight.ad_id,
                ad_name=row.ad_name,
                adset_id=row.AdInsight.adset_id,
                campaign_id=row.AdInsight.campaign_id,
                date_start=row.AdInsight.date_start,
                date_stop=row.AdInsight.date_stop,
                impressions=row.AdInsight.impressions or 0,
                reach=row.AdInsight.reach or 0,
                clicks=row.AdInsight.clicks or 0,
                spend=row.AdInsight.spend,
                ctr=row.AdInsight.ctr,
                cpm=row.AdInsight.cpm,
                cpc=row.AdInsight.cpc,
                cpp=row.AdInsight.cpp,
                inline_link_clicks=row.AdInsight.inline_link_clicks,
                inline_post_engagement=row.AdInsight.inline_post_engagement,
                cost_per_unique_click=row.AdInsight.cost_per_unique_click,
                actions=row.AdInsight.actions,
                frequency=float(row.AdInsight.frequency) if row.AdInsight.frequency is not None else None,
                inline_link_click_ctr=float(row.AdInsight.inline_link_click_ctr) if row.AdInsight.inline_link_click_ctr is not None else None,
                social_spend=float(row.AdInsight.social_spend) if row.AdInsight.social_spend is not None else None,
                cost_per_action_type=row.AdInsight.cost_per_action_type,
                video_play_actions=row.AdInsight.video_play_actions,
                video_30_sec_watched_actions=row.AdInsight.video_30_sec_watched_actions,
                video_p25_watched_actions=row.AdInsight.video_p25_watched_actions,
                video_p50_watched_actions=row.AdInsight.video_p50_watched_actions,
                video_p75_watched_actions=row.AdInsight.video_p75_watched_actions,
                video_p95_watched_actions=row.AdInsight.video_p95_watched_actions,
                video_p100_watched_actions=row.AdInsight.video_p100_watched_actions,
                video_avg_time_watched_actions=row.AdInsight.video_avg_time_watched_actions,
                outbound_clicks=row.AdInsight.outbound_clicks,
                cost_per_outbound_click=row.AdInsight.cost_per_outbound_click,
                cost_per_unique_outbound_click=row.AdInsight.cost_per_unique_outbound_click,
                results=row.AdInsight.results,
                cost_per_result=row.AdInsight.cost_per_result,
                quality_ranking=row.AdInsight.quality_ranking,
                engagement_rate_ranking=row.AdInsight.engagement_rate_ranking,
                conversion_rate_ranking=row.AdInsight.conversion_rate_ranking,
                objective=row.AdInsight.objective,
                buying_type=row.AdInsight.buying_type,
                attribution_setting=row.AdInsight.attribution_setting,
            )
            for row in rows
        ]
    else:
        unit = _TRUNC_UNIT[granularity]
        period_col = cast(func.date_trunc(unit, AdInsight.date_start), SADate).label("period_start")
        q = (
            db.query(
                AdInsight.ad_id,
                Ad.name.label("ad_name"),
                AdInsight.adset_id,
                AdInsight.campaign_id,
                period_col,
                func.sum(AdInsight.impressions).label("impressions"),
                func.sum(AdInsight.reach).label("reach"),
                func.sum(AdInsight.clicks).label("clicks"),
                func.sum(AdInsight.spend).label("spend"),
                func.avg(AdInsight.ctr).label("ctr"),
                func.avg(AdInsight.cpm).label("cpm"),
                func.avg(AdInsight.cpc).label("cpc"),
                func.avg(AdInsight.cpp).label("cpp"),
                func.sum(AdInsight.inline_link_clicks).label("inline_link_clicks"),
                func.sum(AdInsight.inline_post_engagement).label("inline_post_engagement"),
                func.avg(AdInsight.cost_per_unique_click).label("cost_per_unique_click"),
                func.avg(AdInsight.frequency).label("frequency"),
                func.avg(AdInsight.inline_link_click_ctr).label("inline_link_click_ctr"),
                func.sum(AdInsight.social_spend).label("social_spend"),
            )
            .join(Ad, Ad.ad_id == AdInsight.ad_id, isouter=True)
            .filter(AdInsight.account_id == account_id)
        )
        if ad_id:
            q = q.filter(AdInsight.ad_id == ad_id)
        if adset_id:
            q = q.filter(AdInsight.adset_id == adset_id)
        if campaign_id:
            q = q.filter(AdInsight.campaign_id == campaign_id)
        q = _apply_date_filters(q, AdInsight, date_from, date_to)
        rows = q.group_by(
            AdInsight.ad_id, Ad.name, AdInsight.adset_id, AdInsight.campaign_id, period_col
        ).order_by(AdInsight.ad_id, period_col).all()

        data = [
            AdInsightRow(
                ad_id=row.ad_id,
                ad_name=row.ad_name,
                adset_id=row.adset_id,
                campaign_id=row.campaign_id,
                date_start=row.period_start,
                date_stop=_period_date_stop(row.period_start, granularity),
                impressions=row.impressions or 0,
                reach=row.reach or 0,
                clicks=row.clicks or 0,
                spend=row.spend,
                ctr=row.ctr,
                cpm=row.cpm,
                cpc=row.cpc,
                cpp=row.cpp,
                inline_link_clicks=row.inline_link_clicks,
                inline_post_engagement=row.inline_post_engagement,
                cost_per_unique_click=row.cost_per_unique_click,
                actions=None,
                frequency=float(row.frequency) if row.frequency is not None else None,
                inline_link_click_ctr=float(row.inline_link_click_ctr) if row.inline_link_click_ctr is not None else None,
                social_spend=float(row.social_spend) if row.social_spend is not None else None,
            )
            for row in rows
        ]

    total = len(data)
    data = data[offset: offset + limit]
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return AdInsightResponse(
        account_id=account_id,
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        total=total,
        data=data,
    )


# ---------------------------------------------------------------------------
# 1.3 Aliases — /accounts/{account_id}/insights/* (path param style)
# ---------------------------------------------------------------------------

@router.get(
    "/accounts/{account_id}/insights/campaigns",
    response_model=CampaignInsightResponse,
    summary="[Alias] Insights de campanhas — account_id como path param",
)
def get_campaign_insights_v2(
    account_id: str,
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    return get_campaign_insights(
        account_id=account_id,
        campaign_id=campaign_id,
        date_from=date_from,
        date_to=date_to,
        granularity=granularity,
        limit=limit,
        offset=offset,
        response=response,
        db=db,
    )


@router.get(
    "/accounts/{account_id}/insights/adsets",
    response_model=AdSetInsightResponse,
    summary="[Alias] Insights de conjuntos — account_id como path param",
)
def get_adset_insights_v2(
    account_id: str,
    adset_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    return get_adset_insights(
        account_id=account_id,
        adset_id=adset_id,
        campaign_id=campaign_id,
        date_from=date_from,
        date_to=date_to,
        granularity=granularity,
        limit=limit,
        offset=offset,
        response=response,
        db=db,
    )


@router.get(
    "/accounts/{account_id}/insights/ads",
    response_model=AdInsightResponse,
    summary="[Alias] Insights de anúncios — account_id como path param",
)
def get_ad_insights_v2(
    account_id: str,
    ad_id: str | None = Query(None),
    adset_id: str | None = Query(None),
    campaign_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("daily"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    response: Response = None,
    db: Session = Depends(get_db),
):
    return get_ad_insights(
        account_id=account_id,
        ad_id=ad_id,
        adset_id=adset_id,
        campaign_id=campaign_id,
        date_from=date_from,
        date_to=date_to,
        granularity=granularity,
        limit=limit,
        offset=offset,
        response=response,
        db=db,
    )


# ---------------------------------------------------------------------------
# Insights de Posicionamento
# ---------------------------------------------------------------------------

@router.get(
    "/insights/placements",
    response_model=PlacementInsightResponse,
    summary="Insights de posicionamento por anúncio (breakdown publisher_platform + platform_position)",
)
def get_placement_insights(
    account_id: str = Query(...),
    ad_id: str = Query(...),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """
    Retorna breakdown de impressões/gasto/cliques por posicionamento para um anúncio específico.
    Agrupa todos os dias no período (soma impressões, spend, clicks; média ctr/cpm/cpc/frequency).
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from não pode ser maior que date_to.")
    _require_account(account_id, db)

    q = (
        db.query(
            AdPlacementInsight.publisher_platform,
            AdPlacementInsight.platform_position,
            func.sum(AdPlacementInsight.impressions).label("impressions"),
            func.sum(AdPlacementInsight.reach).label("reach"),
            func.sum(AdPlacementInsight.clicks).label("clicks"),
            func.sum(AdPlacementInsight.spend).label("spend"),
            func.avg(AdPlacementInsight.ctr).label("ctr"),
            func.avg(AdPlacementInsight.cpm).label("cpm"),
            func.avg(AdPlacementInsight.cpc).label("cpc"),
            func.avg(AdPlacementInsight.frequency).label("frequency"),
            func.min(AdPlacementInsight.date_start).label("date_start"),
            func.max(AdPlacementInsight.date_stop).label("date_stop"),
        )
        .filter(
            AdPlacementInsight.account_id == account_id,
            AdPlacementInsight.ad_id == ad_id,
        )
    )
    if date_from:
        q = q.filter(AdPlacementInsight.date_start >= date_from)
    if date_to:
        q = q.filter(AdPlacementInsight.date_stop <= date_to)

    rows = q.group_by(
        AdPlacementInsight.publisher_platform,
        AdPlacementInsight.platform_position,
    ).order_by(
        func.sum(AdPlacementInsight.impressions).desc()
    ).all()

    data = [
        PlacementInsightRow(
            ad_id=ad_id,
            date_start=row.date_start,
            date_stop=row.date_stop,
            publisher_platform=row.publisher_platform,
            platform_position=row.platform_position,
            impressions=row.impressions or 0,
            reach=row.reach or 0,
            clicks=row.clicks or 0,
            spend=row.spend,
            ctr=row.ctr,
            cpm=row.cpm,
            cpc=row.cpc,
            frequency=float(row.frequency) if row.frequency is not None else None,
        )
        for row in rows
    ]

    if response:
        response.headers["X-Total-Count"] = str(len(data))

    return PlacementInsightResponse(
        account_id=account_id,
        ad_id=ad_id,
        date_from=date_from,
        date_to=date_to,
        total=len(data),
        data=data,
    )
