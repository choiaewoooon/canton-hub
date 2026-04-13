"use client";

import Image from "next/image";
import { useState } from "react";
import { useExchanges } from "@/lib/api";
import { fmtLargeUsd, fmtUsd } from "@/lib/format";
import type { MarketEntry } from "@/lib/types";

interface Props {
  lang: string;
}

function ExchangeLogo({ logo, name, size = 24 }: { logo: string; name: string; size?: number }) {
  const [error, setError] = useState(false);
  if (error || !logo) {
    return (
      <div
        className="rounded bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <Image
      src={logo}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

function MarketRow({
  entry,
  totalVol,
  accentColor,
  showRank,
}: {
  entry: MarketEntry;
  totalVol: number;
  accentColor: string;
  showRank: boolean;
}) {
  const sharePct = totalVol > 0 ? (entry.volume_24h_usd / totalVol) * 100 : 0;
  return (
    <a
      href={entry.trade_url || "#"}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
    >
      {showRank && <span className="text-[10px] text-zinc-600 w-4 shrink-0">#{entry.rank}</span>}
      <ExchangeLogo logo={entry.logo} name={entry.exchange} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-zinc-100 font-medium truncate">{entry.exchange}</span>
          {entry.type && (
            <span
              className={`text-[9px] font-bold px-1 rounded ${
                entry.type === "DEX"
                  ? "text-canton-private bg-canton-private/10"
                  : "text-canton-mint bg-canton-mint/10"
              }`}
            >
              {entry.type}
            </span>
          )}
        </div>
        <div className="text-[10px] text-zinc-600 truncate">
          {entry.pair} · {fmtUsd(entry.price)} · spread {entry.spread_pct.toFixed(2)}%
        </div>
      </div>
      {/* Volume bar */}
      <div className="w-20 hidden md:block shrink-0">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(sharePct * 2, 100)}%`,
              background: accentColor,
            }}
          />
        </div>
      </div>
      <div className="text-right shrink-0 w-24">
        <div className="text-[12px] text-zinc-200 font-bold">{fmtLargeUsd(entry.volume_24h_usd)}</div>
        <div className="text-[10px] text-zinc-600">{sharePct.toFixed(1)}%</div>
      </div>
    </a>
  );
}

export default function ExchangesSection({ lang }: Props) {
  const { data } = useExchanges();
  const [activeTab, setActiveTab] = useState<"spot" | "derivatives">("spot");

  const spot = data?.spot || [];
  const derivatives = data?.derivatives || [];
  const dexOi = data?.dex_oi || [];
  const totalSpot = data?.total_spot_volume_usd || 0;
  const totalDeriv = data?.total_derivatives_volume_usd || 0;
  const totalPerp = data?.total_perpetuals_volume_usd || 0;
  const totalFutures = data?.total_futures_volume_usd || 0;
  const totalOI = data?.total_open_interest_usd || 0;

  // Spot vs Derivatives 비율
  const totalAll = totalSpot + totalDeriv;
  const spotPct = totalAll > 0 ? (totalSpot / totalAll) * 100 : 0;
  const derivPct = totalAll > 0 ? (totalDeriv / totalAll) * 100 : 0;

  const activeList = activeTab === "spot" ? spot : derivatives;
  const activeTotal = activeTab === "spot" ? totalSpot : totalDeriv;
  const activeColor = activeTab === "spot" ? "#c8e64a" : "#fb923c";

  const title = lang === "ko" ? "거래소 & 시장 활동" : "Exchange & Market Activity";
  const subtitle =
    lang === "ko"
      ? "$CC가 거래되는 거래소별 거래량 — 가격이 어디서 형성되는지 추적"
      : "Where $CC actually trades — track which markets drive price discovery";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>

      {/* === Spot vs Derivatives Overview === */}
      <div className="mb-5">
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
          {lang === "ko" ? "현물 vs 파생상품 24h 거래량" : "Spot vs Derivatives 24h Volume"}
        </div>
        <div className="flex h-9 rounded-md overflow-hidden gap-[2px] mb-3">
          {spotPct > 0 && (
            <div
              className="flex items-center justify-center text-[12px] font-semibold px-3"
              style={{
                width: `${spotPct}%`,
                background: "linear-gradient(90deg, #c8e64a, #a3c93a)",
                color: "#000",
              }}
            >
              {lang === "ko" ? "현물" : "Spot"} {spotPct.toFixed(1)}%
            </div>
          )}
          {derivPct > 0 && (
            <div
              className="flex items-center justify-center text-[12px] font-semibold text-white px-3"
              style={{
                width: `${derivPct}%`,
                background: "linear-gradient(90deg, #f97316, #fb923c)",
              }}
            >
              {lang === "ko" ? "파생" : "Deriv"} {derivPct.toFixed(1)}%
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "현물 (24h)" : "Spot (24h)"}
            </div>
            <div className="text-[14px] font-bold text-canton-lime mt-0.5">{fmtLargeUsd(totalSpot)}</div>
            <div className="text-[9px] text-zinc-700 mt-0.5">
              {data?.spot_exchange_count ?? 0} {lang === "ko" ? "거래소" : "exchanges"}
            </div>
          </div>
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "Perpetuals (24h)" : "Perpetuals (24h)"}
            </div>
            <div className="text-[14px] font-bold text-canton-private mt-0.5">{fmtLargeUsd(totalPerp)}</div>
            <div className="text-[9px] text-zinc-700 mt-0.5">
              {data?.perpetuals_count ?? 0} {lang === "ko" ? "마켓" : "markets"}
            </div>
          </div>
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "Futures (24h)" : "Futures (24h)"}
            </div>
            <div className="text-[14px] font-bold text-canton-mint mt-0.5">{fmtLargeUsd(totalFutures)}</div>
            <div className="text-[9px] text-zinc-700 mt-0.5">
              {(data?.futures_count ?? 0) === 0
                ? lang === "ko"
                  ? "현재 상장 없음"
                  : "no listings"
                : `${data?.futures_count} ${lang === "ko" ? "마켓" : "markets"}`}
            </div>
          </div>
        </div>
      </div>

      {/* === DEX Open Interest === */}
      {dexOi.length > 0 && (
        <div className="mb-5 p-4 bg-gradient-to-br from-canton-private/5 to-transparent border border-canton-private/20 rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-canton-private animate-pulse" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-canton-private">
                  {lang === "ko" ? "DEX 미결제약정 (Open Interest)" : "DEX Open Interest"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {lang === "ko"
                  ? "DEX의 공개 API에서 직접 수집한 실시간 OI — CEX는 OI를 공개하지 않습니다"
                  : "Live OI from DEX public APIs — CEXes don't expose OI publicly"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-600 uppercase">{lang === "ko" ? "총 OI" : "Total OI"}</div>
              <div className="text-[16px] font-bold text-canton-private">{fmtLargeUsd(totalOI)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {dexOi.map((d) => {
              const fundingDisplay =
                d.funding_rate !== null && d.funding_rate !== undefined
                  ? `${(d.funding_rate * 100).toFixed(4)}%`
                  : "-";
              const fundingColor =
                d.funding_rate === null || d.funding_rate === undefined
                  ? "text-zinc-500"
                  : d.funding_rate >= 0
                    ? "text-canton-up"
                    : "text-canton-down";
              return (
                <div
                  key={d.name}
                  className="bg-zinc-900/60 border border-canton-border rounded-md p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] font-semibold text-zinc-100">{d.name}</div>
                    <span className="text-[9px] text-canton-private bg-canton-private/10 px-1 rounded">DEX</span>
                  </div>
                  {d.open_interest_usd > 0 ? (
                    <>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider">OI</div>
                      <div className="text-[14px] font-bold text-zinc-50">{fmtLargeUsd(d.open_interest_usd)}</div>
                      <div className="text-[9px] text-zinc-600 mt-0.5">
                        {d.open_interest_base.toLocaleString(undefined, { maximumFractionDigits: 0 })} CC
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-600">
                      {lang === "ko" ? "OI 미공개" : "OI not exposed"}
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-canton-border/50 grid grid-cols-2 gap-1">
                    <div>
                      <div className="text-[9px] text-zinc-600 uppercase">Vol 24h</div>
                      <div className="text-[10px] text-zinc-300 font-semibold">{fmtLargeUsd(d.daily_volume_usd)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-600 uppercase">Funding</div>
                      <div className={`text-[10px] font-semibold ${fundingColor}`}>{fundingDisplay}</div>
                    </div>
                  </div>
                  {d.max_leverage && (
                    <div className="text-[9px] text-zinc-600 mt-1">
                      Max Lev: <span className="text-zinc-400 font-bold">{d.max_leverage}x</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Tab switcher === */}
      <div className="flex gap-0 border-b border-canton-border mb-3">
        <button
          onClick={() => setActiveTab("spot")}
          className={`px-4 py-2 text-xs border-b-2 transition ${
            activeTab === "spot" ? "border-current text-canton-lime" : "border-transparent text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-canton-lime" />
          {lang === "ko" ? "현물 거래소" : "Spot Exchanges"}
          <span className="ml-2 text-zinc-700">{spot.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("derivatives")}
          className={`px-4 py-2 text-xs border-b-2 transition ${
            activeTab === "derivatives" ? "border-current text-canton-burn" : "border-transparent text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-canton-burn" />
          {lang === "ko" ? "파생상품 (Perp + Futures)" : "Derivatives (Perp + Futures)"}
          <span className="ml-2 text-zinc-700">{derivatives.length}</span>
        </button>
      </div>

      {/* === Active list === */}
      {activeList.length === 0 ? (
        <p className="text-[11px] text-zinc-600 py-4 text-center">
          {lang === "ko" ? "데이터를 불러오는 중..." : "Loading data..."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {activeList.slice(0, 15).map((entry, i) => (
            <MarketRow
              key={`${entry.exchange}-${entry.pair}-${i}`}
              entry={entry}
              totalVol={activeTotal}
              accentColor={activeColor}
              showRank
            />
          ))}
        </div>
      )}

      {/* Insight */}
      <div className="mt-4 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {derivPct > 30
            ? lang === "ko"
              ? `💡 파생상품 비중이 ${derivPct.toFixed(0)}%로 높습니다. 가격 움직임이 레버리지/헤지 자금에 의해 증폭될 수 있습니다. 청산 캐스케이드 위험을 주의하세요.`
              : `💡 Derivatives at ${derivPct.toFixed(0)}% — price moves may be amplified by leverage and hedging. Watch for liquidation cascades.`
            : derivPct > 0
              ? lang === "ko"
                ? `💡 현물이 ${spotPct.toFixed(0)}% 우세합니다. 파생상품 비중(${derivPct.toFixed(0)}%)이 높아지면 투기 자금 유입 신호입니다.`
                : `💡 Spot dominates at ${spotPct.toFixed(0)}%. Growing derivatives share signals incoming speculative capital.`
              : lang === "ko"
                ? "💡 파생상품 시장이 거의 없습니다 — 가격은 순수 현물 매수/매도 압력으로 결정됩니다."
                : "💡 Negligible derivatives market — price driven purely by spot buy/sell pressure."}
        </p>
        <p className="text-[10px] text-zinc-700 mt-1">
          {lang === "ko" ? "출처: " : "Source: "}
          <a href="https://www.coingecko.com/en/coins/canton-network" target="_blank" rel="noopener" className="hover:text-canton-lime">
            CoinGecko Canton Markets
          </a>
        </p>
      </div>
    </div>
  );
}
