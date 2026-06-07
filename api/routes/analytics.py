"""Analytics endpoints — reward split, amulet price, cumulative metrics."""
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api/analytics")

VALID_PERIODS = {"7d", "1m", "3m"}

_KPI_HISTORY_FILE = Path(__file__).parent.parent.parent / "data" / "kpi_history.json"


def _empty(period: str) -> list:
    return []


@router.get("/reward-split")
async def reward_split(
    period: str = "1m",
    cache: TTLCache = Depends(get_cache),
):
    """일일 보상 분배 시계열 — App / Validator / Super Validator."""
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"Invalid period. Valid: {VALID_PERIODS}")
    return cache.get(f"analytics:reward-split:{period}") or _empty(period)


@router.get("/amulet-price")
async def amulet_price(
    period: str = "1m",
    cache: TTLCache = Depends(get_cache),
):
    """Amulet 가격 시계열 — Canton 내부 환산율."""
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"Invalid period. Valid: {VALID_PERIODS}")
    return cache.get(f"analytics:amulet-price:{period}") or _empty(period)


@router.get("/cumulative")
async def cumulative(
    period: str = "1m",
    cache: TTLCache = Depends(get_cache),
):
    """누적 Mint / Burn / Supply 시계열."""
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"Invalid period. Valid: {VALID_PERIODS}")
    return cache.get(f"analytics:cumulative:{period}") or _empty(period)


@router.get("/kr-companies")
async def kr_companies(cache: TTLCache = Depends(get_cache)):
    """한국 기업 Canton 참여 현황 — Upbit/Dunamu, Coinone, Marblex."""
    return cache.get("analytics:kr-companies") or {
        "companies": [],
        "grand_total_balance": 0,
        "total_wallet_count": 0,
        "fetched_at": None,
    }


def _empty_dat():
    return {"companies": [], "company_count": 0, "total_cc_holdings": 0,
            "total_pl_usd": 0, "fetched_at": None}


@router.get("/dat")
async def dat(cache: TTLCache = Depends(get_cache)):
    """Canton DAT 트래커 — $CC 보유 상장사 현황."""
    data = cache.get("analytics:dat")
    if data is None:
        return _empty_dat()
    return data


@router.get("/holders")
async def holders(cache: TTLCache = Depends(get_cache)):
    """Major CC Holders — CantonScan 온체인 balance 기반 top holders."""
    return cache.get("analytics:holders") or {
        "holders": [],
        "total_tracked_balance": 0,
        "total_count": 0,
        "top1_share_pct": 0,
        "top10_share_pct": 0,
        "fetched_at": None,
    }


@router.get("/burn-breakdown")
async def burn_breakdown(cache: TTLCache = Depends(get_cache)):
    """오늘의 소각 분해 — Fees / Traffic Purchases."""
    return cache.get("analytics:burn-breakdown") or {
        "burned_from_fees": None,
        "burned_from_traffic": None,
    }


@router.get("/trending")
async def trending(cache: TTLCache = Depends(get_cache)):
    """캔톤 관련 트렌딩 키워드 — 최근 수집된 트윗에서 추출."""
    return cache.get("analytics:trending") or {"keywords": [], "fetched_at": None}


_EMPTY_FUNDING = {"rates": [], "updated_at": None}


@router.get("/funding-rates")
async def funding_rates(cache: TTLCache = Depends(get_cache)):
    data = cache.get("analytics:funding-rates") or _EMPTY_FUNDING
    exchanges = cache.get("analytics:exchanges")
    return _enrich_funding_with_spread(data, exchanges)


@router.get("/kpi-history")
async def kpi_history():
    """KPI 스냅샷 이력 — 일별 active_addresses / transfers / private_ratio / SV 수.

    Canton Hub 자체 누적 (CantonScan 홈페이지 스냅샷 매일 저장). 데이터가 모이기
    전에는 짧은 배열이 반환됨.
    """
    if not _KPI_HISTORY_FILE.exists():
        return {"entries": []}
    try:
        data = json.loads(_KPI_HISTORY_FILE.read_text())
        if not isinstance(data, list):
            return {"entries": []}
        return {"entries": data}
    except Exception:
        return {"entries": []}


# Realtime source → CoinGecko scraper exchange name mapping for depth enrichment
# Format: (live_source, live_market) → (scraper_exchange_name, scraper_bucket)
_DEPTH_SOURCE_MAP: dict[tuple[str, str], tuple[str, str]] = {
    # DEX Perp
    ("Hyperliquid", "perpetual"): ("Hyperliquid (Futures)", "derivatives"),
    ("Extended", "perpetual"): ("Extended", "derivatives"),
    ("Aster", "perpetual"): ("Aster (Futures)", "derivatives"),
    ("Lighter", "perpetual"): ("Lighter", "derivatives"),
    # CEX Spot
    ("Bybit", "spot"): ("Bybit", "spot"),
    ("OKX", "spot"): ("OKX", "spot"),
    ("Kraken", "spot"): ("Kraken", "spot"),
    # CEX Perp
    ("Bybit Perp", "perpetual"): ("Bybit (Futures)", "derivatives"),
    ("OKX Perp", "perpetual"): ("OKX (Futures)", "derivatives"),
    ("Binance Perp", "perpetual"): ("Binance (Futures)", "derivatives"),
}


def _enrich_funding_with_spread(funding_data: dict, exchanges_data: dict | None) -> dict:
    """각 funding rate row에 거래소 bid-ask spread_pct를 join (없으면 None).
    _DEPTH_SOURCE_MAP을 재사용 — funding source는 모두 perpetual."""
    if not exchanges_data:
        return funding_data
    lookups: dict[tuple[str, str], dict] = {}
    for bucket in ("spot", "derivatives"):
        for entry in exchanges_data.get(bucket, []):
            key = (entry.get("exchange"), bucket)
            if key not in lookups:
                lookups[key] = entry
    enriched = []
    for r in funding_data.get("rates", []):
        mapping = _DEPTH_SOURCE_MAP.get((r.get("source", ""), "perpetual"))
        spread = None
        if mapping:
            entry = lookups.get(mapping)
            if entry is not None:
                spread = entry.get("spread_pct")
        enriched.append({**r, "spread_pct": spread})
    return {**funding_data, "rates": enriched}


def _enrich_with_depth(rt_data: dict, exchanges_data: dict | None) -> dict:
    """Realtime 가격에 exchanges cache의 +2%/-2% depth를 합쳐서 반환."""
    if not exchanges_data:
        return rt_data

    # Build lookup: (exchange_name, bucket) → first matching entry with CC pair
    lookups: dict[tuple[str, str], dict] = {}
    for bucket in ("spot", "derivatives"):
        for entry in exchanges_data.get(bucket, []):
            key = (entry.get("exchange"), bucket)
            # Take the first (highest rank) match per exchange
            if key not in lookups:
                lookups[key] = entry

    enriched_prices = []
    for p in rt_data.get("prices", []):
        source = p.get("source", "")
        market = p.get("market", "")
        map_key = (source, market)
        mapping = _DEPTH_SOURCE_MAP.get(map_key)
        depth_plus = 0
        depth_minus = 0
        trade_url = ""
        if mapping:
            exchange_data = lookups.get(mapping)
            if exchange_data:
                depth_plus = exchange_data.get("depth_plus_2pct", 0) or 0
                depth_minus = exchange_data.get("depth_minus_2pct", 0) or 0
                trade_url = exchange_data.get("trade_url", "") or ""
        enriched_prices.append({
            **p,
            "depth_plus_2pct": depth_plus,
            "depth_minus_2pct": depth_minus,
            "trade_url": trade_url,
        })

    return {**rt_data, "prices": enriched_prices}


@router.get("/realtime-prices")
async def realtime_prices(cache: TTLCache = Depends(get_cache)):
    """5초마다 갱신되는 모든 거래소(DEX+CEX, spot+perp) Canton 가격.
    Exchanges cache의 +2%/-2% depth와 trade_url도 함께 반환."""
    rt = cache.get("analytics:realtime-prices")
    if not rt:
        return {
            "prices": [],
            "lowest": None,
            "highest": None,
            "spread_pct": 0,
            "spread_usd": 0,
            "fetched_at": None,
        }
    exchanges = cache.get("analytics:exchanges")
    return _enrich_with_depth(rt, exchanges)


@router.get("/exchanges")
async def exchanges(cache: TTLCache = Depends(get_cache)):
    """CC가 거래되는 거래소 목록 + 거래량 + 파생상품 정보."""
    return cache.get("analytics:exchanges") or {
        "spot": [],
        "derivatives": [],
        "total_spot_volume_usd": 0,
        "total_derivatives_volume_usd": 0,
        "total_open_interest_usd": 0,
        "fetched_at": None,
    }
