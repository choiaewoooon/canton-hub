"use client";

import { useState } from "react";
import AreaChart from "../area-chart";
import { useChart } from "@/lib/api";
import { bmSeries, normalizePeriod } from "@/lib/chart-utils";
import { CH_DATA } from "@/lib/dummy-data";
import { fmtCc } from "@/lib/format";
import type { NetworkData } from "@/lib/types";

type Period = "7D" | "1M" | "3M";
const PERIODS: Period[] = ["7D", "1M", "3M"];

interface Props {
  network: NetworkData | undefined;
}

export default function BmRow({ network }: Props) {
  const [period, setPeriod] = useState<Period>("1M");
  const { data, isLoading } = useChart("bm-ratio", normalizePeriod(period));
  const real = bmSeries(data);
  const series = real.length > 0 ? real : CH_DATA.bmSeries;

  const mint = network?.daily_mint ?? CH_DATA.dailyMint;
  const burn = network?.daily_burn ?? CH_DATA.dailyBurn;
  const total = mint + burn;
  const mintPct = total > 0 ? (mint / total) * 100 : 43;
  const burnPct = total > 0 ? (burn / total) * 100 : 57;
  const net = mint - burn;

  return (
    <div className="ch-bm-row">
      <div className="ch-card">
        <div className="ch-card-head">
          <span className="ch-card-title">B/M Ratio Trend</span>
          <div className="ch-seg" role="radiogroup" aria-label="B/M 기간">
            {PERIODS.map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={period === p}
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="ch-skel" style={{ height: 140 }} />
        ) : (
          <AreaChart data={series} color="var(--canton-lime)" height={140} showAxes refLine={1.0} />
        )}
        <div className="ch-card-sub" style={{ textAlign: "center", marginTop: "8px" }}>
          Above 1.0x = Deflationary · Below = Inflationary
        </div>
      </div>

      <div className="ch-card">
        <div className="ch-card-head">
          <span className="ch-card-title">Today&apos;s Mint vs Burn</span>
        </div>
        <div className="ch-stat-bar-wrap">
          <div className="ch-stat-bar mint" style={{ width: `${mintPct}%` }}>
            Mint {mintPct.toFixed(0)}%
          </div>
          <div className="ch-stat-bar burn" style={{ width: `${burnPct}%` }}>
            Burn {burnPct.toFixed(0)}%
          </div>
        </div>
        <div className="ch-bm-stats">
          <div className="ch-bm-stat">
            <div className="k">Minted</div>
            <div className="v mint">{fmtCc(mint)}</div>
          </div>
          <div className="ch-bm-stat">
            <div className="k">Burned</div>
            <div className="v burn">{fmtCc(burn)}</div>
          </div>
          <div className="ch-bm-stat">
            <div className="k">Net</div>
            <div className="v up">
              {net < 0 ? "−" : "+"}
              {fmtCc(Math.abs(net))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
