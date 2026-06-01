"use client";

import type { DatCompany } from "@/lib/types";
import { fmtUsd, fmtCc, fmtPct, fmtLargeUsd } from "@/lib/format";
import MnavChart from "./mnav-chart";
import PriceChart from "./price-chart";

const T: Record<string, Record<string, string>> = {
    stockChart: { ko: "주가 vs $CC (6개월)", en: "Stock vs $CC (6M)", ja: "株価 vs $CC (6ヶ月)", zh: "股价 vs $CC (6个月)" },
    mnavChart: { ko: "mNAV 추이", en: "mNAV History", ja: "mNAV推移", zh: "mNAV走势" },
    pl: { ko: "실시간 평가손익", en: "Real-time P/L", ja: "リアルタイム損益", zh: "实时盈亏" },
};
const tr = (k: string, lang: string) => T[k]?.[lang] ?? T[k]?.en ?? k;

const RISK_META: Record<
    string,
    { label: string; cls: string; mark: string; color: string }
> = {
    healthy: { label: "Healthy", cls: "up", mark: "●", color: "var(--canton-up)" },
    watch: { label: "Watch", cls: "burn", mark: "◐", color: "var(--canton-burn)" },
    below_nav: { label: "Below NAV", cls: "down", mark: "▼", color: "var(--canton-down)" },
};

function fmtKrwEok(n: number | null): string {
    // 억원 단위 (1e8) 절대값. 부호는 호출부에서 ▲▼로 표기. null → "—".
    if (n == null) return "—";
    return `₩${(Math.abs(n) / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억`;
}

/** mNAV 게이지 — 0..2x 트랙, 1.0x 기준선, 리스크 색 포인터. */
function MnavGauge({ mnav, color }: { mnav: number | null; color: string }) {
    if (mnav == null) return null;
    const pos = Math.max(0, Math.min(2, mnav)) / 2 * 100; // 1.0x → 50%
    return (
        <div className="ch-mnav-gauge" aria-hidden>
            <div className="track" />
            <div className="ref" />
            <div className="ref-label">1.0x</div>
            <div className="pointer" style={{ left: `${pos}%`, background: color }} />
            <div className="axis"><span>0x</span><span>2x+</span></div>
        </div>
    );
}

export default function CompanyCard({ c, lang = "en" }: { c: DatCompany; lang?: string }) {
    const plPositive = (c.pl_usd ?? 0) >= 0;
    const plColor = plPositive ? "var(--canton-up)" : "var(--canton-down)";
    const plArrow = plPositive ? "▲" : "▼";
    const risk = c.risk ? RISK_META[c.risk] : null;
    const invested =
        c.avg_buy_price && c.cc_holdings ? c.avg_buy_price * c.cc_holdings : null;

    return (
        <div className="ch-card ch-dat-hero">
            {/* Header */}
            <div className="ch-dat-hero-head">
                <div className="ch-dat-hero-id">
                    <span className="tkr">{c.ticker}</span>
                    <span className="nm">{c.name}</span>
                    <span className="ch-chip muted ch-chip-xs">{c.exchange}</span>
                    {c.super_validator && <span className="ch-chip lime ch-chip-xs">SV</span>}
                </div>
                {risk && (
                    <span className={`ch-chip ${risk.cls}`}>
                        {risk.mark} {risk.label}
                    </span>
                )}
            </div>

            {/* 3-up: Holdings | mNAV | P/L */}
            <div className="ch-dat-grid">
                {/* Treasury */}
                <div className="ch-dat-cell">
                    <div className="ch-eyebrow">$CC Holdings</div>
                    <div className="big">{c.cc_holdings ? fmtCc(c.cc_holdings) : "—"}</div>
                    <div className="row-stats">
                        <div className="stat">
                            <span className="k">Avg Buy</span>
                            <span className="v">{c.avg_buy_price ? fmtUsd(c.avg_buy_price) : "—"}</span>
                        </div>
                        <div className="stat">
                            <span className="k">CC Price</span>
                            <span className="v">{fmtUsd(c.cc_price)}</span>
                        </div>
                        <div className="stat">
                            <span className="k">CC NAV</span>
                            <span className="v">{fmtLargeUsd(c.nav)}</span>
                        </div>
                    </div>
                </div>

                {/* mNAV + gauge */}
                <div className="ch-dat-cell">
                    <div className="ch-eyebrow">{c.mnav_label ?? "mNAV"}</div>
                    <div className="big private">{c.mnav != null ? `${c.mnav.toFixed(2)}x` : "—"}</div>
                    <MnavGauge mnav={c.mnav} color={risk?.color ?? "var(--canton-private)"} />
                </div>

                {/* P/L */}
                <div className="ch-dat-cell">
                    <div className="ch-eyebrow">{tr("pl", lang)}</div>
                    <div className="big" style={{ color: plColor }}>
                        {c.pl_usd != null ? `${plArrow} ${fmtLargeUsd(Math.abs(c.pl_usd))}` : "—"}
                    </div>
                    <div className="sub" style={{ fontSize: 12, color: "var(--zinc-500)" }}>
                        {c.pl_pct != null && <span style={{ color: plColor }}>{fmtPct(c.pl_pct)}</span>}
                        {c.pl_krw != null && <span> · ≈ {plArrow} {fmtKrwEok(c.pl_krw)}</span>}
                    </div>
                    <div className="row-stats">
                        <div className="stat">
                            <span className="k">Stock</span>
                            <span className="v">{fmtUsd(c.stock_price)}</span>
                        </div>
                        <div className="stat">
                            <span className="k">Market Cap</span>
                            <span className="v">{fmtLargeUsd(c.market_cap)}</span>
                        </div>
                        <div className="stat">
                            <span className="k">Invested</span>
                            <span className="v">{fmtLargeUsd(invested)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts: Stock Price (6M) + mNAV History, side by side */}
            <div className="ch-dat-charts">
                <div className="ch-dat-chart-row">
                    <div className="ch-card-title">{tr("stockChart", lang)}</div>
                    <PriceChart data={c.price_history} lang={lang} inception={c.dat_inception} />
                </div>
                <div className="ch-dat-chart-row">
                    <div className="ch-card-title">{tr("mnavChart", lang)}</div>
                    <MnavChart data={c.mnav_history} lang={lang} />
                </div>
            </div>
        </div>
    );
}
