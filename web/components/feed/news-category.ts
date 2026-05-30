// web/components/feed/news-category.ts
// 뉴스 유형 메타 (news_summarizer.CATEGORY_KEYS와 1:1)
export interface CategoryMeta {
  ko: string;
  en: string;
  className: string; // 배지 색상 (Tailwind 유틸, 하드코딩 hex 금지)
}

export const NEWS_CATEGORIES: Record<string, CategoryMeta> = {
  partnership:    { ko: "파트너십",   en: "Partnership",   className: "bg-canton-lime/10 text-canton-lime" },
  validator:      { ko: "밸리데이터", en: "Validator",     className: "bg-sky-500/10 text-sky-400" },
  etf_product:    { ko: "ETF·ETP",   en: "ETF / ETP",     className: "bg-violet-500/10 text-violet-400" },
  institutional:  { ko: "기관 채택",  en: "Institutional", className: "bg-amber-500/10 text-amber-400" },
  dat_vehicle:    { ko: "DAT·상장사", en: "Treasury",      className: "bg-orange-500/10 text-orange-400" },
  tokenomics:     { ko: "토크노믹스", en: "Tokenomics",    className: "bg-emerald-500/10 text-emerald-400" },
  funding:        { ko: "펀딩",       en: "Funding",       className: "bg-pink-500/10 text-pink-400" },
  network_metric: { ko: "네트워크",   en: "Network",       className: "bg-zinc-500/10 text-zinc-300" },
  other:          { ko: "기타",       en: "Other",         className: "bg-zinc-700/20 text-zinc-400" },
};

export function categoryLabel(key: string | undefined, lang: string): string {
  const meta = NEWS_CATEGORIES[key || "other"] || NEWS_CATEGORIES.other;
  return lang === "ko" ? meta.ko : meta.en;
}

export function categoryClass(key: string | undefined): string {
  return (NEWS_CATEGORIES[key || "other"] || NEWS_CATEGORIES.other).className;
}
