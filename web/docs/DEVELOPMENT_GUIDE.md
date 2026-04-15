# DEVELOPMENT_GUIDE.md

> **Update triggers**: New bug pattern discovered → add to §5. New utility added to `lib/format.ts` → update §3. Test tooling changes → update §4. Standard template changes → update §2.

---

## 0. CRITICAL WARNING — Next.js 16

> **STOP. READ THIS FIRST.**
>
> This project runs **Next.js 16 App Router**. This is **NOT** the Next.js you learned from training data.
>
> - APIs, conventions, and file structure may differ from Next.js 13/14/15.
> - `AGENTS.md` at the repo root explicitly mandates: **"Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."**
> - When in doubt: read the doc, or ask the user. Do NOT guess based on prior Next.js knowledge.

| WHEN | DO |
|------|----|
| About to use a Next.js API (routing, metadata, image, etc.) | Read `node_modules/next/dist/docs/<relevant>.md` first |
| Unsure if an API exists in v16 | Ask user, do not assume |
| Migrating patterns from older Next.js | Verify each API against v16 docs |

---

## 1. Pre-Work Checklist

Run through this **every** task before writing code.

| # | Check | Command / Action |
|---|-------|------------------|
| 1 | Correct project path? | `pwd` → expect `canton-hub/web` |
| 2 | `AGENTS.md` reviewed for Next.js 16 quirks? | Read repo-root `AGENTS.md` |
| 3 | Backend response shape matches `lib/types.ts`? | Check FastAPI route vs. TS interface |
| 4 | Batch size ≤5 files? | Split large refactors into chunks |
| 5 | Tremor component needed? | Prefer Tremor; override palette to canton |
| 6 | Client or Server component? | `useState`/`useEffect`/hooks → `"use client"` |
| 7 | Recharts involved? | Avoid hex literals; use CSS vars |

**STOP conditions** — do not proceed if:
- You cannot locate `AGENTS.md`.
- Backend shape differs from `lib/types.ts` (fix types first).
- You are about to write >5 files in one batch (split the work).

---

## 2. Standard Templates

### 2.1 Component template

Every new client component follows this shape. Copy, then adapt.

```tsx
"use client";

import type { PriceData } from "@/lib/types";
import { usePrice } from "@/lib/api";
import { fmtUsd } from "@/lib/format";

interface Props {
  lang: string;
}

export default function PriceCard({ lang }: Props) {
  const { data, error } = usePrice();

  if (error) return <div className="text-canton-down">Error loading price</div>;
  if (!data) return <div className="text-zinc-500">Loading...</div>;

  const label = lang === "ko" ? "현재 가격" : "Current Price";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-[22px] font-bold text-zinc-50 mt-1">
        {fmtUsd(data.current_price_usd)}
      </div>
    </div>
  );
}
```

**Rules:**
- `"use client"` at top if the component uses hooks/state/effects.
- Types from `@/lib/types`, hooks from `@/lib/api`, formatters from `@/lib/format`.
- Always handle `error` and `!data` states explicitly.
- Use canton palette tokens (`bg-canton-card`, `text-canton-down`), not hardcoded hex.

### 2.2 SWR hook template

All data fetching goes through `lib/api.ts` as SWR hooks.

```ts
export function usePrice() {
  return useSWR<PriceData>(`${API}/api/price`, fetcher, { refreshInterval: 30_000 });
}
```

**Rules:**
- One hook per endpoint. Name: `use<Resource>`.
- Typed via generic: `useSWR<Shape>`.
- Include `refreshInterval` if the data is live.
- **SWR key must be unique per query params** (see §5 bug #6).

### 2.3 Parameterized SWR hook

```ts
export function useChart(metric: string, range: string) {
  return useSWR<ChartData>(
    `${API}/api/chart/${metric}?range=${range}`,
    fetcher,
    { refreshInterval: 60_000 }
  );
}
```

The URL itself encodes the params, so SWR cache keys naturally diverge.

---

## 3. Utility Reference

### 3.1 `lib/format.ts`

| Function | Input | Output | Example |
|----------|-------|--------|---------|
| `fmtCc(n)` | Canton Coin amount | K/M/B suffix string | `1500000 → "1.5M"` |
| `fmtUsd(n)` | USD price | `$X.XX` or `"N/A"` | `1.2345 → "$1.23"` |
| `fmtLargeUsd(n)` | Large USD (market cap) | `$X.XK/M/B` | `1_200_000 → "$1.2M"` |
| `fmtPct(n)` | Percentage | Signed `+X.XX%` | `0.0523 → "+5.23%"` |
| `fmtNum(n)` | Integer | Comma-separated | `1234567 → "1,234,567"` |

**Rule**: never inline number formatting in components. Add new variants here.

### 3.2 `lib/use-theme.ts`

Returns current theme (`"dark" | "light"`) and setter. Reads/writes `localStorage`.

| WHEN | DO |
|------|----|
| Component needs to branch on theme | `const { theme } = useTheme()` |
| User toggles theme | `setTheme(theme === "dark" ? "light" : "dark")` |
| Need to style by theme | Prefer CSS vars + `.dark` class over JS branching |

### 3.3 `lib/use-lang.ts`

Returns current language (`"ko" | "en" | "ja" | "zh"`) from route or context.

```tsx
const lang = useLang();
const label = lang === "ko" ? "가격" : "Price";
```

**Rule**: all 4 languages must be handled. Missing language = runtime string `undefined`.

---

## 4. Testing Standards

### 4.1 No Jest, no Vitest — yet

This project has **no automated test suite**. Do not add Jest/Vitest without explicit user approval. Until then, the verification gates are:

| Gate | Command | Must pass? |
|------|---------|------------|
| Type check | `npx tsc --noEmit` | Yes |
| Production build | `npm run build` | Yes |
| Manual smoke | See §4.2 | Yes for UI changes |

### 4.2 Manual smoke test checklist

Before declaring any UI change "done":

- [ ] Toggle dark ↔ light at least once
- [ ] Visit all 4 languages: `/ko`, `/en`, `/ja`, `/zh`
- [ ] Load all 3 pages (home, `/feed`, third page)
- [ ] On `/feed`, expand + collapse at least one KR company row
- [ ] No red errors in browser console
- [ ] No Recharts `width(-1)/height(-1)` warnings

### 4.3 Completion definition

A task is complete when **all three** gates pass:

```bash
npx tsc --noEmit && npm run build
```

…plus the §4.2 manual smoke for UI work.

---

## 5. Bug Pattern Catalog

Every pattern below is from a real incident. Search queries are ripgrep-ready.

### 5.1 Hardcoded hex in Recharts

**Symptom**: chart strokes/fills do not change with dark/light theme.

**Search**: `stroke="#[0-9a-fA-F]` and `fill: ?"#[0-9a-fA-F]`

```tsx
// WRONG
<Line stroke="#c8e64a" />

// RIGHT
<Line stroke="var(--canton-lime)" />
```

### 5.2 Flash of wrong theme (FOUC)

**Symptom**: page flashes light theme then snaps to dark on load.

**Fix**: the blocking script in `app/layout.tsx` `<head>` reads `localStorage` before hydration and applies `.dark`. **Do not remove this script.**

```tsx
// WRONG — removing or deferring the inline script
<head>{/* no blocking theme init */}</head>

// RIGHT — keep the inline script as the first <head> child
<head>
  <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
</head>
```

### 5.3 Empty Recharts container warning

**Symptom**: console warning `The width(-1) and height(-1) of chart should be greater than 0`.

**Cause**: `ResponsiveContainer` mounts inside a zero-sized parent.

```tsx
// WRONG
<div>
  <ResponsiveContainer><LineChart data={data}>...</LineChart></ResponsiveContainer>
</div>

// RIGHT — fixed height on the parent
<div className="h-[240px]">
  <ResponsiveContainer minWidth={0} minHeight={0}>
    <LineChart data={data}>...</LineChart>
  </ResponsiveContainer>
</div>
```

### 5.4 `next/image` external domain error

**Symptom**: `Invalid src prop ... hostname "..." is not configured`.

**Fix**: add the host to `next.config.ts` `images.remotePatterns` **before** using the image.

```ts
// next.config.ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "assets.example.com" },
  ],
}
```

### 5.5 Tremor theme mismatch

**Symptom**: Tremor component renders with default blue/indigo, not canton palette.

**Fix**: override Tremor classes with canton tokens, or wrap in a styled container.

```tsx
// WRONG — accepting Tremor defaults
<Card>...</Card>

// RIGHT — canton-styled container, Tremor for structure
<Card className="bg-canton-card border-canton-border">
  ...
</Card>
```

### 5.6 SWR key collision

**Symptom**: switching between `24h` and `7d` returns stale/wrong data.

**Cause**: both calls produced the same SWR cache key.

**Search**: `useSWR\(` — inspect each key for uniqueness.

```ts
// WRONG — key is constant
useSWR<ChartData>(`${API}/api/chart/price`, fetcher)

// RIGHT — params encoded into URL
useSWR<ChartData>(`${API}/api/chart/price?range=${range}`, fetcher)
```

### 5.7 Missing `"use client"` directive

**Symptom**: hydration error or `useState is not a function` at build time.

**Search**: files using `useState|useEffect|useRef|useSWR` without `"use client"` header.

```tsx
// WRONG — hook in a server component
import { useState } from "react";
export default function Foo() { const [n, setN] = useState(0); ... }

// RIGHT
"use client";
import { useState } from "react";
export default function Foo() { const [n, setN] = useState(0); ... }
```

---

## 6. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성 |
