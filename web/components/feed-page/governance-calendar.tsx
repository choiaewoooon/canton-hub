"use client";

import { useGovernance } from "@/lib/api";

interface Props {
  lang: string;
}

const STATUS_STYLE: Record<string, string> = {
  Approved: "text-canton-up bg-canton-up/10 border-canton-up/20",
  Final: "text-canton-up bg-canton-up/10 border-canton-up/20",
  Proposed: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Draft: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
};

export default function GovernanceCalendar({ lang }: Props) {
  const { data } = useGovernance();
  const cips = data?.recent_cips || [];

  // Active proposals (Draft / Proposed) — 진행 중
  const active = cips.filter((c) => c.status === "Draft" || c.status === "Proposed");
  // Recently approved
  const recent = cips.filter((c) => c.status === "Approved" || c.status === "Final");

  const title = lang === "ko" ? "거버넌스 캘린더" : "Governance Calendar";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "Canton Improvement Proposals (CIP) 진행 현황"
            : "Canton Improvement Proposals (CIP) status tracker"}
        </p>
      </div>

      {/* 활성 제안 */}
      {active.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-yellow-400/70 uppercase tracking-wider mb-2">
            ⏳ {lang === "ko" ? "투표 진행 중" : "Voting in Progress"} ({active.length})
          </div>
          <div className="space-y-2">
            {active.map((cip, i) => (
              <a
                key={i}
                href={cip.github_url}
                target="_blank"
                rel="noopener"
                className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-canton-lime bg-canton-lime/10 px-1.5 py-0.5 rounded">
                    {cip.number}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: cip.category_color, background: `${cip.category_color}1a` }}
                  >
                    {lang === "ko" ? cip.category_ko : cip.category_en}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[cip.status] || "text-zinc-500 bg-zinc-800"}`}>
                    {cip.status}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-300">{lang === "ko" ? cip.summary_ko : cip.summary_en}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{lang === "ko" ? cip.impact_ko : cip.impact_en}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 최근 통과 */}
      {recent.length > 0 && (
        <div>
          <div className="text-[10px] text-canton-up/70 uppercase tracking-wider mb-2">
            ✅ {lang === "ko" ? "최근 통과" : "Recently Approved"} ({recent.length})
          </div>
          <div className="space-y-2">
            {recent.map((cip, i) => (
              <a
                key={i}
                href={cip.github_url}
                target="_blank"
                rel="noopener"
                className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-canton-lime bg-canton-lime/10 px-1.5 py-0.5 rounded">
                    {cip.number}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: cip.category_color, background: `${cip.category_color}1a` }}
                  >
                    {lang === "ko" ? cip.category_ko : cip.category_en}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[cip.status] || "text-zinc-500 bg-zinc-800"}`}>
                    {cip.status}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-300">{lang === "ko" ? cip.summary_ko : cip.summary_en}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {cips.length === 0 && (
        <p className="text-[12px] text-zinc-600 py-3">
          {lang === "ko" ? "거버넌스 데이터를 불러오는 중..." : "Loading governance data..."}
        </p>
      )}
    </div>
  );
}
