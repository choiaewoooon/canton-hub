"use client";

import { fmtUsd, fmtLargeUsd, fmtPct } from "@/lib/format";
import type { PriceData } from "@/lib/types";

interface HeroPriceProps {
  data: PriceData | undefined;
}

export default function HeroPrice({ data }: HeroPriceProps) {
  const price = data?.current_price_usd;
  const pct = data?.price_change_percentage_24h;
  const isUp = (pct ?? 0) >= 0;

  return (
    <div className="p-4 sm:p-5 bg-canton-card border border-canton-border rounded-xl mb-5">
      {/* Top row — price always visible, stats flow below on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5 gap-3">
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <span className="text-sm text-zinc-500 font-semibold">$CC</span>
          <span className="text-3xl sm:text-4xl font-extrabold text-zinc-50 tracking-tight">
            {fmtUsd(price ?? null)}
          </span>
          {pct !== null && pct !== undefined && (
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded ${
                isUp
                  ? "text-canton-up bg-canton-up/10"
                  : "text-canton-down bg-canton-down/10"
              }`}
            >
              {fmtPct(pct)}
            </span>
          )}
        </div>
        {/* Stats — 2 col on mobile, 4 col on sm+ */}
        <div className="grid grid-cols-2 sm:flex sm:gap-4 lg:gap-6 sm:ml-auto gap-y-2 gap-x-4 text-xs">
          <div className="sm:text-right">
            <div className="text-zinc-600 uppercase tracking-wider text-[10px]">24h High</div>
            <div className="text-zinc-400 font-semibold mt-0.5">
              {fmtUsd(data?.high_24h ?? null)}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-zinc-600 uppercase tracking-wider text-[10px]">24h Low</div>
            <div className="text-zinc-400 font-semibold mt-0.5">
              {fmtUsd(data?.low_24h ?? null)}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-zinc-600 uppercase tracking-wider text-[10px]">24h Volume</div>
            <div className="text-zinc-400 font-semibold mt-0.5">
              {fmtLargeUsd(data?.total_volume_24h ?? null)}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-zinc-600 uppercase tracking-wider text-[10px]">Market Cap</div>
            <div className="text-zinc-400 font-semibold mt-0.5">
              {fmtLargeUsd(data?.market_cap ?? null)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
