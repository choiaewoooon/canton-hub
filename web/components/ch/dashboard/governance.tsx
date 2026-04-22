"use client";

import { useGovernance } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  protocol: "var(--canton-mint)",
  economic: "var(--canton-lime)",
  governance: "var(--canton-private)",
  technical: "var(--canton-burn)",
};

const FALLBACK_HIST = [
  { key: "protocol", name: "프로토콜", count: 18, color: "var(--canton-mint)" },
  { key: "economic", name: "경제", count: 13, color: "var(--canton-lime)" },
  { key: "governance", name: "거버넌스", count: 9, color: "var(--canton-private)" },
  { key: "technical", name: "기술", count: 7, color: "var(--canton-burn)" },
];

const FALLBACK_CIPS = [
  {
    number: "CIP-47",
    category: "프로토콜",
    categoryColor: "var(--canton-mint)",
    status: "Proposed",
    statusColor: "#facc15",
    title: "블록 프로듀서 보상 곡선 개편 — 장기 스테이킹 가중치 강화",
    impact: "연간 발행량 약 8% 감소 예상, 장기 참여자 수익 +15%",
  },
  {
    number: "CIP-46",
    category: "경제",
    categoryColor: "var(--canton-lime)",
    status: "Approved",
    statusColor: "var(--canton-up)",
    title: "수수료 번 비율을 거래량 기반 다이나믹 구조로 전환",
    impact: "고거래량 구간 번 비율 2배, B/M 비율 안정화",
  },
];

export default function GovernanceCard({ lang }: { lang: string }) {
  const { data: gov } = useGovernance();
  const active = gov?.active_proposals ?? 3;
  const passed = gov?.total_final ?? 47;

  const total = FALLBACK_HIST.reduce((s, h) => s + h.count, 0);
  const histEntries = gov?.history_stats
    ? Object.entries(gov.history_stats).map(([key, s]) => ({
        key,
        name: lang === "ko" ? s.name_ko : s.name_en,
        count: s.count,
        color: s.color || CATEGORY_COLORS[key] || "var(--canton-lime)",
      }))
    : FALLBACK_HIST;
  const histTotal = histEntries.reduce((s, h) => s + h.count, 0) || total;

  const cips =
    gov?.recent_cips?.slice(0, 2).map((c) => ({
      number: c.number,
      category: lang === "ko" ? c.category_ko : c.category_en,
      categoryColor: c.category_color || "var(--canton-lime)",
      status: c.status,
      statusColor:
        c.status.toLowerCase() === "approved"
          ? "var(--canton-up)"
          : c.status.toLowerCase() === "proposed"
            ? "#facc15"
            : "var(--zinc-400)",
      title: c.title,
      impact: lang === "ko" ? c.impact_ko : c.impact_en,
    })) ?? FALLBACK_CIPS;

  return (
    <div className="ch-card">
      <div className="ch-gov-head">
        <span className="ch-card-title">거버넌스</span>
        <span className="ch-gov-meta">
          진행: <span className="active">{active}</span>
          <span className="sep">·</span>
          통과: <span className="passed">{passed}</span>
        </span>
      </div>

      <div className="ch-eyebrow" style={{ marginBottom: "8px", fontSize: "9.5px" }}>
        통과된 유형
      </div>
      {histEntries.map((h) => {
        const pct = histTotal > 0 ? (h.count / histTotal) * 100 : 0;
        return (
          <div key={h.key} className="ch-hist-row">
            <span className="name">
              <span className="pip" style={{ background: h.color }} />
              {h.name}
            </span>
            <span className="bar">
              <span style={{ width: `${pct}%`, background: h.color }} />
            </span>
            <span className="count">{h.count}</span>
          </div>
        );
      })}

      <div
        className="ch-eyebrow"
        style={{ marginTop: "12px", marginBottom: "8px", fontSize: "9.5px" }}
      >
        최근 제안
      </div>
      {cips.map((c) => (
        <div key={c.number} className="ch-cip">
          <div className="ch-cip-badges">
            <span className="ch-chip lime ch-chip-xs" style={{ fontWeight: 700 }}>
              {c.number}
            </span>
            <span
              className="ch-chip ch-chip-xs"
              style={{
                color: c.categoryColor,
                background: `color-mix(in oklab, ${c.categoryColor} 12%, transparent)`,
              }}
            >
              {c.category}
            </span>
            <span
              className="ch-chip ch-chip-xs"
              style={{
                color: c.statusColor,
                background: `color-mix(in oklab, ${c.statusColor} 12%, transparent)`,
              }}
            >
              {c.status}
            </span>
          </div>
          <div className="ch-cip-title">{c.title}</div>
          <div className="ch-cip-impact">{c.impact}</div>
        </div>
      ))}
    </div>
  );
}
