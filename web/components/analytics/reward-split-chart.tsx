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
  Legend,
} from "recharts";
import { useRewardSplit } from "@/lib/api";

const PERIODS = ["7d", "1m", "3m"] as const;

interface Props {
  lang: string;
}

const fmtMillions = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

export default function RewardSplitChart({ lang }: Props) {
  const [period, setPeriod] = useState<string>("1m");
  const { data } = useRewardSplit(period);

  const title = lang === "ko" ? "보상 분배 추이" : "Reward Distribution Over Time";
  const subtitle =
    lang === "ko"
      ? "App 개발자 / Validator / Super Validator 일일 보상 (단위: CC)"
      : "Daily rewards split between Apps / Validators / Super Validators (CC)";

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
          <AreaChart data={data || []}>
            <defs>
              <linearGradient id="grad-app" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8e64a" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#c8e64a" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="grad-val" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="grad-sv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtMillions}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(value) => fmtMillions(Number(value)) + " CC"}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              formatter={(v) => <span style={{ color: "#a1a1aa" }}>{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="app"
              stackId="1"
              stroke="#c8e64a"
              strokeWidth={2}
              fill="url(#grad-app)"
              name={lang === "ko" ? "App 보상" : "App Rewards"}
            />
            <Area
              type="monotone"
              dataKey="validator"
              stackId="1"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#grad-val)"
              name={lang === "ko" ? "Validator 보상" : "Validator Rewards"}
            />
            <Area
              type="monotone"
              dataKey="super_validator"
              stackId="1"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#grad-sv)"
              name={lang === "ko" ? "Super Validator 보상" : "Super Validator Rewards"}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 Canton은 2029년까지 점진적으로 App 보상 비율을 높여가고 있습니다 (현재 ~62%). 이는 생태계의 앱 개발자에게 가장 많은 인센티브가 가도록 설계되어 있다는 의미입니다."
            : "💡 Canton is gradually increasing the App reward share toward ~62% by 2029, prioritizing app developers as the ecosystem's primary value creators."}
        </p>
      </div>
    </div>
  );
}
