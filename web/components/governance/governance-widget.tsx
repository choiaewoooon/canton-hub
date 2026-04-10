"use client";

import { useGovernance } from "@/lib/api";

interface GovernanceWidgetProps {
  lang: string;
}

export default function GovernanceWidget({ lang }: GovernanceWidgetProps) {
  const { data } = useGovernance();

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-zinc-400">
          {lang === "ko" ? "거버넌스 현황" : "Governance at a Glance"}
        </span>
        <span className="text-[11px] text-zinc-600">
          {lang === "ko" ? "진행 중" : "Active"}: {data?.active_proposals ?? 0}
        </span>
      </div>

      {data?.recent_cips && data.recent_cips.length > 0 ? (
        data.recent_cips.map((cip, i) => (
          <div key={i} className={`py-2.5 ${i < data.recent_cips.length - 1 ? "border-b border-canton-border" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-canton-lime bg-canton-lime/10 px-1.5 py-0.5 rounded">{cip.number}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                cip.status === "Approved" || cip.status === "Final" ? "text-canton-up bg-canton-up/10" :
                cip.status === "Proposed" || cip.status === "Draft" ? "text-yellow-400 bg-yellow-400/10" :
                "text-zinc-500 bg-zinc-800"
              }`}>
                {cip.status}
              </span>
            </div>
            <p className="text-[13px] text-zinc-300">{lang === "ko" ? cip.summary_ko : cip.summary_en}</p>
            {cip.impact && <p className="text-[11px] text-zinc-500 mt-1">{cip.impact}</p>}
            <div className="flex gap-3 mt-1.5">
              <a href={cip.github_url} target="_blank" rel="noopener" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">
                {lang === "ko" ? "원문 보기" : "View Original"} →
              </a>
              <a href={cip.vote_url} target="_blank" rel="noopener" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">
                {lang === "ko" ? "투표 현황" : "Vote Status"} →
              </a>
            </div>
          </div>
        ))
      ) : (
        <p className="text-[13px] text-zinc-600 py-2">{lang === "ko" ? "거버넌스 데이터를 불러오는 중..." : "Loading governance data..."}</p>
      )}
    </div>
  );
}
