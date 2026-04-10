# api/routes/chart.py
"""Chart data endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

VALID_TYPES = {"price", "burn", "private-tx", "bm-ratio"}
VALID_PERIODS = {"24h", "7d", "1m", "3m"}


@router.get("/chart/{chart_type}")
async def get_chart(
    chart_type: str,
    period: str = "7d",
    cache: TTLCache = Depends(get_cache),
):
    if chart_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid chart type. Valid: {VALID_TYPES}")
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"Invalid period. Valid: {VALID_PERIODS}")
    key = f"chart:{chart_type}:{period}"
    return cache.get(key) or []
