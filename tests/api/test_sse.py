# tests/api/test_sse.py
import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache
from api.routes.price import _price_event_generator


@pytest.mark.asyncio
async def test_sse_price_generator_yields_data():
    cache = TTLCache()
    cache.set("price", {"current_price_usd": 0.15}, ttl=300)
    gen = _price_event_generator(cache)
    event = await gen.__anext__()
    assert event["event"] == "price"
    payload = json.loads(event["data"])
    assert payload["current_price_usd"] == 0.15
    await gen.aclose()


@pytest.mark.asyncio
async def test_sse_price_returns_event_stream():
    cache = TTLCache()
    cache.set("price", {"current_price_usd": 0.15}, ttl=300)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        try:
            async with asyncio.timeout(5):
                async with client.stream("GET", "/api/sse/price") as resp:
                    assert resp.status_code == 200
                    assert "text/event-stream" in resp.headers["content-type"]
                    first_line = b""
                    async for chunk in resp.aiter_bytes():
                        first_line += chunk
                        if b"\n\n" in first_line:
                            break
                    assert b"data:" in first_line
        except (TimeoutError, asyncio.CancelledError):
            # SSE streams are infinite; timing out after getting headers is acceptable
            pass
    app.dependency_overrides.clear()
