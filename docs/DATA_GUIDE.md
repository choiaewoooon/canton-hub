# DATA_GUIDE.md — Canton Hub Backend

> **Update Triggers**: new collector added, data source changed, TTL adjusted, fallback logic modified, new dataclass field.
> **Audience**: backend developers, AI agents modifying `collectors/`.
> **Scope**: read-only aggregation backend. No persistent database.

---

## 1. Storage Overview

Canton Hub is a **read-only aggregation backend**. There is **no relational database, no Supabase, no Redis, no migrations, no schema**.

| Layer | Implementation | Purpose | Thread-safe |
|---|---|---|---|
| L1 — Hot cache | `TTLCache` (in-memory dict + per-key TTL + `threading.RLock`) | Primary serving layer | Yes |
| L2 — File cache | `data/*.json` (one file per collector) | Fallback on cold start / API failure | Yes (atomic write) |
| L3 — Empty skeleton | `_EMPTY_PRICE`, `_EMPTY_NETWORK`, `_EMPTY_FEED`, … dicts | Last-resort response | Stateless |

**Resolution order** on any `GET /api/*` request:

```
cache.get(key) → hit? return
             ↓ miss/expired
collector.collect() → success? cache.set + file.save + return
             ↓ failure
file.load(key) → success? cache.set + return
             ↓ failure
return _EMPTY_* skeleton (HTTP 200, empty payload)
```

**Why no DB?**
- All data is **derivable** from external APIs — no user state, no writes
- Simplifies deployment (single process, no ops burden)
- Cache TTLs match upstream refresh cadence — no staleness benefit from DB

---

## 2. Data Sources

| # | Source | Type | TTL | Collector | Endpoint |
|---|---|---|---|---|---|
| 1 | CoinGecko API v3 | REST | 30s | `price_collector.py` | `/api/price` |
| 2 | CoinGecko web (derivatives) | Playwright scrape | 15min | `coingecko_scraper.py` | `/api/analytics/exchanges` |
| 3 | CantonScan `/stats` | REST + HTML + Playwright | 5min | `cantonscan_collector.py`, `cantonscan_scraper.py` | `/api/network`, `/api/network/status` |
| 4 | CantonScan `/api/parties/{id}` | REST | 30min | `kr_companies_collector.py` | `/api/analytics/kr-companies` |
| 5 | CantonScan `/api/super-validators`, `/validators` | REST | 1h | `holders_collector.py` | `/api/analytics/holders` |
| 6 | RapidAPI Twitter API45 | REST | 15min | `twitter_collector.py` | `/api/feed` |
| 7 | GitHub CIP repo | GitHub REST API | 1h | `governance_collector.py` | `/api/governance` |
| 8 | Hyperliquid `info` API | POST REST | 5s | `realtime_prices.py` | `/api/analytics/realtime-prices` |
| 9 | Extended `/api/v1/info/markets` | REST | 5s | `realtime_prices.py` | same |
| 10 | Aster `/fapi/v1/openInterest` | REST | 5s | `realtime_prices.py`, `dex_oi_collector.py` | same |
| 11 | Lighter `/api/v1/exchangeStats` | REST | 5s | `realtime_prices.py` | same |
| 12 | Bybit `/v5/market/tickers` | REST | 5s | `realtime_prices.py` | same |
| 13 | OKX `/api/v5/market/ticker` | REST | 5s | `realtime_prices.py` | same |
| 14 | Kraken `/0/public/Ticker` | REST | 5s | `realtime_prices.py` | same |
| 15 | Binance Futures `/fapi/v1/ticker/24hr` | REST | 5s | `realtime_prices.py` | same |
| 16 | ccview.io | Playwright scrape (fallback) | 1h | `holders_collector.py` | `/api/analytics/holders` |

**Fallback chains** (ordered):
- **Network stats**: CantonScan REST `/stats` → CantonScan HTML scrape → Playwright render → file cache → `_EMPTY_NETWORK`
- **Holders**: CantonScan REST → ccview.io Playwright → file cache → `_EMPTY_HOLDERS`
- **Realtime prices**: parallel fan-out across CEX/DEX; each source independently degrades

---

## 3. Data Models

All models are **Python `@dataclass`** defined inline in each collector. No ORM, no schema registry.

### 3.1 `PriceData` — `collectors/price_collector.py`

| Field | Type | Source | Notes |
|---|---|---|---|
| `current_price_usd` | float | CoinGecko `market_data.current_price.usd` | |
| `price_change_24h` | float | `market_data.price_change_24h` | USD absolute |
| `price_change_percentage_24h` | float | `market_data.price_change_percentage_24h` | |
| `high_24h` | float | `market_data.high_24h.usd` | |
| `low_24h` | float | `market_data.low_24h.usd` | |
| `market_cap` | float | `market_data.market_cap.usd` | |
| `total_volume_24h` | float | `market_data.total_volume.usd` | |
| `circulating_supply` | float | `market_data.circulating_supply` | |
| `fetched` | datetime | `datetime.utcnow()` | serialization timestamp |

### 3.2 `CantonScanData` — `collectors/cantonscan_collector.py`

| Field | Type | Notes |
|---|---|---|
| `daily_burn` | float | CC burned in 24h |
| `daily_mint` | float | CC minted in 24h |
| `burn_mint_ratio` | float | `daily_burn / daily_mint` |
| `total_burned` | float | cumulative burn |
| `total_supply` | float | circulating supply |
| `daily_transactions` | int | |
| `daily_active_addresses` | int | |
| `app_rewards` | float | |
| `validator_rewards` | float | |
| `sv_rewards` | float | super-validator rewards |
| `burned_from_fees` | float | |
| `burned_from_traffic` | float | |
| `avg_amulet_price` | float | |
| `cumulative_mint` | float | |
| `cumulative_burn` | float | |
| `fetched` | datetime | |

### 3.3 `TweetData` — `collectors/twitter_collector.py`

| Field | Type | Notes |
|---|---|---|
| `username` | str | `@handle` without `@` |
| `text` | str | tweet body, unicode preserved |
| `created_at` | datetime | RapidAPI ISO-8601 |
| `url` | str | canonical tweet URL |
| `likes` | int | |
| `retweets` | int | |
| `replies` | int | |
| `views` | int | may be `0` for older tweets |
| `media_urls` | list[str] | images + video thumbnails |

### 3.4 `KrCompany` — `collectors/kr_companies_collector.py`

| Field | Type | Notes |
|---|---|---|
| `party_id` | str | CantonScan party identifier |
| `name_ko` | str | |
| `name_en` | str | |
| `wallet_address` | str | |
| `verification_status` | enum | `on_chain_only` \| `confirmed` |
| `confidence` | enum | `high` \| `medium` \| `low` |
| `evidence_ko` | list[str] | Korean-language evidence notes |
| `evidence_en` | list[str] | English-language evidence notes |

**Verification model** — Canton network has **no KYC**. All KR company verification is **on-chain evidence based**:

| Evidence type | Weight | Example |
|---|---|---|
| Corporate email domain | medium | `@company.co.kr` in GSF sponsor metadata |
| GSF sponsor relationship | high | listed as sponsor on `gsf.foundation` |
| Wallet cluster topology | medium | co-signers overlap with known KR entity cluster |
| Transaction tracing | low | recurring flows to verified KR wallets |

`confirmed` requires at least one `high`-weight evidence item. `on_chain_only` is default.

---

## 4. ETL / Pipeline Flow

```
                    ┌─────────────────────────┐
                    │   External API/Source   │
                    └───────────┬─────────────┘
                                │ httpx.AsyncClient / Playwright
                                ▼
                    ┌─────────────────────────┐
                    │   collector.collect()   │
                    │   try: fetch + parse    │
                    │   except: log + return  │
                    │           _EMPTY_*      │
                    └───────────┬─────────────┘
                                │ dataclass instance
                                ▼
                    ┌─────────────────────────┐
                    │   cache.set(key,        │
                    │     value, ttl=N)       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   file_cache.save(      │
                    │     data/{key}.json)    │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   FastAPI route         │
                    │   returns dict payload  │
                    └─────────────────────────┘
```

**Background refresh**: each collector is driven by an `asyncio.create_task` loop started in FastAPI `lifespan`. Request-time code **never blocks** on a fetch — routes always read from `cache.get(...)`.

---

## 5. Fallback Chain

```
GET /api/price
    │
    ▼
cache.get("price")
    │
    ├── HIT  ──────────────────────────────────► return
    │
    └── MISS/EXPIRED
            │
            ▼
        price_collector.collect()
            │
            ├── SUCCESS ──► cache.set + file.save ──► return
            │
            └── FAILURE (network/API/parse)
                    │
                    ▼
                file_cache.load("price.json")
                    │
                    ├── SUCCESS ──► cache.set (short TTL) ──► return
                    │
                    └── FAILURE
                            │
                            ▼
                        return _EMPTY_PRICE
                        (HTTP 200, fields=0/None)
```

**Rules**:
- Routes NEVER return HTTP 5xx for upstream failures — clients always see a valid-shape payload
- `_EMPTY_*` skeletons have the **exact same keys** as successful responses — only values are zero/null
- File cache entries have **no expiry** on disk; freshness is asserted only via L1 TTL

---

## 6. Rate Limit Management

| API | Limit (free) | Limit (paid) | Strategy |
|---|---|---|---|
| CoinGecko v3 | 10-30 req/min | 500+ req/min with `COINGECKO_API_KEY` | **Prod REQUIRES paid key.** 30s TTL stays well under quota. |
| RapidAPI Twitter API45 | per-plan quota | per-plan | 15min TTL; single key in `RAPIDAPI_KEY`. 429 → fallback to file cache. |
| GitHub REST | 60 req/h anon | 5000 req/h with `GITHUB_TOKEN` | `GITHUB_TOKEN` REQUIRED. 1h TTL. |
| CantonScan | undocumented | n/a | 5min TTL + User-Agent rotation on scrape fallback |
| CEX/DEX realtime | per-exchange | per-exchange | 5s TTL; parallel fan-out; per-source degradation |

**WHEN 429 received → DO**:
1. Log warning with collector name + upstream URL
2. Load from file cache
3. Backoff: next retry at `ttl * 2` (one-time; reset on success)

**WHEN 401/403 received → DO**:
1. Log error (likely missing/invalid API key)
2. Load from file cache
3. Do NOT retry (fail fast until config fixed)

---

## 7. Data Quality Rules

| # | Rule | Enforcement |
|---|---|---|
| DQ-1 | All collectors MUST catch their own exceptions | `try/except` wraps entire `collect()` body; return `_EMPTY_*` on any error |
| DQ-2 | Collectors MUST NOT raise to the FastAPI layer | Verified by test `tests/test_collectors_never_raise.py` (TODO: add if missing) |
| DQ-3 | File cache save happens AFTER successful fetch only | Never cache `_EMPTY_*` to disk |
| DQ-4 | All dataclass instances MUST have `fetched: datetime` | For staleness debugging |
| DQ-5 | Response dict keys MUST match `_EMPTY_*` skeleton keys | Shape stability for frontend |
| DQ-6 | Floats MUST be JSON-serializable (no NaN/Inf) | `float("nan")` → `0.0` conversion in serializer |
| DQ-7 | Rate limit protection: CoinGecko REQUIRES `COINGECKO_API_KEY` in prod | Startup check logs warning if missing |
| DQ-8 | KR company `verification_status="confirmed"` REQUIRES ≥1 `high`-weight evidence | Enforced in `kr_companies_collector._classify()` |
| DQ-9 | Scrape fallbacks (Playwright) MUST have timeout ≤30s | Prevent hanging the async loop |
| DQ-10 | No PII stored anywhere — Twitter handles are public, KR companies are public entities | Manual review |

**Verification commands**:
```bash
# All collectors must return on network failure
pytest tests/test_collectors/ -k "empty_on_failure"

# Shape stability
pytest tests/test_routes/ -k "response_shape"

# Startup env validation
python -c "from canton_hub.config import validate_env; validate_env()"
```

---

## 8. Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-04-14 | Initial generation | docs-init auto-generation |

<!-- TODO: add entries on every collector change, TTL adjustment, or new data source -->
