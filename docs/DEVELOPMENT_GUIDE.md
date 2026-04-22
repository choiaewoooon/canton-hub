# DEVELOPMENT_GUIDE.md — Canton Hub

> **Update Triggers**: WHEN adding a new collector → update Templates + Pre-Work Checklist. WHEN a new bug pattern is encountered twice → add to Bug Pattern Catalog. WHEN test infrastructure changes → update Testing Standards.

**Scope**: Canton Hub FastAPI backend (Python 3.12 + FastAPI + APScheduler + httpx + Playwright).
**Audience**: AI agents and humans adding collectors, routes, or scheduler tasks.

---

## 1. Pre-Work Checklist

Run this checklist BEFORE writing any code. Check each box explicitly.

| # | Check | Command / Action | Pass Condition |
|---|-------|------------------|----------------|
| 1 | Python version | `python --version` | `Python 3.12.*` |
| 2 | Virtualenv active | `which python` | Path contains `.venv` |
| 3 | Deps installed | `pip install -r requirements.txt` | Exit 0 |
| 4 | Playwright browsers | `playwright install chromium` | Chromium present |
| 5 | Existing collectors | `ls api/collectors/` | Check siblings for patterns |
| 6 | Cache dependency wired | `grep -n "get_cache" api/dependencies.py` | Function exists |
| 7 | Scheduler entrypoint | `grep -n "start_scheduler" api/scheduler.py` | Function exists |
| 8 | Tests green baseline | `pytest tests/api/ -q` | All pass before changes |
| 9 | `collectors/__init__.py` exports | `grep -n "from .my" api/collectors/__init__.py` | Match planned export |
| 10 | Bot sibling usage check | `grep -rn "canton-hub/collectors" ../canton-bot/` | Know who imports this |

**WHEN any check fails → STOP and fix before proceeding.**

---

## 2. Standard Templates

Copy these verbatim. Do NOT deviate without a documented reason in the PR.

### 2.1 Collector Template

Location: `api/collectors/my_collector.py`

```python
import logging
import httpx
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class MyData:
    value: float | None = None
    fetched: bool = False

class MyCollector:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=15)

    async def collect(self) -> MyData:
        try:
            r = await self.client.get("https://api.example.com/data")
            r.raise_for_status()
            return MyData(value=r.json()["value"], fetched=True)
        except Exception as e:
            logger.warning(f"MyCollector failed: {e}")
            return MyData()  # empty, fetched=False

    async def close(self):
        await self.client.aclose()
```

**Rules**:
- Collectors MUST return a dataclass with `fetched: bool`.
- Collectors MUST NOT raise. Catch everything, log warning, return empty dataclass.
- `timeout=15` is mandatory on every `httpx.AsyncClient`.
- Always provide `close()` and call it from the scheduler loop `finally`.

### 2.2 Route Template

Location: `api/routes/my_route.py`

```python
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

_EMPTY = {"value": None}

@router.get("/mydata")
async def get_mydata(cache: TTLCache = Depends(get_cache)):
    return cache.get("mydata") or _EMPTY
```

**Rules**:
- Routes are thin: DI `get_cache` → read cache → fallback `_EMPTY_*` constant.
- NEVER call collectors directly from routes. Collectors run in scheduler only.
- Define `_EMPTY_*` module-level to avoid allocating per request.

### 2.3 Scheduler Loop Template

Location: `api/scheduler.py`

```python
async def collect_mydata(cache: TTLCache):
    collector = MyCollector()
    try:
        data = await collector.collect()
        if data.fetched:
            cache.set("mydata", {"value": data.value}, ttl=300)
            logger.info(f"MyData cached: value={data.value}")
    finally:
        await collector.close()

# In start_scheduler():
asyncio.create_task(_loop(collect_mydata, cache, 300, "mydata"))
```

**Rules**:
- One `asyncio.create_task(_loop(...))` per collector.
- Only `cache.set` WHEN `data.fetched is True` — never overwrite good data with empty.
- Interval (3rd arg) in seconds; label (4th arg) used for logs.

---

## 3. Utility Function Reference

### 3.1 `TTLCache` API (`api/cache.py`)

| Method | Signature | Behavior |
|--------|-----------|----------|
| `get` | `get(key: str) -> Any \| None` | Returns value or `None` if missing/expired. Thread-safe via `Lock`. |
| `set` | `set(key: str, value: Any, ttl: int) -> None` | Stores with TTL in seconds. Overwrites existing. |
| `delete` | `delete(key: str) -> None` | Removes key. No-op if absent. |
| `clear` | `clear() -> None` | Drops all entries. Used in tests. |

**Thread safety**: All mutations go through an internal `threading.Lock`. Safe for APScheduler + FastAPI concurrency.

### 3.2 `get_cache` DI (`api/dependencies.py`)

```python
def get_cache() -> TTLCache:
    return _cache_singleton
```

- Returns the process-wide singleton created at app startup.
- Use via `Depends(get_cache)` in routes only. Scheduler references the singleton directly.

### 3.3 `_loop` Helper (`api/scheduler.py`)

```python
async def _loop(collect_fn, cache, interval: int, label: str):
    while True:
        try:
            await collect_fn(cache)
        except Exception as e:
            logger.error(f"[{label}] loop error: {e}")
        await asyncio.sleep(interval)
```

- Wraps every collector with a resilient infinite loop.
- Catches all exceptions so one bad collector cannot kill the scheduler.
- `label` appears in every log line for grep-ability.

---

## 4. Testing Standards

| Topic | Rule |
|-------|------|
| Test directory | `tests/api/` — mirrors `api/` structure |
| Test naming | `test_<module>.py`, function `test_<behavior>` |
| Async tests | Mark with `@pytest.mark.asyncio` |
| HTTP mocking | Use `respx` or `httpx.MockTransport` — NEVER hit real APIs in tests |
| Playwright tests | Mark `@pytest.mark.slow`, skip in CI default run |
| Cache isolation | `cache.clear()` in fixture teardown |
| Fixtures | Shared fixtures in `tests/api/conftest.py` |

**Async collector test pattern**:

```python
import pytest
import httpx
from api.collectors.my_collector import MyCollector

@pytest.mark.asyncio
async def test_my_collector_success(respx_mock):
    respx_mock.get("https://api.example.com/data").mock(
        return_value=httpx.Response(200, json={"value": 42})
    )
    c = MyCollector()
    try:
        result = await c.collect()
        assert result.fetched is True
        assert result.value == 42
    finally:
        await c.close()

@pytest.mark.asyncio
async def test_my_collector_failure_returns_empty(respx_mock):
    respx_mock.get("https://api.example.com/data").mock(
        return_value=httpx.Response(500)
    )
    c = MyCollector()
    try:
        result = await c.collect()
        assert result.fetched is False
        assert result.value is None
    finally:
        await c.close()
```

**Route test pattern**:

```python
from fastapi.testclient import TestClient
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache

def test_get_mydata_empty():
    fake = TTLCache()
    app.dependency_overrides[get_cache] = lambda: fake
    client = TestClient(app)
    r = client.get("/api/mydata")
    assert r.status_code == 200
    assert r.json() == {"value": None}
    app.dependency_overrides.clear()
```

**Gate command**: `pytest tests/api/ -q` MUST pass before commit.

---

## 5. Bug Pattern Catalog

Every entry: symptom → root cause → search query → fix.

### 5.1 CoinGecko 429 Cascade

| Field | Value |
|-------|-------|
| Symptom | Both canton-hub and canton-bot log `429 Too Many Requests` from CoinGecko simultaneously |
| Root cause | Web scheduler + bot run duplicate collectors on the same egress IP; free tier shares rate budget |
| Search query | `grep -rn "COINGECKO_API_KEY" api/` and `grep -rn "coingecko" api/collectors/` |
| Fix | Use demo API key env var, add file cache fallback, bump TTL (≥300s) |
| Prevention | Single source of truth: only canton-hub collects; bot reads canton-hub API |

### 5.2 Backend code change not taking effect

| Field | Value |
|-------|-------|
| Symptom | 파일을 수정·저장했는데도 로그/동작이 이전 코드 그대로 |
| Root cause | `com.cobling.canton-hub-backend` LaunchAgent가 `KeepAlive=true`로 같은 프로세스를 며칠 단위 유지 → 인메모리에 올라간 old module 객체가 계속 사용됨 |
| Search query | `ps -ef \| grep uvicorn`, `stat -f "%Sm %N" __pycache__/<module>.cpython-312.pyc` |
| Fix | `launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend` — KeepAlive가 즉시 새 프로세스 스폰 |
| Prevention | 코드 변경 후 체크리스트에 kickstart 포함. 2026-04-20 canton-bot에서 동일 증상으로 Twitter 호스트 교체가 3일 지연됨 |

### 5.3 CantonScan SPA Load Race

| Field | Value |
|-------|-------|
| Symptom | CantonScan collector returns empty / partial data intermittently |
| Root cause | API responds before SPA hydrates the DOM we scrape |
| Search query | `grep -rn "cantonscan" api/collectors/` and `grep -rn "wait_for_selector" api/` |
| Fix | Playwright fallback chain: try API → IF empty, launch Playwright and `wait_for_selector` on hydrated element |
| Prevention | Never trust first paint; always `wait_for_selector` or `wait_for_load_state("networkidle")` |

### 5.4 BSD sed vs GNU sed in LaunchAgent Scripts

| Field | Value |
|-------|-------|
| Symptom | LaunchAgent script fails on macOS with `sed: 1: "...": invalid command code` |
| Root cause | macOS ships BSD sed; `sed -i` requires an explicit backup suffix argument |
| Search query | `grep -rn "sed -i" scripts/ ~/Library/LaunchAgents/` |
| Fix | Use `sed -i '' 's/foo/bar/' file` (empty string after `-i`) on macOS |
| Prevention | Prefer Python scripts over sed for cross-platform LaunchAgents |

### 5.5 Recharts Hardcoded Hex Colors

| Field | Value |
|-------|-------|
| Symptom | Light mode renders dark chart strokes/fills; theme toggle does not affect charts |
| Root cause | Chart components hardcoded hex (`#00d4ff`) instead of CSS variables |
| Search query | `grep -rn "stroke=\"#" web/src/` and `grep -rn "fill=\"#" web/src/` |
| Fix | Replace with `var(--canton-primary)`, `var(--canton-accent)`, etc. |
| Prevention | Lint rule: forbid hex colors in `web/src/components/charts/` |

### 5.6 collectors `__init__.py` Drift

| Field | Value |
|-------|-------|
| Symptom | canton-bot fails to import on startup: `ImportError: cannot import name 'FooCollector'` |
| Root cause | A collector was removed or renamed in canton-hub without updating `api/collectors/__init__.py`, and canton-bot imports via sibling path |
| Search query | `grep -rn "from collectors" ../canton-bot/` and compare with `api/collectors/__init__.py` |
| Fix | Keep `api/collectors/__init__.py` exports in lock-step with files; remove stale re-exports in same commit |
| Prevention | CI check: import every symbol from `api.collectors` as a smoke test |

---

## 6. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성 — 표준 템플릿, 유틸 레퍼런스, 버그 카탈로그 정립 |
