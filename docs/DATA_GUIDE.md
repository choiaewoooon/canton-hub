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
| 17 | Google News RSS (`"Canton Network"` 정확구문) | RSS | 1h | `media_collector.py` | `/api/feed` |
| 18 | Canton 공식 블로그 (`canton.network/blog/rss.xml`) | RSS | 1h | `media_collector.py` | `/api/feed` |
| 19 | Digital Asset 블로그 (`blog.digitalasset.com/blog/rss.xml`) | RSS | 1h | `media_collector.py` | `/api/feed` |
| 20 | Hyperliquid `info` POST API (펀딩비) | REST | 60s | `funding_rates.py` | `/api/analytics/funding-rates` |
| 21 | Lighter REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 22 | Aster REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 23 | Extended DEX REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 24 | Binance Futures REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 25 | Bybit REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 26 | OKX REST API (펀딩비) | REST | 60s | `funding_rates.py` | same |
| 27 | Yahoo Finance chart endpoint (CNTN 주가/시총, 키 불필요) | REST | ~5min | `dat_collector.py` | `/api/analytics/dat` |
| 28 | open.er-api.com (USD/KRW 환율, 키 불필요) | REST | ~5min | `dat_collector.py` | `/api/analytics/dat` |

**Fallback chains** (ordered):
- **Network stats**: CantonScan REST `/stats` → CantonScan HTML scrape → Playwright render → file cache → `_EMPTY_NETWORK`
- **Holders**: CantonScan REST → ccview.io Playwright → file cache → `_EMPTY_HOLDERS`
- **Realtime prices**: parallel fan-out across CEX/DEX; each source independently degrades

**DAT 트래커 데이터 파일** (`dat_collector.py`):
- `data/dat_companies.json` — 공식 공시(8-K 등) 기반으로 **수기 관리**되는 마스터 데이터 (티커, 회사명, $CC 보유량). 외부 수집 대상이 아니며 운영자가 직접 갱신한다.
- `data/dat_history.json` — 런타임 생성 mNAV 시계열 **링버퍼** (시간당 1포인트, 최대 ~90일 = 2160 포인트). 수집 루프가 매 실행마다 append하고 초과분을 오래된 순으로 삭제.

---

### 2.1 미디어 RSS 수집 흐름

```
1시간 폴링 (collect_media, scheduler.py)
    │
    ▼
media_collector.py — RSS 3종 fetch + feedparser 파싱
    │  guid 기반 중복 제거 → data/media_items.json 링버퍼(캐패시티 60)에 저장
    ▼
신규 항목만 처리 (회당 최대 12건 캡 — 비용 가드)
    │
    ├── news_summarizer.py → gemq(Gemini)
    │       한국어 1-call 요약 + 카테고리 분류
    │       (9개 카테고리: partnership/validator/etf_product/institutional/
    │        dat_vehicle/tokenomics/funding/network_metric/other)
    │
    └── api/translator.py → translate() EN→ko/ja/zh 제목 번역
    │
    ▼
cache.set("media:items", ..., ttl=7200)
    │
    ▼
cache.set("tweet:items", ..., ttl=46800)  ← data/tweet_items.json 링버퍼에도 영속
    │
    ▼
GET /api/feed — tweet:items + media:items 머지 → ts 내림차순 페이지네이션(10건/page)
```

**비용 게이팅**: 이미 처리된 guid는 재처리하지 않음. 1회 실행당 최대 12건(`config.MEDIA_MAX_NEW_PER_RUN`)만 LLM/번역 호출.

---

### 2.3 펀딩비 수집 흐름 (funding-rates)

```
60초 폴링 (collect_funding_rates, scheduler.py)
    │
    ▼
funding_rates.py — 7개 거래소 병렬 fan-out
    │  DEX: Hyperliquid (1h 정산), Lighter (1h), Extended (1h), Aster (8h)
    │  CEX: Binance (8h), Bybit (8h), OKX (8h)
    │
    ├── 각 fetcher: 거래소별 REST 호출 → FundingRate dataclass
    │       FundingRate.to_apr() — settlement_interval_h 기반 APR 정규화
    │           1h 정산:  rate × 8760
    │           8h 정산:  rate × 1095
    │
    ▼
collect_all_funding_rates() — asyncio.gather (graceful partial)
    │  ≥1개 거래소 응답 시만 캐시 갱신 (이전 값 보존 로직)
    │
    ▼
cache.set("analytics:funding-rates", {...}, ttl=90)
    │
    ▼
GET /api/analytics/funding-rates
    │  캐시 히트: {rates: FundingRate[], updated_at}
    └─ 캐시 미스: {rates: [], updated_at: null}
```

**Graceful partial**: 일부 거래소 fetcher가 실패해도 성공한 거래소의 데이터만 반환. 모든 거래소가 실패하면 캐시를 덮어쓰지 않고 이전 값을 유지.

---

### 2.2 트윗 수집 흐름 (피드 v2)

```
15분 폴링 (collect_feed, scheduler.py)
    │
    ▼
twitter_collector.py — RapidAPI Twitter API45 fetch
    │  url 기준 중복 제거
    ├── news_summarizer.classify_text → gemq(Gemini)
    │       각 신규 트윗을 9개 카테고리 중 하나로 분류
    │
    ▼
data/tweet_items.json 링버퍼에 append (캐패시티 200, 오래된 순 삭제)
    │
    ▼
cache.set("tweet:items", ..., ttl=46800)
    │
    ▼
summarize_tweets(tweets, news_lines)  ← load_media_items()[:8]의 뉴스 헤드라인 포함
    │
    ▼
cache.set("feed:{lang}", {lang, ai_summary, fetched_at}, ttl=900)
    │   ※ items는 feed:{lang}에 저장되지 않음 (tweet:items에 별도 보관)
    │
    ▼
GET /api/feed — tweet:items + media:items 머지 → ts 내림차순 페이지네이션(10건/page)
```

**주요 변경점 (v2)**:
- 트윗이 `feed:{lang}.items`에 저장되던 방식(~13h 수명)에서 `tweet:items` 영속 링버퍼로 전환
- `ai_summary`는 최근 Canton 미디어 헤드라인(뉴스 최대 8건)을 포함해 생성
- 각 트윗에 `category` 필드 추가 (Haiku 분류, `"other"` 제외 시 UI에 배지 표시)

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
| 2026-05-30 | 피드 v2 반영: 트윗 누적 링버퍼(data/tweet_items.json), Haiku 카테고리 분류, ai_summary에 뉴스 헤드라인 포함, 2.2 트윗 수집 흐름 섹션 추가 | feat/feed-v2-categorize-paginate |
| 2026-05-31 | 펀딩비 데이터 소스 추가: 7개 거래소(#20–26), 2.3 펀딩비 수집 흐름 섹션 추가 | feat/funding-rates |

<!-- TODO: add entries on every collector change, TTL adjustment, or new data source -->
