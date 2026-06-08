"""Unit tests for Finnhub stock-price source + last-good price retention (no live network)."""
import asyncio

import httpx

import config
from collectors import dat_collector
from collectors.dat_collector import (
    _fetch_finnhub,
    _fetch_nasdaq,
    _fetch_yahoo,
    _last_good_prices,
    _parse_money,
)


def test_parse_money_formats():
    assert _parse_money("$2.30") == 2.30
    assert _parse_money("1,234.5") == 1234.5
    assert _parse_money("N/A") is None
    assert _parse_money(None) is None
    assert _parse_money("") is None


def test_nasdaq_parses_last_sale_price():
    body = {"data": {"symbol": "CNTN", "primaryData": {"lastSalePrice": "$2.30"}}, "status": {"rCode": 200}}

    async def run():
        async with _client_returning(body) as c:
            return await _fetch_nasdaq(c, "CNTN")

    assert asyncio.run(run()) == 2.30


def _client_returning(json_body, status=200):
    """httpx.AsyncClient that always responds with the given JSON (MockTransport)."""
    def handler(request):
        return httpx.Response(status, json=json_body)
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_finnhub_parses_current_price(monkeypatch):
    monkeypatch.setattr(config, "FINNHUB_API_KEY", "test-key")

    async def run():
        async with _client_returning({"c": 2.3, "h": 2.4, "l": 2.1, "pc": 2.2}) as c:
            return await _fetch_finnhub(c, "CNTN")

    assert asyncio.run(run()) == 2.3


def test_finnhub_zero_price_is_none(monkeypatch):
    """미상장/오류 시 Finnhub는 c=0 → None 취급(폴백 유도)."""
    monkeypatch.setattr(config, "FINNHUB_API_KEY", "test-key")

    async def run():
        async with _client_returning({"c": 0, "h": 0, "l": 0, "pc": 0}) as c:
            return await _fetch_finnhub(c, "NOPE")

    assert asyncio.run(run()) is None


def test_finnhub_no_key_returns_none(monkeypatch):
    """키 없으면 네트워크 호출 없이 None."""
    monkeypatch.setattr(config, "FINNHUB_API_KEY", "")

    async def run():
        async with _client_returning({"c": 9.9}) as c:
            return await _fetch_finnhub(c, "CNTN")

    assert asyncio.run(run()) is None


def test_yahoo_retries_on_429_then_succeeds(monkeypatch):
    """429를 두 번 맞아도 backoff 재시도로 세 번째 200을 받아 가격을 반환."""
    async def _no_sleep(*_):
        return None
    monkeypatch.setattr(dat_collector.asyncio, "sleep", _no_sleep)  # 테스트 즉시
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, json={})
        return httpx.Response(200, json={"chart": {"result": [{"meta": {"regularMarketPrice": 2.3}}]}})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            return await _fetch_yahoo(c, "CNTN")

    assert asyncio.run(run()) == 2.3
    assert calls["n"] == 3


def test_yahoo_gives_up_after_3_429(monkeypatch):
    async def _no_sleep(*_):
        return None
    monkeypatch.setattr(dat_collector.asyncio, "sleep", _no_sleep)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(429, json={})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            return await _fetch_yahoo(c, "CNTN")

    assert asyncio.run(run()) is None
    assert calls["n"] == 3  # 3회 시도 후 포기


def test_last_good_prices_extracts_valid_only(monkeypatch):
    monkeypatch.setattr(dat_collector, "load_cached_dat", lambda: {
        "companies": [
            {"ticker": "CNTN", "stock_price": 2.3},
            {"ticker": "ZERO", "stock_price": 0},      # 0은 무효 → 제외
            {"ticker": "NULLP", "stock_price": None},  # None → 제외
        ]
    })
    out = _last_good_prices()
    assert out == {"CNTN": 2.3}


def test_last_good_prices_empty_when_no_cache(monkeypatch):
    monkeypatch.setattr(dat_collector, "load_cached_dat", lambda: None)
    assert _last_good_prices() == {}
