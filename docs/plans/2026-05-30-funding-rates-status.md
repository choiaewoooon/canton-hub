# Funding Rate / 양빵 매트릭스 — 진행 상태 스냅샷

- 작성일: 2026-05-30
- 목적: 중단된 Funding Fee 작업의 현재 진행도를 한눈에 확인 (사용자 요청)
- 관련 설계: [2026-05-15-funding-rates-design.md](./2026-05-15-funding-rates-design.md)
- 관련 계획: [2026-05-15-funding-rates-impl-plan.md](./2026-05-15-funding-rates-impl-plan.md) (전 13 태스크)

## 위치

| 항목 | 값 |
|---|---|
| 브랜치 | `feat/funding-rates-arbitrage-matrix` |
| 워크트리 | `.worktrees/feat-funding-rates/` |
| 브랜치 HEAD | `5072473` (origin/main 대비 13 커밋 ahead — 설계/계획 문서 8 + 구현 5) |
| 미커밋 변경 | `tests/api/test_funding_rates.py` 1개 (아래 참조) |

## 무엇을 만드는 기능인가

`/analytics` 페이지에 **7개 Perp 거래소 펀딩비 표 + 양빵(델타뉴트럴) 페어 자동 추천** 섹션 추가.
신규 collector(`funding_rates.py`)가 60초마다 7개 거래소를 병렬 fetch → TTL 캐시 →
신규 라우트(`/api/analytics/funding-rates`) → 프론트 SWR 30초 polling → Tremor 표/추천/카운트다운.
1h 정산(HL·Extended·Lighter)과 8h 정산(Aster·Binance·Bybit·OKX)을 `to_apr()`로 연환산 정규화.

## 진행도 — 전 14 태스크(0~13) 중 **3개 완료, Task 3에서 중단**

| Task | 내용 | 상태 | 근거 커밋 |
|---|---|---|---|
| 0 | pytest/pytest-asyncio 개발 의존성 분리 | ✅ 완료 | `16edc59`, `85cd949` |
| 1 | `FundingRate` dataclass + `to_apr()` 정규화 | ✅ 완료 | `a556334` |
| 2 | DEX fetcher — Hyperliquid + Lighter | ✅ 완료 | `de604d7`, 리팩터 `5072473` |
| **3** | **DEX fetcher — Aster + Extended** | **🟡 중단(실패테스트만)** | 미커밋 (아래) |
| 4 | CEX fetcher — Binance + Bybit + OKX | ⬜ 미착수 | — |
| 5 | `collect_all_funding_rates()` 병렬 aggregator | ⬜ 미착수 | — |
| 6 | `GET /api/analytics/funding-rates` 라우트 | ⬜ 미착수 | — |
| 7 | scheduler 60초 tick 등록 + 백엔드 smoke | ⬜ 미착수 | — |
| 8 | 프론트 types + `formatDuration`/`formatAgo` | ⬜ 미착수 | — |
| 9 | `useFundingRates` SWR 훅 | ⬜ 미착수 | — |
| 10 | i18n dictionary | ⬜ 미착수 | — |
| 11 | `FundingRateMatrix` 컴포넌트 | ⬜ 미착수 | — |
| 12 | `/analytics` 페이지 배치 | ⬜ 미착수 | — |
| 13 | 문서 갱신(ARCHITECTURE.md ×2) | ⬜ 미착수 | — |

### 현재 `collectors/funding_rates.py`에 구현된 심볼
`FundingRate`(dataclass), `to_apr()`, `_next_hourly_ts()`, `fetch_hyperliquid_funding()`, `fetch_lighter_funding()`

### 정확한 중단 지점
Task 3의 **Step 1~2(실패 테스트 작성·실패 확인)까지** 진행하고 **Step 3(구현) 직전에 멈춤**.
미커밋 테스트가 `fetch_aster_funding`·`fetch_extended_funding`를 import하지만 두 함수는 아직 없음:

```
$ pytest tests/api/test_funding_rates.py
8 passed, 2 failed
  FAILED test_fetch_aster_funding_parses   - ImportError: cannot import name 'fetch_aster_funding'
  FAILED test_fetch_extended_funding_parses - ImportError: cannot import name 'fetch_extended_funding'
```

이는 TDD의 정상적인 "red" 상태 — 구현(Task 3 Step 3)을 넣으면 green이 된다.

## 재개 방법

1. 워크트리로 이동: `cd .worktrees/feat-funding-rates`
2. 계획서 **Task 3 Step 3**부터: `fetch_aster_funding`·`fetch_extended_funding` 구현 → 테스트 green
3. 이후 Task 4~13을 계획서 순서대로 (CEX fetcher → aggregator → route → scheduler → 프론트 → 문서)
4. `superpowers:executing-plans` 또는 `subagent-driven-development`로 태스크 단위 실행 권장

## 미해결(계획서 §9 open question)
- Lighter 정산 주기(1h 가정) 실측 검증 필요
- OKX `instId`: `CC-USDT-SWAP` 실패 시 `CC-USD-SWAP` 폴백 (Task 4에 폴백 로직 포함)
- Aster fetch interval 실측
→ Task 7 백엔드 smoke 로그에서 `funding-rates (N/7)` N=7 시간대 1회 관측으로 해소.
