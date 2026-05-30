// web/components/analytics/funding-rate-matrix.i18n.ts
// 2-track i18n: ko = 한국어, en/ja/zh = 영어 fallback
export const TEXTS = {
  title:             { ko: "펀비 양빵 매트릭스",            en: "Funding Rate Arbitrage Matrix" },
  perpPerpTitle:     { ko: "🎯 Perp-Perp 양빵",             en: "🎯 Perp-Perp Arbitrage" },
  spotPerpTitle:     { ko: "🎯 현물-Perp 양빵",             en: "🎯 Spot-Perp Arbitrage" },
  longLabel:         { ko: "롱",                            en: "Long" },
  shortLabel:        { ko: "숏",                            en: "Short" },
  spotBuyLabel:      { ko: "현물 매수",                     en: "Spot Buy" },
  entrySpread:       { ko: "진입스프",                      en: "Entry spread" },
  basis:             { ko: "베이시스",                      en: "Basis" },
  orderbookDepth:    { ko: "호가창",                        en: "Order depth" },
  colExchange:       { ko: "거래소",                        en: "Exchange" },
  colFrRaw:          { ko: "FR(원시)",                      en: "FR (raw)" },
  colApr:            { ko: "APR",                           en: "APR" },
  colNextFunding:    { ko: "다음정산",                      en: "Next Funding" },
  colTrade:          { ko: "Trade ↗",                       en: "Trade ↗" },
  lastUpdated:       { ko: "마지막 업데이트",               en: "Last updated" },
  staleWarning:      { ko: "⚠ 데이터 갱신 지연",            en: "⚠ Data update delayed" },
  errorLoad:         { ko: "펀비 데이터 로드 실패",         en: "Failed to load funding rate data" },
  loading:           { ko: "데이터 수집 중...",             en: "Collecting data..." },
  noArbitrage:       { ko: "현재 양빵 적합 페어 없음 (모든 FR 음수)",
                       en: "No suitable arbitrage pair (all FR negative)" },
} as const;

export type TextKey = keyof typeof TEXTS;
export const makeT = (lang: string) =>
  (key: TextKey) => lang === "ko" ? TEXTS[key].ko : TEXTS[key].en;
