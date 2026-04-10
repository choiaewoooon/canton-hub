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
