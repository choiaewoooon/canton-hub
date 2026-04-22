"use client";

import { useHolders } from "@/lib/api";

interface Row {
  name: string;
  sub: string;
  pct: number;
}

const FALLBACK: Row[] = [
  { name: "Digital Asset", sub: "DAML core · NYC", pct: 14.2 },
  { name: "Goldman Sachs", sub: "Institutional · LON", pct: 11.8 },
  { name: "Deutsche Börse", sub: "Clearing · FRA", pct: 9.4 },
  { name: "MPC Node Alpha", sub: "Foundation · ZRH", pct: 7.2 },
  { name: "Broadridge", sub: "Settlement · NYC", pct: 6.1 },
  { name: "Paxos", sub: "Regulated · NYC", pct: 5.4 },
];

export default function TopValidators() {
  const { data, isLoading } = useHolders();

  const svs = data?.holders?.filter((h) => h.category === "super_validator") ?? [];
  const totalSv = svs.reduce((s, h) => s + (h.total_balance || 0), 0);
  const rows: Row[] =
    svs.length > 0 && totalSv > 0
      ? svs
          .slice()
          .sort((a, b) => b.total_balance - a.total_balance)
          .slice(0, 6)
          .map((h) => ({
            name: h.organization || h.party_id.split("::")[0] || "Unknown",
            sub: h.party_id.split("::")[1]?.slice(0, 24) ?? "",
            pct: (h.total_balance / totalSv) * 100,
          }))
      : FALLBACK;
  const isFallback = rows === FALLBACK;

  return (
    <div className="ch-card ch-metric-card">
      <div className="head-row">
        <div>
          <div className="title">Top Super Validators</div>
          <div className="desc">
            {isFallback
              ? "거버넌스 투표권 기준. 42개 SV 중 상위 6개."
              : `잔액 기준 상위 6개 · 총 ${svs.length}개 SV`}
          </div>
        </div>
      </div>
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ch-skel" style={{ height: 32, marginBottom: 6 }} />
          ))
        : rows.map((v) => (
            <div key={v.name} className="ch-val-row">
              <div className="n">
                {v.name}
                {v.sub && <span className="sub">{v.sub}</span>}
              </div>
              <div className="bar">
                <span style={{ width: `${Math.min(v.pct, 100)}%` }} />
              </div>
              <div className="pct">{v.pct.toFixed(1)}%</div>
            </div>
          ))}
      {isFallback && !isLoading && (
        <div style={{ fontSize: 10, color: "var(--zinc-600)", marginTop: 8 }}>
          샘플 데이터 — 백엔드 holders 데이터 로딩 실패
        </div>
      )}
    </div>
  );
}
