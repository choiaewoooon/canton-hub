# 펀비 양빵 Net APR (체결 스프레드 차감) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 펀비 양빵 매트릭스가 gross 펀딩 APR이 아니라 체결 스프레드를 차감한 **net APR**로 페어를 추천·정렬하고, 손익분기일을 표시하게 한다.

**Architecture:** 백엔드는 이미 수집 중인 거래소별 bid-ask `spread_pct`(coingecko)를 `_DEPTH_SOURCE_MAP`으로 funding rate row에 join한다. 프론트는 순수함수로 net APR / 손익분기일을 계산하고, perp-perp 페어를 net 최대 기준으로 고른다. 신규 수집기·외부호출 없음.

**Tech Stack:** FastAPI(백엔드), pytest, Next.js 16 + TypeScript + Tailwind v4 + SWR(프론트). 프론트 테스트 러너는 미설치 — 프로젝트 관행(`tsc` + `build` + 브라우저 smoke)으로 검증.

**관련 설계:** [2026-06-03-funding-net-apr-design.md](./2026-06-03-funding-net-apr-design.md)

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `api/routes/analytics.py` | funding-rates 라우트에 spread_pct join | Modify |
| `tests/api/test_funding_rates.py` | spread join 단위테스트 | Modify |
| `web/lib/types.ts` | `FundingRate.spread_pct?` 타입 | Modify |
| `web/components/analytics/funding-net.ts` | net APR / 손익분기 순수함수 + 상수 | **Create** |
| `web/components/analytics/funding-rate-matrix.i18n.ts` | i18n 키 추가 | Modify |
| `web/components/analytics/funding-rate-matrix.tsx` | computePairs net 선택 + 테이블 스프레드 칼럼 + 카드 net 표시 | Modify |
| `~/Documents/Obsidian Vault/Brain/notes/adr-0003-*.md` | 결정 기록(ADR) | Create |

---

## Task 1: 백엔드 — funding rate에 spread_pct join

**Files:**
- Modify: `api/routes/analytics.py` (funding_rates 라우트 + 헬퍼 추가, line 93-98 영역)
- Test: `tests/api/test_funding_rates.py` (파일 끝에 추가)

- [ ] **Step 1: 실패 테스트 작성** — `tests/api/test_funding_rates.py` 끝에 추가

```python
@pytest.mark.asyncio
async def test_funding_rates_route_joins_spread_from_exchanges():
    cache = TTLCache()
    cache.set("analytics:funding-rates", {
        "rates": [
            {"source": "Binance Perp", "fr_apr": 30.0},
            {"source": "Hyperliquid", "fr_apr": 12.0},
        ],
        "updated_at": "2026-06-03T10:00:00",
    }, ttl=90)
    cache.set("analytics:exchanges", {
        "spot": [],
        "derivatives": [
            {"exchange": "Binance (Futures)", "spread_pct": 0.08},
            {"exchange": "Hyperliquid (Futures)", "spread_pct": 0.15},
        ],
    }, ttl=90)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/analytics/funding-rates")
    body = resp.json()
    app.dependency_overrides.clear()
    rates = {r["source"]: r for r in body["rates"]}
    assert rates["Binance Perp"]["spread_pct"] == pytest.approx(0.08)
    assert rates["Hyperliquid"]["spread_pct"] == pytest.approx(0.15)


@pytest.mark.asyncio
async def test_funding_rates_route_spread_none_when_exchange_missing():
    cache = TTLCache()
    cache.set("analytics:funding-rates", {
        "rates": [{"source": "Lighter", "fr_apr": 28.0}],
        "updated_at": "2026-06-03T10:00:00",
    }, ttl=90)
    cache.set("analytics:exchanges", {"spot": [], "derivatives": []}, ttl=90)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/analytics/funding-rates")
    body = resp.json()
    app.dependency_overrides.clear()
    assert body["rates"][0]["spread_pct"] is None
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source .venv/bin/activate && pytest tests/api/test_funding_rates.py -k spread -v`
Expected: FAIL — `KeyError: 'spread_pct'` (라우트가 아직 join 안 함)

- [ ] **Step 3: 헬퍼 + 라우트 구현** — `api/routes/analytics.py`

기존 라우트(93-98)를 아래로 교체:

```python
_EMPTY_FUNDING = {"rates": [], "updated_at": None}


def _enrich_funding_with_spread(funding_data: dict, exchanges_data: dict | None) -> dict:
    """각 funding rate row에 거래소 bid-ask spread_pct를 join (없으면 None).
    _DEPTH_SOURCE_MAP을 재사용 — funding source는 모두 perpetual."""
    if not exchanges_data:
        return funding_data
    lookups: dict[tuple[str, str], dict] = {}
    for bucket in ("spot", "derivatives"):
        for entry in exchanges_data.get(bucket, []):
            key = (entry.get("exchange"), bucket)
            if key not in lookups:
                lookups[key] = entry
    enriched = []
    for r in funding_data.get("rates", []):
        mapping = _DEPTH_SOURCE_MAP.get((r.get("source", ""), "perpetual"))
        spread = None
        if mapping:
            entry = lookups.get(mapping)
            if entry is not None:
                spread = entry.get("spread_pct")
        enriched.append({**r, "spread_pct": spread})
    return {**funding_data, "rates": enriched}


@router.get("/funding-rates")
async def funding_rates(cache: TTLCache = Depends(get_cache)):
    data = cache.get("analytics:funding-rates") or _EMPTY_FUNDING
    exchanges = cache.get("analytics:exchanges")
    return _enrich_funding_with_spread(data, exchanges)
```

> 주의: `_enrich_funding_with_spread`/라우트는 `_DEPTH_SOURCE_MAP` 정의(현재 121-135) **뒤**에 와야 한다. 헬퍼를 `_DEPTH_SOURCE_MAP` 아래, 기존 `_enrich_with_depth` 근처로 옮기고 라우트는 그대로 둬도 됨. import는 추가 불필요(기존 `Depends`, `TTLCache`, `get_cache` 사용).

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pytest tests/api/test_funding_rates.py -v`
Expected: PASS (신규 2개 + 기존 전부). 특히 `test_funding_rates_route_empty_cache`가 여전히 `{"rates": [], "updated_at": None}` 반환(exchanges 없으면 unchanged).

- [ ] **Step 5: 커밋**

```bash
git add api/routes/analytics.py tests/api/test_funding_rates.py
git commit -m "feat: funding-rates 응답에 거래소 bid-ask spread_pct join"
```

---

## Task 2: 프론트 타입 — FundingRate.spread_pct

**Files:**
- Modify: `web/lib/types.ts` (FundingRate 인터페이스, line ~156 이후)

- [ ] **Step 1: 타입 필드 추가** — `FundingRate` 인터페이스에 추가

`fr_apr: number;` 등 기존 필드 뒤, 인터페이스 닫기 전에:

```typescript
  spread_pct?: number | null;  // 거래소 bid-ask 스프레드 % (백엔드 join, 없으면 null)
```

- [ ] **Step 2: 타입 체크**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add web/lib/types.ts
git commit -m "feat(types): FundingRate에 spread_pct 추가"
```

---

## Task 3: 프론트 순수함수 — net APR / 손익분기일

**Files:**
- Create: `web/components/analytics/funding-net.ts`

- [ ] **Step 1: 순수함수 모듈 작성** — `web/components/analytics/funding-net.ts`

```typescript
// web/components/analytics/funding-net.ts
// 펀비 양빵 net APR 계산 — 체결 스프레드(bid-ask) 차감.
// 비용 모델: 왕복 = 양다리 스프레드 합. 보유기간으로 연환산.

/** 일회성 비용을 APR로 환산할 때의 기본 보유기간(일). 튜닝 가능 상수. */
export const HOLD_DAYS_DEFAULT = 7;

/**
 * 왕복 체결비용%. 양다리 스프레드 합(개시+청산 ≈ 다리당 풀스프레드).
 * 한쪽이라도 스프레드 데이터가 없으면 null.
 */
export function roundTripCost(
  spreadShort: number | null | undefined,
  spreadLong: number | null | undefined,
): number | null {
  if (spreadShort == null || spreadLong == null) return null;
  return Math.max(0, spreadShort) + Math.max(0, spreadLong);
}

/** net APR = gross − cost × (365 / H). cost가 null이면 null. */
export function netApr(
  grossApr: number,
  cost: number | null,
  holdDays: number = HOLD_DAYS_DEFAULT,
): number | null {
  if (cost == null) return null;
  return grossApr - cost * (365 / holdDays);
}

/**
 * 손익분기 보유일 = cost / gross × 365.
 * gross ≤ 0 (펀딩으로 회수 불가) 또는 cost null이면 null.
 */
export function breakevenDays(grossApr: number, cost: number | null): number | null {
  if (cost == null || grossApr <= 0) return null;
  return (cost / grossApr) * 365;
}
```

- [ ] **Step 2: 타입 체크 + 수계산 검증**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0

검증 시나리오(구현자가 머리/브라우저로 확인할 기준값):
- `roundTripCost(0.4, 0.6)` → `1.0`
- `netApr(100, 1.0, 7)` → `100 − 1.0×(365/7)` = `100 − 52.14` ≈ **47.86**
- `breakevenDays(100, 1.0)` → `1.0/100×365` = **3.65**일
- `netApr(100, null)` → `null`; `breakevenDays(-5, 1.0)` → `null`

- [ ] **Step 3: 커밋**

```bash
git add web/components/analytics/funding-net.ts
git commit -m "feat: net APR / 손익분기일 순수함수 추가"
```

---

## Task 4: 프론트 i18n 키 추가

**Files:**
- Modify: `web/components/analytics/funding-rate-matrix.i18n.ts` (TEXTS 객체, line 22-23 `noArbitrage` 뒤)

- [ ] **Step 1: 키 추가** — `noArbitrage` 항목 뒤(닫는 `} as const;` 앞)에 삽입

```typescript
  colSpread:         { ko: "스프레드",                      en: "Spread" },
  netAprLabel:       { ko: "Net APR",                       en: "Net APR" },
  roundTripCost:     { ko: "왕복비용",                      en: "Round-trip cost" },
  breakeven:         { ko: "손익분기",                      en: "Break-even" },
  daysUnit:          { ko: "일",                            en: "d" },
  netNa:             { ko: "스프레드 없음",                 en: "No spread data" },
  holdNote:          { ko: "기본 7일 보유 가정",            en: "Assumes 7-day hold" },
```

- [ ] **Step 2: 타입 체크**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (TextKey 유니온이 자동 확장됨)

- [ ] **Step 3: 커밋**

```bash
git add web/components/analytics/funding-rate-matrix.i18n.ts
git commit -m "feat(i18n): net APR/스프레드/손익분기 키 추가"
```

---

## Task 5: 컴포넌트 — net 페어 선택 + 테이블 스프레드 칼럼 + 카드

**Files:**
- Modify: `web/components/analytics/funding-rate-matrix.tsx`

### 5a. computePairs — perp-perp를 net 최대로 선택

- [ ] **Step 1: import + PerpPairResult 확장**

상단 import에 추가:

```typescript
import { roundTripCost, netApr, breakevenDays, HOLD_DAYS_DEFAULT } from "./funding-net";
```

`PerpPairResult` 인터페이스(21-27)를 교체:

```typescript
interface PerpPairResult {
  short: FundingRate;
  long: FundingRate;
  apr: number;              // gross APR (short.fr_apr - long.fr_apr)
  entry_spread_pct: number; // 거래소 간 perp 가격 괴리 (참고용 유지)
  liquidity_min_usd: number;
  round_trip_cost: number | null; // 왕복 체결비용% (양다리 스프레드 합)
  net_apr: number | null;         // net APR (기본 7일)
  breakeven_days: number | null;  // 손익분기 보유일
}
```

- [ ] **Step 2: computePairs의 perp-perp 블록 교체**

`computePairs`(100-141) 내 perp-perp 블록(104-115)을 아래로 교체. spot-perp 블록(117-138)과 `return`(140)은 그대로 둔다.

```typescript
  // Perp-Perp: net APR 최대 페어 선택.
  // 후보 = short.fr_apr > long.fr_apr (gross>0) 인 모든 순서쌍.
  // 스프레드 양쪽 다 있는 후보 중 net 최대를 고른다.
  // 스프레드 데이터가 전혀 없으면 gross 최대(최고FR 숏 × 최저FR 롱)로 폴백.
  let perpPair: PerpPairResult | null = null;
  if (sorted.length >= 2) {
    const build = (short: FundingRate, long: FundingRate): PerpPairResult => {
      const gross = short.fr_apr - long.fr_apr;
      const cost = roundTripCost(short.spread_pct, long.spread_pct);
      return {
        short,
        long,
        apr: gross,
        entry_spread_pct: priceSpread(prices, short.source, long.source),
        liquidity_min_usd: minDepth(prices, short.source, long.source),
        round_trip_cost: cost,
        net_apr: netApr(gross, cost),
        breakeven_days: breakevenDays(gross, cost),
      };
    };

    const candidates: PerpPairResult[] = [];
    for (const short of sorted) {
      for (const long of sorted) {
        if (short.source === long.source) continue;
        if (short.fr_apr - long.fr_apr <= 0) continue;
        candidates.push(build(short, long));
      }
    }
    const withNet = candidates.filter((c) => c.net_apr != null);
    if (withNet.length > 0) {
      perpPair = withNet.reduce((a, b) => (b.net_apr! > a.net_apr! ? b : a));
    } else {
      // 스프레드 데이터 없음 → gross 최대로 폴백 (기존 동작)
      perpPair = build(sorted[0], sorted[sorted.length - 1]);
    }
  }
```

- [ ] **Step 3: 타입 체크**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0. (SpotPerpPairResult는 미변경이라 영향 없음. RecommendationCards가 아직 새 필드를 안 써도 OK.)

- [ ] **Step 4: 커밋**

```bash
git add web/components/analytics/funding-rate-matrix.tsx
git commit -m "feat: perp-perp 페어를 net APR 최대 기준으로 선택"
```

### 5b. 추천 카드 — net APR / 왕복비용 / 손익분기 표시

- [ ] **Step 5: perp-perp 카드의 entry_spread 영역 교체**

`RecommendationCards`의 perp-perp 카드(227-259) 안에서, 큰 APR 숫자 블록(230-233)을 net 우선 표시로 바꾸고, entry spread 줄(243-246)을 net/왕복비용/손익분기로 교체.

큰 숫자 블록(230-233) 교체:

```tsx
          <div className={`text-[28px] font-bold tabular-nums ${valClass(perpPair.net_apr ?? perpPair.apr)} leading-none mb-1`}>
            {arrow(perpPair.net_apr ?? perpPair.apr)} {Math.abs(perpPair.net_apr ?? perpPair.apr).toFixed(1)}%
            <span className="text-[12px] font-medium text-zinc-500 ml-1.5">
              {perpPair.net_apr != null ? t("netAprLabel") : "APR"}
            </span>
          </div>
          <div className="text-[11px] text-zinc-600 mb-3">
            {perpPair.net_apr != null
              ? `${t("colApr")} ${perpPair.apr.toFixed(1)}% · ${t("holdNote")}`
              : t("netNa")}
          </div>
```

entry spread 줄(243-246) 교체:

```tsx
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("roundTripCost")}</span>
              <span className="tabular-nums text-zinc-300">
                {perpPair.round_trip_cost != null ? `${perpPair.round_trip_cost.toFixed(3)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("breakeven")}</span>
              <span className="tabular-nums text-zinc-300">
                {perpPair.breakeven_days != null
                  ? `${perpPair.breakeven_days.toFixed(1)}${t("daysUnit")}`
                  : "—"}
              </span>
            </div>
```

- [ ] **Step 6: 타입 체크 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: 둘 다 exit 0, `/analytics` 페이지 ✓

- [ ] **Step 7: 커밋**

```bash
git add web/components/analytics/funding-rate-matrix.tsx
git commit -m "feat: 추천 카드에 net APR/왕복비용/손익분기 표시"
```

### 5c. 펀딩 테이블 — 스프레드 칼럼 추가

- [ ] **Step 8: FundingRateTable에 스프레드 칼럼 추가**

`FundingRateTable`(301-390)에서:

헤더 grid(318)의 `grid-cols-[1fr_auto_auto_auto_auto]`를 `grid-cols-[1fr_auto_auto_auto_auto_auto]`로 바꾸고, `colApr` 헤더(321) 뒤에 스프레드 헤더 추가:

```tsx
        <span className="text-[11px] text-zinc-500 text-right">{t("colSpread")}</span>
```

데이터 row grid(339)도 동일하게 `grid-cols-[1fr_auto_auto_auto_auto_auto]`로 바꾸고, APR 셀(357-362) 뒤에 스프레드 셀 추가:

```tsx
            {/* Spread */}
            <div className="text-right">
              <span className="text-[12px] tabular-nums font-mono text-zinc-400">
                {r.spread_pct != null ? `${r.spread_pct.toFixed(3)}%` : "—"}
              </span>
            </div>
```

> 모바일 폭 주의: `min-w-[440px]`(316)을 `min-w-[520px]`로 늘려 칼럼 6개가 안 깨지게 한다.

- [ ] **Step 9: 타입 체크 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: 둘 다 exit 0

- [ ] **Step 10: 커밋**

```bash
git add web/components/analytics/funding-rate-matrix.tsx
git commit -m "feat: 펀딩 테이블에 거래소별 스프레드 칼럼 추가"
```

---

## Task 6: 결정 기록 (ADR)

**Files:**
- Create: `~/Documents/Obsidian Vault/Brain/notes/adr-0003-funding-net-apr-cost-model.md`
- Modify: `~/Documents/Obsidian Vault/Brain/index.md` (## ADR 섹션)

- [ ] **Step 1: ADR 작성** — 되돌리기 어려운 결정(net APR 비용모델=스프레드만, H=7, 손익분기 중심) 기록

```markdown
---
title: 펀비 양빵 net APR — 비용은 스프레드만, 보유 7일, 손익분기 중심
date: 2026-06-03
status: Accepted
tags: [adr, decision, canton-hub, funding, arbitrage]
---

## Status
Accepted

## Context
양빵 매트릭스가 gross 펀딩 APR로 정렬해 체결비용을 무시 → "이론상 30%가 실제 5%"
함정. X 사용자가 페어별 체결 스프레드 칼럼을 요청. net APR을 보여주려면 비용 모델과
보유기간 가정이 필요한데, 수수료는 거래소·등급별로 달라 misleading 위험(기존 설계가 보류한 이유).

## Decision
- 비용 = bid-ask **스프레드만**(coingecko 기수집). 수수료·슬리피지 제외.
- 왕복비용 = 양다리 스프레드 합. net APR = gross − cost×(365/H), 기본 H=7일(상수).
- 손익분기일(= cost/gross×365)을 가정 불필요한 헤드라인 지표로 병기.
- 페어 추천을 gross 최대 → **net 최대**로 변경. perp-perp만 적용(spot-perp는 현물 스프레드 부재로 보류).

## Consequences
- (+) 객관적·증명가능 데이터만 사용, misleading 최소.
- (+) 순위가 현실 수익을 반영.
- (−) 수수료 제외라 실제 net은 표시보다 약간 낮음(보수적 아님 — 주의 문구 필요).
- (−) H=7 가정에 net 민감 → 손익분기일로 보완.

관련: [[note-canton-hub-live]], 설계 docs/plans/2026-06-03-funding-net-apr-design.md
```

- [ ] **Step 2: index.md ## ADR 섹션에 등록**

```markdown
- [[adr-0003-funding-net-apr-cost-model]] — 펀비 양빵 net APR: 비용은 스프레드만·보유 7일·손익분기 중심, 페어는 net 최대 (Accepted, 2026-06-03)
```

- [ ] **Step 3: Brain 커밋**

```bash
git -C "/Users/choejaewon/Documents/Obsidian Vault/Brain" add -A && \
git -C "/Users/choejaewon/Documents/Obsidian Vault/Brain" commit -m "adr-0003 펀비 양빵 net APR 결정"
```

---

## Task 7: 검증 게이트 (canton-hub §5 증거 기반)

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && source .venv/bin/activate && pytest tests/ -q`
Expected: 전부 PASS

- [ ] **Step 2: 스프레드 커버리지 실측** — 7개 펀딩 거래소 중 실제 몇 개에 spread_pct가 붙는지 확인

Run (백엔드 가동 상태에서):
```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
sleep 40
curl -s http://localhost:8000/api/analytics/funding-rates | python3 -m json.tool | grep -A1 '"source"\|spread_pct'
```
Expected: 각 rate에 `spread_pct` 키 존재. DEX(Lighter/Extended/Aster)는 `null`일 수 있음 → 정상(net 제외). null 개수 기록.
- [ ] **판단:** perp-perp 후보 중 스프레드 양쪽 다 있는 페어가 0이면(예: CEX가 1개뿐) net이 항상 폴백됨 → 카드 문구가 `netNa`로 뜨는지 확인. 커버리지가 너무 낮으면 사용자에게 보고.

- [ ] **Step 3: 프론트 타입 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: 둘 다 exit 0

- [ ] **Step 4: 브라우저 smoke** — `/analytics`에서 확인
  - 펀딩 테이블에 스프레드 칼럼 표시(값 또는 "—")
  - perp-perp 추천 카드에 net APR + 왕복비용 + 손익분기 표시
  - 한국어/영어 토글 시 라벨 정상(ja/zh는 영어 fallback OK)
  - 다크/라이트 양쪽 레이아웃 안 깨짐, 모바일 폭에서 테이블 가로스크롤 정상

- [ ] **Step 5: 문서 최신화** (canton-hub §9) — 응답 shape 변경 반영
  - `docs/ARCHITECTURE.md` API Contracts에 funding-rates 응답의 `spread_pct` 추가
  - 커밋: `git add docs/ARCHITECTURE.md && git commit -m "docs: funding-rates 응답 spread_pct 반영"`

- [ ] **Step 6: finishing-a-development-branch 스킬로 마무리** — 머지/PR 결정

---

## Self-Review 결과 (작성자 체크)

- **Spec coverage:** §3 계산식 → Task 3; §4 백엔드 → Task 1; §5 프론트 → Task 2/4/5; §6 엣지 → Task 1(spread None)·Task 3(null 처리)·Task 5(폴백); §7 테스트 → Task 1·7. spot-perp net은 spec §8에서 범위 밖으로 명시 → Task에서 의도적으로 미포함. ✅
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "적절히 처리" 류 없음. ✅
- **Type consistency:** `spread_pct`(types.ts/백엔드), `roundTripCost`/`netApr`/`breakevenDays`/`HOLD_DAYS_DEFAULT`(funding-net.ts↔컴포넌트 import 일치), `net_apr`/`round_trip_cost`/`breakeven_days`(PerpPairResult↔카드 사용 일치), i18n 키(`colSpread`/`netAprLabel`/`roundTripCost`/`breakeven`/`daysUnit`/`netNa`/`holdNote`↔컴포넌트 `t()` 호출 일치). ✅
