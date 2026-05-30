# api/routes/feed.py
"""Feed endpoint — 트위터 + 미디어(RSS) 통합 타임라인."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

SUPPORTED_LANGS = {"ko", "en", "ja", "zh"}
_MERGED_MAX = 25


def _pick(d: dict, lang: str) -> str:
    """언어별 필드 선택, 없으면 en 폴백, 그것도 없으면 빈 문자열."""
    if not isinstance(d, dict):
        return ""
    return d.get(lang) or d.get("en") or ""


def _media_to_item(rec: dict, lang: str) -> dict:
    return {
        "kind": "news",
        "source": rec.get("publisher", ""),
        "time_ago": "",  # 프론트가 ts로 계산
        "ts": rec.get("ts", ""),
        "text": _pick(rec.get("summary", {}), lang),
        "url": rec.get("url", ""),
        "title": _pick(rec.get("title", {}), lang),
        "category": rec.get("category", "other"),
    }


@router.get("/feed")
async def get_feed(lang: str = "en", cache: TTLCache = Depends(get_cache)):
    if lang not in SUPPORTED_LANGS:
        lang = "en"
    feed = cache.get(f"feed:{lang}") or {"items": [], "ai_summary": "", "fetched_at": None}

    tweets = [{**t, "kind": t.get("kind", "tweet")} for t in feed.get("items", [])]
    media = cache.get("media:items") or []
    news = [_media_to_item(r, lang) for r in media]

    merged = tweets + news
    merged.sort(key=lambda x: x.get("ts") or "", reverse=True)
    merged = merged[:_MERGED_MAX]

    return {
        "lang": lang,
        "items": merged,
        "ai_summary": feed.get("ai_summary", ""),
        "fetched_at": feed.get("fetched_at"),
    }
