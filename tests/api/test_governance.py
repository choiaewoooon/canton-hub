# tests/api/test_governance.py
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


@pytest.fixture
def seeded_cache():
    cache = TTLCache()
    cache.set("governance", {
        "active_proposals": 2,
        "recent_cips": [
            {
                "number": "CIP-0104",
                "title": "Traffic-Based App Rewards",
                "status": "Approved",
                "summary_ko": "트래픽 기반 앱 보상 체계 도입",
                "summary_en": "Introduce traffic-based app reward mechanism",
                "impact": "앱 개발자의 보상 구조가 트래픽 기반으로 변경됩니다",
                "github_url": "https://github.com/canton-foundation/cips/blob/main/cip-0104/cip-0104.md",
                "vote_url": "https://ccview.io/governance/",
            },
        ],
    }, ttl=3600)
    return cache


@pytest.mark.asyncio
async def test_governance_returns_data(seeded_cache):
    app.dependency_overrides[get_cache] = lambda: seeded_cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/governance")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_proposals"] == 2
    assert data["recent_cips"][0]["number"] == "CIP-0104"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_governance_empty_when_no_cache():
    cache = TTLCache()
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/governance")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_proposals"] == 0
    assert data["recent_cips"] == []
    app.dependency_overrides.clear()
