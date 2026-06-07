# Canton DAT Tracker (`/dat`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/dat` page to Canton Hub that tracks publicly-listed companies holding $CC as a treasury asset (seed: CNTN / Canton Strategic Holdings), showing holdings, mNAV, P/L, a death-spiral risk signal, an mNAV time-series chart, and KRW conversion — restyled into the existing Canton Hub design system.

**Architecture:** Backend follows the existing collector → scheduler-wrapper → TTL cache → route pipeline. A **pure collector** (`collectors/dat_collector.py`) loads a manually-maintained `data/dat_companies.json`, fetches live stock price (Yahoo Finance, no key) + USD/KRW (open.er-api.com), and computes mNAV/P/L/risk. The **scheduler wrapper** `collect_dat(cache)` injects the live $CC price from `cache.get("price")["current_price_usd"]` (no extra CoinGecko call), appends an hourly mNAV point to `data/dat_history.json`, and stores the result under cache key `analytics:dat`. The route `/api/analytics/dat` (added to the existing `analytics.py` router) just returns the cache. Frontend adds `DatCompany`/`DatData` types + a `useDat()` SWR hook to `lib/analytics.ts`, a `/dat` page reusing `.ch-*` classes, and a navbar tab.

**Tech Stack:** Python 3.12 / FastAPI / httpx / APScheduler-style asyncio loops / pytest (backend); Next.js 16 / React 19 / TypeScript / Tailwind v4 / Recharts / SWR (frontend).

**Mobile-first (decided):** The `/dat` page must be built mobile-first and verified at **360px** width — no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`). Concretely: the company-card grid uses `minmax(min(100%, 340px), 1fr)` (NOT bare `340px`, which overflows a 360px viewport once the `max-w-[1200px] px-6` gutters are subtracted); the `.ch-kpi-strip` already collapses to 2-col at ≤860px via globals.css; the Data Sources `.ch-data-table` gets a horizontal-scroll wrapper. This mirrors the project's mobile-first pattern in [note-mobile-web-optimization]. Separate `/analytics`·`/feed` mobile work is out of scope here (future branch).

**Design source of truth:** [docs/plans/2026-05-31-dat-tracker-design.md](./2026-05-31-dat-tracker-design.md). This plan supersedes that spec's §9 file list in three places discovered by reading the actual code during planning:
1. The route is **added to `api/routes/analytics.py`** under the existing `/api/analytics` prefix (cache key `analytics:dat`) — **no new `dat.py` router and no `api/main.py` change**.
2. Frontend `DatCompany`/`DatData` interfaces go in **`web/lib/types.ts`** (where `KrCompany`/`KrCompaniesData` live) and the `useDat` hook in **`web/lib/api.ts`** (where `useKrCompanies` lives). There is no `lib/analytics.ts`. Hooks use the `${API}/...` URL prefix + the module-local `fetcher`.
3. **Navbar correction (the spec was wrong):** the LIVE navbar is `web/components/nav/navbar.tsx` (props `{lang, onLangChange, connected}`, 4-language `NAV_ITEMS`, mobile drawer) — NOT `web/components/ch/navbar.tsx` (which is unused). The DAT tab is added to `NAV_ITEMS` (all 4 languages). The page shell follows the `/feed` page pattern (`Navbar` + `<main class="max-w-[1200px]...">` + `Footer`, driven by `useLang` + `usePrice` + `useRealtimePrice`), NOT `ch/app-shell` (also unused). The `.ch-*` CSS classes themselves DO exist in `globals.css` and are safe to use inside cards.

**Color/threshold decisions (locked):** crypto convention green↑ (`--canton-up`) / red↓ (`--canton-down`) per existing Canton Hub tone; WCAG — never color alone, always pair with +/− sign and ▲▼. mNAV bands: `MNAV_NAV_FLOOR = 1.0` (the only structural line — below = death-spiral zone), `MNAV_WATCH_THRESHOLD = 1.2` (tunable heuristic buffer). EV mNAV formula `(market_cap + debt − cash) / nav`, falling back to `market_cap / nav` when debt and cash are both 0/None.

---

## File Structure

**Backend (create):**
- `data/dat_companies.json` — manual seed (CNTN, placeholder 0s + `shares_outstanding`)
- `collectors/dat_collector.py` — pure collector + calc helpers + file-cache load/save
- `tests/api/test_dat_calc.py` — unit tests for pure calc helpers
- `tests/api/test_dat.py` — route shape + empty-fallback tests

**Backend (modify):**
- `config.py` — add `YAHOO_FINANCE_CHART_URL`, `EXCHANGERATE_API_URL`
- `api/scheduler.py` — add `_append_dat_history` + `collect_dat(cache)` wrapper + loop registration
- `api/routes/analytics.py` — add `/dat` endpoint + empty fallback

**Frontend (create):**
- `web/app/dat/page.tsx` — the page
- `web/components/dat/company-card.tsx` — one company card (stats + mNAV gauge + P/L + risk badge)
- `web/components/dat/mnav-chart.tsx` — Recharts mNAV time-series with 1.0x reference line

**Frontend (modify):**
- `web/lib/types.ts` — add `DatCompany`/`DatData` interfaces
- `web/lib/api.ts` — add `useDat()` hook (+ import the new types)
- `web/components/nav/navbar.tsx` — add `/dat` to `NAV_ITEMS` (all 4 languages)

**Docs (modify, final task):**
- `docs/ARCHITECTURE.md` (Cache Key Map + route), `docs/DATA_GUIDE.md` (Yahoo/exchangerate sources)

---

## Task 1: Config constants + seed JSON

**Files:**
- Modify: `config.py`
- Create: `data/dat_companies.json`

- [ ] **Step 1: Add config constants**

In `config.py`, after the CoinGecko block (after line `COINGECKO_CC_ID = "canton-network-2"`), add:

```python
# DAT Tracker — stock price + FX (no API key required)
YAHOO_FINANCE_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
EXCHANGERATE_API_URL = "https://open.er-api.com/v6/latest/USD"
```

- [ ] **Step 2: Create the seed JSON**

Create `data/dat_companies.json`. All numeric values are `0` placeholders to be filled from CNTN's latest 8-K; until filled, the UI renders "—" (handled in later tasks).

```json
[
  {
    "ticker": "CNTN",
    "name": "Canton Strategic Holdings",
    "exchange": "NASDAQ",
    "cc_holdings": 0,
    "avg_buy_price": 0,
    "debt": 0,
    "cash": 0,
    "shares_outstanding": 0,
    "super_validator": true,
    "source": "8-K (fill from latest official filing)",
    "as_of": "2026-02-18"
  }
]
```

- [ ] **Step 3: Verify JSON is valid and loadable**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && python -c "import json; d=json.load(open('data/dat_companies.json')); assert d[0]['ticker']=='CNTN'; print('ok', len(d))"`
Expected: `ok 1`

- [ ] **Step 4: Commit**

```bash
git add config.py data/dat_companies.json
git commit -m "feat(dat): add config constants + CNTN seed JSON"
```

---

## Task 2: Pure calc helpers (TDD)

**Files:**
- Create: `collectors/dat_collector.py` (calc helpers first)
- Create: `tests/api/test_dat_calc.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_dat_calc.py`:

```python
"""Unit tests for DAT pure calc helpers (no network)."""
from collectors.dat_collector import (
    compute_nav,
    compute_mnav,
    compute_pl,
    classify_risk,
    MNAV_NAV_FLOOR,
    MNAV_WATCH_THRESHOLD,
)


def test_compute_nav():
    assert compute_nav(1000, 2.0) == 2000.0
    assert compute_nav(0, 2.0) == 0.0


def test_mnav_ev_formula_when_debt_cash_present():
    # nav = 1000*2 = 2000; EV = mcap(2400)+debt(200)-cash(100) = 2500; mnav = 1.25
    mnav, label = compute_mnav(market_cap=2400, debt=200, cash=100, nav=2000.0)
    assert round(mnav, 4) == 1.25
    assert "EV" in label


def test_mnav_falls_back_to_marketcap_when_no_debt_cash():
    mnav, label = compute_mnav(market_cap=2400, debt=0, cash=0, nav=2000.0)
    assert round(mnav, 4) == 1.2
    assert "Market Cap" in label


def test_mnav_none_when_nav_zero():
    mnav, label = compute_mnav(market_cap=2400, debt=0, cash=0, nav=0.0)
    assert mnav is None
    assert label is None


def test_compute_pl():
    # (cc_price 2.5 - avg 2.0) * holdings 1000 = 500 ; pct = 500 / (2.0*1000) = 25%
    pl_usd, pl_pct = compute_pl(cc_price=2.5, avg_buy_price=2.0, cc_holdings=1000)
    assert pl_usd == 500.0
    assert round(pl_pct, 4) == 25.0


def test_compute_pl_none_when_no_holdings():
    pl_usd, pl_pct = compute_pl(cc_price=2.5, avg_buy_price=0, cc_holdings=0)
    assert pl_usd is None
    assert pl_pct is None


def test_classify_risk_bands():
    assert classify_risk(1.3) == "healthy"
    assert classify_risk(MNAV_WATCH_THRESHOLD) == "healthy"   # >= 1.2 inclusive
    assert classify_risk(1.1) == "watch"
    assert classify_risk(MNAV_NAV_FLOOR) == "watch"           # >= 1.0 inclusive
    assert classify_risk(0.9) == "below_nav"
    assert classify_risk(None) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat_calc.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'collectors.dat_collector'` (or ImportError on the helpers).

- [ ] **Step 3: Write minimal implementation (calc helpers)**

Create `collectors/dat_collector.py` with ONLY the helpers + constants for now:

```python
"""
Canton DAT(Digital Asset Treasury) tracker collector.

$CC를 재무자산으로 보유한 상장사(시드: CNTN)의 보유량·평단 등 정적 데이터를
data/dat_companies.json에서 로드하고, 주가(Yahoo Finance)·USD/KRW(open.er-api.com)를
실시간 조회해 mNAV / P/L / 리스크를 계산한다. $CC 현재가는 호출자(scheduler)가 주입한다.

순수 모듈: cache를 모름. 예외는 내부에서 삼키고 빈/부분 데이터를 반환한다 (절대 throw 금지).
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

import config

logger = logging.getLogger(__name__)

_COMPANIES_FILE = Path(__file__).parent.parent / "data" / "dat_companies.json"
_CACHE_FILE = Path(__file__).parent.parent / "data" / "dat_cache.json"

# mNAV bands. 1.0x is the only structurally-meaningful line (premium↔discount,
# below which equity raises turn dilutive → death-spiral zone). 1.2x is a tunable
# heuristic buffer for the "watch" warning — not a theoretical optimum.
MNAV_NAV_FLOOR = 1.0
MNAV_WATCH_THRESHOLD = 1.2


def compute_nav(cc_holdings: float, cc_price: float) -> float:
    """$CC NAV = 보유 수량 × 현재가."""
    return float(cc_holdings) * float(cc_price)


def compute_mnav(
    market_cap: Optional[float], debt: float, cash: float, nav: float
) -> tuple[Optional[float], Optional[str]]:
    """EV식 mNAV = (시총 + 부채 − 현금) / NAV.

    nav 또는 market_cap이 없으면 (None, None). debt/cash가 둘 다 0이면
    시총/NAV 폴백 + 라벨로 어떤 공식을 썼는지 표시.
    """
    if not nav or market_cap is None:
        return None, None
    if debt or cash:
        mnav = (market_cap + (debt or 0) - (cash or 0)) / nav
        return mnav, "mNAV (EV / $CC Reserve)"
    return market_cap / nav, "mNAV (Market Cap / $CC NAV)"


def compute_pl(
    cc_price: float, avg_buy_price: float, cc_holdings: float
) -> tuple[Optional[float], Optional[float]]:
    """평가손익. 보유량 또는 평단이 0이면 (None, None)."""
    if not cc_holdings or not avg_buy_price:
        return None, None
    pl_usd = (cc_price - avg_buy_price) * cc_holdings
    pl_pct = pl_usd / (avg_buy_price * cc_holdings) * 100
    return pl_usd, pl_pct


def classify_risk(mnav: Optional[float]) -> Optional[str]:
    """mNAV → 리스크 밴드. None이면 None (배지 숨김)."""
    if mnav is None:
        return None
    if mnav >= MNAV_WATCH_THRESHOLD:
        return "healthy"
    if mnav >= MNAV_NAV_FLOOR:
        return "watch"
    return "below_nav"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat_calc.py -v`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add collectors/dat_collector.py tests/api/test_dat_calc.py
git commit -m "feat(dat): pure mNAV/PL/risk calc helpers with tests"
```

---

## Task 3: Collector fetch + build (Yahoo + FX + assemble)

**Files:**
- Modify: `collectors/dat_collector.py`

This task adds the network fetch + assembly. It has no unit test (network-dependent); it's verified by a live smoke run. The pure logic it relies on is already tested in Task 2.

- [ ] **Step 1: Append fetch + build functions to `collectors/dat_collector.py`**

Add to the END of `collectors/dat_collector.py`:

```python
_HTTP_HEADERS = {
    # Yahoo's chart endpoint 429s requests without a browser-like UA.
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}


def _load_companies() -> list[dict]:
    """data/dat_companies.json 로드. 부재/손상 시 빈 리스트."""
    if not _COMPANIES_FILE.exists():
        return []
    try:
        data = json.loads(_COMPANIES_FILE.read_text())
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning(f"dat_companies.json load failed: {e}")
        return []


async def _fetch_stock(client: httpx.AsyncClient, ticker: str) -> tuple[Optional[float], Optional[float]]:
    """Yahoo Finance chart 엔드포인트로 (현재가, 시총) 조회. 시총은 응답에 없으면 None."""
    try:
        url = f"{config.YAHOO_FINANCE_CHART_URL}/{ticker}"
        r = await client.get(url, params={"interval": "1d", "range": "1d"}, timeout=10)
        if r.status_code != 200:
            logger.warning(f"Yahoo {ticker} status {r.status_code}")
            return None, None
        meta = (r.json().get("chart", {}).get("result") or [{}])[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        return (float(price) if price is not None else None), None
    except Exception as e:
        logger.warning(f"Yahoo fetch failed for {ticker}: {e}")
        return None, None


async def _fetch_krw_rate(client: httpx.AsyncClient) -> Optional[float]:
    """USD/KRW 환율. 실패 시 None."""
    try:
        r = await client.get(config.EXCHANGERATE_API_URL, timeout=10)
        if r.status_code == 200:
            return float(r.json().get("rates", {}).get("KRW"))
    except Exception as e:
        logger.warning(f"KRW rate fetch failed: {e}")
    return None


async def collect_dat(cc_price: Optional[float]) -> dict:
    """DAT 트래커 수집. cc_price는 호출자(scheduler)가 cache의 $CC 현재가를 주입.

    각 기업: 정적값(JSON) + 라이브(주가/시총/환율) + 계산(nav/mnav/pl/risk).
    """
    companies = _load_companies()
    out_companies: list[dict] = []

    async with httpx.AsyncClient(headers=_HTTP_HEADERS) as client:
        krw_rate = await _fetch_krw_rate(client)

        for co in companies:
            ticker = co.get("ticker", "")
            stock_price, market_cap = await _fetch_stock(client, ticker)

            # 시총이 응답에 없으면 주가 × 발행주식수로 폴백
            shares = co.get("shares_outstanding") or 0
            if market_cap is None and stock_price is not None and shares:
                market_cap = stock_price * shares

            cc_holdings = co.get("cc_holdings") or 0
            avg_buy = co.get("avg_buy_price") or 0
            debt = co.get("debt") or 0
            cash = co.get("cash") or 0

            nav = compute_nav(cc_holdings, cc_price) if cc_price else 0.0
            mnav, mnav_label = compute_mnav(market_cap, debt, cash, nav)
            pl_usd, pl_pct = compute_pl(cc_price, avg_buy, cc_holdings) if cc_price else (None, None)
            risk = classify_risk(mnav)

            value_usd = nav if nav else None
            out_companies.append({
                **co,
                "stock_price": stock_price,
                "market_cap": market_cap,
                "cc_price": cc_price,
                "nav": nav or None,
                "mnav": mnav,
                "mnav_label": mnav_label,
                "pl_usd": pl_usd,
                "pl_pct": pl_pct,
                "krw_rate": krw_rate,
                "value_krw": (value_usd * krw_rate) if (value_usd and krw_rate) else None,
                "pl_krw": (pl_usd * krw_rate) if (pl_usd is not None and krw_rate) else None,
                "risk": risk,
            })

    result = {
        "companies": out_companies,
        "company_count": len(out_companies),
        "total_cc_holdings": sum((c.get("cc_holdings") or 0) for c in out_companies),
        "total_pl_usd": sum((c.get("pl_usd") or 0) for c in out_companies),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        _CACHE_FILE.parent.mkdir(exist_ok=True)
        _CACHE_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"DAT cache save failed: {e}")

    logger.info(f"DAT collected: {len(out_companies)} companies, krw_rate={krw_rate}")
    return result


def load_cached_dat() -> Optional[dict]:
    """파일 캐시 폴백 로드."""
    if not _CACHE_FILE.exists():
        return None
    try:
        return json.loads(_CACHE_FILE.read_text())
    except Exception:
        return None
```

- [ ] **Step 2: Live smoke test (network)**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && python -c "import asyncio; from collectors.dat_collector import collect_dat; r=asyncio.run(collect_dat(2.0)); print('companies:', r['company_count']); c=r['companies'][0]; print('ticker:', c['ticker'], 'stock_price:', c['stock_price'], 'krw_rate:', c['krw_rate'])"`

Expected: prints `companies: 1` and a line with `ticker: CNTN`, a numeric `stock_price` (or `None` if Yahoo throttles — acceptable, the fallback path is exercised), and a numeric `krw_rate`. No traceback.

> If `stock_price: None` AND `krw_rate: None` both appear, re-run once (transient throttle). If still None, note it but proceed — the pipeline must tolerate None (verified in Task 4 empty path).

- [ ] **Step 3: Commit**

```bash
git add collectors/dat_collector.py
git commit -m "feat(dat): Yahoo stock + KRW fetch + per-company assembly"
```

---

## Task 4: mNAV history persistence + scheduler wrapper (TDD for history)

**Files:**
- Modify: `api/scheduler.py`
- Create: `tests/api/test_dat_history.py`

- [ ] **Step 1: Write the failing test for history dedup**

Create `tests/api/test_dat_history.py`:

```python
"""Tests for the DAT mNAV history append helper (hour-bucket dedup)."""
import importlib


def test_append_dat_history_dedups_by_hour(tmp_path, monkeypatch):
    import api.scheduler as sched
    importlib.reload(sched)
    monkeypatch.setattr(sched, "_DAT_HISTORY_FILE", tmp_path / "dat_history.json")

    # same hour bucket → overwrite (one point kept per ticker per hour)
    sched._append_dat_history("CNTN", "2026-06-01T10:05:00+00:00", 1.40)
    sched._append_dat_history("CNTN", "2026-06-01T10:55:00+00:00", 1.45)
    hist = sched._load_dat_history()
    cntn = [p for p in hist if p["ticker"] == "CNTN"]
    assert len(cntn) == 1
    assert cntn[0]["mnav"] == 1.45  # latest within the hour wins

    # new hour bucket → append
    sched._append_dat_history("CNTN", "2026-06-01T11:01:00+00:00", 1.50)
    cntn = [p for p in sched._load_dat_history() if p["ticker"] == "CNTN"]
    assert len(cntn) == 2


def test_append_dat_history_skips_none_mnav(tmp_path, monkeypatch):
    import api.scheduler as sched
    importlib.reload(sched)
    monkeypatch.setattr(sched, "_DAT_HISTORY_FILE", tmp_path / "dat_history.json")
    sched._append_dat_history("CNTN", "2026-06-01T10:05:00+00:00", None)
    assert sched._load_dat_history() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat_history.py -v`
Expected: FAIL — `AttributeError: module 'api.scheduler' has no attribute '_append_dat_history'`.

- [ ] **Step 3: Add history helpers to `api/scheduler.py`**

In `api/scheduler.py`, right after the `_append_kpi_history` function (after line ~117, before the `# Tweet history` comment), add:

```python
# DAT mNAV history — one point per ticker per hour, 90-day ring buffer.
# Mirrors _append_kpi_history but dedups by hour bucket (ts[:13]) instead of date.
_DAT_HISTORY_FILE = Path(__file__).parent.parent / "data" / "dat_history.json"
_DAT_HISTORY_MAX_PER_TICKER = 2160  # ~90 days hourly


def _load_dat_history() -> list[dict]:
    if not _DAT_HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(_DAT_HISTORY_FILE.read_text())
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning(f"DAT history read failed: {e}")
        return []


def _append_dat_history(ticker: str, ts: str, mnav) -> None:
    """Append {ticker, ts, mnav}, dedup by (ticker, hour-bucket). Skips None mnav."""
    if mnav is None:
        return
    history = _load_dat_history()
    bucket = ts[:13]  # YYYY-MM-DDTHH
    history = [
        e for e in history
        if not (e.get("ticker") == ticker and e.get("ts", "")[:13] == bucket)
    ]
    history.append({"ticker": ticker, "ts": ts, "mnav": round(float(mnav), 4)})
    # Trim per-ticker to the ring-buffer cap (keep newest), preserve others.
    by_ticker: dict[str, list[dict]] = {}
    for e in history:
        by_ticker.setdefault(e.get("ticker", ""), []).append(e)
    trimmed: list[dict] = []
    for items in by_ticker.values():
        items.sort(key=lambda x: x.get("ts", ""))
        trimmed.extend(items[-_DAT_HISTORY_MAX_PER_TICKER:])
    _DAT_HISTORY_FILE.parent.mkdir(exist_ok=True)
    _DAT_HISTORY_FILE.write_text(json.dumps(trimmed, ensure_ascii=False))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat_history.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Add the `collect_dat(cache)` scheduler wrapper**

In `api/scheduler.py`, after the `collect_kr_companies(cache)` function (after line ~835), add:

```python
async def collect_dat(cache: TTLCache):
    """DAT 트래커 — $CC 현재가를 cache에서 주입해 수집하고 mNAV 히스토리 누적."""
    from collectors.dat_collector import collect_dat as _collect, load_cached_dat
    try:
        price = cache.get("price") or {}
        cc_price = price.get("current_price_usd")
        data = await _collect(cc_price)
        if data and data.get("companies"):
            # Append an mNAV history point per company, then attach history to payload.
            for co in data["companies"]:
                _append_dat_history(co.get("ticker", ""), data["fetched_at"], co.get("mnav"))
            history = _load_dat_history()
            for co in data["companies"]:
                co["mnav_history"] = [
                    {"ts": p["ts"], "mnav": p["mnav"]}
                    for p in history if p.get("ticker") == co.get("ticker")
                ]
            cache.set("analytics:dat", data, ttl=600)
            logger.info(f"DAT cached: {data['company_count']} companies")
    except Exception as e:
        logger.error(f"DAT collection failed: {e}")
        cached = load_cached_dat()
        if cached:
            cache.set("analytics:dat", cached, ttl=600)
            logger.info("DAT loaded from file cache")
```

- [ ] **Step 6: Register the loop**

In `api/scheduler.py`, in the loop-registration block (near line ~988, after the `collect_holders` registration), add:

```python
    # DAT 트래커는 5분마다
    asyncio.create_task(_loop(collect_dat, cache, 300, "dat"))
```

- [ ] **Step 7: Run the full backend test suite**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/ -v`
Expected: all pass, including the new `test_dat_calc.py` and `test_dat_history.py`.

- [ ] **Step 8: Commit**

```bash
git add api/scheduler.py tests/api/test_dat_history.py
git commit -m "feat(dat): mNAV history persistence + collect_dat scheduler wrapper"
```

---

## Task 5: Route endpoint (TDD)

**Files:**
- Modify: `api/routes/analytics.py`
- Create: `tests/api/test_dat.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_dat.py`:

```python
"""Route tests for /api/analytics/dat."""
from fastapi.testclient import TestClient

from api.main import app


def test_dat_endpoint_200_and_shape():
    client = TestClient(app)
    resp = client.get("/api/analytics/dat")
    assert resp.status_code == 200
    data = resp.json()
    assert "companies" in data
    assert isinstance(data["companies"], list)
    assert "company_count" in data


def test_dat_empty_fallback_shape():
    """캐시 미스여도 빈 폴백 shape을 200으로 반환 (500 금지)."""
    client = TestClient(app)
    data = client.get("/api/analytics/dat").json()
    # company_count는 항상 존재하고 companies는 리스트
    assert isinstance(data.get("companies"), list)
    assert data.get("company_count") == len(data["companies"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat.py -v`
Expected: FAIL — 404 (route not defined) so `assert resp.status_code == 200` fails.

- [ ] **Step 3: Add the endpoint**

In `api/routes/analytics.py`, after the `kr_companies` endpoint (after line ~26), add:

```python
def _empty_dat():
    return {"companies": [], "company_count": 0, "total_cc_holdings": 0,
            "total_pl_usd": 0, "fetched_at": None}


@router.get("/dat")
async def dat(request: Request):
    """Canton DAT 트래커 — $CC 보유 상장사 현황."""
    cache = get_cache(request)
    data = cache.get("analytics:dat")
    if data is None:
        return _empty_dat()
    return data
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/api/test_dat.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Live endpoint smoke**

Run (in one line, starts server, waits, curls, kills):
```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && (uvicorn api.main:app --port 8011 & SRV=$!; sleep 6; curl -s http://localhost:8011/api/analytics/dat | python -c "import sys,json; d=json.load(sys.stdin); print('count:', d['company_count'])"; kill $SRV)
```
Expected: `count: 1` (after the first scheduled collection) or `count: 0` (if scheduler hasn't run yet) — both are valid 200 responses.

- [ ] **Step 6: Commit**

```bash
git add api/routes/analytics.py tests/api/test_dat.py
git commit -m "feat(dat): /api/analytics/dat endpoint with empty fallback"
```

---

## Task 6: Frontend types + SWR hook

**Files:**
- Modify: `web/lib/types.ts` (add interfaces)
- Modify: `web/lib/api.ts` (add hook + import types)

- [ ] **Step 1: Add types to `web/lib/types.ts`**

At the END of `web/lib/types.ts`, append:

```typescript
export interface DatMnavPoint {
  ts: string;
  mnav: number;
}

export interface DatCompany {
  ticker: string;
  name: string;
  exchange: string;
  cc_holdings: number;
  avg_buy_price: number;
  debt: number;
  cash: number;
  shares_outstanding: number;
  super_validator: boolean;
  source: string;
  as_of: string;
  // computed / live (nullable when data missing)
  stock_price: number | null;
  market_cap: number | null;
  cc_price: number | null;
  nav: number | null;
  mnav: number | null;
  mnav_label: string | null;
  pl_usd: number | null;
  pl_pct: number | null;
  krw_rate: number | null;
  value_krw: number | null;
  pl_krw: number | null;
  risk: "healthy" | "watch" | "below_nav" | null;
  mnav_history: DatMnavPoint[];
}

export interface DatData {
  companies: DatCompany[];
  company_count: number;
  total_cc_holdings: number;
  total_pl_usd: number;
  fetched_at: string | null;
}
```

- [ ] **Step 2: Add the hook to `web/lib/api.ts`**

In `web/lib/api.ts`, add `DatData` to the type import block (lines 2-20, alongside `KrCompaniesData`):

```typescript
  KrCompaniesData,
  DatData,
```

Then, after the `useKrCompanies` function (after line ~97), add:

```typescript
export function useDat() {
  return useSWR<DatData>(`${API}/api/analytics/dat`, fetcher, {
    refreshInterval: 60_000, // 1min
  });
}
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/lib/api.ts
git commit -m "feat(dat): DatCompany/DatData types + useDat hook"
```

---

## Task 7: mNAV chart component

**Files:**
- Create: `web/components/dat/mnav-chart.tsx`

- [ ] **Step 1: Create the chart component**

Create `web/components/dat/mnav-chart.tsx`:

```tsx
"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    ReferenceLine,
    Tooltip,
} from "recharts";

interface Point {
    ts: string;
    mnav: number;
}

export default function MnavChart({ data }: { data: Point[] }) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 160 }}>
                데이터 축적 중
            </div>
        );
    }
    const series = data.map((p) => ({
        t: p.ts.slice(5, 10), // MM-DD
        mnav: p.mnav,
    }));
    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--canton-border)" }}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        domain={["auto", "auto"]}
                    />
                    <ReferenceLine
                        y={1.0}
                        stroke="var(--canton-down)"
                        strokeDasharray="4 4"
                        label={{ value: "1.0x", fontSize: 10, fill: "var(--canton-down)", position: "right" }}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--canton-card)",
                            border: "1px solid var(--canton-border)",
                            borderRadius: 6,
                            fontSize: 12,
                        }}
                        formatter={(v: number) => [`${v.toFixed(2)}x`, "mNAV"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="mnav"
                        stroke="var(--canton-lime)"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/components/dat/mnav-chart.tsx
git commit -m "feat(dat): mNAV time-series chart with 1.0x reference line"
```

---

## Task 8: Company card component

**Files:**
- Create: `web/components/dat/company-card.tsx`

- [ ] **Step 1: Create the card component**

Create `web/components/dat/company-card.tsx`:

```tsx
"use client";

import type { DatCompany } from "@/lib/types";
import { fmtUsd, fmtCc, fmtPct, fmtLargeUsd } from "@/lib/format";
import MnavChart from "./mnav-chart";

const RISK_META: Record<
    string,
    { label: string; cls: string; mark: string }
> = {
    healthy: { label: "Healthy", cls: "up", mark: "●" },
    watch: { label: "Watch", cls: "burn", mark: "◐" },
    below_nav: { label: "Below NAV", cls: "down", mark: "▼" },
};

function fmtKrwEok(n: number | null): string {
    // 억원 단위 (1e8). null → "—".
    if (n == null) return "—";
    return `₩${(n / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억`;
}

export default function CompanyCard({ c }: { c: DatCompany }) {
    const plPositive = (c.pl_usd ?? 0) >= 0;
    const plColor = plPositive ? "var(--canton-up)" : "var(--canton-down)";
    const plArrow = plPositive ? "▲" : "▼";
    const risk = c.risk ? RISK_META[c.risk] : null;

    return (
        <div className="ch-card">
            <div className="ch-card-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--zinc-50)" }}>
                        {c.ticker}
                    </span>
                    <span className="ch-chip muted ch-chip-xs">{c.exchange}</span>
                    {c.super_validator && (
                        <span className="ch-chip lime ch-chip-xs">SV</span>
                    )}
                </div>
                {risk && (
                    <span className={`ch-chip ${risk.cls}`}>
                        {risk.mark} {risk.label}
                    </span>
                )}
            </div>

            {/* Holdings */}
            <div style={{ marginBottom: 12 }}>
                <div className="ch-eyebrow">Holdings</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "var(--zinc-50)", fontVariantNumeric: "tabular-nums" }}>
                    {c.cc_holdings ? fmtCc(c.cc_holdings) : "—"}
                </div>
            </div>

            {/* Stat grid */}
            <div className="ch-bm-stats">
                <div className="ch-bm-stat">
                    <div className="k">Avg Buy</div>
                    <div className="v">{c.avg_buy_price ? fmtUsd(c.avg_buy_price) : "—"}</div>
                </div>
                <div className="ch-bm-stat">
                    <div className="k">CC Price</div>
                    <div className="v">{fmtUsd(c.cc_price)}</div>
                </div>
                <div className="ch-bm-stat">
                    <div className="k">Value</div>
                    <div className="v">{fmtLargeUsd(c.nav)}</div>
                </div>
            </div>

            {/* mNAV */}
            <div style={{ margin: "14px 0" }}>
                <div className="ch-eyebrow">{c.mnav_label ?? "mNAV"}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--canton-private)", fontVariantNumeric: "tabular-nums" }}>
                    {c.mnav != null ? `${c.mnav.toFixed(2)}x` : "—"}
                </div>
            </div>

            {/* P/L */}
            <div style={{ margin: "14px 0", paddingTop: 12, borderTop: "1px solid var(--canton-border)" }}>
                <div className="ch-eyebrow">Real-time P/L</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: plColor, fontVariantNumeric: "tabular-nums" }}>
                    {c.pl_usd != null ? `${plArrow} ${fmtLargeUsd(c.pl_usd)}` : "—"}
                    {c.pl_pct != null && (
                        <span style={{ fontSize: 13, marginLeft: 8 }}>{fmtPct(c.pl_pct)}</span>
                    )}
                </div>
                {c.pl_krw != null && (
                    <div style={{ fontSize: 12, color: "var(--zinc-500)", marginTop: 2 }}>
                        ≈ {fmtKrwEok(c.pl_krw)}원
                    </div>
                )}
            </div>

            {/* mNAV history */}
            <MnavChart data={c.mnav_history} />
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/components/dat/company-card.tsx
git commit -m "feat(dat): company card (stats, mNAV, P/L+KRW, risk badge)"
```

---

## Task 9: DAT page + navbar tab

**Files:**
- Create: `web/app/dat/page.tsx`
- Modify: `web/components/nav/navbar.tsx`

The page shell mirrors `web/app/feed/page.tsx` exactly (`Navbar` with `lang/onLangChange/connected` props + `<main className="max-w-[1200px]...">` + `Footer lang`), because that is the live shell. Inside `<main>` we use the `.ch-*` classes (they exist in globals.css).

- [ ] **Step 1: Create the page**

Create `web/app/dat/page.tsx`:

```tsx
"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import CompanyCard from "@/components/dat/company-card";
import { usePrice, useDat } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";
import { useLang } from "@/lib/use-lang";
import { fmtCc, fmtLargeUsd } from "@/lib/format";

export default function DatPage() {
  const [lang, setLang] = useLang();
  const { data: swrPrice } = usePrice();
  const { connected } = useRealtimePrice(swrPrice);
  const { data, isLoading } = useDat();

  const companies = data?.companies ?? [];
  const avgMnav = (() => {
    const vals = companies.map((c) => c.mnav).filter((m): m is number => m != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();
  const totalPlPositive = (data?.total_pl_usd ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-canton-bg flex flex-col">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />
      <main className="max-w-[1200px] w-full mx-auto px-6 py-5 flex-1">
        <div className="ch-page-header">
          <div>
            <h1>DAT Tracker</h1>
            <div className="sub">
              Canton 재무자산($CC)을 보유한 상장 기업 — 보유량 · mNAV · 평가손익. 참고용이며 투자 조언이 아닙니다.
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="ch-kpi-strip">
          <div className="ch-kpi">
            <div className="label">추적 기업</div>
            <div className="value-row"><span className="value">{data?.company_count ?? 0}</span></div>
          </div>
          <div className="ch-kpi">
            <div className="label">합산 $CC 보유</div>
            <div className="value-row"><span className="value">{fmtCc(data?.total_cc_holdings ?? 0)}</span></div>
          </div>
          <div className="ch-kpi">
            <div className="label">합산 평가손익</div>
            <div className="value-row">
              <span className="value" style={{ color: totalPlPositive ? "var(--canton-up)" : "var(--canton-down)" }}>
                {totalPlPositive ? "▲" : "▼"} {fmtLargeUsd(data?.total_pl_usd ?? 0)}
              </span>
            </div>
          </div>
          <div className="ch-kpi">
            <div className="label">평균 mNAV</div>
            <div className="value-row"><span className="value">{avgMnav != null ? `${avgMnav.toFixed(2)}x` : "—"}</span></div>
          </div>
        </div>

        {/* Company cards */}
        {isLoading && companies.length === 0 ? (
          <div className="ch-skel" style={{ height: 320 }}>로딩 중</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
            {companies.map((c) => (
              <CompanyCard key={c.ticker} c={c} />
            ))}
          </div>
        )}

        {/* Data sources */}
        <div className="ch-card" style={{ marginTop: 24 }}>
          <div className="ch-card-title" style={{ marginBottom: 8 }}>Data Sources</div>
          <div style={{ overflowX: "auto" }}>
            <table className="ch-data-table" style={{ minWidth: 360 }}>
              <thead>
                <tr><th>Data</th><th>Source</th><th>Update</th></tr>
              </thead>
              <tbody>
                <tr><td>Stock Price / Market Cap</td><td>Yahoo Finance</td><td>5 min</td></tr>
                <tr><td>$CC Price</td><td>CoinGecko (Canton Hub)</td><td>30 sec</td></tr>
                <tr><td>CC Holdings / Avg Buy</td><td>Official filings (manual)</td><td>On announcement</td></tr>
                <tr><td>USD/KRW</td><td>open.er-api.com</td><td>5 min</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
```

- [ ] **Step 2: Add navbar tab (all 4 languages)**

In `web/components/nav/navbar.tsx`, add a `/dat` entry to each language array inside `NAV_ITEMS` (lines 16-37), placed between `/analytics` and `/feed`:

```typescript
const NAV_ITEMS = {
  ko: [
    { href: "/", label: "대시보드" },
    { href: "/analytics", label: "분석" },
    { href: "/dat", label: "DAT" },
    { href: "/feed", label: "피드" },
  ],
  en: [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/dat", label: "DAT" },
    { href: "/feed", label: "Feed" },
  ],
  ja: [
    { href: "/", label: "ダッシュボード" },
    { href: "/analytics", label: "分析" },
    { href: "/dat", label: "DAT" },
    { href: "/feed", label: "フィード" },
  ],
  zh: [
    { href: "/", label: "仪表板" },
    { href: "/analytics", label: "分析" },
    { href: "/dat", label: "DAT" },
    { href: "/feed", label: "动态" },
  ],
};
```

- [ ] **Step 3: Type-check + build**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build completes with `/dat` listed among the routes (`✓` for the page).

- [ ] **Step 4: Browser smoke (manual)**

Start backend + frontend, open `http://localhost:3000/dat`:
```bash
# terminal A
cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && uvicorn api.main:app --reload --port 8000
# terminal B
cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
Verify: DAT tab appears in navbar (desktop + mobile drawer) and is active on `/dat`; KPI strip + CNTN card render (values show "—" because seed is 0s — expected); toggle dark/light — colors adapt; switch language — DAT tab label persists; no console errors.

**Mobile check (360px):** resize the viewport to 360px (or DevTools device toolbar) and confirm NO horizontal scroll. In the console run `document.documentElement.scrollWidth <= window.innerWidth` → must be `true`. The card grid should be a single column, the KPI strip 2×2, and the Data Sources table should scroll horizontally inside its wrapper without pushing the page wide.

- [ ] **Step 5: Commit**

```bash
git add web/app/dat/page.tsx web/components/nav/navbar.tsx
git commit -m "feat(dat): /dat page (KPI strip, cards, data sources) + navbar tab"
```

---

## Task 10: Docs update + final verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/DATA_GUIDE.md`

- [ ] **Step 1: Update ARCHITECTURE.md**

In `docs/ARCHITECTURE.md`, add to the Cache Key Map table a row:
`| analytics:dat | 600s | DAT 트래커 (CNTN 등 $CC 보유 상장사 mNAV/PL) | /api/analytics/dat |`
And add `/api/analytics/dat` to the API/route map alongside the other analytics endpoints.

- [ ] **Step 2: Update DATA_GUIDE.md**

In `docs/DATA_GUIDE.md`, add to the Data Sources table:
`| Yahoo Finance chart | CNTN 주가/시총 | 키 불필요 | 5분 |`
`| open.er-api.com | USD/KRW 환율 | 키 불필요 | 5분 |`
And note `data/dat_companies.json` is manually maintained from official filings, `data/dat_history.json` is a runtime-generated hourly mNAV ring buffer (90 days).

- [ ] **Step 3: Full verification gate**

Run backend tests + frontend build together:
```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub && source venv/bin/activate && pytest tests/ -v && cd web && npx tsc --noEmit && npm run build
```
Expected: all pytest pass; tsc exit 0; build succeeds with `/dat` route present.

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md docs/DATA_GUIDE.md
git commit -m "docs(dat): cache key map + data sources for DAT tracker"
```

- [ ] **Step 5: Fill real CNTN data (manual, post-merge note)**

After merge, edit `data/dat_companies.json` with real figures from CNTN's latest 8-K / press release (cc_holdings, avg_buy_price, debt, cash, shares_outstanding) and update `source`/`as_of`. Restart backend (`launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend`) so the next collection picks them up. Until this step, cards correctly render "—".

---

## Self-Review

**Spec coverage** (against [2026-05-31-dat-tracker-design.md](./2026-05-31-dat-tracker-design.md)):
- §1 $CC-only, multi-company, CNTN seed → Task 1 JSON, Task 8/9 multi-card grid. ✓
- §2 architecture (collector→scheduler→cache→route→web), price reuse via cache, Yahoo source → Tasks 2-6. ✓
- §3 data model (cc_holdings, shares_outstanding, mnav EV+fallback+label, pl, krw, risk) → Task 1 JSON + Task 2/3 calc + Task 6 types. ✓
- §3.3 mNAV history (hour dedup, 90-day window, `_append_dat_history`) → Task 4. ✓
- §4 UI (page header, KPI strip, cards, mNAV chart, data sources, `.ch-*`, responsive auto-fit) → Tasks 7-9. ✓
- §5 risk bands (1.2/1.0, neutral "Below NAV", no "DEATH SPIRAL") → Task 2 `classify_risk` + Task 8 `RISK_META`. ✓
- §6 colors (green↑/red↓ + ▲▼ + sign, CSS var swap) → Task 8/9. ✓
- §7 error handling (price fail fallback, Yahoo null fields, holdings 0 → "—", short history → skeleton) → Task 3 (None tolerance) + Task 5 empty fallback + Task 7 skeleton + Task 8 "—" guards. ✓
- §8 tests → Tasks 2,4,5 + Task 10 build gate. ✓
- §10 YAGNI (no SV revenue, no copy-clipboard, no multi-coin) → not implemented. ✓

**Placeholder scan:** No TBD/"add error handling"/"similar to" — all steps carry full code. The only intentional placeholders are the `0` values in `dat_companies.json`, which are real seed data documented as fill-later (Task 10 Step 5).

**Type consistency:** Backend dict keys (`stock_price, market_cap, cc_price, nav, mnav, mnav_label, pl_usd, pl_pct, krw_rate, value_krw, pl_krw, risk, mnav_history`) match the `DatCompany` TS interface (Task 6) and the card's field reads (Task 8). `classify_risk` returns exactly `"healthy"|"watch"|"below_nav"|None`, matching `RISK_META` keys and the TS union. `collect_dat` exists in two namespaces by design: pure `collectors.dat_collector.collect_dat(cc_price)` vs scheduler `collect_dat(cache)` — imported with `as _collect` to avoid collision (matches the existing `collect_kr_companies` pattern).
