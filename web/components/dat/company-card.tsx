"use client";

import type { DatCompany } from "@/lib/types";
import { fmtUsd, fmtCc, fmtPct, fmtLargeUsd } from "@/lib/format";
import MnavChart from "./mnav-chart";

const RISK_META: Record<
    string,
    { label: string; cls: string; mark: string }
> = {
    healthy: { label: "Healthy", cls: "up", mark: "●" },
    watch: { label: "Watch", cls: "burn", mark: "◐" },
    below_nav: { label: "Below NAV", cls: "down", mark: "▼" },
};

function fmtKrwEok(n: number | null): string {
    // 억원 단위 (1e8) 절대값. 부호는 호출부에서 ▲▼로 표기. null → "—".
    if (n == null) return "—";
    return `₩${(Math.abs(n) / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억`;
}

export default function CompanyCard({ c }: { c: DatCompany }) {
    const plPositive = (c.pl_usd ?? 0) >= 0;
    const plColor = plPositive ? "var(--canton-up)" : "var(--canton-down)";
    const plArrow = plPositive ? "▲" : "▼";
    const risk = c.risk ? RISK_META[c.risk] : null;

    return (
        <div className="ch-card">
            <div className="ch-card-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--zinc-50)" }}>
                        {c.ticker}
                    </span>
                    <span className="ch-chip muted ch-chip-xs">{c.exchange}</span>
                    {c.super_validator && (
                        <span className="ch-chip lime ch-chip-xs">SV</span>
                    )}
                </div>
                {risk && (
                    <span className={`ch-chip ${risk.cls}`}>
                        {risk.mark} {risk.label}
                    </span>
                )}
            </div>

            {/* Holdings */}
            <div style={{ marginBottom: 12 }}>
                <div className="ch-eyebrow">Holdings</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "var(--zinc-50)", fontVariantNumeric: "tabular-nums" }}>
                    {c.cc_holdings ? fmtCc(c.cc_holdings) : "—"}
                </div>
            </div>

            {/* Stat grid */}
            <div className="ch-bm-stats">
                <div className="ch-bm-stat">
                    <div className="k">Avg Buy</div>
                    <div className="v">{c.avg_buy_price ? fmtUsd(c.avg_buy_price) : "—"}</div>
                </div>
                <div className="ch-bm-stat">
                    <div className="k">CC Price</div>
                    <div className="v">{fmtUsd(c.cc_price)}</div>
                </div>
                <div className="ch-bm-stat">
                    <div className="k">Value</div>
                    <div className="v">{fmtLargeUsd(c.nav)}</div>
                </div>
            </div>

            {/* mNAV */}
            <div style={{ margin: "14px 0" }}>
                <div className="ch-eyebrow">{c.mnav_label ?? "mNAV"}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--canton-private)", fontVariantNumeric: "tabular-nums" }}>
                    {c.mnav != null ? `${c.mnav.toFixed(2)}x` : "—"}
                </div>
            </div>

            {/* P/L */}
            <div style={{ margin: "14px 0", paddingTop: 12, borderTop: "1px solid var(--canton-border)" }}>
                <div className="ch-eyebrow">Real-time P/L</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: plColor, fontVariantNumeric: "tabular-nums" }}>
                    {c.pl_usd != null ? `${plArrow} ${fmtLargeUsd(c.pl_usd)}` : "—"}
                    {c.pl_pct != null && (
                        <span style={{ fontSize: 13, marginLeft: 8 }}>{fmtPct(c.pl_pct)}</span>
                    )}
                </div>
                {c.pl_krw != null && (
                    <div style={{ fontSize: 12, color: "var(--zinc-500)", marginTop: 2 }}>
                        ≈ {plArrow} {fmtKrwEok(c.pl_krw)}
                    </div>
                )}
            </div>

            {/* mNAV history */}
            <MnavChart data={c.mnav_history} />
        </div>
    );
}
