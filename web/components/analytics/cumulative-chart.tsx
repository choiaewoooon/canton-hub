"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useCumulative } from "@/lib/api";

const PERIODS = ["7d", "1m", "3m"] as const;

interface Props {
  lang: string;
}

const fmtBillions = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  return v.toFixed(0);
};

export default function CumulativeChart({ lang }: Props) {
  const [period, setPeriod] = useState<string>("3m");
  const { data } = useCumulative(period);

  const title = lang === "ko" ? "누적 발행/소각/공급량" : "Cumulative Mint / Burn / Supply";
  const subtitle =
    lang === "ko"
      ? "Canton의 burn-mint 균형이 시간에 따라 어떻게 변하는지"
      : "How Canton's burn-mint equilibrium evolves over time";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex gap-0.5 bg-zinc-900 rounded-md p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[11px] px-2 py-1 rounded ${
                period === p ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtBillions}
              domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v) => fmtBillions(Number(v)) + " CC"}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="line"
              formatter={(v) => <span style={{ color: "#a1a1aa" }}>{v}</span>}
            />
            <Line
              type="monotone"
              dataKey="cumulative_mint"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              name={lang === "ko" ? "누적 발행" : "Cumulative Mint"}
            />
            <Line
              type="monotone"
              dataKey="cumulative_supply"
              stroke="#c8e64a"
              strokeWidth={2}
              dot={false}
              name={lang === "ko" ? "유통 공급량" : "Circulating Supply"}
            />
            <Line
              type="monotone"
              dataKey="cumulative_burn"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              name={lang === "ko" ? "누적 소각" : "Cumulative Burn"}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 누적 발행이 누적 공급량보다 위에 있으면 그 차이가 소각된 양입니다. 누적 소각 곡선이 가팔라질수록 디플레이션 압력이 강해집니다."
            : "💡 The gap between cumulative mint and circulating supply is the burned amount. A steeper burn curve means stronger deflationary pressure."}
        </p>
      </div>
    </div>
  );
}
