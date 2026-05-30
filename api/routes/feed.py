# api/routes/feed.py
"""Feed endpoint — 트위터 + 미디어(RSS) 통합 타임라인 + 페이지네이션."""
import math

from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

SUPPORTED_LANGS = {"ko", "en", "ja", "zh"}
PAGE_SIZE = 10


def _pick(d: dict, lang: str) -> str:
    if not isinstance(d, dict):
        return ""
    return d.get(lang) or d.get("en") or ""


def _tweet_to_item(t: dict) -> dict:
    return {
        "kind": "tweet",
        "source": t.get("source", ""),
        "time_ago": "",
        "ts": t.get("ts", ""),
        "text": t.get("text", ""),
        "url": t.get("url", ""),
        "title": None,
        "category": t.get("category", "other"),
    }


def _media_to_item(rec: dict, lang: str) -> dict:
    return {
        "kind": "news",
        "source": rec.get("publisher", ""),
        "time_ago": "",
        "ts": rec.get("ts", ""),
        "text": _pick(rec.get("summary", {}), lang),
        "url": rec.get("url", ""),
        "title": _pick(rec.get("title", {}), lang),
        "category": rec.get("category", "other"),
    }


@router.get("/feed")
async def get_feed(lang: str = "en", page: int = 1, cache: TTLCache = Depends(get_cache)):
    if lang not in SUPPORTED_LANGS:
        lang = "en"
    if page < 1:
        page = 1

    summary = cache.get(f"feed:{lang}") or {}
    tweets = [_tweet_to_item(t) for t in (cache.get("tweet:items") or [])]
    news = [_media_to_item(r, lang) for r in (cache.get("media:items") or [])]

    merged = tweets + news
    merged.sort(key=lambda x: x.get("ts") or "", reverse=True)

    total = len(merged)
    total_pages = math.ceil(total / PAGE_SIZE) if total else 0
    start = (page - 1) * PAGE_SIZE
    items = merged[start:start + PAGE_SIZE]

    return {
        "lang": lang,
        "items": items,
        "ai_summary": summary.get("ai_summary", ""),
        "fetched_at": summary.get("fetched_at"),
        "page": page,
        "page_size": PAGE_SIZE,
        "total": total,
        "total_pages": total_pages,
    }
