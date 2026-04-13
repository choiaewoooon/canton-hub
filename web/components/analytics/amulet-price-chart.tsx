"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAmuletPrice } from "@/lib/api";

const PERIODS = ["7d", "1m", "3m"] as const;

interface Props {
  lang: string;
}

export default function AmuletPriceChart({ lang }: Props) {
  const [period, setPeriod] = useState<string>("1m");
  const { data } = useAmuletPrice(period);

  const title = lang === "ko" ? "Amulet 가격 추이" : "Amulet Price Trend";
  const subtitle =
    lang === "ko"
      ? "Canton 내부 환산율 — 트랜잭션 수수료 계산용 (CC 시장가와 별개)"
      : "Internal exchange rate used for transaction fees (separate from CC market price)";

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

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []}>
            <defs>
              <linearGradient id="grad-amulet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(4)}`}
              domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v) => `$${Number(v).toFixed(6)}`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#grad-amulet)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
