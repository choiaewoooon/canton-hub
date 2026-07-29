"""
CoinGecko 레이트리밋(429) 대응 테스트.

배경: `COINGECKO_API_KEY`가 비어 있어 키 없는 공개 등급으로 호출한다(분당 한도가 낮음).
이때 markets가 429를 받자마자 simple/price로 폴백하면 **같은 레이트리밋 버킷을
한 번 더 두드려** 호출량이 2배가 된다. 이미 막힌 상태에서 더 세게 미는 꼴이라
회복이 더 느려진다. → 429일 때는 폴백하지 않고 직전 캐시를 유지한다.
"""
import httpx
import pytest

from collectors.price_collector import PriceCollector


def _resp(status: int) -> httpx.Response:
    return httpx.Response(status, request=httpx.Request("GET", "https://api.coingecko.com/x"))


@pytest.mark.asyncio
async def test_429_skips_fallback_to_avoid_doubling_calls(monkeypatch):
    c = PriceCollector()
    calls = {"markets": 0, "simple": 0}

    async def markets():
        calls["markets"] += 1
        raise httpx.HTTPStatusError("429", request=_resp(429).request, response=_resp(429))

    async def simple():
        calls["simple"] += 1
        raise AssertionError("429에서 폴백하면 안 된다 — 같은 버킷을 두 번 두드린다")

    monkeypatch.setattr(c, "_fetch_markets_data", markets)
    monkeypatch.setattr(c, "_fetch_simple_price", simple)

    data = await c.collect()
    await c.close()

    assert calls["markets"] == 1
    assert calls["simple"] == 0
    assert data.fetched is False, "미수집으로 반환해야 스케줄러가 직전 캐시를 유지한다"


@pytest.mark.asyncio
async def test_non_429_failure_still_falls_back(monkeypatch):
    """일시적 네트워크 오류는 폴백이 실제로 도움이 되므로 유지한다."""
    c = PriceCollector()
    calls = {"simple": 0}

    async def markets():
        raise httpx.ConnectError("boom")

    async def simple():
        calls["simple"] += 1
        from collectors.price_collector import PriceData
        return PriceData(current_price_usd=0.12, fetched=True)

    monkeypatch.setattr(c, "_fetch_markets_data", markets)
    monkeypatch.setattr(c, "_fetch_simple_price", simple)

    data = await c.collect()
    await c.close()

    assert calls["simple"] == 1
    assert data.fetched is True
    assert data.current_price_usd == 0.12


@pytest.mark.asyncio
async def test_500_from_markets_still_falls_back(monkeypatch):
    """429가 아닌 HTTP 에러는 폴백 대상 — 레이트리밋과 구분해야 한다."""
    c = PriceCollector()
    calls = {"simple": 0}

    async def markets():
        raise httpx.HTTPStatusError("503", request=_resp(503).request, response=_resp(503))

    async def simple():
        calls["simple"] += 1
        from collectors.price_collector import PriceData
        return PriceData(current_price_usd=0.13, fetched=True)

    monkeypatch.setattr(c, "_fetch_markets_data", markets)
    monkeypatch.setattr(c, "_fetch_simple_price", simple)

    data = await c.collect()
    await c.close()

    assert calls["simple"] == 1
    assert data.fetched is True
