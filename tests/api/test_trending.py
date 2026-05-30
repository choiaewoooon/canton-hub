# tests/api/test_trending.py
import pytest

from api.scheduler import collect_trending
from api.cache import TTLCache


@pytest.mark.asyncio
async def test_trending_reads_tweet_items():
    """v2 회귀 방지: 트렌딩은 feed:{lang}.items가 아니라 tweet:items를 읽어야 한다."""
    cache = TTLCache()
    cache.set("tweet:items", [
        {"source": "@x", "ts": "2026-05-30T11:00:00+00:00",
         "text": "Canton partnership tokenized collateral announcement", "url": "u1", "category": "partnership"},
        {"source": "@y", "ts": "2026-05-30T10:00:00+00:00",
         "text": "Canton validator tokenized collateral pilot", "url": "u2", "category": "validator"},
    ], ttl=900)
    await collect_trending(cache)
    data = cache.get("analytics:trending")
    assert data is not None
    kws = [k["keyword"] for k in data["keywords"]]
    assert kws, "tweet:items에서 키워드가 추출되어야 한다"
    # 반복 등장 단어가 상위에 올라와야 함
    assert "tokenized" in kws or "collateral" in kws or "canton" in kws
    # last_seen은 이제 ts(ISO)
    assert any((k["last_seen"] or "").startswith("2026-05-30") for k in data["keywords"])


@pytest.mark.asyncio
async def test_trending_empty_when_no_tweets():
    cache = TTLCache()
    await collect_trending(cache)
    assert cache.get("analytics:trending") == {"keywords": [], "fetched_at": None}
