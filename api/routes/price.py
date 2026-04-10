"""Price endpoints."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")


@router.get("/price")
async def get_price(cache: TTLCache = Depends(get_cache)):
    data = cache.get("price")
    if data is None:
        return {
            "current_price_usd": None,
            "price_change_percentage_24h": None,
            "high_24h": None,
            "low_24h": None,
            "market_cap": None,
            "total_volume_24h": None,
        }
    return data
