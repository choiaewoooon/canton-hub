# tests/api/test_feed.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


@pytest.fixture
def seeded_cache():
    cache = TTLCache()
    cache.set("feed:ko", {
        "lang": "ko",
        "items": [
            {"source": "@CantonNetwork", "time_ago": "2시간 전", "text": "Canton 네트워크 일일 활성 주소가 82K+를 돌파...", "url": "https://x.com/CantonNetwork/status/123"},
        ],
        "ai_summary": "오늘의 핵심: 일일 소각량 증가 추세 지속 중.",
    }, ttl=900)
    cache.set("feed:en", {
        "lang": "en",
        "items": [
            {"source": "@CantonNetwork", "time_ago": "2h ago", "text": "Canton Network daily active addresses surpass 82K+...", "url": "https://x.com/CantonNetwork/status/123"},
        ],
        "ai_summary": "Key takeaway: daily burn continues to increase.",
    }, ttl=900)
    return cache


@pytest.mark.asyncio
async def test_feed_korean(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/feed?lang=ko")
    assert resp.status_code == 200
    data = resp.json()
    assert data["lang"] == "ko"
    assert len(data["items"]) == 1
    assert "2시간 전" in data["items"][0]["time_ago"]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_defaults_to_en():
    cache = TTLCache()
    cache.set("feed:en", {"lang": "en", "items": [], "ai_summary": ""}, ttl=900)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/feed")
    assert resp.status_code == 200
    data = resp.json()
    assert data["lang"] == "en"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_empty_includes_fetched_at():
    """캐시 미스 시 폴백 응답에도 fetched_at 키가 포함되어야 한다(프론트 타입 정합)."""
    cache = TTLCache()  # feed:* 미설정 → 캐시 미스
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/feed?lang=ko")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["fetched_at"] is None
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_passes_through_ts_and_fetched_at():
    """아이템의 절대 타임스탬프 ts와 피드 fetched_at이 그대로 전달되어야 한다."""
    cache = TTLCache()
    cache.set("feed:ko", {
        "lang": "ko",
        "items": [
            {"source": "@CantonNetwork", "time_ago": "4시간 전",
             "ts": "2026-05-30T08:00:00+00:00", "text": "...", "url": "https://x.com/CantonNetwork/status/123"},
        ],
        "ai_summary": "",
        "fetched_at": "2026-05-30T12:00:00+00:00",
    }, ttl=900)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/feed?lang=ko")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"][0]["ts"] == "2026-05-30T08:00:00+00:00"
    assert data["fetched_at"] == "2026-05-30T12:00:00+00:00"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_merges_tweets_and_media_sorted_by_ts():
    cache = TTLCache()
    cache.set("feed:ko", {
        "lang": "ko", "ai_summary": "", "fetched_at": "2026-05-30T12:00:00+00:00",
        "items": [
            {"kind": "tweet", "source": "@CantonNetwork", "time_ago": "1시간 전",
             "ts": "2026-05-30T11:00:00+00:00", "text": "tweet A", "url": "https://x/1"},
        ],
    }, ttl=900)
    cache.set("media:items", [
        {"url": "https://n/1", "guid": "g1", "ts": "2026-05-30T11:30:00+00:00",
         "publisher": "CoinDesk", "category": "etf_product",
         "title": {"ko": "ETF 상장", "en": "ETF listed"},
         "summary": {"ko": "코인데스크 요약", "en": "summary"}},
    ], ttl=7200)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/feed?lang=ko")
    data = resp.json()
    assert [i["kind"] for i in data["items"]] == ["news", "tweet"]  # 11:30 > 11:00
    news = data["items"][0]
    assert news["title"] == "ETF 상장"
    assert news["text"] == "코인데스크 요약"
    assert news["category"] == "etf_product"
    assert news["source"] == "CoinDesk"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_news_lang_fallback_to_en():
    cache = TTLCache()
    cache.set("media:items", [
        {"url": "https://n/2", "guid": "g2", "ts": "2026-05-30T10:00:00+00:00",
         "publisher": "Canton Blog", "category": "tokenomics",
         "title": {"en": "Only English"}, "summary": {"en": "english only"}},
    ], ttl=7200)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/feed?lang=ja")  # ja 없음 → en 폴백
    data = resp.json()
    assert data["items"][0]["title"] == "Only English"
    assert data["items"][0]["text"] == "english only"
    app.dependency_overrides.clear()
