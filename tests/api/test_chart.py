# tests/api/test_chart.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


@pytest.fixture
def seeded_cache():
    cache = TTLCache()
    cache.set("chart:price:7d", [
        {"time": "2026-04-03T00:00:00", "open": 0.14, "high": 0.145, "low": 0.138, "close": 0.142},
        {"time": "2026-04-04T00:00:00", "open": 0.142, "high": 0.15, "low": 0.14, "close": 0.148},
    ], ttl=300)
    return cache


@pytest.mark.asyncio
async def test_chart_price(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/chart/price?period=7d")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["close"] == 0.142
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_chart_invalid_type():
    cache = TTLCache()
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/chart/invalid?period=7d")
    assert resp.status_code == 400
    app.dependency_overrides.clear()
