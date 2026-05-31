# Canton DAT Tracker (`/dat`) — 설계 문서

- 날짜: 2026-05-31
- 대상 프로젝트: `canton-hub` (백엔드 FastAPI) + `canton-hub/web` (Next.js 프론트엔드)
- 참고: deathspiral.vercel.app (기능 레퍼런스), 기존 Canton-Hub 디자인 시스템(톤&매너), 금융 UX 원칙(옵시디언 `note-finance-investment-ux`)

## 1. 배경 & 목표

[deathspiral.vercel.app](https://deathspiral.vercel.app/)은 BTC/ETH를 재무자산으로 보유한 상장사(MSTR, BMNR 등)의 보유량·mNAV·평가손익을 실시간 추적하는 "crypto treasury risk monitor"다. 이 페이지처럼 **Canton Network($CC)를 재무자산으로 보유한 상장사(DAT, Digital Asset Treasury)** 를 Canton-Hub 안에서 추적하는 것이 목표다.

핵심 제약:
- **$CC 전용.** BTC/ETH 등 다른 자산은 추적하지 않는다. 멀티-코인 일반화(`asset` 필드 등)는 하지 않는다.
- **멀티-기업 구조.** 현재 $CC DAT 상장사는 사실상 **CNTN (Canton Strategic Holdings, Inc. — 구 Tharimmune, NASDAQ: CNTN, 2026-02-18 거래 시작)** 하나뿐이다. 다만 향후 $CC DAT 상장사가 추가될 수 있으므로, JSON 항목 추가만으로 확장되는 멀티-기업 자료구조로 설계한다.
- **디자인은 deathspiral의 네온 사이버펑크를 버리고, 기존 Canton-Hub의 Linear/Vercel 미니멀 톤(`--canton-*` 토큰, `.ch-*` 클래스, Tremor + Recharts + SWR)으로 리디자인.**

추적 지표: 보유량 · mNAV · 평단 · 평가손익(P/L) + (Canton 특화) **mNAV 시계열 차트** · **death-spiral 리스크 신호** · **KRW 환산**.

명시적으로 **하지 않는 것**: Super Validator 수익 지표, deathspiral의 "Copy to Clipboard" 기능, 다중 코인 지원.

## 2. 아키텍처

기존 canton-hub 패턴(collector → scheduler loop → cache → route → web SWR 훅)에 그대로 얹는다.

```
data/dat_companies.json  (수동 갱신: 공식발표 기반 보유량·평단·부채·현금·발행주식·SV·근거)
        │
api/scheduler.py  collect_dat loop (간격 5분)
   ├─ cache.get("price")로 기존 $CC 현재가를 읽어 cc_price 인자로 주입  (★ 별도 CoinGecko 호출 금지)
   └─ collectors/dat_collector.py(cc_price=...) 호출
        │
collectors/dat_collector.py   ← kr_companies_collector 패턴 (JSON 로드 + 검증, 예외 내부 처리, 빈 데이터 폴백)
   ├─ dat_companies.json 로드 (보유량·평단·부채·현금·발행주식·SV·근거)
   ├─ 주가 / 시가총액 라이브: Yahoo Finance 무료 chart 엔드포인트 (키 불필요, httpx)
   ├─ $CC 현재가: scheduler가 넘겨준 cc_price 인자 사용 (수집기는 cache 직접 접근 안 함)
   └─ USD/KRW: exchangerate (deathspiral과 동일 소스, httpx)
        │  결과를 cache key "dat"에 적재 + data/dat_history.json에 mNAV 점 누적
        ▼
api/routes/dat.py  →  GET /api/analytics/dat   (mNAV · P/L · 리스크 계산 결과 + mnav_history 포함)
        │
web/lib/types.ts (DatCompany 타입, 백엔드 shape과 1:1) + web/lib/api.ts (useDat SWR 훅)
        ▼
web/app/dat/page.tsx  +  web/components/dat/*   (.ch-* 클래스 재사용)
web/components/ch/navbar.tsx 에 "DAT" 탭 추가  (★ 실제 렌더되는 navbar는 ch/ 쪽)
```

설계 원칙:
- **계산은 백엔드(collector/route)에서 수행**하고 프론트는 표시만 한다. (deathspiral은 프론트 계산이지만, canton-hub는 "백엔드가 가공해 shape을 확정"하는 패턴을 따른다.)
- 수집기는 예외를 내부에서 삼키고 빈 데이터클래스를 반환한다(절대 throw 금지). 하드코딩 URL 금지 → `config.py` 상수 사용(Yahoo Finance·exchangerate URL).
- 캐시 키 `dat` 신설 → `docs/ARCHITECTURE.md` Cache Key Map에 추가(TTL + 소비처).
- **$CC 현재가 재사용 방식(중요):** collector는 cache에 직접 접근하지 않는다(`kr_companies_collector`도 self-contained). **scheduler가 `cache.get("price")`로 기존 $CC 가격을 읽어 `collect_dat(cc_price=...)` 인자로 주입**한다. 이렇게 해야 별도 CoinGecko 호출 없이(rate limit 사고 이력) 가격을 재사용하면서 수집기를 순수하게 유지한다.
- **CNTN 주가/시총 소스(중요):** 백엔드 런타임은 MCP에 접근할 수 없으므로 FMP MCP는 쓸 수 없다. **Yahoo Finance 무료 chart 엔드포인트**(`https://query1.finance.yahoo.com/v8/finance/chart/CNTN`, 키 불필요)를 httpx로 호출한다. deathspiral도 Yahoo Finance를 쓴다. 시가총액이 응답에 없으면 `주가 × 발행주식수`(발행주식수는 `dat_companies.json`의 `shares_outstanding`)로 계산.

## 3. 데이터 모델

### 3.1 `data/dat_companies.json` (수동 — 공식발표 기반, $CC 전용)

```jsonc
[
  {
    "ticker": "CNTN",
    "name": "Canton Strategic Holdings",
    "exchange": "NASDAQ",
    "cc_holdings": 0,          // $CC 보유 수량 (공식발표)
    "avg_buy_price": 0,        // $CC 평단 (USD)
    "debt": 0,                 // mNAV(EV식) 계산용
    "cash": 0,
    "shares_outstanding": 0,   // 시총 폴백 계산용 (Yahoo 응답에 시총 없을 때 주가×주식수)
    "super_validator": true,   // SV 운영 여부 (배지 표시용; 수익 지표는 추적 안 함)
    "source": "8-K 2026-..",   // 근거 출처 (kr_companies식 evidence)
    "as_of": "2026-..-.."      // 발표 기준일
  }
]
```

> - `cc_holdings` 0 또는 미발표 시 mNAV·P/L은 "—"로 표기하고 리스크 배지를 숨긴다.
> - **시드 데이터 주의:** 위 예시는 전부 `0` 플레이스홀더다. 구현 시 **CNTN 최신 공식 공시(8-K/보도자료)에서 실제 수치를 채워야** 한다. 채우기 전에는 §7에 따라 카드가 "—"로 렌더된다.

### 3.2 API 응답 (`GET /api/analytics/dat`)

위 정적 필드 + 다음 계산/라이브 필드:

| 필드 | 계산식 / 소스 |
|---|---|
| `stock_price`, `market_cap` | 라이브 (Yahoo Finance). 시총 없으면 `stock_price × shares_outstanding` |
| `cc_price` | 라이브 ($CC 현재가, scheduler가 `cache.get("price")`로 주입) |
| `nav` | `cc_holdings × cc_price` ($CC NAV) |
| `mnav` | **EV식으로 고정: `(market_cap + debt − cash) / nav`**, 라벨 "mNAV (EV / $CC Reserve)". `debt`/`cash`가 둘 다 미상(0/누락)이면 `market_cap / nav`로 폴백하고 라벨을 "mNAV (Market Cap / $CC NAV)"로 표기 |
| `mnav_label` | 위에서 실제 사용한 공식 라벨 문자열 (프론트 표시용) |
| `pl_usd` | `(cc_price − avg_buy_price) × cc_holdings` |
| `pl_pct` | `pl_usd / (avg_buy_price × cc_holdings)` |
| `krw_rate` | USD/KRW |
| `value_krw`, `pl_krw` | 위 USD 값 × `krw_rate` |
| `risk` | §5 리스크 신호 (`healthy` / `watch` / `below_nav`) |
| `mnav_history[]` | mNAV 시계열 `{ts, mnav}`. 저장 방식은 §3.3 |

`web/lib/types.ts`에 `DatCompany` 타입을 백엔드 shape과 1:1로 추가한다(cross-cutting 규칙: 백엔드 route와 같은 PR).

### 3.3 mNAV 시계열 누적 (`data/dat_history.json`)

`data/kpi_history.json`와 동일한 "파일에 누적 append" 패턴을 따른다.

- **누가/언제 append:** `collect_dat` 스케줄러 루프가 **티커별로 점 1개**를 추가한다. 단, 노이즈 방지를 위해 **마지막 점과 같은 시(hour) 버킷이면 덮어쓰고, 새 시 버킷이면 append**(시간당 1점).
- **보존 윈도우:** 티커별 **최근 90일(약 2160점)**만 유지하고 초과분은 앞에서 잘라낸다(무한 증가 방지).
- 파일 손상/부재 시 빈 리스트로 시작(예외 내부 처리). 차트 표시용으로 route가 cache의 `dat`에 실어 내려준다.

## 4. UI 레이아웃 (`/dat`, `.ch-*` 재사용)

```
┌ Page header (.ch-page-header): "DAT Tracker" + sub("Canton 재무자산($CC)을 보유한 상장사") ┐
│
├ KPI strip (.ch-kpi-strip, 4-up):
│     추적 기업 수 · 합산 $CC 보유 · 합산 평가손익 · 평균(또는 대표) mNAV
│
├ 기업 카드 그리드 (멀티-기업, 1~2열, 각 카드 = .ch-card):
│   ┌──────────── CNTN  [NASDAQ]  [🛡 SV] ────────────┐
│   │ HOLDINGS:  000,000 CC                            │
│   │ ┌Avg Buy┐ ┌CC Price┐ ┌Invested┐ ┌Value(+₩)┐    │  ← .ch-bm-stat 그리드
│   │ mNAV  ●━━━━━━━●  1.46x   (1.0x 기준선)           │  ← .ch-bm-dial 재사용*
│   │ ▲ P/L  +$5,181,026,979  (+10.87%)  ≈ ₩7조...     │  ← 색 + ▲▼ + 부호 + KRW 병기
│   │ [리스크 배지: Healthy / Watch / Below NAV]        │  ← §5
│   └─────────────────────────────────────────────────┘
│
├ mNAV 시계열 차트 (.ch-chart-card + Recharts): 선택 기업 mNAV 추이 + 1.0x 점선 기준선
│
└ Data Sources 테이블 (.ch-data-table): deathspiral식 출처/갱신주기 명시 (투명성)
```

- 모든 색/숫자는 `var(--canton-*)` + `tabular-nums`. 하드코딩 색상 금지.
- 반응형: 기존 `@media (max-width: 860px)` 규칙 따라 1열로.
- *`.ch-bm-dial`은 down→up 그라데이션 트랙 + 중앙 포인터가 하드코딩돼 있어, mNAV 게이지(1.0x 기준선)로 재사용하려면 **포인터 위치 계산 로직만 살짝 수정**해야 한다(기준선=1.0x를 트랙상 특정 지점에 매핑). 비용 작음. 부담되면 단순 숫자+칩 표기로 대체 가능.

## 5. death-spiral 리스크 신호 (절제된 버전)

mNAV 기준 3단계 배지. **공포 조장·게임화 없이 사실만** 표기(옵시디언 금융 UX 원칙: 위험 가리는/과장하는 다크패턴 금지).

| 상태 | 조건 | 색 / 표기 |
|---|---|---|
| **Healthy** | mNAV ≥ 1.2x | `--canton-up` · ● |
| **Watch** | 1.0x ≤ mNAV < 1.2x | `--canton-burn`(주황) · ◐ |
| **Below NAV** | mNAV < 1.0x | `--canton-down` · ▼ + 툴팁 "프리미엄 소멸 → 자금조달 압박 구간" |

- 차트에 **1.0x 기준선**을 점선으로 그어 임계선을 시각화한다.
- 단정적 "DEATH SPIRAL" 라벨은 쓰지 않는다 → 중립적 **"Below NAV"**.

## 6. 색상 컨벤션 결정 (중요)

- 옵시디언 노트는 한국 관습(빨강↑/파랑↓)을 권하지만, **기존 Canton-Hub는 글로벌(ko/en/ja/zh) 대상이라 크립토 관습(초록↑=`--canton-up` / 빨강↓=`--canton-down`)을 쓴다.** "기존 톤&매너 유지"가 우선이므로 **초록↑/빨강↓를 따른다.**
- 단, 노트의 **WCAG 1.4.1**(색 단독 사용 금지) 원칙은 적용 → 손익·등락에 **+/− 부호 + ▲▼ 화살표를 색과 함께** 표기한다.
- 다크/라이트 양쪽 모두 기존 CSS 변수 swap으로 자동 적응.

## 7. 에러 처리 & 엣지 케이스

- 라이브 가격 실패 → 마지막 캐시값 + "official announcement data" 표기(deathspiral 폴백 철학과 동일). route는 500 금지, 빈 폴백 반환.
- 보유량 미발표/0 → mNAV·P/L "—" 표기, 리스크 배지 숨김.
- `mnav_history` 데이터가 짧으면 차트 대신 "데이터 축적 중" 스켈레톤(`.ch-skel`).

## 8. 테스트

- 백엔드 `tests/api/test_dat.py`: route 200 + 응답 shape 검증, mNAV/P/L 계산 정확성(고정 입력 → 기대값), 가격 실패 시 폴백, 보유량 0 처리.
- 프론트: `npx tsc --noEmit` + `npm run build` 통과, 다크/라이트 토글 · KRW 표기 수동 smoke.

## 9. 영향 받는 파일 (cross-cutting 체크리스트)

신규:
- `data/dat_companies.json` (수동 시드 + `shares_outstanding`)
- `data/dat_history.json` (mNAV 시계열 누적, 런타임 생성)
- `collectors/dat_collector.py`
- `api/routes/dat.py`
- `web/app/dat/page.tsx`, `web/components/dat/*`
- `tests/api/test_dat.py`

수정:
- `api/scheduler.py` (collect_dat loop 등록 + `cache.get("price")`→`cc_price` 주입)
- `api/main.py` (router 등록)
- `config.py` (Yahoo Finance chart URL + exchangerate URL 상수)
- `web/lib/types.ts` (`DatCompany`), `web/lib/api.ts` (`useDat`)
- `web/components/ch/navbar.tsx` ("DAT" 탭 — 실제 렌더되는 navbar)
- 문서: `docs/ARCHITECTURE.md`(Cache Key Map + 라우트), `docs/DATA_GUIDE.md`(Yahoo Finance·exchangerate 데이터 소스), 프론트 `web/docs/ARCHITECTURE.md`/`PRD.md`

## 10. YAGNI로 뺀 것

- Super Validator 수익 지표(배지 표시만, 수익 추적 X)
- Copy to Clipboard
- 다중 코인 지원 ($CC 전용)
