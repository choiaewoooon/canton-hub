"use client";

import Image from "next/image";
import { useState } from "react";
import { useConsensus } from "@/lib/api";
import { fmtCc } from "@/lib/format";
import type { ConsensusSV, ConsensusValidator } from "@/lib/types";

interface Props {
  lang: string;
}

function PartnerLogo({
  domain,
  name,
  size = 28,
}: {
  domain: string | null;
  name: string;
  size?: number;
}) {
  const [error, setError] = useState(false);

  if (error || !domain) {
    return (
      <div
        className="rounded bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

function formatRewards(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B CC`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M CC`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K CC`;
  return `${n.toFixed(0)} CC`;
}

function SVRow({ sv, lang }: { sv: ConsensusSV; lang: string }) {
  const statusColor =
    sv.status === "active"
      ? "text-canton-up bg-canton-up/10"
      : "text-canton-down bg-canton-down/10";
  const uptimeColor =
    sv.uptime_pct >= 99 ? "text-canton-up" : sv.uptime_pct >= 95 ? "text-yellow-400" : "text-canton-down";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/50 border border-canton-border rounded-md hover:border-canton-lime/30 transition">
      <PartnerLogo domain={sv.domain} name={sv.name} size={28} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-zinc-100 font-medium truncate">{sv.name}</span>
          <span className={`text-[9px] font-bold px-1 rounded uppercase ${statusColor}`}>
            {sv.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
          <span>
            {lang === "ko" ? "가동률" : "Uptime"}:{" "}
            <span className={`font-semibold ${uptimeColor}`}>{sv.uptime_pct.toFixed(1)}%</span>
          </span>
          {sv.rounds_missed > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-canton-down">-{sv.rounds_missed} {lang === "ko" ? "라운드 누락" : "missed"}</span>
            </>
          )}
        </div>
      </div>

      {/* Weight */}
      <div className="text-right shrink-0 w-14">
        <div className="text-[9px] text-zinc-600 uppercase">Weight</div>
        <div className="text-[12px] text-canton-lime font-bold">{sv.weight.toFixed(2)}</div>
      </div>

      {/* Total Rewards */}
      <div className="text-right shrink-0 w-24">
        <div className="text-[9px] text-zinc-600 uppercase">{lang === "ko" ? "누적 보상" : "Earned"}</div>
        <div className="text-[12px] text-zinc-100 font-bold">{formatRewards(sv.rewards_total)}</div>
      </div>

      {/* Balance */}
      {sv.balance > 0 && (
        <div className="text-right shrink-0 w-20 hidden md:block">
          <div className="text-[9px] text-zinc-600 uppercase">Balance</div>
          <div className="text-[11px] text-zinc-300 font-semibold">{formatRewards(sv.balance)}</div>
        </div>
      )}
    </div>
  );
}

function ValidatorRow({ v, lang, rank }: { v: ConsensusValidator; lang: string; rank: number }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition">
      <span className="text-[10px] text-zinc-600 w-5 shrink-0 font-mono">#{rank}</span>
      <PartnerLogo domain={v.domain} name={v.organization} size={22} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-zinc-200 font-medium truncate">{v.organization}</div>
        <div className="text-[10px] text-zinc-600 truncate">
          {lang === "ko" ? "스폰서" : "Sponsor"}: {v.sponsor || "—"}
        </div>
      </div>
      <div className="text-right shrink-0 w-24">
        <div className="text-[9px] text-zinc-600 uppercase">{lang === "ko" ? "누적 보상" : "Rewards"}</div>
        <div className="text-[11px] text-zinc-100 font-bold">{formatRewards(v.rewards_total)}</div>
      </div>
      {v.balance > 0 && (
        <div className="text-right shrink-0 w-20 hidden md:block">
          <div className="text-[9px] text-zinc-600 uppercase">Balance</div>
          <div className="text-[10px] text-zinc-400 font-semibold">{formatRewards(v.balance)}</div>
        </div>
      )}
    </div>
  );
}

export default function ConsensusParticipants({ lang }: Props) {
  const { data } = useConsensus();
  const svs = data?.super_validators || [];
  const topVals = data?.top_validators || [];

  const title = lang === "ko" ? "Canton 컨센서스 참여자" : "Canton Consensus Participants";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "CantonScan 온체인 API에서 실시간으로 가져온 검증된 데이터"
            : "Live on-chain data from CantonScan API"}
        </p>
      </div>

      {/* Super Validators */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-canton-lime animate-pulse" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-canton-lime">
            Super Validators
          </span>
          <span className="text-[10px] text-zinc-700">{svs.length}</span>
          <span className="text-[10px] text-zinc-700 ml-auto">
            {lang === "ko" ? "누적 보상순 정렬" : "Sorted by Total Earned"}
          </span>
        </div>

        {svs.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-3">
            {lang === "ko" ? "SV 데이터 로딩 중..." : "Loading SV data..."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {svs.map((sv) => (
              <SVRow key={sv.party_id} sv={sv} lang={lang} />
            ))}
          </div>
        )}
      </div>

      {/* Top Validators */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-canton-mint" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-canton-mint">
            {lang === "ko" ? "주요 Validator (누적 보상 TOP 20)" : "Top Validators (by Rewards)"}
          </span>
          <span className="text-[10px] text-zinc-700">{topVals.length}</span>
          <span className="text-[10px] text-zinc-700 ml-auto">
            {lang === "ko" ? `전체 ${data?.total_validator_count ?? 0}개 중` : `of ${data?.total_validator_count ?? 0} total`}
          </span>
        </div>

        {topVals.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-3">
            {lang === "ko" ? "Validator 데이터 로딩 중..." : "Loading validator data..."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {topVals.map((v, i) => (
              <ValidatorRow key={v.party_id} v={v} lang={lang} rank={i + 1} />
            ))}
          </div>
        )}

        <a
          href="https://ccview.io/validators"
          target="_blank"
          rel="noopener"
          className="block text-center mt-4 py-2 text-[11px] text-zinc-500 hover:text-canton-lime transition border border-canton-border rounded-md"
        >
          {lang === "ko"
            ? `전체 ${data?.total_validator_count ?? 0}개 Validator 보기 (ccview.io) →`
            : `View all ${data?.total_validator_count ?? 0} validators on ccview.io →`}
        </a>
      </div>

      <div className="mt-4 pt-3 border-t border-canton-border">
        <p className="text-[10px] text-zinc-700 leading-relaxed">
          {lang === "ko"
            ? "출처: CantonScan API (/api/super-validators, /api/validators, /api/parties/{id}) · 30분마다 자동 갱신"
            : "Source: CantonScan API (/api/super-validators, /api/validators, /api/parties/{id}) · auto-refreshed every 30 minutes"}
        </p>
      </div>
    </div>
  );
}
