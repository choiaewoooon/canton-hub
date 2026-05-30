# tests/api/test_feed.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


def _seed(cache, *, tweets=None, media=None, summary=None):
    if tweets is not None:
        cache.set("tweet:items", tweets, ttl=900)
    if media is not None:
        cache.set("media:items", media, ttl=900)
    if summary is not None:
        cache.set(f"feed:{summary['lang']}", summary, ttl=900)


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_feed_empty_returns_shape():
    cache = TTLCache()
    app.dependency_overrides[get_cache] = lambda: cache
    async with _client() as c:
        resp = await c.get("/api/feed?lang=ko")
    assert resp.status_code == 200
    d = resp.json()
    assert d["lang"] == "ko"
    assert d["items"] == []
    assert d["total"] == 0
    assert d["page"] == 1
    assert d["fetched_at"] is None
    assert d["ai_summary"] == ""
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_defaults_lang_to_en():
    cache = TTLCache()
    app.dependency_overrides[get_cache] = lambda: cache
    async with _client() as c:
        resp = await c.get("/api/feed")
    assert resp.json()["lang"] == "en"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_merges_and_sorts_by_ts():
    cache = TTLCache()
    _seed(cache,
        tweets=[{"source": "@CantonNetwork", "ts": "2026-05-30T11:00:00+00:00",
                 "text": "tweet A", "url": "https://x/1", "category": "partnership"}],
        media=[{"url": "https://n/1", "guid": "g1", "ts": "2026-05-30T11:30:00+00:00",
                "publisher": "CoinDesk", "category": "etf_product",
                "title": {"ko": "ETF 상장", "en": "ETF listed"},
                "summary": {"ko": "코인데스크 요약", "en": "summary"}}],
        summary={"lang": "ko", "ai_summary": "오늘의 요약", "fetched_at": "2026-05-30T12:00:00+00:00"})
    app.dependency_overrides[get_cache] = lambda: cache
    async with _client() as c:
        resp = await c.get("/api/feed?lang=ko")
    d = resp.json()
    assert [i["kind"] for i in d["items"]] == ["news", "tweet"]  # 11:30 > 11:00
    news = d["items"][0]
    assert news["title"] == "ETF 상장" and news["text"] == "코인데스크 요약"
    assert news["category"] == "etf_product" and news["source"] == "CoinDesk"
    tweet = d["items"][1]
    assert tweet["kind"] == "tweet" and tweet["category"] == "partnership"
    assert d["ai_summary"] == "오늘의 요약"
    assert d["fetched_at"] == "2026-05-30T12:00:00+00:00"
    assert d["total"] == 2
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_paginates_10_per_page():
    cache = TTLCache()
    # 23 tweets with descending ts
    tweets = [{"source": "@x", "ts": f"2026-05-{30:02d}T{23 - i:02d}:00:00+00:00",
               "text": f"t{i}", "url": f"https://x/{i}", "category": "other"} for i in range(23)]
    _seed(cache, tweets=tweets, media=[])
    app.dependency_overrides[get_cache] = lambda: cache
    async with _client() as c:
        p1 = (await c.get("/api/feed?lang=en&page=1")).json()
        p2 = (await c.get("/api/feed?lang=en&page=2")).json()
        p3 = (await c.get("/api/feed?lang=en&page=3")).json()
    assert p1["total"] == 23 and p1["total_pages"] == 3
    assert len(p1["items"]) == 10 and len(p2["items"]) == 10 and len(p3["items"]) == 3
    # no overlap between pages
    urls = [i["url"] for i in p1["items"] + p2["items"] + p3["items"]]
    assert len(urls) == len(set(urls)) == 23
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_news_lang_fallback_to_en():
    cache = TTLCache()
    _seed(cache, tweets=[], media=[
        {"url": "https://n/2", "guid": "g2", "ts": "2026-05-30T10:00:00+00:00",
         "publisher": "Canton Blog", "category": "tokenomics",
         "title": {"en": "Only English"}, "summary": {"en": "english only"}}])
    app.dependency_overrides[get_cache] = lambda: cache
    async with _client() as c:
        resp = await c.get("/api/feed?lang=ja")  # ja missing → en fallback
    d = resp.json()
    assert d["items"][0]["title"] == "Only English"
    assert d["items"][0]["text"] == "english only"
    app.dependency_overrides.clear()
