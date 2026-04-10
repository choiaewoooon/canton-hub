import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


@pytest.fixture
def seeded_cache():
    cache = TTLCache()
    cache.set("price", {
        "current_price_usd": 0.1543,
        "price_change_percentage_24h": 2.34,
        "high_24h": 0.1589,
        "low_24h": 0.1487,
        "market_cap": 5_850_000_000,
        "total_volume_24h": 4_200_000,
    }, ttl=300)
    return cache


@pytest.mark.asyncio
async def test_price_returns_cached_data(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/price")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_price_usd"] == 0.1543
    assert data["price_change_percentage_24h"] == 2.34
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_price_returns_empty_when_no_cache():
    empty_cache = TTLCache()
    app.dependency_overrides[get_cache] = lambda: empty_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/price")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_price_usd"] is None
    app.dependency_overrides.clear()
