"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDelta,
  Callout,
  Card,
  Grid,
  Metric,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
} from "@tremor/react";
import { useFundingRates, useRealtimePrices } from "@/lib/api";
import type { FundingRate, LivePrice } from "@/lib/types";
import { formatAgo, formatDuration, fmtLargeUsd } from "@/lib/format";
import { makeT } from "./funding-rate-matrix.i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerpPairResult {
  short: FundingRate;
  long: FundingRate;
  apr: number;
  entry_spread_pct: number;
  liquidity_min_usd: number;
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

  // Perp-Perp: highest FR (short) vs lowest FR (long)
  let perpPair: PerpPairResult | null = null;
  if (sorted.length >= 2) {
    const short = sorted[0];
    const long = sorted[sorted.length - 1];
    perpPair = {
      short,
      long,
      apr: short.fr_apr - long.fr_apr,
      entry_spread_pct: priceSpread(prices, short.source, long.source),
      liquidity_min_usd: minDepth(prices, short.source, long.source),
    };
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

  return <span className="text-[11px] text-zinc-300">{formatDuration(remaining, lang, true)}</span>;
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
    <div className="mt-3 pt-3 border-t border-canton-border">
      <p className="text-[11px] text-zinc-600">
        {t("lastUpdated")}: {formatAgo(secondsAgo, lang)}
      </p>
      {isStale && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-yellow-400/10 border border-yellow-400/30 px-3 py-2">
          <span className="text-[12px] text-yellow-400 font-semibold">{t("staleWarning")}</span>
        </div>
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

  if (allNegative) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md bg-zinc-800/60 border border-canton-border px-4 py-3">
        <span className="text-[12px] text-zinc-400">{t("noArbitrage")}</span>
      </div>
    );
  }

  if (!perpPair && !spotPerpPair) return null;

  return (
    <Grid numItems={1} numItemsSm={2} className="gap-3 mb-4">
      {perpPair && (
        <Card className="bg-zinc-900/50 border-canton-border p-3">
          <div className="text-[12px] font-semibold text-zinc-200 mb-2">{t("perpPerpTitle")}</div>
          <Metric className="text-canton-up text-[22px] leading-none mb-2">
            {perpPair.apr >= 0 ? "+" : ""}
            {perpPair.apr.toFixed(1)}% APR
          </Metric>
          <div className="text-[11px] text-zinc-400 space-y-0.5">
            <div>
              <span className="text-zinc-600">{t("shortLabel")}: </span>
              <span className="text-zinc-200 font-medium">{perpPair.short.source}</span>
            </div>
            <div>
              <span className="text-zinc-600">{t("longLabel")}: </span>
              <span className="text-zinc-200 font-medium">{perpPair.long.source}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-canton-border/50 text-[10px] text-zinc-600 space-y-0.5">
            <div>
              {t("entrySpread")}: {perpPair.entry_spread_pct.toFixed(3)}%
            </div>
            {perpPair.liquidity_min_usd > 0 && (
              <div>
                {t("orderbookDepth")}: {fmtLargeUsd(perpPair.liquidity_min_usd)}
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>{t("colNextFunding")}:</span>
              <Countdown targetTs={perpPair.short.next_funding_ts} lang={lang} />
            </div>
          </div>
        </Card>
      )}
      {spotPerpPair && (
        <Card className="bg-zinc-900/50 border-canton-border p-3">
          <div className="text-[12px] font-semibold text-zinc-200 mb-2">{t("spotPerpTitle")}</div>
          <Metric className="text-canton-up text-[22px] leading-none mb-2">
            {spotPerpPair.apr >= 0 ? "+" : ""}
            {spotPerpPair.apr.toFixed(1)}% APR
          </Metric>
          <div className="text-[11px] text-zinc-400 space-y-0.5">
            <div>
              <span className="text-zinc-600">{t("spotBuyLabel")}: </span>
              <span className="text-zinc-200 font-medium">{spotPerpPair.spotSource}</span>
            </div>
            <div>
              <span className="text-zinc-600">{t("shortLabel")}: </span>
              <span className="text-zinc-200 font-medium">{spotPerpPair.short.source}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-canton-border/50 text-[10px] text-zinc-600 space-y-0.5">
            <div>
              {t("basis")}: {spotPerpPair.entry_spread_pct >= 0 ? "+" : ""}
              {spotPerpPair.entry_spread_pct.toFixed(3)}%
            </div>
            {spotPerpPair.liquidity_min_usd > 0 && (
              <div>
                {t("orderbookDepth")}: {fmtLargeUsd(spotPerpPair.liquidity_min_usd)}
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>{t("colNextFunding")}:</span>
              <Countdown targetTs={spotPerpPair.short.next_funding_ts} lang={lang} />
            </div>
          </div>
        </Card>
      )}
    </Grid>
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
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell className="text-[11px] text-zinc-500">{t("colExchange")}</TableHeaderCell>
          <TableHeaderCell className="text-[11px] text-zinc-500">{t("colFrRaw")}</TableHeaderCell>
          <TableHeaderCell className="text-[11px] text-zinc-500">{t("colApr")}</TableHeaderCell>
          <TableHeaderCell className="text-[11px] text-zinc-500">{t("colNextFunding")}</TableHeaderCell>
          <TableHeaderCell className="text-[11px] text-zinc-500">{t("colTrade")}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.map((r) => {
          const frRawPct = (r.fr_raw * 100).toFixed(4);
          const frSign = r.fr_raw >= 0 ? "+" : "";
          const aprSign = r.fr_apr >= 0 ? "+" : "";

          // Find trade_url from matching prices entry (perp market for this source)
          const priceEntry = prices.find(
            (p) => p.source === r.source && p.market === "perpetual"
          );
          const tradeUrl = priceEntry?.trade_url;

          return (
            <TableRow key={r.source} className="hover:bg-zinc-900/40 transition">
              {/* Exchange */}
              <TableCell>
                <div className="text-[12px] text-zinc-200 font-medium">{r.source}</div>
                <div className="text-[9px] text-zinc-600 uppercase">
                  {r.venue_type} · {r.period_hours}h
                </div>
              </TableCell>

              {/* FR raw */}
              <TableCell>
                <span className={`text-[11px] font-mono ${r.fr_raw >= 0 ? "text-canton-up" : "text-canton-down"}`}>
                  {frSign}{frRawPct}%
                </span>
                <span className="text-[9px] text-zinc-700 ml-1">/{r.period_hours}h</span>
              </TableCell>

              {/* APR with BadgeDelta */}
              <TableCell>
                <BadgeDelta deltaType={r.fr_apr >= 0 ? "increase" : "decrease"} size="xs">
                  {aprSign}{r.fr_apr.toFixed(1)}%
                </BadgeDelta>
              </TableCell>

              {/* Countdown */}
              <TableCell>
                <Countdown targetTs={r.next_funding_ts} lang={lang} />
              </TableCell>

              {/* Trade link */}
              <TableCell>
                {tradeUrl ? (
                  <a
                    href={tradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-canton-lime hover:underline"
                  >
                    {t("colTrade")}
                  </a>
                ) : (
                  <span className="text-[11px] text-zinc-700">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
