"use client";

import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useChart } from "@/lib/api";
import type { ChartPoint } from "@/lib/types";

const TABS = [
  { key: "price", label: "CC Price", color: "#c8e64a" },
  { key: "burn", label: "Burn Activity", color: "#fb923c" },
  { key: "private-tx", label: "Private TX (Institutional)", color: "#a78bfa" },
] as const;

const PERIODS = ["24h", "7d", "1m", "3m"] as const;

export default function ChartArea() {
  const [activeTab, setActiveTab] = useState<string>("price");
  const [period, setPeriod] = useState<string>("7d");
  const { data: chartData } = useChart(activeTab, period);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4 mb-5">
      {/* Header: tabs + period filter */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-0 border-b border-canton-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs border-b-2 transition ${
                activeTab === tab.key
                  ? "border-current"
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
              }`}
              style={activeTab === tab.key ? { color: tab.color, borderColor: tab.color } : {}}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ backgroundColor: tab.color }}
              />
              {tab.label}
            </button>
          ))}
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

      {/* Subtitle for Private TX */}
      {activeTab === "private-tx" && (
        <p className="text-[11px] text-zinc-500 mb-2">Institutional Activity — 기관 사용자의 프라이빗 네트워크 활동 비율</p>
      )}

      {/* Chart */}
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "burn" ? (
            <BarChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Bar dataKey="burn" fill={currentTab.color} fillOpacity={0.7} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis
                dataKey={activeTab === "price" ? "time" : "date"}
                tick={{ fill: "#52525b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <defs>
                <linearGradient id={`grad-${activeTab}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentTab.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={currentTab.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey={activeTab === "price" ? "close" : "ratio"}
                stroke={currentTab.color}
                strokeWidth={2}
                fill={`url(#grad-${activeTab})`}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
