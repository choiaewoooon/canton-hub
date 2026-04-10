import time
from api.cache import TTLCache


def test_get_returns_none_when_empty():
    cache = TTLCache()
    assert cache.get("missing") is None


def test_set_and_get():
    cache = TTLCache()
    cache.set("price", {"usd": 0.15}, ttl=60)
    assert cache.get("price") == {"usd": 0.15}


def test_expired_entry_returns_none():
    cache = TTLCache()
    cache.set("price", {"usd": 0.15}, ttl=0.1)
    time.sleep(0.15)
    assert cache.get("price") is None


def test_set_overwrites():
    cache = TTLCache()
    cache.set("key", "old", ttl=60)
    cache.set("key", "new", ttl=60)
    assert cache.get("key") == "new"
