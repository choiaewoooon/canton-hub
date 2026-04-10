# api/routes/feed.py
"""Feed endpoint — Twitter news with AI translation."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

SUPPORTED_LANGS = {"ko", "en", "ja", "zh"}


@router.get("/feed")
async def get_feed(
    lang: str = "en",
    cache: TTLCache = Depends(get_cache),
):
    if lang not in SUPPORTED_LANGS:
        lang = "en"
    data = cache.get(f"feed:{lang}")
    if data is None:
        return {"lang": lang, "items": [], "ai_summary": ""}
    return data
