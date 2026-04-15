"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { useChart } from "@/lib/api";
import { fmtCc } from "@/lib/format";
import type { NetworkData } from "@/lib/types";

const PERIODS = ["7d", "1m", "3m"] as const;

interface BmSectionProps {
  network: NetworkData | undefined;
}

export default function BmSection({ network }: BmSectionProps) {
  const [period, setPeriod] = useState<string>("1m");
  const { data: bmData } = useChart("bm-ratio", period);

  const mint = network?.daily_mint;
  const burn = network?.daily_burn;
  const total = (mint || 0) + (burn || 0);
  const mintPct = total > 0 ? Math.round(((mint || 0) / total) * 100) : 50;
  const burnPct = 100 - mintPct;
  const netChange = (mint || 0) - (burn || 0);

  return (
    <div className="grid grid-cols-[2fr_1fr] gap-3 mb-5">
      {/* Left: B/M Ratio Trend */}
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[13px] font-semibold text-zinc-400">B/M Ratio Trend</span>
          <div className="flex gap-0.5 bg-zinc-900 rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[11px] px-2 py-1 rounded ${period === p ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"}`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bmData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--canton-border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--zinc-500)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "var(--zinc-500)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[(dataMin: number) => Math.min(dataMin * 0.9, 0.95), (dataMax: number) => Math.max(dataMax * 1.1, 1.05)]}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: "var(--canton-card)", border: "1px solid var(--canton-border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
                labelStyle={{ color: "var(--zinc-400)" }}
              />
              <ReferenceLine y={1} stroke="var(--canton-lime)" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "1.0x", position: "right", fill: "var(--canton-lime)", fontSize: 9, opacity: 0.6 }} />
              <defs>
                <linearGradient id="grad-bm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--canton-lime)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--canton-lime)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="ratio" stroke="var(--canton-lime)" strokeWidth={2} fill="url(#grad-bm)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-[10px] text-zinc-600 mt-1">Above 1.0x = Deflationary / Below = Inflationary</div>
      </div>

      {/* Right: Today's Mint vs Burn */}
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
        <span className="text-[13px] font-semibold text-zinc-400">Today&apos;s Mint vs Burn</span>
        {/* Horizontal bar */}
        <div className="flex h-8 rounded-md overflow-hidden gap-0.5 mt-3">
          <div className="flex items-center justify-center text-[11px] font-semibold text-white" style={{ width: `${mintPct}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }}>
            Mint {mintPct}%
          </div>
          <div className="flex items-center justify-center text-[11px] font-semibold text-white" style={{ width: `${burnPct}%`, background: "linear-gradient(90deg, #f97316, #fb923c)" }}>
            Burn {burnPct}%
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center p-2.5 bg-zinc-900 rounded-md">
            <div className="text-[10px] text-zinc-600 uppercase">Minted</div>
            <div className="text-[15px] font-bold text-canton-mint mt-0.5">{fmtCc(mint ?? null)}</div>
          </div>
          <div className="text-center p-2.5 bg-zinc-900 rounded-md">
            <div className="text-[10px] text-zinc-600 uppercase">Burned</div>
            <div className="text-[15px] font-bold text-canton-burn mt-0.5">{fmtCc(burn ?? null)}</div>
          </div>
          <div className="text-center p-2.5 bg-zinc-900 rounded-md">
            <div className="text-[10px] text-zinc-600 uppercase">Net Supply</div>
            <div className={`text-[15px] font-bold mt-0.5 ${netChange > 0 ? "text-canton-down" : "text-canton-up"}`}>
              {netChange > 0 ? "+" : ""}{fmtCc(netChange)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
