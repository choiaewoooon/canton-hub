# DESIGN_SYSTEM.md

> **Update triggers**: New canton-* token added, theme strategy change, Tremor/Recharts swap, layout breakpoint change, typography stack change.
> **Scope**: `canton-hub/web/` — Next.js dashboard UI.
> **Source of truth**: `app/globals.css` (`@theme inline`) + `tailwind.config.ts`.

---

## 1. Theme Strategy

WHEN runtime theme toggles → CSS variables swap, Tailwind utility classes remain unchanged.

| Mechanism | Location | Behavior |
|---|---|---|
| `@theme inline` | `app/globals.css` | Declares Tailwind v4 tokens referencing `var(--canton-*)` and `var(--zinc-*)` |
| `:root { ... }` | `app/globals.css` | Light palette values |
| `.dark { ... }` | `app/globals.css` | Dark palette values |
| `darkMode: "class"` | `tailwind.config.ts` | Toggles `.dark` on `<html>` |

**Concrete example** — a component writes `className="bg-canton-card text-zinc-50"`:

```
bg-canton-card → var(--canton-card) → #ffffff (light) | #0f0f12 (dark)
text-zinc-50   → var(--zinc-50)     → near-black (light) | near-white (dark)
```

No component code changes on theme switch. ~369 existing `zinc-*` references migrated via token swap only (zero classname edits).

---

## 2. Color System

### 2.1 Canton Brand Tokens (semantic, theme-aware)

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `canton-lime` | `#7fa01e` | `#c8e64a` | Brand accent, primary CTA |
| `canton-bg` | `#fafafa` | `#09090b` | Page background |
| `canton-card` | `#ffffff` | `#0f0f12` | Card/surface background |
| `canton-border` | `#e4e4e7` | `#1c1c1f` | Card/divider border |
| `canton-up` | `#16a34a` | `#4ade80` | Positive delta, price up |
| `canton-down` | `#dc2626` | `#f87171` | Negative delta, price down |
| `canton-burn` | `#ea580c` | `#fb923c` | Burn events, supply reduction |
| `canton-mint` | `#2563eb` | `#60a5fa` | Mint events, supply issuance |
| `canton-private` | `#7c3aed` | `#a78bfa` | Private TX, institutional flow |
| `canton-accent-bg` | `#f6fae6` | `#151a0a` | Highlighted card gradient end (B/M Ratio) |

### 2.2 Zinc Scale — Inverted in Light Mode

WHEN light mode → `zinc-50` renders near-black for primary text on light surfaces.
WHEN dark mode → `zinc-50` renders near-white as standard.

| Class | Light resolves to | Dark resolves to | Role |
|---|---|---|---|
| `text-zinc-50` | near-black | near-white | Primary text |
| `text-zinc-200` | dark gray | light gray | Secondary text |
| `text-zinc-400` | mid gray | mid gray | Tertiary/meta |
| `text-zinc-500` | `#71717a` | `#71717a` | Neutral middle (identical both modes) |
| `bg-zinc-900` | light elevated | near-black elevated | Hover surface |

**Rationale**: Invert only the endpoints so every existing utility auto-adapts; the neutral middle (`zinc-500`) stays fixed as the contrast anchor.

---

## 3. Typography

**Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
**No custom webfont** — zero FOUT, native OS rendering.

| Pixel size | Usage | Example |
|---|---|---|
| `10px` | Meta labels, uppercase tags | KPI sub-label, nav meta |
| `11px` | Body secondary, captions | Chart legends, footnotes |
| `12px` | Body default | Table cells, paragraph |
| `13px` | Nav items, card titles | Top nav, card header |
| `15–18px` | Stat values | KPI numeric value |
| `22px` | Hero numbers | Section headline stat |
| `32px+` | Hero price | Landing price banner |

Weight: system default 400; titles `font-medium` (500); hero numbers `font-semibold` (600).

---

## 4. Component Patterns

| Pattern | Library | When to use |
|---|---|---|
| KPI card | Tremor `<Card>` + `<Metric>` | Standard numeric KPI with delta |
| Analytics section (reward split, burn breakdown) | Tremor `<DonutChart>`, `<BarList>` | Pre-composed analytic blocks |
| Custom chart (B/M ratio timeline, mint-vs-burn) | Recharts | When layout/interaction needs control beyond Tremor |
| Gradient highlight card | `bg-gradient-to-br from-canton-card to-canton-accent-bg` | Featured KPI (e.g., B/M Ratio) |

WHEN chart needs custom tooltip or axis formatter → Recharts (`bm-section.tsx`, `chart-card.tsx`).
WHEN chart is standard analytic block → Tremor.

Rounded corners: cards `rounded-[10px]`, buttons `rounded-md`.
Borders: `border border-canton-border` on all card surfaces.

---

## 5. Layout Rules

### 5.1 Container

```
max-w-[1200px] mx-auto px-6 py-8
```

Sticky `<nav>` top, static `<footer>` bottom.

### 5.2 Grid Patterns

| Pattern | Tailwind | Contents |
|---|---|---|
| KPI row | `grid grid-cols-4 gap-4` | 4 KPI cards |
| B/M + mint-vs-burn | `grid grid-cols-[2fr_1fr] gap-4` | Chart + sidebar |
| Twitter + governance | `grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4` | Stacked on mobile |

### 5.3 Spacing

Tailwind defaults; prefer `gap-4` (16px) between cards, `p-6` (24px) inside cards, `py-8` (32px) for section vertical rhythm.

### 5.4 Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| mobile (default) | <1024px | Single column |
| `lg` | ≥1024px | Multi-column grids activate |
| `sm`/`md`/`xl` | Tailwind defaults | Rare overrides only |

---

## 6. Icon System

**Convention**: Emoji-first. No SVG icon library imported for domain markers.

| Emoji | Meaning |
|---|---|
| 🥶 | Cold wallet |
| ⚡ | Validator |
| 🏦 | Operational entity |
| 🧪 | Test environment |
| 🏢 | Subsidiary |
| 🔥 | Burn event |
| 🇰🇷 | KR (Korea) jurisdiction |
| 🌍 | Global / multi-region |

WHEN adding new actor category → pick emoji that renders identically on macOS + Windows; document here.

---

## 7. Accessibility

**Goal**: WCAG 2.1 AA.

| Requirement | Implementation |
|---|---|
| Contrast ratio ≥4.5:1 (body) | Verified via theme variable choices in both palettes |
| Keyboard navigation | All interactive elements reachable via Tab; native `<button>`/`<a>`/`<select>` |
| Screen reader labels | ARIA labels on theme toggle, language switcher |
| Focus visible | Native focus ring retained (no `outline: none` overrides) |
| Reduced motion | Transitions limited to 150ms default; no parallax |

**Interactive surfaces**: hover `hover:text-zinc-200 hover:bg-zinc-900`, transition `transition` (150ms). Theme toggle and language `<select>` in navbar.

**Verification**:
```bash
# Manual: run axe DevTools on / and key routes
# Contrast: check canton-up/down against canton-card in both modes
```

---

## 8. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성 |
