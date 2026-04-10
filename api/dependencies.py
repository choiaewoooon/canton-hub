"""Shared FastAPI dependencies."""
from api.cache import TTLCache

_cache = TTLCache()


def get_cache() -> TTLCache:
    return _cache
