# Canton Hub — 거래소별 펀딩비(Funding Rate) 표시 & 양빵 매트릭스

**Date**: 2026-05-15
**Status**: Design approved — pending implementation plan
**Author**: Brainstormed with @podonoro

---

## 1. 목적과 컨텍스트

### 1.1 배경

Canton Hub 실시간 아비트라지 트래커 페이지는 현재 10개 거래소(DEX/CEX × Spot/Perp)의 실시간 가격 + 2% 호가창 depth를 비교하지만, **펀딩비(Funding Rate, 이하 FR) 정보가 없다**. 양빵(델타뉴트럴 차익거래) 트레이더 입장에서는 가격 스프레드보다 FR 차이가 더 큰 알파인 경우가 빈번하다.

### 1.2 핵심 요구사항

기존 가격 비교 그리드 **아래에 별도 섹션**("펀비 양빵 매트릭스")을 신설하여:

1. **7개 Perp 거래소의 현재 FR**을 표 형태로 나열 (APR 정규화 포함)
2. **양빵 페어 자동 추천 2가지**:
   - **Perp ↔ Perp**: FR 양수 거래소 숏 + FR 음수 거래소 롱 → 양쪽에서 FR 수익
   - **현물 ↔ Perp**: 가장 싼 현물 매수 + FR 양수 Perp 숏 → 베이시스 + FR 수익
3. **다음 정산까지 카운트다운**: 클라이언트 1초 단위
4. **1h 정산(HL/Extended/Lighter) ↔ 8h 정산(Aster/Binance/Bybit/OKX) 혼재**를 APR로 정규화하여 동일 척도 비교
5. **다국어 지원**: 기존 `useLang()` 패턴 따름. `lang === "ko"`면 한국어, 그 외(`en` / `ja` / `zh`)는 **영어 fallback**. 자세한 매핑은 §10 참조.

### 1.3 페어 추천 알고리즘 — Raw FR APR 차이 (단순 정렬)

```
Perp-Perp 추천: argmax(short.fr_apr − long.fr_apr) for short ≠ long
현물-Perp 추천: argmax(perp.fr_apr) + 가장 싼 현물
```

가격 스프레드, 호가창 depth, 수수료는 **추천 박스 sub-text로 함께 표시**하되 정렬 기준에는 넣지 않음. 이유:
- "8h 보유 가정"이 임의적 → 합산식 misleading
- 작은 거래소를 임계값으로 거르면 화면엔 보이는데 추천엔 안 나오는 모순

### 1.4 명시적 비목표 (Phase 2로 이관)

- **누적 8h FR 컬럼** — 1h 정산 거래소는 별도 history API 호출 필요. MVP에서는 현재 FR만.
- **수수료 차감 net APR 표시** — 거래소·사용자 등급별로 fee가 달라 misleading 위험. MVP는 raw APR + 안내문.
- **사용자 설정 토글** (수수료율, 자본 규모 등 입력 → 실손익 계산) — 사용자 수요 확인 후 결정.

---

## 2. Architecture

기존 `realtime_prices.py` 패턴을 그대로 따라가서 코드베이스 일관성 유지.

### 2.1 Backend (Python · FastAPI)

```
canton-hub/
├─ collectors/
│  └─ funding_rates.py        ← 신규
├─ api/
│  ├─ scheduler.py            ← fetch task 1개 추가
│  └─ routes/analytics.py     ← 엔드포인트 1개 추가
```

- **`collectors/funding_rates.py`**: 7개 거래소 fetch 함수 + `FundingRate` dataclass + `collect_all_funding_rates()` 진입점
- **Scheduler**: 60초 간격 fetch (가격 그리드 5초보다 느슨 — FR은 1h/8h 정산이라 분 단위면 충분)
- **Cache key**: `analytics:funding-rates` (TTL 90초, 직전 데이터 유지용 여유)
- **신규 라우트**: `GET /api/analytics/funding-rates`

### 2.2 Frontend (Next.js · React · Tremor)

```
web/components/
└─ FundingRateMatrix.tsx      ← 신규 (단일 컴포넌트, sub-component 내부 정의)
```

- 기존 가격 비교 그리드 컴포넌트 **바로 아래**에 placement
- `SWR` polling 30초 (서버는 60초 갱신, 클라가 약간 자주 → 캐시 hit 비율 ↑)
- **카운트다운은 클라이언트 setInterval 1초** (서버 부담 0, `next_funding_ts`만 받음)
- **페어 추천 계산은 클라이언트** (raw 데이터 정렬·매칭만; UI 실험 시 백엔드 재배포 불필요)

### 2.3 핵심 설계 결정 근거

| 결정 | 이유 |
|---|---|
| 별도 collector 분리 | `realtime_prices.py`에 합치면 5초마다 FR도 fetch → 거래소 rate limit 빨리 소진 |
| 페어 계산 클라이언트 | 추천 로직 변경 시 백엔드 재배포 불필요. 백엔드는 변하지 않는 raw 데이터만 제공 |
| 카운트다운 클라이언트 | 서버는 `next_funding_ts` (unix epoch)만 응답. 매초 재계산 불필요 |
| 60초 fetch | FR은 1h/8h 정산. 분 단위면 충분. 거래소 API 부담 ↓ |

---

## 3. Data Flow

```
[Scheduler: 60s tick]
       ↓
asyncio.gather(7개 거래소 fetch, timeout=5s each, exception=skip)
       ↓
[FundingRate 객체 × 최대 7개]
       ↓
cache.set("analytics:funding-rates", {rates, updated_at}, ttl=90s)
       ↓
GET /api/analytics/funding-rates  ←  cache hit
       ↓
[Client SWR polling 30s]
       ↓
1) 표 렌더 (정렬: APR 내림차순)
2) 페어 추천 계산 (computePairs)
3) setInterval(1s): next_funding_ts - now 카운트다운
```

### 3.1 거래소별 API 매핑

| 거래소 | 정산 | Endpoint | 파싱 |
|---|---|---|---|
| **Hyperliquid** | 1h | `POST api.hyperliquid.xyz/info {"type":"metaAndAssetCtxs"}` | `ctxs[i].funding`. 정산 = 매시 정각 |
| **Aster** | 8h | `GET fapi.asterdex.com/fapi/v1/premiumIndex?symbol=CCUSDT` | `lastFundingRate`, `nextFundingTime` (ms) |
| **Extended** | 1h | `GET api.starknet.extended.exchange/api/v1/info/markets` | `marketStats.fundingRate`. 정산 = 매시 정각 |
| **Lighter** | 1h | `GET mainnet.zklighter.elliot.ai/api/v1/funding-rates` | `funding_rates[].{exchange:"lighter", symbol:"CC"}.rate` |
| **Binance Perp** | 8h | `GET fapi.binance.com/fapi/v1/premiumIndex?symbol=CCUSDT` | `lastFundingRate`, `nextFundingTime` |
| **Bybit Perp** | 8h | `GET api.bybit.com/v5/market/tickers?category=linear&symbol=CCUSDT` | `result.list[0].fundingRate`, `nextFundingTime` |
| **OKX Perp** | 8h | `GET okx.com/api/v5/public/funding-rate?instId=CC-USDT-SWAP` | `data[0].fundingRate`, `nextFundingTime` |

**Lighter API 보너스**: 응답에 `binance`, `bybit`, `hyperliquid` CC funding도 함께 포함되지만 cross-reference 용도(mark price 산정). 우리는 각 거래소 official API를 primary로 사용 (정확성/실시간성 우선).

### 3.2 데이터 모델

```python
@dataclass
class FundingRate:
    source: str              # "Hyperliquid", "Bybit Perp", ...
    venue_type: str          # "DEX" or "CEX"
    market: str              # "perpetual"
    pair: str                # "CC/USD" or "CC/USDT"
    fr_raw: float            # 소수점 표기 (e.g. 0.00012 = 0.012%)
    period_hours: int        # 1 or 8
    fr_apr: float            # 연환산 % (e.g. 10.5)
    next_funding_ts: int     # unix epoch seconds
    api_source: str          # endpoint hostname (디버깅용)
```

### 3.3 정규화 로직

```python
def to_apr(fr_raw: float, period_hours: int) -> float:
    periods_per_year = (24 * 365) // period_hours  # 8760 (1h) or 1095 (8h)
    return fr_raw * periods_per_year * 100
```

검증 예:
- HL `fr_raw=0.00012` (1h) → `0.00012 × 8760 × 100 = 105.12%` APR
- Bybit `fr_raw=-0.00045` (8h) → `-0.00045 × 1095 × 100 = -49.275%` APR

---

## 4. UI Components (Tremor 기반)

### 4.1 화면 배치

```
┌──────────────────────────────────────────────────────────┐
│ [기존] 실시간 아비트라지 트래커 — 가격 비교 그리드        │
├──────────────────────────────────────────────────────────┤  ← 여기 아래 신규
│ 💰 펀비 양빵 매트릭스                                     │
│                                                            │
│ ┌──────────────────┬──────────────────────────────────┐  │
│ │ 🎯 Perp-Perp 양빵 │ 🎯 현물-Perp 양빵                │  │
│ │ +18.3% APR        │ +13.4% APR                       │  │
│ │ HL 롱 + BP 숏     │ Bybit 현물 매수 + HL Perp 숏    │  │
│ │ ※ 진입스프 0.07%↑ │ ※ 베이시스 0.02%↓                │  │
│ │ ※ 호가창 $87K     │ ※ 호가창 $128K (Bybit -2%)       │  │
│ └──────────────────┴──────────────────────────────────┘  │
│                                                            │
│ 거래소         FR(원시)    APR     다음정산   Trade ↗    │
│ Lighter        +0.032%/1h  +28.0%   18m       →           │
│ Hyperliquid    +0.012%/1h  +10.5%   43m       →           │
│ OKX Perp       +0.008%/8h  +8.8%    5h 21m    →           │
│ Aster          +0.001%/8h  +1.1%    3h 21m    →           │
│ Extended       -0.001%/1h  -0.9%    43m       →           │
│ Binance Perp   -0.020%/8h  -2.2%    5h 21m    →           │
│ Bybit Perp     -0.045%/8h  -4.9%    5h 21m    →           │
│                                                            │
│ 마지막 업데이트: 18:42:15 (12초 전)                       │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Tremor 컴포넌트 매핑

| 영역 | Tremor 컴포넌트 |
|---|---|
| 전체 카드 | `<Card>` |
| 추천 박스 (반응형 2열 → 1열) | `<Grid numItems={1} numItemsSm={2} gap={4}>` + `<Card>` × 2 |
| APR 강조 (큰 글자 + 색) | `<Metric>` (양수 green, 음수 red) |
| 거래소 표 | `<Table>` + `<TableHead/Body/Row/Cell>` |
| 양수/음수 FR | `<BadgeDelta deltaType={positive\|negative}>` |
| 카운트다운 | 일반 `<Text>` + `useEffect setInterval` |
| Trade 링크 | `<Button variant="light">` + 화살표 (기존 가격 카드 패턴) |

### 4.3 컴포넌트 구조 (단일 파일)

⚠️ **`web/CLAUDE.md` §0 규칙 — API 호출은 반드시 `lib/api.ts` SWR 훅 경유. `fetch` 직접 호출 금지.**

먼저 `web/lib/`에 hook + type을 추가:

```typescript
// web/lib/types.ts (추가)
export interface FundingRate {
  source: string;                    // "Hyperliquid", "Bybit Perp" 등
  venue_type: "DEX" | "CEX";
  market: "perpetual";
  pair: string;                      // "CC/USD", "CC/USDT"
  fr_raw: number;                    // 0.00012 = 0.012%
  period_hours: 1 | 8;
  fr_apr: number;                    // 연환산 % (백엔드에서 미리 계산)
  next_funding_ts: number;           // unix epoch seconds
  api_source: string;
}

export interface FundingRates {
  rates: FundingRate[];
  updated_at: string | null;         // ISO8601
}

// web/lib/api.ts (추가)
export function useFundingRates() {
  return useSWR<FundingRates>(
    `${API_BASE}/api/analytics/funding-rates`,
    fetcher,
    { refreshInterval: 30_000, fallbackData: { rates: [], updated_at: null } }
  );
}
```

그 다음 컴포넌트:

```typescript
// web/components/analytics/FundingRateMatrix.tsx
"use client";
import { Card, Title, Grid, Metric, Table, BadgeDelta, Callout } from "@tremor/react";
import { useFundingRates, useRealtimePrices } from "@/lib/api";
import { useLang } from "@/lib/use-lang";
import { TEXTS } from "./funding-rate-matrix.i18n";   // §10 참조

export default function FundingRateMatrix() {
  const [lang] = useLang();
  const t = (key: keyof typeof TEXTS) => lang === "ko" ? TEXTS[key].ko : TEXTS[key].en;
  const { data: fr, error } = useFundingRates();
  const { data: rt } = useRealtimePrices();

  const recommendations = useMemo(
    () => computePairs(fr?.rates ?? [], rt?.prices ?? []),  // ← rt.prices (live_prices 아님)
    [fr, rt]
  );

  if (error) return <Callout color="rose" title={t("errorLoad")} />;
  if (!fr?.rates.length) return <Callout color="gray" title={t("loading")} />;

  return (
    <Card>
      <Title>{t("title")}</Title>
      <RecommendationCards pairs={recommendations} t={t} />
      <FundingRateTable rates={fr.rates} prices={rt?.prices ?? []} t={t} />
      <LastUpdated ts={fr.updated_at} t={t} />
    </Card>
  );
}

function RecommendationCards({ pairs }: ...) { ... }
function FundingRateTable({ rates, prices }: ...) { ... }  // prices는 trade_url 매핑용
function Countdown({ targetTs }: { targetTs: number }) {
  // setInterval 1초. targetTs - now < 0이면 "정산 중..." 표시.
}
```

**trade_url 처리**: `FundingRate` dataclass에 별도로 넣지 않고, 클라이언트에서 `rt.prices`의 동일 `source` entry에서 `trade_url` join (기존 `_enrich_with_depth` 패턴과 동일 접근).

### 4.4 페어 계산 로직 (클라이언트)

```typescript
type Pair = {
  short: FundingRate;
  long?: FundingRate | { source: string; price: number };  // 현물-Perp일 땐 spot venue
  apr: number;
  entry_spread_pct: number;
  liquidity_min_usd: number;  // min(short depth_-2%, long depth_+2%)
};

// prices: rt.prices (RealtimePrices.prices, 즉 LivePrice[])
function computePairs(rates: FundingRate[], prices: LivePrice[]): {perpPair: Pair | null, spotPerpPair: Pair | null} {
  const sorted = [...rates].sort((a, b) => b.fr_apr - a.fr_apr);

  // Perp-Perp
  const perpPair = sorted.length >= 2 ? {
    short: sorted[0],
    long: sorted[sorted.length - 1],
    apr: sorted[0].fr_apr - sorted[sorted.length - 1].fr_apr,
    entry_spread_pct: priceSpread(prices, sorted[0].source, sorted[sorted.length - 1].source),
    liquidity_min_usd: minDepth(prices, sorted[0].source, sorted[sorted.length - 1].source),
  } : null;

  // 현물-Perp: 양수 FR 가장 큰 Perp + 가장 싼 현물
  const cheapestSpot = prices
    .filter(p => p.market === 'spot')
    .sort((a, b) => a.price - b.price)[0];

  const spotPerpPair = (sorted[0]?.fr_apr > 0 && cheapestSpot) ? {
    short: sorted[0],
    long: { source: cheapestSpot.source, price: cheapestSpot.price },
    apr: sorted[0].fr_apr,
    entry_spread_pct: (perpPriceOf(prices, sorted[0].source) - cheapestSpot.price) / cheapestSpot.price * 100,
    liquidity_min_usd: minSpotPerpDepth(prices, cheapestSpot.source, sorted[0].source),
  } : null;

  return { perpPair, spotPerpPair };
}
```

### 4.5 반응형

- **데스크탑 (≥ 640px)**: 추천 박스 2열, 표 전체 너비
- **모바일 (< 640px)**: 추천 박스 1열로 쌓임, 표는 가로 스크롤 (Tremor `<Table>` 기본 동작)
- 카운트다운 약식: `5h 21m` → `5h`

---

## 5. Error Handling

### 5.1 거래소 fetch 단계

기존 `realtime_prices.py` 패턴 (예외 삼키고 None 반환):

```python
async def fetch_hyperliquid_funding(client) -> FundingRate | None:
    try:
        resp = await client.post(...)
        resp.raise_for_status()
        return FundingRate(...)
    except Exception as e:
        logger.warning(f"Hyperliquid funding rate failed: {e}")
        return None
```

→ 7개 중 일부 실패해도 나머지는 표에 정상 표시 (graceful degradation).

### 5.2 캐시 단계

```python
results = [r for r in fetched if r is not None]
if results:  # 전부 실패하면 캐시 갱신 안 함 → 직전 데이터 유지
    cache.set("analytics:funding-rates", {"rates": results, "updated_at": now}, ttl=90)
```

### 5.3 클라이언트 표시

- 표 하단 `마지막 업데이트: 18:42:15 (12초 전)` (Tremor `<Text size="xs">`)
- `updated_at`이 5분 이상 오래되면 노란색 `⚠ 데이터 갱신 지연` 배너 (Tremor `<Callout color="yellow">`)
- SWR fetch fail → `fallbackData`로 마지막 성공 데이터 유지, 에러 시 작은 아이콘만

### 5.4 페어 계산 edge cases

| 상황 | UI |
|---|---|
| Perp 거래소 < 2개 | Perp-Perp 추천 박스 hide |
| 현물 데이터 없음 | 현물-Perp 추천 박스 hide |
| 양수 FR 거래소 없음 | "현재 양빵 적합 페어 없음 (모든 FR 음수)" 안내문 |
| 단일 거래소만 fetch 성공 | 추천 박스 모두 hide, 표만 표시 |

---

## 6. Testing

기존 `canton-hub/tests/api/` 패턴 — 실제 mocking 라이브러리는 implementation plan 첫 단계에서 `tests/` 디렉토리 확인 후 확정 (`pytest-httpx` / `httpx-respx` / `unittest.mock` 중 기존 코드가 쓰는 것).

### 6.1 백엔드 테스트

```
tests/
├─ test_funding_rates_fetchers.py    ← 거래소별 7개
├─ test_funding_rates_normalize.py   ← APR 정규화
├─ test_funding_rates_route.py       ← /api/analytics/funding-rates
└─ test_funding_rates_scheduler.py   ← 60초 tick, partial failure
```

| 테스트 | 검증 |
|---|---|
| `test_<exchange>_parse_funding` × 7 | mock 응답 → `FundingRate` dataclass 정확 채워짐 |
| `test_<exchange>_timeout_returns_none` | 타임아웃 → None 반환 (예외 미발생) |
| `test_<exchange>_malformed_response` | 비어있거나 schema 어긋난 응답 → None |
| `test_apr_1h_normalize` | `0.00012 × 8760 × 100 = 105.12` |
| `test_apr_8h_normalize` | `0.00045 × 1095 × 100 = 49.275`  |
| `test_apr_negative` | 음수 FR도 부호 유지 |
| `test_route_returns_cached` | cache hit 시 거래소 API 호출 안 됨 |
| `test_route_empty_cache` | 캐시 비어있으면 빈 rates + 적절한 응답 |
| `test_scheduler_partial_failure` | 7개 중 4개 실패 → 캐시에 3개만 저장, 직전 데이터 삭제 안 됨 |

### 6.2 프론트엔드 테스트

기존 `web/`에 jest/vitest 셋업이 있으면 사용:
- `computePairs` 단위 테스트 (다양한 rates/prices 조합)
- `Countdown` 컴포넌트 (Date mock으로 0초 임박 시 "정산 중..." 출력 검증)

셋업 없으면 MVP에선 생략 (구현 단계에서 결정).

---

## 7. 작업 영향 분석 (Side Effects)

| 변경 영역 | 영향 | 완화 |
|---|---|---|
| `api/scheduler.py` | fetch task 1개 추가 → 60초마다 7개 HTTP 요청 | 거래소별 rate limit 안전 (대부분 100+ req/sec 허용, 우리는 1/min) |
| `api/cache.py` | 신규 키 1개 (`analytics:funding-rates`) | TTL 90초로 메모리 부담 미미 |
| `requirements.txt` | 변경 없음 (`httpx`, `apscheduler` 기존 의존성으로 충분) | — |
| `web/lib/types.ts` | `FundingRate`, `FundingRates` 타입 2개 추가 | 기존 타입과 충돌 없음 |
| `web/lib/api.ts` | `useFundingRates` SWR 훅 추가 (web §0 규칙) | 기존 훅 영향 없음 |
| `web/` 의존성 | Tremor 기존 사용 (`@tremor/react`) | 추가 패키지 없음 |
| 기존 `/api/analytics/realtime-prices` | 응답 변경 없음 (컴포넌트가 trade_url 매핑용으로 read-only 활용) | — |
| `docs/ARCHITECTURE.md` | Cache Key Map + SWR Hook Map 항목 추가 필요 (canton-hub §9 Doc Rules) | implementation plan에 step으로 포함 |

---

## 8. 작업 순서 (구현 plan은 별도 문서)

상위 단계만 명시. 세부 plan은 `writing-plans` skill로 별도 작성:

1. **Backend**
   - (1-a) `collectors/funding_rates.py` — 7개 fetcher + dataclass + 정규화 함수
   - (1-b) `api/routes/analytics.py` — `/funding-rates` 엔드포인트
   - (1-c) `api/scheduler.py` — 60초 tick
   - (1-d) 백엔드 테스트
2. **Frontend**
   - (2-a) `web/lib/types.ts` — `FundingRate`, `FundingRates` 타입 추가
   - (2-b) `web/lib/api.ts` — `useFundingRates` SWR 훅 추가
   - (2-c) `web/components/analytics/funding-rate-matrix.i18n.ts` — 다국어 텍스트 사전 (§10)
   - (2-d) `web/components/analytics/FundingRateMatrix.tsx` — 단일 컴포넌트
   - (2-e) 기존 페이지에 placement
   - (2-f) (있다면) 프론트엔드 테스트
3. **검증**
   - 7개 거래소 모두 살아있는 시간대 확인 (특히 Lighter 응답)
   - 모바일 1열 동작
   - 60초 fetch failure 시 graceful degradation

---

## 9. Open Questions (구현 중 결정)

- **Lighter funding 정산 주기 확인**: 응답에 `period_hours` 정보 없음. Lighter docs에서 확인 후 1h 가정 검증.
- **OKX `CC-USDT-SWAP` vs `CC-USD-SWAP`**: 어느 instId가 실제 가용한지 구현 시 확인.
- **Aster funding 정산 주기**: Binance API 호환이라 8h로 가정하나 응답 `fundingIntervalHours` 같은 필드로 검증.

이 항목들은 design 결정사항이 아니라 구현 단계에서 직접 fetch로 확인.

---

## 10. Internationalization (i18n)

### 10.1 정책

기존 `useLang()` 훅(`/web/lib/use-lang.ts`)이 4개 언어 코드(`ko` / `en` / `ja` / `zh`)를 지원하지만, 본 컴포넌트는 **2-track 정책**:

- `lang === "ko"` → **한국어**
- `lang === "en" | "ja" | "zh"` → **영어 fallback** (별도 ja/zh 번역 안 만듦)

이유: ja/zh 사용자가 영어를 이해할 수 있다는 가정 + 트레이딩 용어(FR, APR, Spot, Perp)는 영어 원어가 더 정확. ja/zh 별도 번역은 미래 수요 확인 후 추가 (지금은 YAGNI).

### 10.2 패턴 — 컴포넌트 dictionary 파일

기존 `components/nav/navbar.tsx`의 inline 객체 매핑 패턴을 그대로 따르되, 텍스트가 많으니 **dictionary를 별도 파일로 분리**:

```typescript
// web/components/analytics/funding-rate-matrix.i18n.ts
export const TEXTS = {
  title:              { ko: "펀비 양빵 매트릭스",            en: "Funding Rate Arbitrage Matrix" },
  perpPerpTitle:      { ko: "🎯 Perp-Perp 양빵",             en: "🎯 Perp-Perp Arbitrage" },
  spotPerpTitle:      { ko: "🎯 현물-Perp 양빵",             en: "🎯 Spot-Perp Arbitrage" },
  longLabel:          { ko: "롱",                            en: "Long" },
  shortLabel:         { ko: "숏",                            en: "Short" },
  spotBuyLabel:       { ko: "현물 매수",                     en: "Spot Buy" },
  entrySpread:        { ko: "진입스프",                      en: "Entry spread" },
  basis:              { ko: "베이시스",                      en: "Basis" },
  orderbookDepth:     { ko: "호가창",                        en: "Order depth" },
  colExchange:        { ko: "거래소",                        en: "Exchange" },
  colFrRaw:           { ko: "FR(원시)",                      en: "FR (raw)" },
  colApr:             { ko: "APR",                           en: "APR" },
  colNextFunding:     { ko: "다음정산",                      en: "Next Funding" },
  colTrade:           { ko: "Trade ↗",                       en: "Trade ↗" },
  countdownSettling:  { ko: "정산 중...",                    en: "Settling..." },
  lastUpdated:        { ko: "마지막 업데이트",               en: "Last updated" },
  ago:                { ko: "전",                            en: "ago" },     // "12초 전" / "12s ago"
  staleWarning:       { ko: "⚠ 데이터 갱신 지연",            en: "⚠ Data update delayed" },
  errorLoad:          { ko: "펀비 데이터 로드 실패",         en: "Failed to load funding rate data" },
  loading:            { ko: "데이터 수집 중...",             en: "Collecting data..." },
  noArbitrage:        { ko: "현재 양빵 적합 페어 없음 (모든 FR 음수)", en: "No suitable arbitrage pair (all FR negative)" },
} as const;

// 컴포넌트에서 사용:
//   const t = (key: keyof typeof TEXTS) => lang === "ko" ? TEXTS[key].ko : TEXTS[key].en;
//   <Title>{t("title")}</Title>
```

거래소 이름(Hyperliquid, Bybit Perp 등)은 **번역 안 함** — 고유명사.

### 10.3 영어 모드 mockup

```
┌──────────────────────────────────────────────────────────┐
│ 💰 Funding Rate Arbitrage Matrix                          │
│                                                            │
│ ┌──────────────────┬──────────────────────────────────┐  │
│ │ 🎯 Perp-Perp Arb │ 🎯 Spot-Perp Arb                 │  │
│ │ +18.3% APR       │ +13.4% APR                       │  │
│ │ HL Long + BP Short│ Bybit Spot Buy + HL Perp Short  │  │
│ │ ※ Entry spread   │ ※ Basis 0.02%↓                   │  │
│ │   0.07%↑         │ ※ Order depth $128K (Bybit -2%)  │  │
│ │ ※ Order depth $87K│                                  │  │
│ └──────────────────┴──────────────────────────────────┘  │
│                                                            │
│ Exchange       FR (raw)   APR     Next Funding   Trade ↗ │
│ Lighter        +0.032%/1h +28.0%   18m            →       │
│ Hyperliquid    +0.012%/1h +10.5%   43m            →       │
│ OKX Perp       +0.008%/8h +8.8%    5h 21m         →       │
│ Aster          +0.001%/8h +1.1%    3h 21m         →       │
│ Extended       -0.001%/1h -0.9%    43m            →       │
│ Binance Perp   -0.020%/8h -2.2%    5h 21m         →       │
│ Bybit Perp     -0.045%/8h -4.9%    5h 21m         →       │
│                                                            │
│ Last updated: 18:42:15 (12s ago)                          │
└──────────────────────────────────────────────────────────┘
```

### 10.4 시간 단위 표기

| 한국어 | 영어 |
|---|---|
| `43분` | `43m` |
| `5시간 21분` (모바일: `5시간`) | `5h 21m` (모바일: `5h`) |
| `12초 전` | `12s ago` |
| `3분 전` | `3m ago` |

→ 별도 helper `formatDuration(seconds, lang)` 함수로 추출 권장. `web/lib/format.ts`에 추가.

### 10.5 테스트

- `test_funding_rate_matrix_renders_ko`: `useLang() = ["ko", ...]` → "펀비 양빵 매트릭스" 노출
- `test_funding_rate_matrix_renders_en`: `useLang() = ["en", ...]` → "Funding Rate Arbitrage Matrix" 노출
- `test_funding_rate_matrix_renders_zh_fallbacks_to_en`: `useLang() = ["zh", ...]` → "Funding Rate Arbitrage Matrix" 노출 (영어 fallback 검증)
- `test_funding_rate_matrix_renders_ja_fallbacks_to_en`: 동일 (ja → en)

(web/ 테스트 셋업 존재 여부에 따라 구현 단계에서 결정.)
