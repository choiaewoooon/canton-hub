# tests/api/test_network.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


@pytest.fixture
def seeded_cache():
    cache = TTLCache()
    cache.set("network", {
        "bm_ratio": 0.8542, "bm_status": "inflationary",
        "active_addresses_24h": 82156, "active_addresses_change": -2.53,
        "daily_burn_usd": 2_560_000, "daily_burn_change": 6.88,
        "private_tx_ratio": 35.9, "private_tx_count": 689472,
        "daily_mint": 5_200_000, "daily_burn": 4_400_000, "net_supply_change": 800_000,
    }, ttl=300)
    cache.set("network_status", {
        "total_supply": 38_280_000_000, "super_validators": 45, "validator_nodes": 866,
        "total_transfers_24h": 1_981_576, "cumulative_burned": 2_890_000_000, "cumulative_burn_rate": 7.02,
    }, ttl=3600)
    return cache


@pytest.mark.asyncio
async def test_network_returns_kpi(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/network")
    assert resp.status_code == 200
    data = resp.json()
    assert data["bm_ratio"] == 0.8542
    assert data["private_tx_ratio"] == 35.9
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_network_status(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/network/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["super_validators"] == 45
    app.dependency_overrides.clear()
