# ARCHITECTURE — Canton Hub Backend

> **Update triggers**: New route in `api/routes/`, new collector in `collectors/`, new cache key, scheduler interval change, infra change (Dockerfile/fly.toml), external data source change.

| Field | Value |
|-------|-------|
| Project | Canton Hub backend |
| Path | `/Users/choejaewon/project/Ozzycanton/canton-hub` |
| Runtime | Python 3.12 |
| Framework | FastAPI 0.115+ / uvicorn[standard] |
| Scheduler | APScheduler 3.10 (in-process async) |
| HTTP client | httpx 0.25 |
| HTML parsing | beautifulsoup4 |
| Headless browser | Playwright + Chromium |
| SSE | sse-starlette |
| Deploy | Mac local uvicorn (launchd `KeepAlive`) + Cloudflare Quick Tunnel (`scripts/run-tunnel.sh` 경유, 터널 URL 변경 시 `scripts/update-vercel-env.sh`가 Vercel env 자동 갱신) |
| Frontend | `web/` deployed separately on Vercel (`canton-hub.vercel.app`) |

---

## 1. System Diagram

```
                         ┌─────────────────────────────┐
                         │   External Data Sources     │
                         │  CoinGecko · CantonScan     │
                         │  RapidAPI Twitter · GitHub  │
                         │  10 Exchange REST APIs      │
                         │  ccview.io                  │
                         └──────────────┬──────────────┘
                                        │ httpx / Playwright
                                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Canton Hub FastAPI Process                    │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │  api/main.py     │  lifespan.startup ─┐                       │
│  │  FastAPI app     │                    │                       │
│  │  CORSMiddleware  │                    ▼                       │
│  │  (ALLOWED_ORIGINS)│         ┌──────────────────┐               │
│  └────────┬─────────┘         │ api/scheduler.py │               │
│           │                   │  APScheduler     │               │
│           │                   │  async loops     │               │
│           │                   └────────┬─────────┘               │
│           │                            │ invokes                 │
│           │                            ▼                         │
│           │                  ┌───────────────────┐               │
│           │                  │   collectors/     │               │
│           │                  │  price / network  │               │
│           │                  │  chart / feed     │               │
│           │                  │  governance / ... │               │
│           │                  └─────────┬─────────┘               │
│           │                            │ writes                  │
│           │                            ▼                         │
│           │                  ┌───────────────────┐               │
│           │   reads          │   TTLCache        │               │
│           └─────────────────▶│   (thread-safe)   │               │
│                              └───────────────────┘               │
│                                                                  │
│   api/routes/*.py  ── read-from-cache ── JSON / SSE response     │
└──────────────────────────────────────┬───────────────────────────┘
                                       │ HTTPS (CORS-gated)
                           ┌───────────┴───────────┐
                           ▼                       ▼
                   ┌──────────────┐        ┌──────────────┐
                   │  web/        │        │  Telegram /  │
                   │  (Vercel)    │        │  Discord bot │
                   └──────────────┘        └──────────────┘
```

**WHEN** FastAPI boots → lifespan calls `start_scheduler(cache)` → all loops begin populating `TTLCache` → routes serve from cache only.

---

## 2. Module Dependency Map

```
api/main.py
  ├── api/routes/price.py         ─┐
  ├── api/routes/network.py        │
  ├── api/routes/chart.py          │
  ├── api/routes/feed.py           ├─▶ TTLCache (shared singleton)
  ├── api/routes/governance.py     │
  ├── api/routes/analytics.py     ─┘
  └── api/scheduler.py
        ├── collectors/price_collector.py        ─▶ CoinGecko API
        ├── collectors/cantonscan_collector.py   ─┐
        ├── collectors/cantonscan_scraper.py     ─┼▶ CantonScan (API→HTML→Playwright)
        ├── collectors/twitter_collector.py      ─▶ RapidAPI Twitter API45
        ├── collectors/media_collector.py        ─▶ RSS 3종 (Google News / Canton 블로그 / DA 블로그)
        ├── news_summarizer.py                   ─▶ Anthropic Haiku (KO 요약 + 카테고리 분류, 트윗 분류: classify_text)
        ├── collectors/governance_collector.py   ─▶ GitHub CIP repo
        ├── collectors/holders_collector.py      ─▶ CantonScan
        ├── collectors/kr_companies_collector.py ─▶ CantonScan party API
        ├── collectors/dex_oi_collector.py       ─▶ DEX REST
        ├── collectors/realtime_prices.py        ─▶ 10 exchange REST
        └── collectors/coingecko_scraper.py      ─▶ CoinGecko (Playwright)
```

| Rule | Enforcement |
|------|-------------|
| `api/routes/*` MUST NOT call collectors directly | Routes only read `cache.get(key)` |
| `collectors/*` MUST NOT import from `api/` | One-way dependency |
| All HTTP I/O MUST be async (`httpx.AsyncClient`) | No `requests` library |
| Cache writes only from scheduler loops | Routes are read-only |

**파일 캐시 — 피드 전용**:
- `data/tweet_items.json` — 트윗 링버퍼 (최대 200건, url 기준 중복 제거). `collect_feed` 실행 시마다 신규 트윗을 append하고 초과분을 오래된 순으로 삭제. 각 항목은 `news_summarizer.classify_text`(Haiku)로 분류된 `category` 필드 포함. `tweet:items` 캐시(TTL 46800s)의 영속 폴백.
- `data/media_items.json` — 뉴스 링버퍼 (캐패시티 60). 기존 방식 유지.

---

## 3. API Contracts

| Method | Path | Query Params | Cache Key | Response Shape |
|--------|------|--------------|-----------|----------------|
| GET | `/api/price` | — | `price` | `{usd, usd_24h_change, market_cap, total_volume, last_updated}` |
| GET | `/api/sse/price` | — | `price` (polled) | SSE stream `data: {usd, ...}\n\n` every ~30s |
| GET | `/api/network` | — | `network` | `{tps, validators, total_stake, block_height, ...}` |
| GET | `/api/network/status` | — | `network_status` | `{status, latency_ms, uptime_pct, ...}` |
| GET | `/api/chart/{type}` | `period` (1d/7d/30d/90d/1y) | `chart:{type}:{period}` | `{series: [[ts, value], ...]}` |
| GET | `/api/feed` | `lang` (en/ko/ja), `page` (int, default 1) | `feed:{lang}`, `tweet:items`, `media:items` | `{lang, items, ai_summary, fetched_at, page, page_size(=10), total, total_pages}` — `tweet:items`와 `media:items`를 머지해 `ts` 내림차순 정렬 후 10건/page 페이지네이션. 트윗(`kind:"tweet"`)은 `category` 포함(분류: Haiku). 뉴스(`kind:"news"`)는 `title`(lang별)·`category`·`source`(퍼블리셔명) 포함. |
| GET | `/api/governance` | — | `governance` | `{proposals: [{id, title, status, url}, ...]}` |
| GET | `/api/analytics/realtime-prices` | — | `realtime_prices` | `{exchanges: [{name, price, volume_24h, ts}, ...]}` |
| GET | `/api/analytics/exchanges` | — | `exchanges` | `{cex: [...], dex: [...]}` |
| GET | `/api/analytics/reward-split` | `period` | `reward_split:{period}` | `{validators, app_providers, super_validators, ...}` |
| GET | `/api/analytics/amulet-price` | `period` | `amulet_price:{period}` | `{series: [[ts, price], ...]}` |
| GET | `/api/analytics/cumulative` | `period` | `cumulative:{period}` | `{series: [[ts, cumulative], ...]}` |
| GET | `/api/analytics/burn-breakdown` | — | `burn_breakdown` | `{categories: [{name, amount, pct}, ...]}` |
| GET | `/api/analytics/holders` | — | `holders` | `{total, top: [{address, balance, pct}, ...]}` |
| GET | `/api/analytics/kr-companies` | — | `kr_companies` | `{companies: [{name, holdings, source}, ...]}` |
| GET | `/api/health` | — | — | `{status: "ok"}` (Cloudflare Tunnel 헬스체크) |

**WHEN** a route's cache key is missing/expired → return HTTP 503 with `{error: "cache_miss", key: "<key>"}`. Routes do **not** trigger on-demand collection.

---

## 4. Data Flow — `/api/price` Example

```
 Client (web/Vercel or bot)
       │
       │ GET /api/price
       ▼
 FastAPI CORSMiddleware  ──▶ reject if Origin ∉ ALLOWED_ORIGINS
       │
       ▼
 api/routes/price.py::get_price()
       │
       ▼
 cache.get("price")
       │
       ├── HIT  ──▶ return JSONResponse(payload)  ─────────┐
       │                                                   │
       └── MISS ──▶ return 503 {error: "cache_miss"}       │
                                                            │
 Meanwhile, background:                                     │
   scheduler loop collect_price (every 30s)                 │
     └─▶ collectors/price_collector.py::fetch()             │
           └─▶ httpx.get(CoinGecko /simple/price)           │
                 └─▶ cache.set("price", payload, ttl=60) ◀──┘
```

**Guarantees**:
- Route latency p99 < 20ms (pure in-memory cache read).
- Collector failure does not break route — last good value served until TTL expires, then 503.
- SSE endpoint (`/api/sse/price`) wraps the same cache read in an async generator emitting every 30s.

---

## 5. Infrastructure

### Dockerfile (multi-stage)

| Stage | Purpose | Key steps |
|-------|---------|-----------|
| builder | Install Python deps | `pip install -r requirements.txt` |
| runtime | Slim runtime image | `python:3.12-slim` + `fonts-noto-cjk` + `playwright install chromium` |
| CMD | Start server | `uvicorn api.main:app --host 0.0.0.0 --port 8080` |

### fly.toml

| Setting | Value |
|---------|-------|
| `primary_region` | `nrt` (Tokyo) |
| VM size | `shared-cpu-1x`, 512MB |
| Volume | `canton_data` (Playwright cache, SQLite if any) |
| `min_machines_running` | `1` |
| `auto_start_machines` | `true` |
| `force_https` | `true` |
| Health check | `GET /api/health` every 30s |

### Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `ALLOWED_ORIGINS` | CORS allowlist (comma-separated) | `*` (dev only) |
| `RAPIDAPI_KEY` | Twitter API45 auth | — (required for feed) |
| `COINGECKO_API_KEY` | CoinGecko rate limit tier | optional |
| `PORT` | uvicorn bind port | `8080` |

**WHEN** deploying to prod → `ALLOWED_ORIGINS` MUST be set to the Vercel URL. Never ship `*` to prod.

---

## 6. Cache Key Map

| Key | TTL | Producer (scheduler loop) | Interval | Consumers (routes) |
|-----|-----|---------------------------|----------|--------------------|
| `price` | 60s | `collect_price` | 30s | `/api/price`, `/api/sse/price` |
| `network` | 300s | `collect_network` | 300s | `/api/network` |
| `network_status` | 3600s | `collect_network` | 300s | `/api/network/status` |
| `chart:{type}:{period}` | 900s | `collect_charts` | 900s | `/api/chart/{type}` |
| `feed:{lang}` | 900s | `collect_feed` | 900s | `/api/feed` — `{lang, ai_summary, fetched_at}`만 보관 (items 미포함) |
| `tweet:items` | 46800s | `collect_feed` | 900s | `/api/feed` — 링버퍼(최대 200, url 기준 중복 제거), 항목마다 `category` 포함(Haiku 분류) |
| `governance` | 3600s | `collect_governance` | 3600s | `/api/governance` |
| `exchanges` | 900s | `collect_exchanges` | 900s | `/api/analytics/exchanges` |
| `realtime_prices` | 10s | `collect_realtime_prices` | 5s | `/api/analytics/realtime-prices` |
| `reward_split:{period}` | 900s | `collect_charts` | 900s | `/api/analytics/reward-split` |
| `amulet_price:{period}` | 900s | `collect_charts` | 900s | `/api/analytics/amulet-price` |
| `cumulative:{period}` | 900s | `collect_charts` | 900s | `/api/analytics/cumulative` |
| `burn_breakdown` | 900s | `collect_charts` | 900s | `/api/analytics/burn-breakdown` |
| `holders` | 3600s | `collect_holders` | 3600s | `/api/analytics/holders` |
| `homepage` | 86400s | `collect_homepage` | 86400s | (internal / pre-render) |
| `kr_companies` | 1800s | `collect_kr_companies` | 1800s | `/api/analytics/kr-companies` |
| `media:items` | 7200s | `collect_media` | 3600s | `/api/feed` |

**Rule**: Producer interval MUST be ≤ TTL/2 to ensure no serving stale-miss gaps.

---

## 7. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-15 | Initial creation | Generated via `docs-init` skill |
| 2026-05-30 | 피드 v2 반영: `tweet:items` 캐시 키 추가, `feed:{lang}` ai_summary 전용으로 변경, `/api/feed` 페이지네이션·트윗분류 문서화, `data/tweet_items.json` 링버퍼 기록 | feat/feed-v2-categorize-paginate |