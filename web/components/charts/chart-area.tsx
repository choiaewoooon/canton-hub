"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useChart, useNetwork } from "@/lib/api";
import { fmtNum } from "@/lib/format";

type ChartType = "area" | "bar" | "versus";

interface TabConfig {
  key: string;
  label: string;
  color: string;
  dataKey: string;
  xKey: string;
  chartType: ChartType;
}

const TABS: TabConfig[] = [
  { key: "price", label: "CC Price", color: "#c8e64a", dataKey: "close", xKey: "time", chartType: "area" },
  { key: "burn", label: "Burn Activity", color: "#fb923c", dataKey: "burn", xKey: "date", chartType: "bar" },
  { key: "private-tx", label: "Private TX (Institutional)", color: "#a78bfa", dataKey: "ratio", xKey: "date", chartType: "versus" },
];

const PERIODS = ["24h", "7d", "1m", "3m"] as const;

export default function ChartArea() {
  const [activeTab, setActiveTab] = useState<string>("price");
  const [period, setPeriod] = useState<string>("7d");

  const { data: priceData } = useChart("price", period);
  const { data: burnData } = useChart("burn", period);
  const { data: networkData } = useNetwork();

  // Private TX 스냅샷 데이터
  const privatePct = networkData?.private_tx_ratio ?? 0;
  const publicPct = privatePct > 0 ? 100 - privatePct : 0;
  const privateCount = networkData?.private_tx_count ?? null;
  const publicCount =
    privateCount !== null && privatePct > 0
      ? Math.round((privateCount / privatePct) * publicPct)
      : null;
  const totalUpdates =
    privateCount !== null && publicCount !== null ? privateCount + publicCount : null;

  const dataMap: Record<string, unknown[]> = {
    price: priceData || [],
    burn: burnData || [],
    "private-tx": [],
  };

  const activeConfig = TABS.find((t) => t.key === activeTab)!;
  const inactiveTabs = TABS.filter((t) => t.key !== activeTab);

  const renderMainChart = () => {
    if (activeConfig.chartType === "bar") {
      return (
        <BarChart data={dataMap[activeTab] as Record<string, unknown>[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
          <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
              return v.toFixed(0);
            }}
          />
          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
          <Bar dataKey="burn" fill={activeConfig.color} fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      );
    }
    // area (default for price)
    return (
      <AreaChart data={dataMap[activeTab] as Record<string, unknown>[]}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
        <XAxis dataKey={activeConfig.xKey} tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[(dataMin: number) => dataMin * 0.995, (dataMax: number) => dataMax * 1.005]}
          tickFormatter={(v: number) => (v < 1 ? v.toFixed(4) : v.toFixed(2))}
        />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
        <defs>
          <linearGradient id={`grad-${activeTab}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeConfig.color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={activeConfig.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={activeConfig.dataKey} stroke={activeConfig.color} strokeWidth={2} fill={`url(#grad-${activeTab})`} />
      </AreaChart>
    );
  };

  const renderMiniChart = (tab: TabConfig) => {
    if (tab.chartType === "bar") {
      return (
        <BarChart data={(dataMap[tab.key] as Record<string, unknown>[]).slice(-7)}>
          <Bar dataKey="burn" fill={tab.color} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
        </BarChart>
      );
    }
    if (tab.chartType === "versus") {
      // 미니 프리뷰: 가로 bar 형태 + 중앙에 퍼센트
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          <div className="flex h-3 rounded overflow-hidden gap-[2px]">
            <div style={{ width: `${privatePct}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)" }} />
            <div style={{ width: `${publicPct}%`, background: "#27272a" }} />
          </div>
          <div className="flex justify-between text-[9px]">
            <span style={{ color: tab.color }}>Private {privatePct.toFixed(1)}%</span>
            <span className="text-zinc-600">Public {publicPct.toFixed(1)}%</span>
          </div>
        </div>
      );
    }
    return (
      <AreaChart data={(dataMap[tab.key] as Record<string, unknown>[]).slice(-7)}>
        <defs>
          <linearGradient id={`mini-grad-${tab.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tab.color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={tab.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={tab.dataKey} stroke={tab.color} strokeWidth={1.5} fill={`url(#mini-grad-${tab.key})`} />
      </AreaChart>
    );
  };

  const isPrivateTab = activeTab === "private-tx";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4 mb-5">
      {/* Header: tabs + period filter — mobile: tabs scroll, period toggle drops below */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4">
        <div className="flex gap-0 border-b border-canton-border overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs border-b-2 transition ${
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
        {!isPrivateTab && (
          <div className="flex gap-0.5 bg-zinc-900 rounded-md p-0.5 self-start sm:self-auto shrink-0">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[11px] px-3 py-1.5 rounded ${
                  period === p ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subtitle for Private TX */}
      {isPrivateTab && (
        <p className="text-[11px] text-zinc-500 mb-3">
          Institutional Activity — 기관 사용자의 프라이빗 네트워크 활동 비율 (24시간 기준)
        </p>
      )}

      {/* Main chart OR versus card */}
      {isPrivateTab ? (
        <div className="min-h-[200px] flex flex-col justify-center">
          {/* Horizontal versus bar */}
          <div className="flex h-10 rounded-md overflow-hidden gap-[2px] mb-4">
            <div
              className="flex items-center justify-center text-[13px] font-semibold text-white"
              style={{
                width: `${privatePct || 50}%`,
                background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
              }}
            >
              Private {privatePct.toFixed(1)}%
            </div>
            <div
              className="flex items-center justify-center text-[13px] font-semibold text-zinc-400"
              style={{
                width: `${publicPct || 50}%`,
                background: "linear-gradient(90deg, #27272a, #3f3f46)",
              }}
            >
              Public {publicPct.toFixed(1)}%
            </div>
          </div>

          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-zinc-900 rounded-md">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Private (Institutional)</div>
              <div className="text-[17px] font-bold text-canton-private mt-0.5">
                {fmtNum(privateCount)}
              </div>
            </div>
            <div className="text-center p-3 bg-zinc-900 rounded-md">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Public</div>
              <div className="text-[17px] font-bold text-zinc-400 mt-0.5">
                {fmtNum(publicCount)}
              </div>
            </div>
            <div className="text-center p-3 bg-zinc-900 rounded-md">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Total Updates</div>
              <div className="text-[17px] font-bold text-zinc-50 mt-0.5">
                {fmtNum(totalUpdates)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderMainChart()}
          </ResponsiveContainer>
        </div>
      )}

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
              {tab.key === "private-tx" && privatePct > 0 && (
                <span className="ml-2 text-zinc-500 font-normal">{privatePct.toFixed(1)}%</span>
              )}
            </div>
            <div className="h-[60px]">
              {tab.chartType === "versus" ? (
                renderMiniChart(tab)
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {renderMiniChart(tab)}
                </ResponsiveContainer>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
