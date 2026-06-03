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
