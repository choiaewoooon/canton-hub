# Funding Rate / 양빵 매트릭스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canton Hub `/analytics` 페이지에 7개 Perp 거래소 펀딩비 표 + 양빵 페어 자동 추천 섹션을 추가한다.

**Architecture:** 기존 `realtime_prices.py` 패턴을 그대로 따른다 — 신규 collector(`funding_rates.py`)가 7개 거래소를 60초마다 병렬 fetch → TTL 캐시 → 신규 라우트(`/api/analytics/funding-rates`) → 프론트 SWR 훅 30초 polling → Tremor 컴포넌트가 표/추천/카운트다운 렌더. 페어 추천·카운트다운은 클라이언트 계산(백엔드는 raw만 제공).

**Tech Stack:** Python 3.12 / FastAPI / httpx / APScheduler · Next.js 16 / React 19 / TypeScript / Tremor / SWR

**Spec:** [2026-05-15-funding-rates-design.md](./2026-05-15-funding-rates-design.md)

---

## Scope

단일 plan. backend(FastAPI) + frontend(Next.js) 두 레이어를 다루지만 하나의 feature이고 type 동기화가 필수라 분리하지 않는다. backend가 먼저 동작해야 frontend를 실데이터로 검증할 수 있으므로 backend → frontend 순서.

## File Structure

### Backend
- **Create** `collectors/funding_rates.py` — `FundingRate` dataclass + `to_apr()` + 7개 `fetch_*_funding()` + `collect_all_funding_rates()`
- **Modify** `api/routes/analytics.py` — `GET /funding-rates` 엔드포인트 추가
- **Modify** `api/scheduler.py` — `collect_funding_rates` job 60초 tick 등록
- **Create** `tests/api/test_funding_rates.py` — fetcher(monkeypatch) + normalize + route(seeded_cache) 테스트
- **Modify** `docs/ARCHITECTURE.md` — Cache Key Map + API Contracts 갱신

### Frontend
- **Modify** `web/lib/types.ts` — `FundingRate`, `FundingRates` 인터페이스
- **Modify** `web/lib/api.ts` — `useFundingRates()` SWR 훅
- **Modify** `web/lib/format.ts` — `formatDuration(seconds, lang)` helper
- **Create** `web/components/analytics/funding-rate-matrix.i18n.ts` — 다국어 dictionary
- **Create** `web/components/analytics/funding-rate-matrix.tsx` — 메인 컴포넌트 + sub-component
- **Modify** `web/app/analytics/page.tsx` — `<ArbitrageTracker>` 아래 placement
- **Modify** `web/docs/ARCHITECTURE.md` — SWR Hook Map 갱신

---

## Task 0: 테스트 도구 설치 (사전 작업)

**문제:** `pytest`/`pytest-asyncio`가 venv에 없고 `requirements.txt`에도 없다 (`./venv/bin/python -m pytest` → `No module named pytest`). 기존 `tests/api/*.py`조차 현재 환경에서 실행 불가. Task 1의 첫 "fail 확인" 스텝부터 도구 에러로 막히므로 먼저 해결한다. prod 배포(`requirements.txt`)에는 테스트 의존성을 넣지 않고 별도 `requirements-dev.txt`로 분리한다.

**Files:**
- Create: `requirements-dev.txt`
- Create: `pytest.ini`

- [ ] **Step 1: `requirements-dev.txt` 생성**

```
# 개발/테스트 전용 — prod(requirements.txt)에 섞지 않음
-r requirements.txt
pytest>=8.0
pytest-asyncio>=0.23
```

- [ ] **Step 2: `pytest.ini` 생성** — 기존 테스트가 `@pytest.mark.asyncio` 마커 방식이므로 strict 모드

```ini
[pytest]
asyncio_mode = strict
testpaths = tests
```

- [ ] **Step 3: venv에 설치**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pip install -r requirements-dev.txt`
Expected: `Successfully installed ... pytest-8.x pytest-asyncio-0.x`

- [ ] **Step 4: 기존 테스트로 도구 동작 검증** (우리 코드 아직 0줄 — 순수 툴체인 확인)

Run: `./venv/bin/python -m pytest tests/api/test_cache.py tests/api/test_price.py -v`
Expected: PASS — `test_cache.py`(sync)로 pytest 자체, `test_price.py`(`@pytest.mark.asyncio`)로 pytest-asyncio + `asyncio_mode=strict`가 정상 resolve 되는지 함께 증명 (pytest.ini 오설정을 여기서 조기 발견)

- [ ] **Step 5: Commit**

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub
git add requirements-dev.txt pytest.ini
git commit -m "test: pytest + pytest-asyncio 개발 의존성 분리 (requirements-dev.txt)"
```

---

## Task 1: `FundingRate` dataclass + APR 정규화

**Files:**
- Create: `collectors/funding_rates.py`
- Test: `tests/api/test_funding_rates.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_funding_rates.py
import pytest
from collectors.funding_rates import FundingRate, to_apr


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/api/test_funding_rates.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'collectors.funding_rates'`

- [ ] **Step 3: Write minimal implementation**

```python
# collectors/funding_rates.py
"""
거래소별 펀딩비(Funding Rate) 수집기 — 7개 Perp 거래소

60초 간격으로 fetch. 양빵(델타뉴트럴) 페어 추천용 raw 데이터 제공.
1h 정산(HL/Extended/Lighter) ↔ 8h 정산(Aster/Binance/Bybit/OKX) 혼재 →
to_apr()로 연환산 정규화.

수집기 규약(../CLAUDE.md §0): 예외는 내부에서 삼키고 None 반환. 절대 raise 금지.
"""
import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class FundingRate:
    source: str          # "Hyperliquid", "Bybit Perp" 등 (고유명사, 번역 안 함)
    venue_type: str      # "DEX" | "CEX"
    market: str          # "perpetual"
    pair: str            # "CC/USD", "CC/USDT"
    fr_raw: float        # 0.00012 = 0.012%
    period_hours: int    # 1 | 8
    fr_apr: float        # 연환산 % (미리 계산해서 프론트에 제공)
    next_funding_ts: int # unix epoch seconds
    api_source: str      # endpoint hostname (디버깅용)


def to_apr(fr_raw: float, period_hours: int) -> float:
    periods_per_year = (24 * 365) // period_hours  # 8760 (1h) | 1095 (8h)
    return fr_raw * periods_per_year * 100
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/api/test_funding_rates.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub
git add collectors/funding_rates.py tests/api/test_funding_rates.py
git commit -m "feat(collectors): FundingRate dataclass + APR 정규화"
```

---

## Task 2: DEX Perp fetcher — Hyperliquid + Lighter

**Files:**
- Modify: `collectors/funding_rates.py`
- Test: `tests/api/test_funding_rates.py`

**Context:** Hyperliquid는 기존 `realtime_prices.py:fetch_hyperliquid`와 동일 엔드포인트(`POST api.hyperliquid.xyz/info {"type":"metaAndAssetCtxs"}`) — 같은 응답의 `ctxs[i].funding` 필드 사용, 정산은 매시 정각이므로 `next_funding_ts = (현재시 + 1h) 정각`. Lighter는 `GET mainnet.zklighter.elliot.ai/api/v1/funding-rates`에서 `funding_rates[]` 중 `{exchange:"lighter", symbol:"CC"}.rate` (1h 정산).

- [ ] **Step 1: Write the failing test** — `httpx.AsyncClient`를 monkeypatch로 stub

```python
class _FakeResp:
    def __init__(self, payload): self._p = payload
    def raise_for_status(self): pass
    def json(self): return self._p


class _FakeClient:
    """post/get를 미리 지정한 payload로 응답하는 stub."""
    def __init__(self, payload): self._p = payload
    async def post(self, *a, **k): return _FakeResp(self._p)
    async def get(self, *a, **k): return _FakeResp(self._p)


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
        async def post(self, *a, **k): raise httpx.TimeoutException("boom")
    assert await fetch_hyperliquid_funding(_BoomClient()) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/api/test_funding_rates.py -k "hyperliquid or lighter" -v`
Expected: FAIL — `ImportError: cannot import name 'fetch_hyperliquid_funding'`

- [ ] **Step 3: Write minimal implementation** (append to `collectors/funding_rates.py`)

```python
def _next_hourly_ts() -> int:
    """1h 정산 거래소: 다음 정각 unix ts."""
    now = int(time.time())
    return now - (now % 3600) + 3600


async def fetch_hyperliquid_funding(client) -> FundingRate | None:
    try:
        resp = await client.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "metaAndAssetCtxs"}, timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        universe = data[0].get("universe", [])
        ctxs = data[1]
        for i, asset in enumerate(universe):
            if asset.get("name", "").upper() in ("CC", "CANTON"):
                fr_raw = float(ctxs[i].get("funding", 0))
                return FundingRate(
                    "Hyperliquid", "DEX", "perpetual", "CC/USD",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "hyperliquid.xyz",
                )
    except Exception as e:
        logger.warning(f"Hyperliquid funding rate failed: {e}")
    return None


async def fetch_lighter_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates", timeout=5,
        )
        resp.raise_for_status()
        for r in resp.json().get("funding_rates", []):
            if r.get("exchange") == "lighter" and r.get("symbol") == "CC":
                fr_raw = float(r.get("rate", 0))
                return FundingRate(
                    "Lighter", "DEX", "perpetual", "CC/USDC",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "zklighter.elliot.ai",
                )
    except Exception as e:
        logger.warning(f"Lighter funding rate failed: {e}")
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/api/test_funding_rates.py -k "hyperliquid or lighter" -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add collectors/funding_rates.py tests/api/test_funding_rates.py
git commit -m "feat(collectors): Hyperliquid + Lighter funding fetcher"
```

---

## Task 3: DEX Perp fetcher — Aster + Extended

**Files:** Modify `collectors/funding_rates.py`, Test `tests/api/test_funding_rates.py`

**Context:** Aster = `GET fapi.asterdex.com/fapi/v1/premiumIndex?symbol=CCUSDT` (Binance 호환, `lastFundingRate` + `nextFundingTime` ms, 8h 정산). Extended = `GET api.starknet.extended.exchange/api/v1/info/markets`, `data[]` 중 `name=="CC-USD"`의 `marketStats.fundingRate` (1h 정산, `_next_hourly_ts()`).

- [ ] **Step 1: Write failing test**

```python
@pytest.mark.asyncio
async def test_fetch_aster_funding_parses():
    from collectors.funding_rates import fetch_aster_funding
    payload = {"lastFundingRate": "0.0001", "nextFundingTime": 1747310400000}
    fr = await fetch_aster_funding(_FakeClient(payload))
    assert fr.source == "Aster"
    assert fr.period_hours == 8
    assert fr.next_funding_ts == 1747310400  # ms → s


@pytest.mark.asyncio
async def test_fetch_extended_funding_parses():
    from collectors.funding_rates import fetch_extended_funding
    payload = {"data": [{"name": "CC-USD", "marketStats": {"fundingRate": "0.00005"}}]}
    fr = await fetch_extended_funding(_FakeClient(payload))
    assert fr.source == "Extended"
    assert fr.period_hours == 1
    assert fr.fr_raw == pytest.approx(0.00005)
```

- [ ] **Step 2: Run → FAIL** (`ImportError: fetch_aster_funding`)

Run: `./venv/bin/python -m pytest tests/api/test_funding_rates.py -k "aster or extended" -v`

- [ ] **Step 3: Implement** (append)

```python
async def fetch_aster_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://fapi.asterdex.com/fapi/v1/premiumIndex",
            params={"symbol": "CCUSDT"}, timeout=5,
        )
        resp.raise_for_status()
        d = resp.json()
        fr_raw = float(d.get("lastFundingRate", 0))
        next_ts = int(d.get("nextFundingTime", 0)) // 1000
        return FundingRate(
            "Aster", "DEX", "perpetual", "CC/USDT",
            fr_raw, 8, to_apr(fr_raw, 8), next_ts, "asterdex.com",
        )
    except Exception as e:
        logger.warning(f"Aster funding rate failed: {e}")
    return None


async def fetch_extended_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://api.starknet.extended.exchange/api/v1/info/markets", timeout=5,
        )
        resp.raise_for_status()
        for m in resp.json().get("data", []):
            if m.get("name") == "CC-USD":
                fr_raw = float(m.get("marketStats", {}).get("fundingRate", 0))
                return FundingRate(
                    "Extended", "DEX", "perpetual", "CC/USD",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "extended.exchange",
                )
    except Exception as e:
        logger.warning(f"Extended funding rate failed: {e}")
    return None
```

- [ ] **Step 4: Run → PASS** (`-k "aster or extended"`, 2 passed)
- [ ] **Step 5: Commit** `feat(collectors): Aster + Extended funding fetcher`

---

## Task 4: CEX Perp fetcher — Binance + Bybit + OKX

**Files:** Modify `collectors/funding_rates.py`, Test `tests/api/test_funding_rates.py`

**Context:** 셋 다 8h 정산.
- Binance = `GET fapi.binance.com/fapi/v1/premiumIndex?symbol=CCUSDT` → `lastFundingRate`, `nextFundingTime` (ms)
- Bybit = `GET api.bybit.com/v5/market/tickers?category=linear&symbol=CCUSDT` → `result.list[0].fundingRate`, `result.list[0].nextFundingTime` (ms)
- OKX = `GET okx.com/api/v5/public/funding-rate?instId=CC-USDT-SWAP` → `data[0].fundingRate`, `data[0].fundingTime` (ms). ⚠️ instId는 §9 open question — `CC-USDT-SWAP` 실패 시 `CC-USD-SWAP` 폴백 로직 포함.

- [ ] **Step 1: Write failing test**

```python
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
```

- [ ] **Step 2: Run → FAIL**

Run: `./venv/bin/python -m pytest tests/api/test_funding_rates.py -k "binance or bybit or okx" -v`

- [ ] **Step 3: Implement** (append)

```python
async def fetch_binance_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://fapi.binance.com/fapi/v1/premiumIndex",
            params={"symbol": "CCUSDT"}, timeout=5,
        )
        resp.raise_for_status()
        d = resp.json()
        fr_raw = float(d.get("lastFundingRate", 0))
        next_ts = int(d.get("nextFundingTime", 0)) // 1000
        return FundingRate(
            "Binance Perp", "CEX", "perpetual", "CC/USDT",
            fr_raw, 8, to_apr(fr_raw, 8), next_ts, "binance.com",
        )
    except Exception as e:
        logger.warning(f"Binance funding rate failed: {e}")
    return None


async def fetch_bybit_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://api.bybit.com/v5/market/tickers",
            params={"category": "linear", "symbol": "CCUSDT"}, timeout=5,
        )
        resp.raise_for_status()
        row = resp.json()["result"]["list"][0]
        fr_raw = float(row.get("fundingRate", 0))
        next_ts = int(row.get("nextFundingTime", 0)) // 1000
        return FundingRate(
            "Bybit Perp", "CEX", "perpetual", "CC/USDT",
            fr_raw, 8, to_apr(fr_raw, 8), next_ts, "bybit.com",
        )
    except Exception as e:
        logger.warning(f"Bybit funding rate failed: {e}")
    return None


async def fetch_okx_funding(client) -> FundingRate | None:
    for inst in ("CC-USDT-SWAP", "CC-USD-SWAP"):  # §9 instId 폴백
        try:
            resp = await client.get(
                "https://www.okx.com/api/v5/public/funding-rate",
                params={"instId": inst}, timeout=5,
            )
            resp.raise_for_status()
            rows = resp.json().get("data", [])
            if not rows:
                continue
            d = rows[0]
            fr_raw = float(d.get("fundingRate", 0))
            next_ts = int(d.get("fundingTime", 0)) // 1000
            return FundingRate(
                "OKX Perp", "CEX", "perpetual",
                "CC/USDT" if "USDT" in inst else "CC/USD",
                fr_raw, 8, to_apr(fr_raw, 8), next_ts, "okx.com",
            )
        except Exception as e:
            logger.warning(f"OKX funding rate failed ({inst}): {e}")
    return None
```

- [ ] **Step 4: Run → PASS** (`-k "binance or bybit or okx"`, 3 passed)
- [ ] **Step 5: Commit** `feat(collectors): Binance + Bybit + OKX funding fetcher`

---

## Task 5: `collect_all_funding_rates()` aggregator

**Files:** Modify `collectors/funding_rates.py`, Test `tests/api/test_funding_rates.py`

- [ ] **Step 1: Write failing test** — 일부 fetcher 실패해도 나머지 반환 (graceful)

```python
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
```

- [ ] **Step 2: Run → FAIL** (`ImportError: collect_all_funding_rates`)

Run: `./venv/bin/python -m pytest tests/api/test_funding_rates.py -k collect_all -v`

- [ ] **Step 3: Implement** (append)

```python
async def collect_all_funding_rates() -> list[FundingRate]:
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            fetch_hyperliquid_funding(client),
            fetch_lighter_funding(client),
            fetch_aster_funding(client),
            fetch_extended_funding(client),
            fetch_binance_funding(client),
            fetch_bybit_funding(client),
            fetch_okx_funding(client),
            return_exceptions=True,
        )
    out: list[FundingRate] = []
    for r in results:
        if isinstance(r, FundingRate):
            out.append(r)
        elif isinstance(r, Exception):
            logger.warning(f"funding fetch raised: {r}")
    return out
```

- [ ] **Step 4: Run → PASS** (`-k collect_all`, 1 passed)
- [ ] **Step 5: Commit** `feat(collectors): collect_all_funding_rates 병렬 aggregator`

---

## Task 6: `GET /api/analytics/funding-rates` 라우트

**Files:**
- Modify: `api/routes/analytics.py` (기존 `/realtime-prices` 라우트 근처 — `grep -n "realtime-prices" api/routes/analytics.py`로 위치 확인)
- Test: `tests/api/test_funding_rates.py`

- [ ] **Step 1: Write failing test** (기존 `test_price.py` seeded_cache 패턴)

```python
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.dependencies import get_cache
from api.cache import TTLCache


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
```

- [ ] **Step 2: Run → FAIL** (404 Not Found)

Run: `./venv/bin/python -m pytest tests/api/test_funding_rates.py -k route -v`

- [ ] **Step 3: Implement** — `api/routes/analytics.py`에 추가 (캐시 미스 폴백은 §4 CLAUDE.md anti-pattern: 500 금지, 빈 객체 반환)

```python
_EMPTY_FUNDING = {"rates": [], "updated_at": None}


@router.get("/funding-rates")
async def funding_rates(cache: TTLCache = Depends(get_cache)):
    return cache.get("analytics:funding-rates") or _EMPTY_FUNDING
```

- [ ] **Step 4: Run → PASS** (`-k route`, 2 passed)
- [ ] **Step 5: Run full test file** — 회귀 확인

Run: `./venv/bin/python -m pytest tests/api/test_funding_rates.py -v`
Expected: PASS (전체 ~15 passed)

- [ ] **Step 6: Commit** `feat(analytics): /api/analytics/funding-rates 엔드포인트`

---

## Task 7: Scheduler 60초 tick 등록 + 백엔드 smoke

**Context — 실제 scheduler 패턴 (검증 완료):** `api/scheduler.py`는 APScheduler를 쓰지 **않는다**. 직접 만든 asyncio 루프 패턴이다:
- 각 수집기: `async def collect_X(cache: TTLCache):` — cache를 **파라미터로 주입**받음 (모듈 레벨 `_cache` 없음)
- `async def _loop(fn, cache, interval, name):` (line ~815) — `while True: await asyncio.sleep(interval); await fn(cache)`
- `async def start_scheduler(cache):` (line ~846) 안에서:
  - `asyncio.create_task(_loop(collect_X, cache, interval, "name"))` (line ~856–866 블록)
  - 즉시 1회 실행 `asyncio.create_task(collect_realtime_prices(cache))` (line ~869)

→ `scheduler.add_job` / `_cache` 같은 심볼은 **존재하지 않는다**. 아래 패턴을 그대로 따른다.

**Files:**
- Modify: `api/scheduler.py`

- [ ] **Step 1: 기존 패턴 위치 재확인**

Run: `grep -n "_loop\|async def collect_realtime_prices\|async def start_scheduler\|create_task(_loop(collect_realtime_prices\|create_task(collect_realtime_prices" api/scheduler.py`
→ `collect_realtime_prices` 함수 정의 / `_loop` 등록 줄 / 즉시 실행 줄의 정확한 라인 확인

- [ ] **Step 2: Implement — collect 함수 추가** (다른 `collect_*` 정의들 근처, 예: `collect_realtime_prices` 아래)

```python
# 파일 상단 import 그룹에 추가 (기존 collectors import 옆)
from collectors.funding_rates import collect_all_funding_rates
from dataclasses import asdict
from datetime import datetime, timezone
```

```python
# collect_realtime_prices 정의 근처에 추가 — cache 파라미터 DI (기존 패턴 동일)
async def collect_funding_rates(cache: TTLCache):
    rates = await collect_all_funding_rates()
    if rates:  # 전부 실패 시 직전 캐시 유지 (갱신 안 함)
        cache.set("analytics:funding-rates", {
            "rates": [asdict(r) for r in rates],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, ttl=90)
        logger.info(f"cached: funding-rates ({len(rates)}/7 거래소)")
```

- [ ] **Step 3: Implement — start_scheduler에 등록 2줄 추가**

`start_scheduler(cache)` 안, `_loop(collect_realtime_prices, ...)` 줄 바로 아래에:

```python
    asyncio.create_task(_loop(collect_funding_rates, cache, 60, "funding-rates"))  # 60초
```

그리고 즉시 1회 실행 `asyncio.create_task(collect_realtime_prices(cache))` 줄 바로 아래에:

```python
    asyncio.create_task(collect_funding_rates(cache))
```

⚠️ `logger`는 기존 모듈에 `logging.getLogger(__name__)`로 존재함 (그대로 사용). `cache`는 `start_scheduler`/`_loop`가 넘겨주는 파라미터를 그대로 받는다 — 모듈 전역 참조 금지.

- [ ] **Step 3: 백엔드 재기동 + smoke**

```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
sleep 8
curl -s http://localhost:8000/api/analytics/funding-rates | python3 -m json.tool
```
Expected: `rates` 배열에 1~7개 entry, 각 entry에 `source`, `fr_apr`, `next_funding_ts`. (거래소 다운 시간대면 일부 누락 가능 — 0개면 60초 더 대기 후 재시도)

- [ ] **Step 4: 로그 확인**

Run: `grep "funding-rates" /tmp/canton-hub-backend.err.log | tail -3`
Expected: `cached: funding-rates (N/7 거래소)` 라인 출현

- [ ] **Step 5: Commit** `feat(scheduler): funding-rates 60s 수집 job 등록`

---

## Task 8: Frontend — types + format helper

**Files:**
- Modify: `web/lib/types.ts` (`RealtimePrices` 인터페이스 근처)
- Modify: `web/lib/format.ts`

- [ ] **Step 1: Check frontend test setup**

Run: `cd web && cat package.json | grep -E "vitest|jest|test"`
→ 테스트 러너 있으면 Step 2에서 TDD, 없으면 `npx tsc --noEmit`로 타입 검증만.

- [ ] **Step 2: types.ts에 인터페이스 추가**

```typescript
export interface FundingRate {
  source: string;
  venue_type: "DEX" | "CEX";
  market: "perpetual";
  pair: string;
  fr_raw: number;
  period_hours: 1 | 8;
  fr_apr: number;
  next_funding_ts: number;
  api_source: string;
}

export interface FundingRates {
  rates: FundingRate[];
  updated_at: string | null;
}
```

- [ ] **Step 3: format.ts에 `formatDuration` 추가**

```typescript
// 남은 시간(초) → "5h 21m" / "43m" / "Settling..." (lang 분기)
export function formatDuration(seconds: number, lang: string, short = false): string {
  if (seconds <= 0) return lang === "ko" ? "정산 중..." : "Settling...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return short ? `${h}h` : `${h}h ${m}m`;
  return `${m}m`;
}

// 경과 시간(초) → "12s ago" / "12초 전"
export function formatAgo(seconds: number, lang: string): string {
  const ko = lang === "ko";
  if (seconds < 60) return ko ? `${seconds}초 전` : `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  return ko ? `${m}분 전` : `${m}m ago`;
}
```

- [ ] **Step 4: 타입 검증**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (에러 없음)

- [ ] **Step 5: Commit** `feat(web): FundingRate 타입 + formatDuration/formatAgo helper`

---

## Task 9: Frontend — `useFundingRates` SWR 훅

**Files:** Modify `web/lib/api.ts` (기존 `useRealtimePrices` 훅 근처 — `grep -n "useRealtimePrices" web/lib/api.ts`)

- [ ] **Step 1: 기존 훅 패턴 확인**

Run: `grep -n "useRealtimePrices\|API_BASE\|fetcher\|refreshInterval" web/lib/api.ts | head`
→ base URL 상수명, fetcher 정의, refreshInterval 설정 패턴 확인

- [ ] **Step 2: Implement** — 기존 `useRealtimePrices`와 동일 구조, 30초 polling

```typescript
import type { FundingRates } from "./types";  // 기존 import 그룹에 추가

export function useFundingRates() {
  return useSWR<FundingRates>(
    `${API_BASE}/api/analytics/funding-rates`,   // ← API_BASE 실제 상수명에 맞춤
    fetcher,
    { refreshInterval: 30_000, fallbackData: { rates: [], updated_at: null } },
  );
}
```

- [ ] **Step 3: 타입 검증**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit** `feat(web): useFundingRates SWR 훅 (30s polling)`

---

## Task 10: Frontend — i18n dictionary 파일

**Files:** Create `web/components/analytics/funding-rate-matrix.i18n.ts`

- [ ] **Step 1: Implement** (spec §10.2 전체 dictionary)

```typescript
// web/components/analytics/funding-rate-matrix.i18n.ts
// 2-track i18n: ko = 한국어, en/ja/zh = 영어 fallback (spec §10)
export const TEXTS = {
  title:             { ko: "펀비 양빵 매트릭스",            en: "Funding Rate Arbitrage Matrix" },
  perpPerpTitle:     { ko: "🎯 Perp-Perp 양빵",             en: "🎯 Perp-Perp Arbitrage" },
  spotPerpTitle:     { ko: "🎯 현물-Perp 양빵",             en: "🎯 Spot-Perp Arbitrage" },
  longLabel:         { ko: "롱",                            en: "Long" },
  shortLabel:        { ko: "숏",                            en: "Short" },
  spotBuyLabel:      { ko: "현물 매수",                     en: "Spot Buy" },
  entrySpread:       { ko: "진입스프",                      en: "Entry spread" },
  basis:             { ko: "베이시스",                      en: "Basis" },
  orderbookDepth:    { ko: "호가창",                        en: "Order depth" },
  colExchange:       { ko: "거래소",                        en: "Exchange" },
  colFrRaw:          { ko: "FR(원시)",                      en: "FR (raw)" },
  colApr:            { ko: "APR",                           en: "APR" },
  colNextFunding:    { ko: "다음정산",                      en: "Next Funding" },
  colTrade:          { ko: "Trade ↗",                       en: "Trade ↗" },
  lastUpdated:       { ko: "마지막 업데이트",               en: "Last updated" },
  staleWarning:      { ko: "⚠ 데이터 갱신 지연",            en: "⚠ Data update delayed" },
  errorLoad:         { ko: "펀비 데이터 로드 실패",         en: "Failed to load funding rate data" },
  loading:           { ko: "데이터 수집 중...",             en: "Collecting data..." },
  noArbitrage:       { ko: "현재 양빵 적합 페어 없음 (모든 FR 음수)",
                       en: "No suitable arbitrage pair (all FR negative)" },
} as const;

export type TextKey = keyof typeof TEXTS;
export const makeT = (lang: string) =>
  (key: TextKey) => lang === "ko" ? TEXTS[key].ko : TEXTS[key].en;
```

- [ ] **Step 2: 타입 검증**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit** `feat(web): 펀비 매트릭스 i18n dictionary (ko + en fallback)`

---

## Task 11: Frontend — `FundingRateMatrix` 컴포넌트

**Files:** Create `web/components/analytics/funding-rate-matrix.tsx`

**Context:** `lang`을 prop으로 받는다 (기존 `arbitrage-tracker.tsx`가 `lang` prop 받는 패턴과 동일). spec §4.3/§4.4 컴포넌트 + computePairs 로직. Tremor 컴포넌트는 기존 analytics 컴포넌트(`grep -rn "@tremor/react" web/components/analytics/exchanges-section.tsx`)에서 실제 import 형태 확인.

> ⚠️ **의도된 spec 일탈**: spec §4.3 코드 스니펫은 컴포넌트 내부에서 `useLang()`을 직접 호출하지만, 실제 페이지(`page.tsx`)가 `useLang()`을 소유하고 모든 섹션에 `lang`을 prop으로 내려주는 구조다 (`arbitrage-tracker.tsx`와 동일). 따라서 **`lang` prop 방식이 맞다 — spec의 `useLang()` 스니펫으로 "되돌리지" 말 것.** `const t = makeT(lang)`로 i18n 헬퍼 생성.

- [ ] **Step 1: 기존 Tremor 사용 패턴 확인**

Run: `grep -rn "from \"@tremor/react\"\|trade_url\|depth_plus" web/components/analytics/arbitrage-tracker.tsx | head`
→ `LivePrice` 타입에 `trade_url`, `depth_*` 필드 실제 이름 확인 (computePairs sub-text/Trade 링크용)

- [ ] **Step 2: Implement** — 단일 파일, sub-component 내부 정의

spec §4.3 + §4.4 코드를 기반으로 작성. 핵심:
- `"use client"` 선언
- `props: { lang: string }`, `const t = makeT(lang)`
- `useFundingRates()` + `useRealtimePrices()`
- `computePairs(fr.rates, rt.prices)` — spec §4.4 (정렬 APR desc, Perp-Perp = sorted[0]+sorted[-1], 현물-Perp = sorted[0]+최저가 spot. 양수 FR 없으면 `noArbitrage`)
- `<RecommendationCards>` (Tremor `<Grid numItems={1} numItemsSm={2}>` + `<Card>` ×2 + `<Metric>`)
- `<FundingRateTable>` (Tremor `<Table>`, APR desc 정렬, `<BadgeDelta>` 부호색, Trade↗ = `rt.prices`에서 source 매칭해 `trade_url` join)
- `<Countdown targetTs>` (`useEffect` + `setInterval` 1s + `formatDuration`)
- `<LastUpdated>` (`formatAgo`, 5분 초과 시 `<Callout color="yellow">`)
- edge case: Perp<2 → Perp-Perp hide, spot 없음 → 현물-Perp hide

전체 코드는 spec §4.3·§4.4를 그대로 옮기되 Step 1에서 확인한 실제 필드명으로 맞춘다.

- [ ] **Step 3: 타입 검증 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: exit 0, `/analytics` 페이지 ✓ prerender (아직 페이지에 미배치 — 컴포넌트만 컴파일 통과 확인)

- [ ] **Step 4: Commit** `feat(web): FundingRateMatrix 컴포넌트 (표+추천+카운트다운)`

---

## Task 12: Frontend — 페이지 placement

**Files:** Modify `web/app/analytics/page.tsx:26` (`<ArbitrageTracker lang={lang} />` 바로 아래)

- [ ] **Step 1: Implement**

```tsx
import FundingRateMatrix from "@/components/analytics/funding-rate-matrix";  // 기존 import 그룹

// <ArbitrageTracker lang={lang} /> 바로 아래 줄에:
<FundingRateMatrix lang={lang} />
```

- [ ] **Step 2: 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: exit 0, `/analytics ○` prerender 성공

- [ ] **Step 3: 로컬 브라우저 smoke**

```bash
cd web && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
브라우저 `http://localhost:3000/analytics` 열고 확인:
- 아비트라지 트래커 아래 "펀비 양빵 매트릭스" 섹션 노출
- 표에 거래소별 FR/APR/카운트다운 (카운트다운 1초마다 감소)
- 추천 박스 2개 (Perp-Perp / 현물-Perp)
- 언어 토글 en → "Funding Rate Arbitrage Matrix"로 전환, zh/ja도 영어로
- 모바일 폭(개발자도구 375px) → 추천 박스 1열

- [ ] **Step 4: Commit** `feat(web): /analytics에 FundingRateMatrix 배치`

---

## Task 13: 문서 갱신

**Files:**
- Modify: `docs/ARCHITECTURE.md` (Cache Key Map + API Contracts)
- Modify: `web/docs/ARCHITECTURE.md` (SWR Hook Map)

- [ ] **Step 1: `docs/ARCHITECTURE.md`** — Cache Key Map에 `analytics:funding-rates` (TTL 90s, scheduler 60s, 소비처 `/api/analytics/funding-rates`) 추가. API Contracts에 `GET /api/analytics/funding-rates` 응답 shape 추가. Data Sources에 `collectors/funding_rates.py` (7개 거래소) 추가.

- [ ] **Step 2: `web/docs/ARCHITECTURE.md`** — SWR Hook Map에 `useFundingRates` (refreshInterval 30s, `/api/analytics/funding-rates`) 추가. Component 트리에 `analytics/funding-rate-matrix.tsx` 추가.

- [ ] **Step 3: Commit** `docs: ARCHITECTURE.md 펀비 매트릭스 반영 (Cache Key/API/SWR Map)`

---

## Final Verification

- [ ] 백엔드 전체 테스트: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/ -v` → 전체 PASS
- [ ] 프론트 빌드: `cd web && npx tsc --noEmit && npm run build` → exit 0
- [ ] 프로덕션 확인: `curl -s https://canton-hub.vercel.app/analytics -o /dev/null -w "%{http_code}"` → 200 (Vercel 재배포 후), 터널 `/api/analytics/funding-rates` → 200
- [ ] 7개 거래소 §9 open question 해소 확인: 로그에서 `funding-rates (N/7)` N=7인 시간대 1회 이상 관측 (Lighter period, OKX instId, Aster interval 실측 검증)
