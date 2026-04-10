"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useChart } from "@/lib/api";

const TABS = [
  { key: "price", label: "CC Price", color: "#c8e64a", dataKey: "close", xKey: "time", chartType: "area" as const },
  { key: "burn", label: "Burn Activity", color: "#fb923c", dataKey: "burn", xKey: "date", chartType: "bar" as const },
  { key: "bm-ratio", label: "B/M Ratio", color: "#a78bfa", dataKey: "ratio", xKey: "date", chartType: "area" as const },
] as const;

const PERIODS = ["24h", "7d", "1m", "3m"] as const;

export default function ChartArea() {
  const [activeTab, setActiveTab] = useState<string>("price");
  const [period, setPeriod] = useState<string>("7d");

  // 3개 차트 데이터 모두 fetch
  const { data: priceData } = useChart("price", period);
  const { data: burnData } = useChart("burn", period);
  const { data: bmRatioData } = useChart("bm-ratio", period);

  const dataMap: Record<string, unknown[]> = {
    price: priceData || [],
    burn: burnData || [],
    "bm-ratio": bmRatioData || [],
  };

  const activeConfig = TABS.find((t) => t.key === activeTab)!;
  const inactiveTabs = TABS.filter((t) => t.key !== activeTab);

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

      {/* Main chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeConfig.chartType === "bar" ? (
            <BarChart data={dataMap[activeTab] as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
              <Bar dataKey="burn" fill={activeConfig.color} fillOpacity={0.7} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={dataMap[activeTab] as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
              <XAxis dataKey={activeConfig.xKey} tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
              <defs>
                <linearGradient id={`grad-${activeTab}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeConfig.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={activeConfig.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={activeConfig.dataKey} stroke={activeConfig.color} strokeWidth={2} fill={`url(#grad-${activeTab})`} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Mini preview charts — 나머지 2개 */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {inactiveTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="bg-zinc-900/50 border border-canton-border rounded-lg p-3 text-left hover:border-zinc-700 transition cursor-pointer"
          >
            <div className="text-[11px] font-semibold mb-2" style={{ color: tab.color }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: tab.color }} />
              {tab.label}
            </div>
            <div className="h-[60px]">
              <ResponsiveContainer width="100%" height="100%">
                {tab.chartType === "bar" ? (
                  <BarChart data={(dataMap[tab.key] as Record<string, unknown>[]).slice(-7)}>
                    <Bar dataKey="burn" fill={tab.color} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={(dataMap[tab.key] as Record<string, unknown>[]).slice(-7)}>
                    <defs>
                      <linearGradient id={`mini-grad-${tab.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={tab.color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={tab.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey={tab.dataKey} stroke={tab.color} strokeWidth={1.5} fill={`url(#mini-grad-${tab.key})`} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
