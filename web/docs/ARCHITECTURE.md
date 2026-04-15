# ARCHITECTURE — Canton Hub Web

> **Update Triggers**: 새 라우트 추가 / 새 SWR 훅 / 새 타입 export / 백엔드 엔드포인트 변경 / 테마 토큰 추가 / 배포 리전 변경 시 반드시 본 문서 갱신.

**Project**: Canton Hub Web (Next.js frontend)
**Path**: `canton-hub/web`
**Stack**: Next.js 16.2.3 (App Router + Turbopack), React 19, TypeScript strict, Tailwind v4, Tremor React, Recharts, SWR

---

## 1. System Diagram

```
┌──────────────┐      HTTPS       ┌─────────────────────┐
│ User Browser │ ───────────────▶ │   Vercel Edge (ICN) │
│  (Chrome/..) │ ◀─────────────── │   region=icn1       │
└──────┬───────┘                  └──────────┬──────────┘
       │                                     │
       │ (hydrate)                           │ SSR/RSC
       ▼                                     ▼
┌──────────────────────────────────────────────────────┐
│            Next.js 16 App Router (Turbopack)         │
│                                                      │
│  app/layout.tsx  ── pre-hydration theme script       │
│       │                                              │
│       ├── app/page.tsx           (/)                 │
│       ├── app/analytics/page.tsx (/analytics)        │
│       └── app/feed/page.tsx      (/feed)             │
│              │                                       │
│              ▼                                       │
│         components/*  (hero, kpi, charts, feed, ..)  │
│              │                                       │
│              ▼                                       │
│         lib/api.ts  ── SWR hooks (useSWR)            │
│         lib/sse.ts  ── EventSource (SSE)             │
└───────────────┬──────────────────────────────────────┘
                │ fetch(NEXT_PUBLIC_API_URL + /api/*)
                ▼
┌──────────────────────────────────────────────────────┐
│      canton-hub FastAPI backend                      │
│      dev : http://localhost:8000                     │
│      prod: https://canton-api.fly.dev                │
└──────────────────────────────────────────────────────┘
```

### Theme flow (FOUC 방지)

```
<html> load
   │
   ▼
app/layout.tsx <script> (pre-hydration, sync)
   │  reads localStorage["theme"]
   │  adds/removes ".dark" class on <html>
   ▼
app/globals.css
   :root        { --canton-*, --zinc-* (light) }
   .dark        { --canton-*, --zinc-* (dark)  }
   ▼
tailwind.config.ts  colors: { canton: var(--canton-*) }
   ▼
components render with Tailwind classes (bg-canton-*, text-zinc-*)
   ▼
lib/use-theme.ts (client) → toggle .dark + persist localStorage
```

---

## 2. Module Dependency Map

```
app/
 ├─ layout.tsx ───────────────▶ components/nav, components/footer
 ├─ page.tsx ─────────────────▶ components/hero, kpi, charts, governance, network
 ├─ analytics/page.tsx ───────▶ components/analytics, charts
 └─ feed/page.tsx ────────────▶ components/feed, feed-page, governance
                                       │
                                       ▼
                                 lib/api.ts (SWR)
                                 lib/sse.ts (SSE)
                                 lib/use-theme.ts
                                 lib/use-lang.ts
                                 lib/types.ts
                                       │
                                       ▼
                            NEXT_PUBLIC_API_URL (FastAPI)
```

| Layer | Imports From | Exports To |
|-------|--------------|------------|
| `app/*` | `components/*`, `lib/*` | Next.js router |
| `components/*` | `lib/api`, `lib/types`, `lib/use-lang`, Tremor, Recharts | `app/*` |
| `lib/api.ts` | `swr`, `lib/types` | `components/*`, `app/*` |
| `lib/sse.ts` | React, `lib/types` | `components/*` |
| `lib/types.ts` | — | everything |

**Rule**: `lib/*` 는 `components/*` 나 `app/*` 를 import 하지 않는다. 단방향 의존.

---

## 3. Route Map

| Route | File | Hooks Used | Key Components |
|-------|------|------------|----------------|
| `/` | `app/page.tsx` | `usePrice`, `useNetwork`, `useNetworkStatus`, `useChart`, `useGovernance`, `useRealtimePrice` (SSE) | `hero/HeroPrice`, `kpi/KpiGrid`, `charts/ChartTabs`, `network/BurnMint`, `governance/HolderCard`, `governance/GovernanceCard` |
| `/analytics` | `app/analytics/page.tsx` | `useRewardSplit`, `useCumulative`, `useAmuletPrice`, `useBurnBreakdown`, `useExchanges`, `useRealtimePrices`, `useHolders` | `analytics/RewardSplitChart`, `analytics/CumulativeSupply`, `analytics/AmuletPriceChart`, `analytics/ExchangeList`, `analytics/HoldersTable` |
| `/feed` | `app/feed/page.tsx` | `useFeed`, `useGovernance`, `useKrCompanies` | `feed-page/TwitterArchive`, `feed-page/GovernanceCalendar`, `feed-page/EcosystemGuide`, `feed-page/ParticipationGuide`, `feed-page/KoreanCompanies` |

**Shared (all routes)**: `nav/TopNav`, `footer`, theme toggle, language switch.

---

## 4. SWR Hook Map

Source: `lib/api.ts` (REST) + `lib/sse.ts` (streaming).

| Hook | Endpoint | refreshInterval | Response Type |
|------|----------|----------------:|---------------|
| `usePrice()` | `/api/price` | 30s | `PriceData` |
| `useNetwork()` | `/api/network` | 300s | `NetworkData` |
| `useNetworkStatus()` | `/api/network/status` | 3600s | `NetworkStatus` |
| `useChart(type, period)` | `/api/chart/{type}` | 300s | `ChartPoint[]` |
| `useFeed(lang)` | `/api/feed?lang={lang}` | 900s | `FeedData` |
| `useGovernance()` | `/api/governance` | 3600s | `GovernanceData` |
| `useRewardSplit(period)` | `/api/analytics/reward-split` | 900s | `RewardSplitPoint[]` |
| `useAmuletPrice(period)` | `/api/analytics/amulet-price` | 900s | `AmuletPricePoint[]` |
| `useCumulative(period)` | `/api/analytics/cumulative` | 900s | `CumulativePoint[]` |
| `useBurnBreakdown()` | `/api/analytics/burn-breakdown` | 900s | `BurnBreakdown` |
| `useExchanges()` | `/api/analytics/exchanges` | 900s | `ExchangesData` |
| `useRealtimePrices()` | `/api/analytics/realtime-prices` | 5s | `RealtimePrices` |
| `useHolders()` | `/api/analytics/holders` | 3600s | `HoldersData` |
| `useKrCompanies()` | `/api/analytics/kr-companies` | 1800s | `KrCompaniesData` |
| `useRealtimePrice()` (SSE) | `/api/sse/price` | stream | `PriceData` events |

**Base URL**: `process.env.NEXT_PUBLIC_API_URL` (dev `http://localhost:8000`, prod `https://canton-api.fly.dev`).
**Fetcher**: 공통 `fetch` wrapper — non-OK response throw, SWR `onErrorRetry` 기본값 사용.

---

## 5. Type Map

Exported from `lib/types.ts`:

| Type | Consumed by |
|------|-------------|
| `PriceData` | `usePrice`, `useRealtimePrice`, `hero/*`, `kpi/*` |
| `NetworkData` | `useNetwork`, `network/*` |
| `NetworkStatus` | `useNetworkStatus`, `kpi/*` |
| `ChartPoint` | `useChart`, `charts/*` |
| `FeedData` | `useFeed`, `feed-page/TwitterArchive`, `EcosystemGuide`, `ParticipationGuide` |
| `GovernanceData` | `useGovernance`, `governance/*`, `feed-page/GovernanceCalendar` |
| `RewardSplitPoint` | `useRewardSplit`, `analytics/RewardSplitChart` |
| `AmuletPricePoint` | `useAmuletPrice`, `analytics/AmuletPriceChart` |
| `CumulativePoint` | `useCumulative`, `analytics/CumulativeSupply` |
| `BurnBreakdown` | `useBurnBreakdown`, `analytics/*` |
| `ExchangesData` | `useExchanges`, `analytics/ExchangeList` |
| `RealtimePrices` | `useRealtimePrices`, `analytics/*` |
| `HoldersData` | `useHolders`, `analytics/HoldersTable` |
| `KrCompaniesData`, `KrCompany`, `KrWallet` | `useKrCompanies`, `feed-page/KoreanCompanies` |

**Rule**: 모든 API 응답은 반드시 `lib/types.ts` 에서 선언 → `lib/api.ts` 훅 반환 타입에 명시.

---

## 6. Theme System

**Source of truth**: `app/globals.css`.

| Scope | Selector | Token Groups |
|-------|----------|--------------|
| Light mode | `:root` | `--canton-primary`, `--canton-accent`, `--canton-bg`, `--canton-surface`, `--canton-border`, `--zinc-50..900` |
| Dark mode | `.dark` | same keys, dark values |

### Flow

```
tailwind.config.ts
  theme.extend.colors.canton = {
    primary:   "var(--canton-primary)",
    accent:    "var(--canton-accent)",
    bg:        "var(--canton-bg)",
    surface:   "var(--canton-surface)",
    border:    "var(--canton-border)",
  }
```

1. `app/layout.tsx` 에 동기 `<script>` 삽입 → localStorage `theme` 읽고 `<html>.classList` 에 `.dark` 추가/제거 (hydration 이전 실행, FOUC 방지).
2. `lib/use-theme.ts` — React hook, `toggleTheme()` 호출 시 `.dark` 토글 + localStorage 동기화.
3. 컴포넌트는 `bg-canton-surface text-zinc-900 dark:text-zinc-100` 형태로 사용 → CSS 변수가 자동 전환.

**Rule**: 컴포넌트에서 `#hex` 하드코딩 금지. 반드시 `canton-*` / `zinc-*` 토큰 사용.

---

## 7. Data Flow — Example: `/feed` KR Companies

다음은 사용자가 `/feed` 페이지에서 한국 기업 섹션을 볼 때의 전체 요청 사이클이다.

```
[1] User navigates to /feed
        │
        ▼
[2] Next.js renders app/feed/page.tsx (RSC shell)
        │
        ▼
[3] Client hydration → <KoreanCompanies lang={lang}/> mounts
        │
        ▼
[4] useKrCompanies() called inside KoreanCompanies
        │  useSWR(key="/api/analytics/kr-companies",
        │         fetcher, { refreshInterval: 1800_000 })
        ▼
[5] SWR cache check
        ├─ HIT  → return cached KrCompaniesData instantly
        │        (background revalidate if stale)
        └─ MISS → fetch(`${NEXT_PUBLIC_API_URL}/api/analytics/kr-companies`)
                     │
                     ▼
[6]              canton-hub FastAPI backend
                     │  aggregates KR wallet on-chain data
                     ▼
[7]              JSON response: { companies: KrCompany[], updated_at, ... }
                     │
                     ▼
[8] SWR stores in cache, typed as KrCompaniesData
        │
        ▼
[9] KoreanCompanies re-renders
        │  - maps companies → cards
        │  - uses `lang` prop for ko/en/ja/zh labels
        │  - Tremor Card + custom layout
        ▼
[10] User sees rendered list (+ revalidates every 1800s or on focus)
```

**Error path**: fetcher throw → SWR `error` 반환 → 컴포넌트에서 skeleton/empty state 렌더.
**Loading path**: `data === undefined && !error` → Tremor Skeleton 표시.

---

## 8. Infrastructure

| Item | Value |
|------|-------|
| Host | Vercel (framework preset: Next.js) |
| Region | `icn1` (Seoul) — declared in `vercel.json` |
| Build | `next build` (Turbopack) |
| Node | Vercel default (Next 16 요구 사항 따름) |
| Security headers | `vercel.json` → CSP/XFO/Referrer-Policy 등 |
| Image optimization | `next/image` + `next.config.*` `remotePatterns`: `www.google.com/s2/favicons`, `*.coingecko.com` |

### Environment Variables

| Name | Scope | dev | prod |
|------|-------|-----|------|
| `NEXT_PUBLIC_API_URL` | client+server | `http://localhost:8000` | `https://canton-api.fly.dev` |

**Rule**: 공개 키만 `NEXT_PUBLIC_*` 사용. 비공개 토큰은 추가 금지 (현재 없음).

### Deployment pipeline

```
git push → Vercel webhook → install → next build (Turbopack)
       → deploy to icn1 edge → SWR 훅이 NEXT_PUBLIC_API_URL 호출
```

### Verification gates

| Check | Command |
|-------|---------|
| Type safety | `pnpm tsc --noEmit` |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Dev run | `pnpm dev` → http://localhost:3000 |

---

## 9. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성 |
