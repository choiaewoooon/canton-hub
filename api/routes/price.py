"""Price endpoints."""
import asyncio
import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

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


async def _price_event_generator(cache: TTLCache):
    """Yield price data every 30 seconds."""
    while True:
        data = cache.get("price")
        if data is not None:
            yield {"event": "price", "data": json.dumps(data)}
        await asyncio.sleep(30)


@router.get("/sse/price")
async def sse_price(cache: TTLCache = Depends(get_cache)):
    return EventSourceResponse(_price_event_generator(cache))
