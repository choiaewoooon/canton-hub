"""Analytics endpoints — reward split, amulet price, cumulative metrics."""
from fastapi import APIRouter, Depends, HTTPException

from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api/analytics")

VALID_PERIODS = {"7d", "1m", "3m"}


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


@router.get("/burn-breakdown")
async def burn_breakdown(cache: TTLCache = Depends(get_cache)):
    """오늘의 소각 분해 — Fees / Traffic Purchases."""
    return cache.get("analytics:burn-breakdown") or {
        "burned_from_fees": None,
        "burned_from_traffic": None,
    }


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
