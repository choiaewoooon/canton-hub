# SYSTEM_OVERVIEW — Canton Hub

> **Purpose**: Institutional memory for Canton Hub backend. Records project history, architecture decisions, known issues, and hard-won lessons.
>
> **Update Trigger**: WHEN a new phase milestone, ADR, incident, or non-obvious lesson occurs → append a row here in the **same commit**.
>
> **Audience**: Future maintainers (human + AI). Read this before ARCHITECTURE.md.

---

## 1. Project Overview

| Field | Value |
|---|---|
| Name | Canton Hub |
| Role | Real-time web backend for Canton Network ($CC) dashboard |
| Target Users | Korean retail crypto investors |
| Sibling Repo | `canton-telegram-bot/` (daily report bot, split 2026-04-15) |
| Legacy Repo | `canton-bot/` (pre-split monorepo, kept as safety net) |
| Backend Stack | FastAPI + Python 3.11, TTLCache (no DB) |
| Frontend Stack | Next.js 14 + Tailwind + Tremor + Recharts (`web/`) |
| Backend Deploy | Fly.io (Tokyo region, single VM) |
| Frontend Deploy | Vercel |
| Data Sources | CoinGecko, CantonScan (unofficial), exchange public APIs, Twitter |
| Persistence | **None** — in-memory TTLCache only (see ADR-001) |

**Scope boundary**: Canton Hub serves the **web dashboard only**. Telegram delivery lives in `canton-telegram-bot/`. The two repos **must not share runtime state or upstream API quota** (see ADR-003).

---

## 2. Phase History

| Date | Phase | Summary |
|---|---|---|
| 2026-03-31 | P0 — Bot seed | Initial telegram bot (`canton-bot/`) created. Daily 9am KST report. |
| 2026-04-XX | P1 — Web dashboard | Web dashboard added to `canton-bot/` as FastAPI + Next.js hybrid. Collectors shared between `bot.py` and `api/scheduler.py`. |
| 2026-04-XX | P1.5 — Incident | **9am KST CoinGecko rate-limit collision**: bot and web scheduler hit shared IP simultaneously. Bot failed with `가격 데이터 수집 실패`. See Lessons Learned L1. |
| 2026-04-XX | P2 — Real-time prices | Added 5-second polling of 10 exchange venues for live price grid. |
| 2026-04-13~14 | P3 — KR companies tracking | Added exchange/company wallet evidence: Upbit (9 wallets, high), Coinone (2 validators, medium), Bithumb (1 DeFi wallet, medium), Marblex (low), Binance Global (5 wallets, high — added after 40+ wallet on-chain topology investigation). |
| 2026-04-14 | P3.1 — Dark/light theme | Added theme toggle via CSS variable swap. **Zero component-level edits** across ~369 color references (see ADR-004). |
| 2026-04-15 | **P4 — Folder split** | `canton-bot/` divided into `canton-hub/` (this repo) + `canton-telegram-bot/`. Eliminates rate-limit coupling and deployment coupling. Legacy kept as safety net. (see ADR-003) |
| 2026-04-15 | P4.1 — Docs init | `docs-init` run. Initial AI Native documentation set generated (this file + ARCHITECTURE, PRD, DATA_GUIDE, DEVELOPMENT_GUIDE). |
| TODO | — | Next phase not yet planned. |

---

## 3. Architecture Decision Records (ADRs)

| ID | Title | Date | Status |
|---|---|---|---|
| ADR-001 | No database, in-memory TTLCache only | 2026-04-XX | Active |
| ADR-002 | Collectors never raise | 2026-04-XX | Active |
| ADR-003 | Folder split from `canton-bot/` | 2026-04-15 | Active |
| ADR-004 | Theme via CSS variable swap | 2026-04-14 | Active |

### ADR-001 — No database, in-memory TTLCache only

| Field | Value |
|---|---|
| **Decision** | Use thread-safe `TTLCache` instead of Postgres / Redis / SQLite. |
| **Before** | (none — greenfield) |
| **After** | `api/cache.py` |
| **Reason** | Single-VM deployment on Fly.io. All data is derived/cacheable from upstream APIs. No user state to persist. |
| **Rule** | **NEVER** introduce a database without first proving it's actually needed (user state? multi-VM? audit trail?). |
| **Impact** | Cold starts return empty responses for ~30s until the scheduler fills cache. Documented in DATA_GUIDE.md. |

### ADR-002 — Collectors never raise

| Field | Value |
|---|---|
| **Decision** | Every collector **catches its own exceptions** and returns an empty dataclass on failure. |
| **Before** | N/A (established with initial collector layer) |
| **After** | All modules in `collectors/` |
| **Reason** | Prevent cascading failures — one broken upstream must not crash the scheduler or take down unrelated endpoints. |
| **Rule** | `raise` inside `collectors/` is an **anti-pattern** → use `logger.warning(...)` + return empty result. |
| **Impact** | Silent failures possible if logs aren't monitored. Mitigation: Fly.io log alerting (TODO). |

### ADR-003 — Folder split from canton-bot/ (2026-04-15)

| Field | Value |
|---|---|
| **Decision** | Separate web dashboard from telegram bot into independent repos. |
| **Before** | Shared `canton-bot/` with collectors used by **both** `bot.py` AND `api/scheduler.py`. |
| **After** | `canton-hub/` (this) + `canton-telegram-bot/` — each has its own collectors copy. |
| **Reason** | Shared collectors caused CoinGecko rate-limit collisions (P1.5 incident) + deployment coupling (can't update bot without restarting web VM). |
| **Rule** | Web and bot **must never** share runtime state or upstream API quota. |
| **Impact** | Code duplication in `collectors/twitter_collector.py`, `cantonscan_collector.py`, `price_collector.py` — **accepted trade-off** for independence. |

### ADR-004 — Theme via CSS variable swap (2026-04-14)

| Field | Value |
|---|---|
| **Decision** | Override Tailwind's `zinc-*` and `canton-*` color tokens via `@theme inline` with CSS vars. Swap values under `.dark` class. |
| **Before** | Every component had hardcoded dark-mode classes like `text-zinc-500`, `bg-canton-bg` — **~369 occurrences** across the `web/` tree. |
| **After** | `web/app/globals.css` defines light `:root` + `.dark` overrides. Components untouched. |
| **Reason** | Manual migration of 369 color references was impractical and error-prone. |
| **Rule** | New components **can still use** `text-zinc-*` and `bg-canton-*` classes — they auto-adapt. No need to rewrite color logic per component. |
| **Impact** | Recharts components with **hardcoded hex** still need manual migration to `var(--*)`. Tracked in Known Issues. |

---

## 4. Known Issues

| ID | Area | Symptom | Workaround / Plan |
|---|---|---|---|
| KI-01 | Frontend / Recharts | Analytics charts have hardcoded hex colors that don't adapt to light mode. | Manual migration to `var(--chart-*)` CSS vars. TODO. |
| KI-02 | Data / CantonScan | CantonScan API is **unofficial** internal endpoint (`fossil-outlook-levitate-gloomy.cantonscan.com`). Could break without notice. | Collector catches errors per ADR-002. Monitor logs. |
| KI-03 | Data / CoinGecko | Free-tier rate limit remains a concern in production even post-split. | Single-process polling + TTLCache. Consider paid tier if 429s recur. |
| KI-04 | Data / Bithumb | Bithumb wallet shows **49 CC** current balance despite **456K CC** lifetime IN — confusing UX. | Data is **correct** — balance moved out. UI should clarify "lifetime IN" vs "current". TODO UX copy fix. |
| KI-05 | Ops | No alerting on silent collector failures (see ADR-002 impact). | TODO: Fly.io log-based alerts for `logger.warning` patterns in `collectors/`. |

---

## 5. Lessons Learned

| ID | Symptom | Root Cause | Fix | Lesson |
|---|---|---|---|---|
| L1 | Bot fails at 9am KST with `가격 데이터 수집 실패`. | Bot scheduler and web scheduler both hit CoinGecko from the **same Fly.io IP** at the same minute → 429. | Split repos so bot and web have independent processes / optionally independent IPs (ADR-003). | **Always test what happens when two services share an upstream.** Shared egress IP = shared quota. |
| L2 | "Upbit listing triggered Binance cold wallet moves" hypothesis fit the timing perfectly. | Narrative-fit bias. Timeline correlation ≠ causation. | On-chain topology investigation (40+ wallets) **disproved** the hypothesis. | **Be skeptical of narrative-fit hypotheses. Verify with data before adding to evidence-based lists.** |
| L3 | Refactor to "shared API layer between bot and web" was getting complex and fragile. | Premature abstraction — the two services have different cadences, different failure modes, different deploy cycles. | Duplicate `collectors/` across `canton-hub/` and `canton-telegram-bot/`. | **Sometimes duplication beats coupling.** Split was easier than shared API. |
| L4 | Adding "Binance" wallets based on a CantonScan label. | CantonScan label `binance` is the **same key as `binance-us`**, which was reused by `iBTC`/`cBTC` as a name squat. "Binance" ≠ "binance-us" in that dataset. | Manual on-chain verification before inclusion. Cross-check with topology + known exchange addresses. | **Always verify identity before adding to evidence-based lists.** Label strings are not identity. |
| L5 | 369 hardcoded color classes blocked dark/light mode feature. | Early components committed to concrete Tailwind color classes instead of semantic tokens. | CSS variable swap under `.dark` class (ADR-004). | **When a cross-cutting refactor is infeasible, move the indirection layer down** (here: into CSS vars) rather than touch every component. |

---

## 6. Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-04-14 | Initial generation | `docs-init` auto-generated from project facts and phase history. Records ADR-001..004, KI-01..05, L1..L5. |
