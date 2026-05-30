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
