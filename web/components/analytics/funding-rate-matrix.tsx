"use client";

import { useEffect, useMemo, useState } from "react";
import { useFundingRates, useRealtimePrices } from "@/lib/api";
import type { FundingRate, LivePrice } from "@/lib/types";
import { formatAgo, formatDuration, fmtLargeUsd } from "@/lib/format";
import { makeT } from "./funding-rate-matrix.i18n";
import { roundTripCost, netApr, breakevenDays, HOLD_DAYS_DEFAULT } from "./funding-net";

// ---------------------------------------------------------------------------
// Toss-style color helpers
// Korean convention: positive = RED, negative = BLUE
// ---------------------------------------------------------------------------

const valClass = (n: number) => (n >= 0 ? "text-rose-400" : "text-sky-400");
const arrow = (n: number) => (n >= 0 ? "▲" : "▼");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerpPairResult {
  short: FundingRate;
  long: FundingRate;
  apr: number;              // gross APR (short.fr_apr - long.fr_apr)
  entry_spread_pct: number; // 거래소 간 perp 가격 괴리 (참고용 유지)
  liquidity_min_usd: number;
  round_trip_cost: number | null; // 왕복 체결비용% (양다리 스프레드 합)
  net_apr: number | null;         // net APR (기본 7일)
  breakeven_days: number | null;  // 손익분기 보유일
}

interface SpotPerpPairResult {
  short: FundingRate;
  spotSource: string;
  spotPrice: number;
  apr: number;
  entry_spread_pct: number;
  liquidity_min_usd: number;
}

interface ComputedPairs {
  perpPair: PerpPairResult | null;
  spotPerpPair: SpotPerpPairResult | null;
  sorted: FundingRate[];
}

// ---------------------------------------------------------------------------
// computePairs helpers
// ---------------------------------------------------------------------------

/** Returns the price of the perpetual LivePrice whose source === srcName, or 0. */
function perpPriceOf(prices: LivePrice[], srcName: string): number {
  const entry = prices.find((p) => p.source === srcName && p.market === "perpetual");
  return entry?.price ?? 0;
}

/**
 * Absolute % spread between two perp prices.
 * abs(priceA - priceB) / min(priceA, priceB) * 100.
 * Returns 0 if either price is missing or min is 0.
 */
function priceSpread(prices: LivePrice[], srcA: string, srcB: string): number {
  const pA = perpPriceOf(prices, srcA);
  const pB = perpPriceOf(prices, srcB);
  const minP = Math.min(pA, pB);
  if (minP <= 0) return 0;
  return (Math.abs(pA - pB) / minP) * 100;
}

/** Min of available depth fields across two perp sources. Returns 0 if unavailable. */
function minDepth(prices: LivePrice[], srcA: string, srcB: string): number {
  const eA = prices.find((p) => p.source === srcA && p.market === "perpetual");
  const eB = prices.find((p) => p.source === srcB && p.market === "perpetual");
  const candidates: number[] = [];
  if (eA?.depth_minus_2pct) candidates.push(eA.depth_minus_2pct);
  if (eA?.depth_plus_2pct) candidates.push(eA.depth_plus_2pct);
  if (eB?.depth_minus_2pct) candidates.push(eB.depth_minus_2pct);
  if (eB?.depth_plus_2pct) candidates.push(eB.depth_plus_2pct);
  if (candidates.length === 0) return 0;
  return Math.min(...candidates);
}

/**
 * Min depth across the spot entry for spotSrc and the perp entry for perpSrc.
 * Returns 0 if unavailable.
 */
function minSpotPerpDepth(prices: LivePrice[], spotSrc: string, perpSrc: string): number {
  const spot = prices.find((p) => p.source === spotSrc && p.market === "spot");
  const perp = prices.find((p) => p.source === perpSrc && p.market === "perpetual");
  const candidates: number[] = [];
  if (spot?.depth_minus_2pct) candidates.push(spot.depth_minus_2pct);
  if (spot?.depth_plus_2pct) candidates.push(spot.depth_plus_2pct);
  if (perp?.depth_minus_2pct) candidates.push(perp.depth_minus_2pct);
  if (perp?.depth_plus_2pct) candidates.push(perp.depth_plus_2pct);
  if (candidates.length === 0) return 0;
  return Math.min(...candidates);
}

// ---------------------------------------------------------------------------
// computePairs — main pairing logic (§4.4)
// ---------------------------------------------------------------------------

function computePairs(rates: FundingRate[], prices: LivePrice[]): ComputedPairs {
  const sorted = [...rates].sort((a, b) => b.fr_apr - a.fr_apr);

  // Perp-Perp: net APR 최대 페어 선택.
  // 후보 = short.fr_apr > long.fr_apr (gross>0) 인 모든 순서쌍.
  // 스프레드 양쪽 다 있는 후보 중 net 최대를 고른다.
  // 스프레드 데이터가 전혀 없으면 gross 최대(최고FR 숏 × 최저FR 롱)로 폴백.
  let perpPair: PerpPairResult | null = null;
  if (sorted.length >= 2) {
    const build = (short: FundingRate, long: FundingRate): PerpPairResult => {
      const gross = short.fr_apr - long.fr_apr;
      const cost = roundTripCost(short.spread_pct, long.spread_pct);
      return {
        short,
        long,
        apr: gross,
        entry_spread_pct: priceSpread(prices, short.source, long.source),
        liquidity_min_usd: minDepth(prices, short.source, long.source),
        round_trip_cost: cost,
        net_apr: netApr(gross, cost, HOLD_DAYS_DEFAULT),
        breakeven_days: breakevenDays(gross, cost),
      };
    };

    const candidates: PerpPairResult[] = [];
    for (const short of sorted) {
      for (const long of sorted) {
        if (short.source === long.source) continue;
        if (short.fr_apr - long.fr_apr <= 0) continue;
        candidates.push(build(short, long));
      }
    }
    const withNet = candidates.filter((c) => c.net_apr != null);
    if (withNet.length > 0) {
      perpPair = withNet.reduce((a, b) => (b.net_apr! > a.net_apr! ? b : a));
    } else {
      // 스프레드 데이터 없음 → gross 최대 폴백: 최고FR 숏 × 다른 소스의 최저FR 롱
      const short = sorted[0];
      const long =
        [...sorted].reverse().find((r) => r.source !== short.source) ??
        sorted[sorted.length - 1];
      perpPair = build(short, long);
    }
  }

  // Spot-Perp: highest positive FR perp + cheapest spot
  const cheapestSpot = prices
    .filter((p) => p.market === "spot")
    .sort((a, b) => a.price - b.price)[0];

  let spotPerpPair: SpotPerpPairResult | null = null;
  if (sorted.length >= 1 && sorted[0].fr_apr > 0 && cheapestSpot) {
    const short = sorted[0];
    const perpPrice = perpPriceOf(prices, short.source);
    const basisPct =
      cheapestSpot.price > 0
        ? ((perpPrice - cheapestSpot.price) / cheapestSpot.price) * 100
        : 0;
    spotPerpPair = {
      short,
      spotSource: cheapestSpot.source,
      spotPrice: cheapestSpot.price,
      apr: short.fr_apr,
      entry_spread_pct: basisPct,
      liquidity_min_usd: minSpotPerpDepth(prices, cheapestSpot.source, short.source),
    };
  }

  return { perpPair, spotPerpPair, sorted };
}

// ---------------------------------------------------------------------------
// Countdown sub-component
// ---------------------------------------------------------------------------

function Countdown({ targetTs, lang }: { targetTs: number; lang: string }) {
  const [remaining, setRemaining] = useState<number>(() => {
    return Math.floor(targetTs - Date.now() / 1000);
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.floor(targetTs - Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetTs]);

  return <span className="text-[11px] text-zinc-300 tabular-nums">{formatDuration(remaining, lang, true)}</span>;
}

// ---------------------------------------------------------------------------
// LastUpdated sub-component
// ---------------------------------------------------------------------------

function LastUpdated({
  ts,
  lang,
  t,
}: {
  ts: string | null;
  lang: string;
  t: ReturnType<typeof makeT>;
}) {
  const [now, setNow] = useState<number>(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!ts) return null;

  const updatedAtSec = new Date(ts).getTime() / 1000;
  const secondsAgo = Math.max(0, Math.floor(now - updatedAtSec));
  const isStale = secondsAgo > 300;

  return (
    <div className="mt-3 pt-3 border-t border-canton-border/60">
      <p className="text-[11px] text-zinc-500">
        {t("lastUpdated")}: {formatAgo(secondsAgo, lang)}
      </p>
      {isStale && (
        <p className="mt-1 text-[11px] text-amber-400">{t("staleWarning")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecommendationCards sub-component
// ---------------------------------------------------------------------------

function RecommendationCards({
  pairs,
  lang,
  t,
}: {
  pairs: ComputedPairs;
  lang: string;
  t: ReturnType<typeof makeT>;
}) {
  const { perpPair, spotPerpPair, sorted } = pairs;

  const allNegative = sorted.length > 0 && sorted[0].fr_apr <= 0;

  if (allNegative || (!perpPair && !spotPerpPair)) {
    return (
      <div className="mb-4 rounded-2xl bg-zinc-900/50 border border-canton-border/60 px-4 py-3">
        <span className="text-[12px] text-zinc-400">{t("noArbitrage")}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {perpPair && (
        <div className="rounded-2xl bg-zinc-900/50 border border-canton-border/60 p-5">
          <div className="text-[12px] text-zinc-400 mb-2">{t("perpPerpTitle")}</div>
          <div className={`text-[28px] font-bold tabular-nums ${valClass(perpPair.net_apr ?? perpPair.apr)} leading-none mb-1`}>
            {arrow(perpPair.net_apr ?? perpPair.apr)} {Math.abs(perpPair.net_apr ?? perpPair.apr).toFixed(1)}%
            <span className="text-[12px] font-medium text-zinc-500 ml-1.5">
              {perpPair.net_apr != null ? t("netAprLabel") : "APR"}
            </span>
          </div>
          <div className="text-[11px] text-zinc-600 mb-3">
            {perpPair.net_apr != null
              ? `${t("colApr")} ${perpPair.apr.toFixed(1)}% · ${t("holdNote")}`
              : t("netNa")}
          </div>
          {(perpPair.net_apr ?? perpPair.apr) < 0 && (
            <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-400 font-medium leading-snug">
              {t("warnLoss")}
            </div>
          )}
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("shortLabel")}</span>
              <span className="font-medium text-zinc-200">{perpPair.short.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("longLabel")}</span>
              <span className="font-medium text-zinc-200">{perpPair.long.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("roundTripCost")}</span>
              <span className="tabular-nums text-zinc-300">
                {perpPair.round_trip_cost != null ? `${perpPair.round_trip_cost.toFixed(3)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("breakeven")}</span>
              <span className="tabular-nums text-zinc-300">
                {perpPair.breakeven_days != null
                  ? `${perpPair.breakeven_days.toFixed(1)}${t("daysUnit")}`
                  : "—"}
              </span>
            </div>
          </div>
          {perpPair.liquidity_min_usd > 0 && (
            <div className="flex justify-between text-[12px] mt-1.5">
              <span className="text-zinc-500">{t("orderbookDepth")}</span>
              <span className="tabular-nums text-zinc-300">{fmtLargeUsd(perpPair.liquidity_min_usd)}</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-canton-border/60 flex items-center justify-between text-[12px] text-zinc-500">
            <span>{t("colNextFunding")}</span>
            <Countdown targetTs={perpPair.short.next_funding_ts} lang={lang} />
          </div>
        </div>
      )}
      {spotPerpPair && (
        <div className="rounded-2xl bg-zinc-900/50 border border-canton-border/60 p-5">
          <div className="text-[12px] text-zinc-400 mb-2">{t("spotPerpTitle")}</div>
          <div className={`text-[28px] font-bold tabular-nums ${valClass(spotPerpPair.apr)} leading-none mb-3`}>
            {arrow(spotPerpPair.apr)} {Math.abs(spotPerpPair.apr).toFixed(1)}%
            <span className="text-[12px] font-medium text-zinc-500 ml-1.5">APR</span>
          </div>
          {spotPerpPair.apr < 0 && (
            <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-400 font-medium leading-snug">
              {t("warnLoss")}
            </div>
          )}
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("spotBuyLabel")}</span>
              <span className="font-medium text-zinc-200">{spotPerpPair.spotSource}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("shortLabel")}</span>
              <span className="font-medium text-zinc-200">{spotPerpPair.short.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("basis")}</span>
              <span className="tabular-nums text-zinc-300">{spotPerpPair.entry_spread_pct.toFixed(3)}%</span>
            </div>
          </div>
          {spotPerpPair.liquidity_min_usd > 0 && (
            <div className="flex justify-between text-[12px] mt-1.5">
              <span className="text-zinc-500">{t("orderbookDepth")}</span>
              <span className="tabular-nums text-zinc-300">{fmtLargeUsd(spotPerpPair.liquidity_min_usd)}</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-canton-border/60 flex items-center justify-between text-[12px] text-zinc-500">
            <span>{t("colNextFunding")}</span>
            <Countdown targetTs={spotPerpPair.short.next_funding_ts} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FundingRateTable sub-component
// ---------------------------------------------------------------------------

function FundingRateTable({
  rates,
  prices,
  lang,
  t,
}: {
  rates: FundingRate[];
  prices: LivePrice[];
  lang: string;
  t: ReturnType<typeof makeT>;
}) {
  const sorted = [...rates].sort((a, b) => b.fr_apr - a.fr_apr);

  return (
    <div className="w-full overflow-x-auto -mx-1 px-1">
      <div className="min-w-[520px]">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 px-1 pb-2 border-b border-canton-border/60">
        <span className="text-[11px] text-zinc-500">{t("colExchange")}</span>
        <span className="text-[11px] text-zinc-500 text-right">{t("colFrRaw")}</span>
        <span className="text-[11px] text-zinc-500 text-right">{t("colApr")}</span>
        <span className="text-[11px] text-zinc-500 text-right">{t("colSpread")}</span>
        <span className="text-[11px] text-zinc-500 text-right">{t("colNextFunding")}</span>
        <span className="text-[11px] text-zinc-500 text-right">{t("colTrade")}</span>
      </div>

      {/* Data rows */}
      {sorted.map((r) => {
        const frRawPct = (r.fr_raw * 100).toFixed(4);

        // Find trade_url from matching prices entry (perp market for this source)
        const priceEntry = prices.find(
          (p) => p.source === r.source && p.market === "perpetual"
        );
        const tradeUrl = priceEntry?.trade_url;

        return (
          <div
            key={r.source}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 items-center px-1 py-3.5 border-b border-canton-border/60 hover:bg-zinc-900/40 transition-colors"
          >
            {/* Exchange */}
            <div>
              <div className="text-[13px] text-zinc-100 font-semibold">{r.source}</div>
              <div className="text-[11px] text-zinc-500 uppercase mt-0.5">
                {r.venue_type} · {r.period_hours}H
              </div>
            </div>

            {/* FR raw */}
            <div className="text-right">
              <span className={`text-[12px] tabular-nums font-mono ${valClass(r.fr_raw)}`}>
                {arrow(r.fr_raw)}&thinsp;{frRawPct}%
              </span>
              <span className="text-[11px] text-zinc-600 ml-0.5">/{r.period_hours}h</span>
            </div>

            {/* APR — clean colored text, no BadgeDelta */}
            <div className="text-right">
              <span className={`text-[15px] font-bold tabular-nums ${valClass(r.fr_apr)}`}>
                {arrow(r.fr_apr)}&thinsp;{Math.abs(r.fr_apr).toFixed(1)}%
              </span>
            </div>

            {/* Spread */}
            <div className="text-right">
              <span className="text-[12px] tabular-nums font-mono text-zinc-400">
                {r.spread_pct != null ? `${r.spread_pct.toFixed(3)}%` : "—"}
              </span>
            </div>

            {/* Countdown */}
            <div className="text-right text-zinc-400">
              <Countdown targetTs={r.next_funding_ts} lang={lang} />
            </div>

            {/* Trade link */}
            <div className="text-right">
              {tradeUrl ? (
                <a
                  href={tradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-zinc-500 hover:text-canton-lime transition-colors"
                >
                  Trade ↗
                </a>
              ) : (
                <span className="text-[12px] text-zinc-700">—</span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FundingRateMatrix component
// ---------------------------------------------------------------------------

interface Props {
  lang: string;
}

export default function FundingRateMatrix({ lang }: Props) {
  const t = makeT(lang);
  const { data: fr, error } = useFundingRates();
  const { data: rt } = useRealtimePrices();

  const pairs = useMemo(
    () => computePairs(fr?.rates ?? [], rt?.prices ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fr?.rates, rt?.prices]
  );

  if (error) {
    return (
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-5 mb-5">
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3">
          <span className="text-[12px] text-red-400 font-semibold">{t("errorLoad")}</span>
        </div>
      </div>
    );
  }

  if (!fr?.rates.length) {
    return (
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
          <h3 className="text-[14px] font-semibold text-zinc-400">{t("title")}</h3>
        </div>
        <p className="text-[11px] text-zinc-600 py-4 text-center">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5 mb-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full bg-canton-lime animate-pulse" />
        <h3 className="text-[14px] font-semibold text-zinc-100">{t("title")}</h3>
        <span className="text-[10px] text-zinc-600">30s</span>
      </div>

      {/* Recommendation cards */}
      <RecommendationCards pairs={pairs} lang={lang} t={t} />

      {/* Funding rate table */}
      <FundingRateTable rates={fr.rates} prices={rt?.prices ?? []} lang={lang} t={t} />

      {/* Last updated */}
      <LastUpdated ts={fr.updated_at} lang={lang} t={t} />
    </div>
  );
}
