"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useChart } from "@/lib/api";
import { fmtCc } from "@/lib/format";

interface Props {
  lang: string;
}

interface BurnPoint {
  date?: string;
  burn?: number;
  cumulative_burn?: number;
}

const fmtMillions = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

export default function BurnBreakdownCard({ lang }: Props) {
  const { data } = useChart("burn", "7d");
  const points: BurnPoint[] = (data as BurnPoint[]) || [];

  // 7일 통계
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const todayBurn = last?.burn ?? 0;
  const prevBurn = prev?.burn ?? 0;
  const dayChange = prevBurn > 0 ? ((todayBurn - prevBurn) / prevBurn) * 100 : 0;

  const validBurns = points.map((p) => p.burn ?? 0).filter((b) => b > 0);
  const avg7d = validBurns.length > 0 ? validBurns.reduce((a, b) => a + b, 0) / validBurns.length : 0;
  const vsAvg = avg7d > 0 ? ((todayBurn - avg7d) / avg7d) * 100 : 0;

  const maxIdx = points.reduce(
    (best, p, i) => ((p.burn ?? 0) > (points[best]?.burn ?? 0) ? i : best),
    0
  );

  const title = lang === "ko" ? "일일 소각 활동 (7일)" : "Daily Burn Activity (7d)";
  const subtitle =
    lang === "ko"
      ? "Canton의 일일 소각량 추이와 오늘의 변화"
      : "Daily burn trend and today's variance";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Chart */}
      <div className="h-[160px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 10, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtMillions}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v) => fmtCc(Number(v))}
            />
            <Bar dataKey="burn" radius={[4, 4, 0, 0]}>
              {points.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === points.length - 1 ? "#fb923c" : i === maxIdx ? "#f97316" : "#fb923c80"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3 Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "오늘" : "Today"}
          </div>
          <div className="text-[14px] font-bold text-canton-burn mt-0.5">{fmtCc(todayBurn)}</div>
        </div>
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "어제 대비" : "vs Yesterday"}
          </div>
          <div
            className={`text-[14px] font-bold mt-0.5 ${
              dayChange >= 0 ? "text-canton-up" : "text-canton-down"
            }`}
          >
            {dayChange >= 0 ? "+" : ""}
            {dayChange.toFixed(1)}%
          </div>
        </div>
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "7일 평균 대비" : "vs 7d Avg"}
          </div>
          <div
            className={`text-[14px] font-bold mt-0.5 ${
              vsAvg >= 0 ? "text-canton-up" : "text-canton-down"
            }`}
          >
            {vsAvg >= 0 ? "+" : ""}
            {vsAvg.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 Canton의 모든 소각은 트래픽 구매(네트워크 사용량)에서 발생합니다. CIP-0078 이후 일반 수수료 소각은 폐지되었으므로, 일일 소각량 = 실제 네트워크 활동량입니다."
            : "💡 All Canton burns come from traffic purchases (network usage). Since CIP-0078 removed fee burns, daily burn directly reflects real network activity."}
        </p>
      </div>
    </div>
  );
}
