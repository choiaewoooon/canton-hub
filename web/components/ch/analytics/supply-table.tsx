"use client";

import { useCumulative } from "@/lib/api";
import type { CumulativePoint } from "@/lib/types";

interface Row {
  date: string;
  minted: string;
  burned: string;
  net: string;
  bm?: string;
  privPct?: string;
  activeAddr?: string;
  netColor: string;
}

const FALLBACK: Row[] = [
  { date: "Jan 28", minted: "3,820,000", burned: "4,910,000", net: "−1,090,000", bm: "1.285x", privPct: "67.4%", activeAddr: "24,318", netColor: "var(--canton-up)" },
  { date: "Jan 27", minted: "3,760,000", burned: "4,620,000", net: "−860,000", bm: "1.229x", privPct: "66.1%", activeAddr: "23,102", netColor: "var(--canton-up)" },
  { date: "Jan 26", minted: "3,910,000", burned: "4,780,000", net: "−870,000", bm: "1.222x", privPct: "65.3%", activeAddr: "22,815", netColor: "var(--canton-up)" },
  { date: "Jan 25", minted: "3,850,000", burned: "4,510,000", net: "−660,000", bm: "1.171x", privPct: "64.9%", activeAddr: "21,994", netColor: "var(--canton-up)" },
  { date: "Jan 24", minted: "3,770,000", burned: "4,820,000", net: "−1,050,000", bm: "1.278x", privPct: "66.7%", activeAddr: "23,421", netColor: "var(--canton-up)" },
  { date: "Jan 23", minted: "3,680,000", burned: "4,390,000", net: "−710,000", bm: "1.193x", privPct: "63.8%", activeAddr: "20,876", netColor: "var(--canton-up)" },
  { date: "Jan 22", minted: "3,610,000", burned: "3,980,000", net: "−370,000", bm: "1.102x", privPct: "62.1%", activeAddr: "19,540", netColor: "var(--canton-up)" },
];

function fmtCcLocale(n: number): string {
  return Math.round(n).toLocaleString();
}

function deriveRows(points: CumulativePoint[]): Row[] {
  // Reverse chronological, diff against previous day for daily mint/burn
  const sorted = [...points].sort((a, b) => (a.date > b.date ? 1 : -1));
  const rows: Row[] = [];
  for (let i = sorted.length - 1; i > 0 && rows.length < 7; i--) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    const minted = cur.cumulative_mint - prev.cumulative_mint;
    const burned = cur.cumulative_burn - prev.cumulative_burn;
    const net = minted - burned;
    const bm = minted > 0 ? burned / minted : 0;
    rows.push({
      date: cur.date,
      minted: fmtCcLocale(minted),
      burned: fmtCcLocale(burned),
      net: (net < 0 ? "−" : "+") + fmtCcLocale(Math.abs(net)),
      bm: bm > 0 ? `${bm.toFixed(3)}x` : "—",
      netColor: net < 0 ? "var(--canton-up)" : "var(--canton-down)",
    });
  }
  return rows;
}

export default function SupplyTable() {
  const { data, isLoading } = useCumulative("7d");
  const real = data && data.length > 1 ? deriveRows(data) : [];
  const rows = real.length > 0 ? real : FALLBACK;
  const isFallback = real.length === 0;

  return (
    <div className="ch-card ch-metric-card">
      <div className="head-row">
        <div>
          <div className="title">공급 및 번 내역 (최근 7일)</div>
          <div className="desc">일별 Mint, Burn, 순변화, 누적 공급량.</div>
        </div>
      </div>
      {isLoading ? (
        <div className="ch-skel" style={{ height: 240, marginTop: 12 }} />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
        <table className="ch-data-table min-w-[480px]">
          <thead>
            <tr>
              <th>Date (UTC)</th>
              <th>Minted (CC)</th>
              <th>Burned (CC)</th>
              <th>Net</th>
              <th>B/M</th>
              {rows === FALLBACK && <th>Private TX%</th>}
              {rows === FALLBACK && <th>Active Addr</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bmVal = parseFloat(r.bm ?? "0");
              const bmColor = bmVal > 1 ? "var(--canton-lime)" : "var(--canton-down)";
              return (
                <tr key={r.date}>
                  <td className="name">
                    <span className="dot" style={{ background: "var(--canton-lime)" }} />
                    {r.date}
                  </td>
                  <td>{r.minted}</td>
                  <td>{r.burned}</td>
                  <td style={{ color: r.netColor }}>{r.net}</td>
                  <td style={{ color: bmColor }}>{r.bm ?? "—"}</td>
                  {rows === FALLBACK && (
                    <td style={{ color: "var(--canton-private)" }}>{r.privPct}</td>
                  )}
                  {rows === FALLBACK && <td>{r.activeAddr}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
      {isFallback && !isLoading && (
        <div style={{ fontSize: 10, color: "var(--zinc-600)", marginTop: 8 }}>
          샘플 데이터 — cumulative 엔드포인트 응답 없음
        </div>
      )}
    </div>
  );
}
