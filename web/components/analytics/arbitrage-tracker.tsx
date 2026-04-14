"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimePrices } from "@/lib/api";
import type { LivePrice } from "@/lib/types";

interface Props {
  lang: string;
}

const VENUE_LABELS: Record<string, { ko: string; en: string }> = {
  DEX: { ko: "DEX", en: "DEX" },
  CEX: { ko: "CEX", en: "CEX" },
};

const MARKET_LABELS: Record<string, { ko: string; en: string }> = {
  spot: { ko: "현물", en: "Spot" },
  perpetual: { ko: "Perp", en: "Perp" },
  futures: { ko: "Futures", en: "Futures" },
};

function formatPrice(p: number): string {
  return `$${p.toFixed(5)}`;
}

// Map source name → direct trade URL for each venue in the live tracker.
// These match the sources registered in collectors/realtime_prices.py.
function getTradeUrl(source: string): string {
  switch (source) {
    // DEX Perp
    case "Hyperliquid":
      return "https://app.hyperliquid.xyz/trade/CC";
    case "Extended":
      return "https://app.extended.exchange/trade/CC-USD";
    case "Aster":
      return "https://www.asterdex.com/en/futures/CCUSDT";
    case "Lighter":
      return "https://app.lighter.xyz/trade/CC";
    // CEX Spot
    case "Bybit":
      return "https://www.bybit.com/trade/spot/CC/USDT";
    case "OKX":
      return "https://www.okx.com/trade-spot/cc-usdt";
    case "Kraken":
      return "https://pro.kraken.com/app/trade/CC-USD";
    // CEX Perp
    case "Bybit Perp":
      return "https://www.bybit.com/trade/usdt/CCUSDT";
    case "OKX Perp":
      return "https://www.okx.com/trade-swap/cc-usdt-swap";
    case "Binance Perp":
      return "https://www.binance.com/en/futures/CCUSDT";
    default:
      return "#";
  }
}

function PriceCard({
  entry,
  isHighest,
  isLowest,
  prevPrice,
  lang,
}: {
  entry: LivePrice;
  isHighest: boolean;
  isLowest: boolean;
  prevPrice: number | undefined;
  lang: string;
}) {
  const direction =
    prevPrice === undefined
      ? "neutral"
      : entry.price > prevPrice
        ? "up"
        : entry.price < prevPrice
          ? "down"
          : "neutral";

  const borderColor = isHighest
    ? "border-canton-up/50"
    : isLowest
      ? "border-canton-down/50"
      : "border-canton-border";

  const accentBg = isHighest
    ? "bg-canton-up/5"
    : isLowest
      ? "bg-canton-down/5"
      : "bg-zinc-900/50";

  const venueLabel = VENUE_LABELS[entry.venue_type] || { ko: entry.venue_type, en: entry.venue_type };
  const marketLabel = MARKET_LABELS[entry.market] || { ko: entry.market, en: entry.market };
  const tradeUrl = getTradeUrl(entry.source);
  const hasLink = tradeUrl !== "#";

  const hoverRing = isHighest
    ? "hover:border-canton-up"
    : isLowest
      ? "hover:border-canton-down"
      : "hover:border-zinc-600";

  return (
    <a
      href={tradeUrl}
      target={hasLink ? "_blank" : undefined}
      rel={hasLink ? "noopener noreferrer" : undefined}
      className={`relative block ${accentBg} border ${borderColor} rounded-md p-3 transition ${hoverRing} ${
        hasLink ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {/* Highest/Lowest badge */}
      {(isHighest || isLowest) && (
        <div
          className={`absolute -top-2 left-2 px-1.5 py-0.5 text-[9px] font-bold rounded ${
            isHighest ? "bg-canton-up text-black" : "bg-canton-down text-white"
          }`}
        >
          {isHighest
            ? lang === "ko"
              ? "↑ 최고가"
              : "↑ HIGH"
            : lang === "ko"
              ? "↓ 최저가"
              : "↓ LOW"}
        </div>
      )}

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-zinc-100 truncate flex items-center gap-1">
          {entry.source}
          {hasLink && <span className="text-[9px] text-zinc-600">↗</span>}
        </span>
        <div className="flex gap-1 shrink-0">
          <span
            className={`text-[8px] font-bold px-1 rounded ${
              entry.venue_type === "DEX"
                ? "text-canton-private bg-canton-private/10"
                : "text-canton-mint bg-canton-mint/10"
            }`}
          >
            {venueLabel[lang as "ko" | "en"] || venueLabel.en}
          </span>
          <span className="text-[8px] font-bold px-1 rounded text-zinc-400 bg-zinc-800">
            {marketLabel[lang as "ko" | "en"] || marketLabel.en}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-[18px] font-bold transition-colors ${
            direction === "up"
              ? "text-canton-up"
              : direction === "down"
                ? "text-canton-down"
                : "text-zinc-100"
          }`}
        >
          {formatPrice(entry.price)}
        </span>
        {direction !== "neutral" && (
          <span
            className={`text-[10px] ${direction === "up" ? "text-canton-up" : "text-canton-down"}`}
          >
            {direction === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>

      <div className="text-[9px] text-zinc-600 mt-0.5">{entry.pair}</div>
    </a>
  );
}

export default function ArbitrageTracker({ lang }: Props) {
  const { data } = useRealtimePrices();
  // Track previous prices to show direction arrows
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (data?.prices) {
      const newMap = new Map<string, number>();
      for (const p of data.prices) {
        newMap.set(p.source, p.price);
      }
      prevPricesRef.current = newMap;
      setTick((t) => t + 1);
    }
  }, [data?.fetched_at]);

  const prices = data?.prices || [];
  const sortedPrices = [...prices].sort((a, b) => b.price - a.price);
  const highest = data?.highest;
  const lowest = data?.lowest;
  const spread = data?.spread_pct || 0;
  const spreadUsd = data?.spread_usd || 0;

  // Get prev price map (snapshot at time of previous render)
  const getPrev = (source: string) => prevPricesRef.current.get(source);

  // Spread severity for arbitrage
  const spreadColor =
    spread >= 1 ? "text-canton-up" : spread >= 0.3 ? "text-yellow-400" : "text-zinc-400";
  const spreadBg =
    spread >= 1
      ? "from-canton-up/10 to-canton-up/5 border-canton-up/30"
      : spread >= 0.3
        ? "from-yellow-400/10 to-yellow-400/5 border-yellow-400/30"
        : "from-zinc-900 to-zinc-900/50 border-canton-border";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-canton-up animate-pulse" />
            <h3 className="text-[14px] font-semibold text-zinc-100">
              {lang === "ko" ? "실시간 아비트라지 트래커" : "Live Arbitrage Tracker"}
            </h3>
            <span className="text-[10px] text-zinc-600">5s</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {lang === "ko"
              ? "DEX + CEX (현물·선물) 가격을 5초마다 비교해 아비트라지 기회 포착"
              : "Compare DEX + CEX (spot/perp) prices every 5s to spot arbitrage"}
          </p>
        </div>
      </div>

      {/* Arbitrage Spread Display */}
      <div className={`bg-gradient-to-br ${spreadBg} border rounded-md p-4 mb-4`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "아비트라지 스프레드" : "Arbitrage Spread"}
            </div>
            <div className={`text-[28px] font-bold ${spreadColor} leading-none mt-1`}>
              {spread.toFixed(3)}%
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              ${spreadUsd.toFixed(6)} {lang === "ko" ? "차이" : "difference"}
            </div>
          </div>

          {highest && lowest && (
            <div className="flex items-center gap-3">
              {/* Buy at LOW */}
              <div className="text-right">
                <div className="text-[9px] text-canton-down uppercase tracking-wider">
                  {lang === "ko" ? "매수 (최저)" : "Buy at Low"}
                </div>
                <div className="text-[14px] font-bold text-canton-down">{formatPrice(lowest.price)}</div>
                <div className="text-[10px] text-zinc-500">{lowest.source}</div>
              </div>

              <div className="text-canton-lime text-2xl">→</div>

              {/* Sell at HIGH */}
              <div>
                <div className="text-[9px] text-canton-up uppercase tracking-wider">
                  {lang === "ko" ? "매도 (최고)" : "Sell at High"}
                </div>
                <div className="text-[14px] font-bold text-canton-up">{formatPrice(highest.price)}</div>
                <div className="text-[10px] text-zinc-500">{highest.source}</div>
              </div>
            </div>
          )}
        </div>

        {spread >= 0.5 && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <p className={`text-[11px] ${spreadColor}`}>
              {spread >= 1
                ? lang === "ko"
                  ? "🚨 매우 큰 스프레드! 아비트라지 기회가 명확합니다 (수수료/슬리피지 고려 필요)"
                  : "🚨 Major spread! Clear arbitrage opportunity (factor in fees/slippage)"
                : lang === "ko"
                  ? "⚡ 의미 있는 스프레드 감지됨"
                  : "⚡ Notable spread detected"}
            </p>
          </div>
        )}
      </div>

      {/* Price Cards Grid */}
      {prices.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              {lang === "ko" ? "전체 가격 비교" : "All Venue Prices"} ({prices.length})
            </span>
            <span className="text-[9px] text-zinc-700" key={tick}>
              {data?.fetched_at && (
                <>{lang === "ko" ? "업데이트: " : "Updated: "}{new Date(data.fetched_at).toLocaleTimeString()}</>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {sortedPrices.map((entry) => (
              <PriceCard
                key={`${entry.source}-${entry.market}`}
                entry={entry}
                isHighest={highest?.source === entry.source && highest?.market === entry.market}
                isLowest={lowest?.source === entry.source && lowest?.market === entry.market}
                prevPrice={getPrev(entry.source)}
                lang={lang}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600 py-4 text-center">
          {lang === "ko" ? "실시간 가격 데이터를 불러오는 중..." : "Loading real-time prices..."}
        </p>
      )}
    </div>
  );
}
