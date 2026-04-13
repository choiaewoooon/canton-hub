"use client";

import Image from "next/image";
import { useState } from "react";
import { useExchanges } from "@/lib/api";
import { fmtLargeUsd, fmtUsd } from "@/lib/format";

interface Props {
  lang: string;
}

function ExchangeLogo({ logo, name }: { logo: string; name: string }) {
  const [error, setError] = useState(false);
  if (error || !logo) {
    return (
      <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-500 shrink-0">
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <Image
      src={logo}
      alt={`${name} logo`}
      width={28}
      height={28}
      className="rounded shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

export default function ExchangesSection({ lang }: Props) {
  const { data } = useExchanges();
  const spot = data?.spot || [];
  const derivatives = data?.derivatives || [];
  const totalSpot = data?.total_spot_volume_usd || 0;
  const totalDeriv = data?.total_derivatives_volume_usd || 0;
  const totalOI = data?.total_open_interest_usd || 0;

  // Spot vs Derivatives 비율
  const totalAll = totalSpot + totalDeriv;
  const spotPct = totalAll > 0 ? (totalSpot / totalAll) * 100 : 100;
  const derivPct = totalAll > 0 ? (totalDeriv / totalAll) * 100 : 0;

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
          <div
            className="flex items-center justify-center text-[12px] font-semibold text-white px-3"
            style={{
              width: `${spotPct || 100}%`,
              background: "linear-gradient(90deg, #c8e64a, #a3c93a)",
              color: "#000",
            }}
          >
            {lang === "ko" ? "현물" : "Spot"} {spotPct.toFixed(1)}%
          </div>
          {derivPct > 0 && (
            <div
              className="flex items-center justify-center text-[12px] font-semibold text-white px-3"
              style={{
                width: `${derivPct}%`,
                background: "linear-gradient(90deg, #fb923c, #f97316)",
              }}
            >
              {lang === "ko" ? "파생" : "Deriv"} {derivPct.toFixed(1)}%
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "현물 거래량 (24h)" : "Spot Volume (24h)"}
            </div>
            <div className="text-[14px] font-bold text-canton-lime mt-0.5">{fmtLargeUsd(totalSpot)}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "파생 거래량 (24h)" : "Deriv Volume (24h)"}
            </div>
            <div className="text-[14px] font-bold text-canton-burn mt-0.5">{fmtLargeUsd(totalDeriv)}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "미결제약정 (OI)" : "Open Interest"}
            </div>
            <div className="text-[14px] font-bold text-canton-private mt-0.5">{fmtLargeUsd(totalOI)}</div>
          </div>
        </div>
      </div>

      {/* === Top Spot Exchanges === */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-canton-lime" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-canton-lime">
              {lang === "ko" ? "현물 거래소 TOP 10" : "Top 10 Spot Exchanges"}
            </span>
          </div>
          <span className="text-[10px] text-zinc-700">
            {data?.spot_exchange_count ?? 0} {lang === "ko" ? "전체" : "total"}
          </span>
        </div>
        {spot.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-2">
            {lang === "ko" ? "거래소 데이터를 불러오는 중..." : "Loading exchange data..."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {spot.slice(0, 10).map((ex, i) => {
              const sharePct = totalSpot > 0 ? (ex.volume_usd / totalSpot) * 100 : 0;
              return (
                <a
                  key={ex.identifier || ex.name}
                  href={ex.trade_url || "#"}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md hover:border-canton-lime/30 transition"
                >
                  <span className="text-[10px] text-zinc-600 w-4 shrink-0">#{i + 1}</span>
                  <ExchangeLogo logo={ex.logo} name={ex.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-zinc-100 font-medium truncate">{ex.name}</div>
                    <div className="text-[10px] text-zinc-600 truncate">
                      {ex.pairs.length} {lang === "ko" ? "페어" : "pairs"} · {fmtUsd(ex.last_price)}
                    </div>
                  </div>
                  {/* Volume bar */}
                  <div className="w-24 hidden sm:block shrink-0">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-canton-lime to-[#a3c93a] rounded-full"
                        style={{ width: `${Math.min(sharePct * 4, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <div className="text-[12px] text-zinc-200 font-bold">{fmtLargeUsd(ex.volume_usd)}</div>
                    <div className="text-[10px] text-zinc-600">{sharePct.toFixed(1)}%</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* === Derivatives === */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-canton-burn" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-canton-burn">
              {lang === "ko" ? "파생상품 시장" : "Derivatives Markets"}
            </span>
          </div>
          <span className="text-[10px] text-zinc-700">
            {data?.derivatives_count ?? 0} {lang === "ko" ? "마켓" : "markets"}
          </span>
        </div>
        {derivatives.length === 0 ? (
          <div className="text-[11px] text-zinc-600 py-3 px-3 bg-zinc-900/30 border border-dashed border-canton-border rounded-md">
            {lang === "ko"
              ? "📉 현재 $CC는 의미 있는 파생상품 시장이 없습니다. 거의 모든 거래량이 현물에서 발생합니다 — 가격은 순수 현물 매수/매도 압력으로만 결정되며, 레버리지 청산이나 펀딩 비용 영향이 없습니다."
              : "📉 $CC currently has no significant derivatives market. Nearly all volume is spot — price is driven purely by real buy/sell pressure, with no leverage liquidation or funding rate effects."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {derivatives.slice(0, 5).map((d, i) => (
              <div
                key={`${d.market}-${d.symbol}`}
                className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md"
              >
                <span className="text-[10px] text-zinc-600 w-4 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-100 font-medium truncate">{d.market}</div>
                  <div className="text-[10px] text-zinc-600 truncate">
                    {d.symbol} · {d.contract_type}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-zinc-600">{lang === "ko" ? "OI" : "Open Interest"}</div>
                  <div className="text-[11px] text-canton-private font-bold">{fmtLargeUsd(d.open_interest_usd)}</div>
                </div>
                <div className="text-right shrink-0 w-24">
                  <div className="text-[10px] text-zinc-600">Vol 24h</div>
                  <div className="text-[11px] text-zinc-200 font-bold">{fmtLargeUsd(d.volume_usd)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="mt-4 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 현물 비중이 압도적이라면 가격 상승은 실제 매수 수요에서 옵니다. 파생상품 거래량과 OI가 커지기 시작하면 레버리지 / 헤지 / 투기 자금이 유입되는 신호입니다."
            : "💡 If spot dominates, price moves come from real buying demand. Growing derivatives volume and OI signal incoming leverage, hedging, and speculative capital."}
        </p>
        <p className="text-[10px] text-zinc-700 mt-1">
          {lang === "ko" ? "출처: " : "Source: "}
          <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener" className="hover:text-canton-lime">
            Powered by CoinGecko
          </a>
        </p>
      </div>
    </div>
  );
}
