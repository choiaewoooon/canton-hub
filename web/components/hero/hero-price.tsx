"use client";

import { useRealtimePrices } from "@/lib/api";
import { fmtUsd, fmtLargeUsd, fmtPct } from "@/lib/format";
import type { PriceData } from "@/lib/types";

interface HeroPriceProps {
  data: PriceData | undefined;
}

/**
 * Hero 가격 표시 우선순위:
 *   1) 실시간 트래커(useRealtimePrices)의 median — 5초 갱신, /analytics 카드와 100% 일치
 *   2) CoinGecko (props.data) — 트래커 미준비/실패 시 폴백
 *
 * 24h change/high/low/volume/market_cap은 트래커에 없으므로 그대로 CoinGecko에서.
 */
export default function HeroPrice({ data }: HeroPriceProps) {
  const { data: realtime } = useRealtimePrices();

  // 1) 실시간 median 계산
  let livePrice: number | null = null;
  if (realtime?.prices && realtime.prices.length > 0) {
    const sorted = realtime.prices
      .map((p) => p.price)
      .filter((p) => typeof p === "number" && p > 0)
      .sort((a, b) => a - b);
    if (sorted.length > 0) {
      const mid = Math.floor(sorted.length / 2);
      livePrice =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    }
  }

  // 2) 폴백 — CoinGecko VWAP
  const displayPrice = livePrice ?? data?.current_price_usd ?? null;
  const isLive = livePrice !== null;

  const pct = data?.price_change_percentage_24h;
  const isUp = (pct ?? 0) >= 0;

  return (
    <div className="p-4 sm:p-5 bg-canton-card border border-canton-border rounded-xl mb-5">
      {/* Top row — price always visible, stats flow below on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5 gap-3">
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <span className="text-sm text-zinc-500 font-semibold">$CC</span>
          <span className="text-3xl sm:text-4xl font-extrabold text-zinc-50 tracking-tight">
            {fmtUsd(displayPrice)}
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
          {isLive && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 bg-canton-up/10 text-canton-up"
              title="10개 거래소 5초 polling median"
            >
              <span className="w-1 h-1 rounded-full bg-canton-up animate-pulse" />
              Live · 5s median
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
