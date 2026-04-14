"use client";

import { useState } from "react";
import { useHolders } from "@/lib/api";
import { fmtCc } from "@/lib/format";
import type { Holder } from "@/lib/types";

interface Props {
  lang: string;
}

const CATEGORY_LABELS: Record<string, { ko: string; en: string; color: string }> = {
  super_validator: { ko: "SV", en: "SV", color: "#c8e64a" },
  validator: { ko: "Validator", en: "Validator", color: "#60a5fa" },
  app: { ko: "App", en: "App", color: "#a78bfa" },
  unknown: { ko: "기타", en: "Other", color: "#71717a" },
};

function HolderRow({
  holder,
  rank,
  totalSupply,
  lang,
}: {
  holder: Holder;
  rank: number;
  totalSupply: number;
  lang: string;
}) {
  const cat = CATEGORY_LABELS[holder.category] || CATEGORY_LABELS.unknown;
  const sharePct = totalSupply > 0 ? (holder.total_balance / totalSupply) * 100 : 0;
  const lockedPct =
    holder.total_balance > 0 ? (holder.locked_balance / holder.total_balance) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition">
      <span className="text-[11px] text-zinc-600 w-6 shrink-0 font-mono">#{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-zinc-100 font-medium truncate">{holder.organization}</span>
          <span
            className="text-[9px] font-bold px-1 rounded"
            style={{
              color: cat.color,
              backgroundColor: `${cat.color}1a`,
            }}
          >
            {lang === "ko" ? cat.ko : cat.en}
          </span>
        </div>
        <div className="text-[10px] text-zinc-600 truncate font-mono">
          {holder.party_id.split("::")[1]?.substring(0, 20) || holder.party_id.substring(0, 20)}...
        </div>
      </div>

      {/* Share bar */}
      <div className="w-24 hidden md:block shrink-0">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(sharePct * 10, 100)}%`,
              background: `linear-gradient(90deg, ${cat.color}, ${cat.color}80)`,
            }}
          />
        </div>
        <div className="text-[9px] text-zinc-600 mt-0.5 text-right">{sharePct.toFixed(2)}% {lang === "ko" ? "점유" : "share"}</div>
      </div>

      <div className="text-right shrink-0 w-28">
        <div className="text-[12px] text-zinc-100 font-bold">{fmtCc(holder.total_balance)}</div>
        {holder.locked_balance > 0 && (
          <div className="text-[9px] text-canton-private">
            {lockedPct.toFixed(0)}% {lang === "ko" ? "잠김" : "locked"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MajorHolders({ lang }: Props) {
  const { data } = useHolders();
  const [limit, setLimit] = useState<10 | 20 | 50>(20);

  const holders = data?.holders || [];
  const totalTracked = data?.total_tracked_balance || 0;
  const top1Pct = data?.top1_share_pct || 0;
  const top10Pct = data?.top10_share_pct || 0;

  const visible = holders.slice(0, limit);

  const title = lang === "ko" ? "주요 CC 홀더" : "Major CC Holders";
  const subtitle =
    lang === "ko"
      ? "CantonScan 온체인 데이터 기반 상위 보유자 — Validator/SV/App 계정 집계"
      : "Top holders from CantonScan on-chain data — Validator/SV/App accounts";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex gap-0.5 bg-zinc-900 rounded-md p-0.5">
          {([10, 20, 50] as const).map((n) => (
            <button
              key={n}
              onClick={() => setLimit(n)}
              className={`text-[11px] px-2 py-1 rounded ${
                limit === n ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"
              }`}
            >
              TOP {n}
            </button>
          ))}
        </div>
      </div>

      {/* Concentration summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "전체 추적 잔액" : "Tracked Balance"}
          </div>
          <div className="text-[14px] font-bold text-zinc-50 mt-0.5">{fmtCc(totalTracked)}</div>
          <div className="text-[9px] text-zinc-600 mt-0.5">
            {data?.total_count ?? 0} {lang === "ko" ? "계정" : "accounts"}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "Top 1 집중도" : "Top 1 Share"}
          </div>
          <div className="text-[14px] font-bold text-canton-down mt-0.5">{top1Pct.toFixed(1)}%</div>
          <div className="text-[9px] text-zinc-600 mt-0.5 truncate">
            {holders[0]?.organization || "—"}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-md p-2.5">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "Top 10 집중도" : "Top 10 Share"}
          </div>
          <div className="text-[14px] font-bold text-yellow-400 mt-0.5">{top10Pct.toFixed(1)}%</div>
          <div className="text-[9px] text-zinc-600 mt-0.5">
            {lang === "ko" ? "상위 10개 계정" : "top 10 accounts"}
          </div>
        </div>
      </div>

      {/* Holder list */}
      {visible.length === 0 ? (
        <p className="text-[11px] text-zinc-600 py-4 text-center">
          {lang === "ko" ? "Holders 데이터 로딩 중..." : "Loading holders..."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((h, i) => (
            <HolderRow
              key={h.party_id}
              holder={h}
              rank={i + 1}
              totalSupply={totalTracked}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* Insight note */}
      <div className="mt-4 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {top10Pct > 80
            ? lang === "ko"
              ? `⚠️ 매우 높은 집중도 — Top 10이 전체 추적 잔액의 ${top10Pct.toFixed(0)}%를 보유. Broadridge, GSF 등 기관 위주의 분포입니다.`
              : `⚠️ Very high concentration — Top 10 hold ${top10Pct.toFixed(0)}% of tracked balance. Distribution is skewed toward institutional validators.`
            : top10Pct > 50
              ? lang === "ko"
                ? `💡 중간 집중도 — Top 10이 ${top10Pct.toFixed(0)}%. 일부 분산이 이루어지고 있음.`
                : `💡 Moderate concentration — Top 10 hold ${top10Pct.toFixed(0)}%.`
              : lang === "ko"
                ? `✓ 비교적 분산됨 — Top 10이 ${top10Pct.toFixed(0)}%.`
                : `✓ Relatively distributed — Top 10 hold ${top10Pct.toFixed(0)}%.`}
        </p>
        <p className="text-[10px] text-zinc-700 mt-1">
          {lang === "ko"
            ? "* Validator/Super Validator/Featured App 계정만 추적. 소매 지갑(EOA 등)은 포함되지 않습니다."
            : "* Only Validator/Super Validator/Featured App accounts are tracked. Retail wallets not included."}
        </p>
      </div>
    </div>
  );
}
