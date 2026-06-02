# 펀비 양빵 매트릭스 — Net APR (체결 스프레드 차감) 설계

- 작성일: 2026-06-03
- 상태: 승인됨 (브레인스토밍 완료)
- 관련 설계: [2026-05-15-funding-rates-design.md](./2026-05-15-funding-rates-design.md)
- 브랜치: `feat/funding-net-apr` (main 기준)
- 트리거: X(@co_cobling) 댓글 — *"a column for avg execution spread per pair would make this even more useful, since that's what usually kills the theoretical return."*

## 1. 배경 / 문제

현재 펀비 양빵 매트릭스(`web/components/analytics/funding-rate-matrix.tsx`)는 **gross 펀딩 APR**로
거래소를 줄 세우고, 최고FR(숏) × 최저FR(롱) 페어를 추천한다. 하지만 양빵의 실수익은
**진입·청산 시 무는 체결 스프레드**에 크게 깎인다. "이론상 APR 30%"가 스프레드 왕복으로
실제 5%가 되거나 마이너스가 될 수 있다. 기존 설계문서는 이 net APR 표시를 "수수료가
거래소·등급별로 달라 misleading"이라며 의도적으로 보류했고, 사용자 수요 확인 후 결정하기로 했다.
이번 댓글이 그 수요 신호다.

## 2. 결정 사항 (브레인스토밍 확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| 정렬 기준 | **net APR** | 문제를 실제로 해결 (gross 순위의 함정 제거) |
| 비용 구성 | **bid-ask 스프레드만** (수수료·슬리피지 제외) | 객관적·증명가능 데이터(coingecko `spread_pct`)만. 수수료는 등급별로 달라 misleading |
| 보유기간 처리 | **손익분기일 중심** + 기본 보유일(7일) net APR로 정렬 | 자의적 가정 최소화. 손익분기일은 가정 불필요한 정직한 지표 |
| 데이터 | 신규 수집기 0 | `coingecko_scraper`가 이미 `spread_pct` 수집 중, `_DEPTH_SOURCE_MAP`로 join |

## 3. 계산식

페어 = 숏(S) + 롱(L). 각 거래소 bid-ask 스프레드 `spread_S`, `spread_L` (%, coingecko `spread_pct`):

- **왕복 체결비용%** = `spread_S + spread_L`
  (개시+청산에서 다리당 스프레드를 1회씩 ≈ 다리당 풀스프레드. 보수적 근사)
- **gross 페어 APR** = `short.fr_apr − long.fr_apr` (기존 로직 그대로)
- **net APR** = `gross_APR − (spread_S + spread_L) × (365 / H)`, 기본 `H = HOLD_DAYS_DEFAULT = 7`
- **손익분기일** = `(spread_S + spread_L) / gross_APR × 365`
  (며칠 이상 보유하면 스프레드 회수. `gross_APR > 0`일 때만 유효. 낮을수록 좋음)

**페어 선택 변경**: 기존 "gross 최대 페어" → **net APR 최대 페어 추천**. 7개 거래소 전 조합
평가(O(n²), trivial). 스프레드 데이터가 양쪽 다 있는 페어만 후보.

`HOLD_DAYS_DEFAULT = 7`은 상수로 분리(튜닝 가능). 향후 사용자 슬라이더 확장 여지.

## 4. 백엔드 변경 (`api/routes/analytics.py`)

- `_enrich_with_depth`와 동일하게 `_DEPTH_SOURCE_MAP` + `analytics:exchanges` 캐시를 사용해
  각 funding rate row에 `spread_pct`를 join하는 헬퍼 추가(또는 기존 헬퍼 확장).
- `/api/analytics/funding-rates` 라우트가 enriched rate 반환.
- 응답의 각 rate에 `spread_pct: float | None` 필드 추가 (매칭 실패 시 None).
- 수집기·스케줄러 무변경.

## 5. 프론트 변경

- `web/lib/types.ts`: `FundingRate`에 `spread_pct?: number` 추가 (백엔드와 같은 PR — 크로스컷 프로토콜).
- `web/components/analytics/funding-rate-matrix.tsx`:
  - 순수함수 분리(테스트 대상):
    - `netApr(grossApr, spreadSum, holdDays)`
    - `breakevenDays(grossApr, spreadSum)`
  - `computePairs`: **perp-perp 페어**에 net 최대 선택 + net/손익분기 계산. spot-perp는 기존 베이시스 표시 유지(현물 다리 스프레드가 펀딩 페이로드에 없어 net 비적용 — §8 참조).
  - **펀딩 테이블에 "스프레드" 칼럼** 추가 (거래소별 bid-ask %, 없으면 "—").
  - **추천 카드**: 기존 entry_spread 영역을 왕복비용 → net APR → 손익분기일 표시로 정리.
  - i18n: `netApr`, `spread`, `breakevenDays`, `holdAssumption` 등 ko/en/ja/zh 키 추가.
- `web/components/analytics/funding-rate-matrix.i18n.ts` 키 확장.

## 6. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 거래소 스프레드 누락 (특히 DEX) | 테이블 스프레드 "—". 한쪽이라도 누락된 페어는 **net 정렬/추천에서 제외**, gross는 표시 |
| `gross_APR ≤ 0` | 손익분기 무한대, 추천 안 함 (기존 allNegative 처리 유지) |
| 전 페어 스프레드 누락 | 오늘과 동일하게 gross로 동작 + "net 데이터 없음" 안내 |
| 스프레드 0 또는 음수(데이터 이상) | 0으로 클램프 후 비용 0 취급 |

## 7. 테스트 / 검증

- **백엔드**: spread join(소스 매핑 정확성) + 라우트 응답에 `spread_pct` 포함 단위테스트
  (`tests/api/test_funding_rates.py` 확장).
- **프론트**: `netApr` / `breakevenDays` 순수함수 단위테스트(경계값 — gross≤0, 스프레드 누락, H 변화).
- **구현 중 검증**: `curl`로 `analytics:exchanges` 캐시가 7개 펀딩 거래소(특히 Lighter/Extended/Aster
  DEX) 중 실제 몇 개에 `spread_pct`를 주는지 확인 → 커버리지에 따라 "net 제외" 안내 문구 조정.
- **완료 게이트**(canton-hub §5): `curl .../api/analytics/funding-rates`로 `spread_pct` 응답 확인,
  `npx tsc --noEmit` + `npm run build`, 브라우저 4개 언어 + 다크/라이트 smoke.

## 8. 범위 밖 (YAGNI / 향후)

- 수수료·슬리피지 비용 모델 (이번엔 스프레드만)
- 사용자 입력 토글(수수료율·자본규모 → 개인 실손익)
- 보유기간 슬라이더 (상수 분리로 확장 여지만 남김)
- **spot-perp net APR** — 현물 다리 bid-ask 스프레드는 펀딩 페이로드에 없어 별도 exchanges spot join 필요. 이번엔 perp-perp만 net 적용, spot-perp는 베이시스 유지

## 9. 영향 파일 (예상)

- `api/routes/analytics.py` (백엔드 join + 라우트)
- `web/lib/types.ts` (타입)
- `web/components/analytics/funding-rate-matrix.tsx` (계산 + UI)
- `web/components/analytics/funding-rate-matrix.i18n.ts` (i18n)
- `tests/api/test_funding_rates.py` (백엔드 테스트) + 프론트 순수함수 테스트
