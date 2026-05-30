import pytest
import httpx
from collectors.funding_rates import FundingRate, to_apr
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


def test_to_apr_1h():
    # 0.00012/1h → 0.00012 * 8760 * 100
    assert to_apr(0.00012, 1) == pytest.approx(105.12, abs=0.01)


def test_to_apr_8h():
    # 0.00045/8h → 0.00045 * 1095 * 100
    assert to_apr(0.00045, 8) == pytest.approx(49.275, abs=0.01)


def test_to_apr_negative_keeps_sign():
    assert to_apr(-0.00045, 8) < 0


def test_funding_rate_dataclass_fields():
    fr = FundingRate(
        source="Hyperliquid", venue_type="DEX", market="perpetual",
        pair="CC/USD", fr_raw=0.00012, period_hours=1,
        fr_apr=105.12, next_funding_ts=1747300000, api_source="hyperliquid.xyz",
    )
    assert fr.source == "Hyperliquid"
    assert fr.period_hours == 1


# Stub clients for testing
class _FakeResp:
    def __init__(self, payload):
        self._p = payload
    def raise_for_status(self):
        pass
    def json(self):
        return self._p


class _FakeClient:
    """post/get을 미리 지정한 payload로 응답하는 stub."""
    def __init__(self, payload):
        self._p = payload
    async def post(self, *a, **k):
        return _FakeResp(self._p)
    async def get(self, *a, **k):
        return _FakeResp(self._p)


@pytest.mark.asyncio
async def test_fetch_hyperliquid_funding_parses():
    from collectors.funding_rates import fetch_hyperliquid_funding
    payload = [
        {"universe": [{"name": "CC"}]},
        [{"funding": "0.00012", "markPx": "0.16"}],
    ]
    fr = await fetch_hyperliquid_funding(_FakeClient(payload))
    assert fr is not None
    assert fr.source == "Hyperliquid"
    assert fr.period_hours == 1
    assert fr.fr_raw == pytest.approx(0.00012)
    assert fr.fr_apr == pytest.approx(105.12, abs=0.01)


@pytest.mark.asyncio
async def test_fetch_lighter_funding_parses():
    from collectors.funding_rates import fetch_lighter_funding
    payload = {"funding_rates": [
        {"exchange": "binance", "symbol": "CC", "rate": 0.0001},
        {"exchange": "lighter", "symbol": "CC", "rate": 0.00032},
    ]}
    fr = await fetch_lighter_funding(_FakeClient(payload))
    assert fr.source == "Lighter"
    assert fr.fr_raw == pytest.approx(0.00032)
    assert fr.period_hours == 1


@pytest.mark.asyncio
async def test_fetch_hyperliquid_funding_handles_error():
    from collectors.funding_rates import fetch_hyperliquid_funding
    class _BoomClient:
        async def post(self, *a, **k):
            raise httpx.TimeoutException("boom")
    assert await fetch_hyperliquid_funding(_BoomClient()) is None


@pytest.mark.asyncio
async def test_fetch_lighter_funding_handles_error():
    from collectors.funding_rates import fetch_lighter_funding
    class _BoomGetClient:
        async def get(self, *a, **k):
            raise httpx.TimeoutException("boom")
    assert await fetch_lighter_funding(_BoomGetClient()) is None


@pytest.mark.asyncio
async def test_fetch_aster_funding_parses():
    from collectors.funding_rates import fetch_aster_funding
    payload = {"lastFundingRate": "0.0001", "nextFundingTime": 1747310400000}
    fr = await fetch_aster_funding(_FakeClient(payload))
    assert fr.source == "Aster"
    assert fr.period_hours == 8
    assert fr.next_funding_ts == 1747310400  # ms -> s


@pytest.mark.asyncio
async def test_fetch_extended_funding_parses():
    from collectors.funding_rates import fetch_extended_funding
    payload = {"data": [{"name": "CC-USD", "marketStats": {"fundingRate": "0.00005"}}]}
    fr = await fetch_extended_funding(_FakeClient(payload))
    assert fr.source == "Extended"
    assert fr.period_hours == 1
    assert fr.fr_raw == pytest.approx(0.00005)


@pytest.mark.asyncio
async def test_fetch_binance_funding_parses():
    from collectors.funding_rates import fetch_binance_funding
    payload = {"lastFundingRate": "-0.0002", "nextFundingTime": 1747310400000}
    fr = await fetch_binance_funding(_FakeClient(payload))
    assert fr.source == "Binance Perp"
    assert fr.fr_raw < 0
    assert fr.period_hours == 8


@pytest.mark.asyncio
async def test_fetch_bybit_funding_parses():
    from collectors.funding_rates import fetch_bybit_funding
    payload = {"result": {"list": [{"fundingRate": "-0.00045", "nextFundingTime": "1747310400000"}]}}
    fr = await fetch_bybit_funding(_FakeClient(payload))
    assert fr.source == "Bybit Perp"
    assert fr.fr_apr == pytest.approx(-49.275, abs=0.01)


@pytest.mark.asyncio
async def test_fetch_okx_funding_parses():
    from collectors.funding_rates import fetch_okx_funding
    payload = {"data": [{"fundingRate": "0.00008", "fundingTime": "1747310400000"}]}
    fr = await fetch_okx_funding(_FakeClient(payload))
    assert fr.source == "OKX Perp"
    assert fr.period_hours == 8


@pytest.mark.asyncio
async def test_collect_all_skips_failures(monkeypatch):
    import collectors.funding_rates as m

    async def ok(client):
        return FundingRate("X", "DEX", "perpetual", "CC/USD",
                            0.0001, 1, to_apr(0.0001, 1), 1747300000, "x")
    async def fail(client):
        return None

    monkeypatch.setattr(m, "fetch_hyperliquid_funding", ok)
    monkeypatch.setattr(m, "fetch_lighter_funding", fail)
    monkeypatch.setattr(m, "fetch_aster_funding", fail)
    monkeypatch.setattr(m, "fetch_extended_funding", fail)
    monkeypatch.setattr(m, "fetch_binance_funding", ok)
    monkeypatch.setattr(m, "fetch_bybit_funding", fail)
    monkeypatch.setattr(m, "fetch_okx_funding", fail)

    rates = await m.collect_all_funding_rates()
    assert len(rates) == 2
    assert all(isinstance(r, FundingRate) for r in rates)


@pytest.mark.asyncio
async def test_funding_rates_route_returns_cached():
    cache = TTLCache()
    cache.set("analytics:funding-rates", {
        "rates": [{"source": "Lighter", "fr_apr": 28.0}],
        "updated_at": "2026-05-15T10:00:00",
    }, ttl=90)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/analytics/funding-rates")
    assert resp.status_code == 200
    body = resp.json()
    assert body["rates"][0]["source"] == "Lighter"
    assert body["updated_at"] == "2026-05-15T10:00:00"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_funding_rates_route_empty_cache():
    app.dependency_overrides[get_cache] = lambda: TTLCache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/analytics/funding-rates")
    assert resp.status_code == 200
    assert resp.json() == {"rates": [], "updated_at": None}
    app.dependency_overrides.clear()
