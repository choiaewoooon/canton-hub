"use client";

import { fmtLargeUsd, fmtNum, fmtPct } from "@/lib/format";
import type { NetworkData } from "@/lib/types";

interface KpiGridProps {
  data: NetworkData | undefined;
}

export default function KpiGrid({ data }: KpiGridProps) {
  const bmRatio = data?.bm_ratio;
  const bmStatus = data?.bm_status;
  const isDeflationary = bmStatus === "deflationary";

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {/* B/M Ratio — special highlighted card */}
      <div className="bg-gradient-to-br from-canton-card to-[#151a0a] border border-canton-lime/20 rounded-[10px] p-4">
        <div className="text-[11px] text-canton-lime/50 uppercase tracking-wider mb-1.5">B/M Ratio</div>
        <div className="text-[22px] font-bold text-canton-lime">
          {bmRatio !== null && bmRatio !== undefined ? `${bmRatio.toFixed(4)}x` : "N/A"}
        </div>
        <div className="text-[11px] mt-1">
          <span className={isDeflationary ? "text-canton-up" : "text-canton-down"}>
            {bmStatus === "deflationary" ? "Deflationary" : bmStatus === "inflationary" ? "Inflationary" : "—"}
          </span>
        </div>
      </div>

      {/* Active Addresses */}
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
        <div className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1.5">Active Addresses (24h)</div>
        <div className="text-[22px] font-bold text-zinc-50">
          {data?.active_addresses_24h != null ? fmtNum(data.active_addresses_24h) : (
            <a href="https://www.cantonscan.com/" target="_blank" rel="noopener" className="text-[14px] text-zinc-500 hover:text-zinc-400 transition">
              cantonscan.com →
            </a>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {data?.active_addresses_change != null && (
            <span className={data.active_addresses_change >= 0 ? "text-canton-up" : "text-canton-down"}>
              {fmtPct(data.active_addresses_change)}
            </span>
          )}
        </div>
      </div>

      {/* Daily Burn */}
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
        <div className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1.5">Daily Burn</div>
        <div className="text-[22px] font-bold text-zinc-50">
          {fmtLargeUsd(data?.daily_burn_usd ?? null)}
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {data?.daily_burn_change != null && (
            <span className={data.daily_burn_change >= 0 ? "text-canton-up" : "text-canton-down"}>
              {fmtPct(data.daily_burn_change)}
            </span>
          )}
        </div>
      </div>

      {/* Private TX Ratio (Institutional) */}
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
        <div className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          Private TX (Institutional)
          <span className="inline-block w-3 h-3 text-zinc-600 cursor-help" title="Canton은 기업/기관용 프라이빗 레이어를 제공합니다. Private TX는 기관 사용자의 트랜잭션으로, 이 비율이 높을수록 기관 채택이 활발함을 의미합니다.">ⓘ</span>
        </div>
        <div className="text-[22px] font-bold text-zinc-50">
          {data?.private_tx_ratio != null ? `${data.private_tx_ratio.toFixed(1)}%` : (
            <a href="https://www.cantonscan.com/" target="_blank" rel="noopener" className="text-[14px] text-zinc-500 hover:text-zinc-400 transition">
              cantonscan.com →
            </a>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {data?.private_tx_count != null ? `${fmtNum(data.private_tx_count)} institutional updates` : ""}
        </div>
      </div>
    </div>
  );
}
