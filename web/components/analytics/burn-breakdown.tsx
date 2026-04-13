"use client";

import { useBurnBreakdown } from "@/lib/api";
import { fmtCc } from "@/lib/format";

interface Props {
  lang: string;
}

export default function BurnBreakdownCard({ lang }: Props) {
  const { data } = useBurnBreakdown();

  const fees = data?.burned_from_fees ?? 0;
  const traffic = data?.burned_from_traffic ?? 0;
  const total = fees + traffic;
  const feesPct = total > 0 ? (fees / total) * 100 : 0;
  const trafficPct = total > 0 ? (traffic / total) * 100 : 0;

  const cumFees = data?.cumulative_burned_from_fees ?? 0;
  const cumTraffic = data?.cumulative_burned_from_traffic ?? 0;

  const title = lang === "ko" ? "오늘의 소각 분해" : "Today's Burn Breakdown";
  const subtitle =
    lang === "ko"
      ? "수수료 vs 트래픽 구매로부터의 소각 비율"
      : "Burn split between fees and traffic purchases";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex h-10 rounded-md overflow-hidden gap-[2px] mb-4">
        <div
          className="flex items-center justify-center text-[12px] font-semibold text-white"
          style={{
            width: `${trafficPct || 100}%`,
            background: "linear-gradient(90deg, #f97316, #fb923c)",
          }}
        >
          Traffic {trafficPct.toFixed(1)}%
        </div>
        {feesPct > 0 && (
          <div
            className="flex items-center justify-center text-[12px] font-semibold text-white"
            style={{
              width: `${feesPct}%`,
              background: "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          >
            Fees {feesPct.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-md p-3">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "트래픽 구매 (오늘)" : "Traffic Purchases (Today)"}
          </div>
          <div className="text-[15px] font-bold text-canton-burn mt-1">{fmtCc(traffic)}</div>
          <div className="text-[10px] text-zinc-600 mt-1">
            {lang === "ko" ? "누적: " : "Cumulative: "}
            <span className="text-zinc-500">{fmtCc(cumTraffic)}</span>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-md p-3">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "수수료 (오늘)" : "Fees (Today)"}
          </div>
          <div className="text-[15px] font-bold text-canton-down mt-1">{fmtCc(fees)}</div>
          <div className="text-[10px] text-zinc-600 mt-1">
            {lang === "ko" ? "누적: " : "Cumulative: "}
            <span className="text-zinc-500">{fmtCc(cumFees)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 Canton의 소각은 대부분 트래픽 구매(네트워크 사용량)에서 발생합니다. CIP-0078 이후 일반 수수료 소각은 폐지되었습니다."
            : "💡 Most Canton burns come from traffic purchases (network usage). CIP-0078 removed general fee burns."}
        </p>
      </div>
    </div>
  );
}
