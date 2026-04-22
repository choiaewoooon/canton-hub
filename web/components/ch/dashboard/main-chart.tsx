"use client";

import { useState } from "react";
import AreaChart from "../area-chart";
import { useChart } from "@/lib/api";
import { priceSeries, burnSeries, bmSeries, normalizePeriod } from "@/lib/chart-utils";
import { CH_DATA } from "@/lib/dummy-data";

type Tab = "price" | "burn" | "bm" | "priv";
type Period = "24H" | "7D" | "1M" | "3M";

const TABS: { key: Tab; label: string; color: string }[] = [
  { key: "price", label: "CC Price", color: "var(--canton-lime)" },
  { key: "burn", label: "Burn Activity", color: "var(--canton-burn)" },
  { key: "bm", label: "B/M Ratio", color: "var(--canton-lime)" },
  { key: "priv", label: "Private TX", color: "var(--canton-private)" },
];

const PERIODS: Period[] = ["24H", "7D", "1M", "3M"];

export default function MainChart() {
  const [tab, setTab] = useState<Tab>("price");
  const [period, setPeriod] = useState<Period>("7D");
  const p = normalizePeriod(period);

  // Fetch all three supported series once; tab switch is instant from cache.
  const { data: priceData, isLoading: priceLoading } = useChart("price", p);
  const { data: burnData, isLoading: burnLoading } = useChart("burn", p);
  const { data: bmData, isLoading: bmLoading } = useChart("bm-ratio", p);

  let series: number[];
  let color = "var(--canton-lime)";
  let barMode = false;
  let refLine: number | null = null;
  let loading = false;
  let isFallback = false;

  if (tab === "price") {
    const real = priceSeries(priceData);
    series = real.length > 0 ? real : CH_DATA.priceSeries;
    isFallback = real.length === 0;
    color = "var(--canton-lime)";
    loading = priceLoading;
  } else if (tab === "burn") {
    const real = burnSeries(burnData);
    series = real.length > 0 ? real : CH_DATA.burnSeries;
    isFallback = real.length === 0;
    color = "var(--canton-burn)";
    barMode = true;
    loading = burnLoading;
  } else if (tab === "bm") {
    const real = bmSeries(bmData);
    series = real.length > 0 ? real : CH_DATA.bmSeries;
    isFallback = real.length === 0;
    color = "var(--canton-lime)";
    refLine = 1.0;
    loading = bmLoading;
  } else {
    // No private-tx timeseries endpoint — use dummy.
    series = CH_DATA.privateSeries;
    isFallback = true;
    color = "var(--canton-private)";
    refLine = 50;
  }

  return (
    <div className="ch-card ch-chart-card">
      <div className="ch-chart-head">
        <div className="ch-tabs-pill" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`ch-tab-pill${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span className="pip" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="ch-seg" role="radiogroup" aria-label="Period">
          {PERIODS.map((pp) => (
            <button
              key={pp}
              role="radio"
              aria-checked={period === pp}
              className={period === pp ? "active" : ""}
              onClick={() => setPeriod(pp)}
            >
              {pp}
            </button>
          ))}
        </div>
      </div>
      <div className="ch-chart-main">
        {loading ? (
          <div className="ch-skel" style={{ height: 280 }} />
        ) : (
          <AreaChart
            data={series}
            color={color}
            height={280}
            showAxes
            refLine={refLine}
            barMode={barMode}
          />
        )}
        {isFallback && !loading && (
          <div style={{ fontSize: 10, color: "var(--zinc-600)", marginTop: 4, textAlign: "right" }}>
            {tab === "priv" ? "샘플 데이터 (엔드포인트 없음)" : "샘플 데이터 폴백"}
          </div>
        )}
      </div>
    </div>
  );
}
