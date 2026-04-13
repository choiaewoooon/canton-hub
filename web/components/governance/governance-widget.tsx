"use client";

import { useGovernance } from "@/lib/api";

interface GovernanceWidgetProps {
  lang: string;
}

const LABEL = {
  ko: {
    title: "거버넌스 현황",
    active: "진행 중",
    recent: "최근 제안",
    history: "통과된 거버넌스 유형",
    totalPassed: "전체 통과",
    impact: "영향",
    viewOriginal: "원문",
    viewVote: "투표",
    loading: "거버넌스 데이터를 불러오는 중...",
    unit: "건",
  },
  en: {
    title: "Governance at a Glance",
    active: "Active",
    recent: "Recent Proposals",
    history: "Passed CIP Categories",
    totalPassed: "Total Passed",
    impact: "Impact",
    viewOriginal: "Source",
    viewVote: "Vote",
    loading: "Loading governance data...",
    unit: "",
  },
};

function getLabel(lang: string) {
  return lang === "ko" ? LABEL.ko : LABEL.en;
}

function statusStyle(status: string): string {
  if (status === "Approved" || status === "Final") return "text-canton-up bg-canton-up/10";
  if (status === "Proposed" || status === "Draft") return "text-yellow-400 bg-yellow-400/10";
  return "text-zinc-500 bg-zinc-800";
}

export default function GovernanceWidget({ lang }: GovernanceWidgetProps) {
  const { data } = useGovernance();
  const L = getLabel(lang);

  if (!data) {
    return (
      <div className="bg-canton-card border border-canton-border rounded-[10px] p-4 mt-3">
        <span className="text-[13px] font-semibold text-zinc-400">{L.title}</span>
        <p className="text-[13px] text-zinc-600 py-2">{L.loading}</p>
      </div>
    );
  }

  // history_stats를 count 내림차순으로 정렬
  const historyEntries = Object.entries(data.history_stats || {}).sort(
    (a, b) => b[1].count - a[1].count
  );
  const totalFinal = data.total_final || 0;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4 mt-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-zinc-400">{L.title}</span>
        <span className="text-[11px] text-zinc-600">
          {L.active}: <span className="text-yellow-400 font-semibold">{data.active_proposals ?? 0}</span>
          <span className="mx-1.5 text-zinc-700">·</span>
          {L.totalPassed}: <span className="text-canton-up font-semibold">{totalFinal}</span>
        </span>
      </div>

      {/* 이전 통과된 거버넌스 유형 통계 */}
      {historyEntries.length > 0 && (
        <div className="mb-3 pb-3 border-b border-canton-border">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
            {L.history}
          </div>
          <div className="space-y-1.5">
            {historyEntries.map(([key, stat]) => {
              const pct = totalFinal > 0 ? (stat.count / totalFinal) * 100 : 0;
              const name = lang === "ko" ? stat.name_ko : stat.name_en;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 w-[120px] shrink-0">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="text-[11px] text-zinc-400">{name}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: stat.color }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 w-[30px] text-right shrink-0">
                    {stat.count}{L.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 최근 제안 목록 */}
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
        {L.recent}
      </div>
      {data.recent_cips && data.recent_cips.length > 0 ? (
        data.recent_cips.map((cip, i) => (
          <div
            key={i}
            className={`py-2.5 ${i < data.recent_cips.length - 1 ? "border-b border-canton-border" : ""}`}
          >
            {/* CIP 번호 + 유형 뱃지 + 상태 뱃지 */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] font-bold text-canton-lime bg-canton-lime/10 px-1.5 py-0.5 rounded">
                {cip.number}
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color: cip.category_color,
                  backgroundColor: `${cip.category_color}1a`,
                }}
              >
                {lang === "ko" ? cip.category_ko : cip.category_en}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusStyle(cip.status)}`}>
                {cip.status}
              </span>
            </div>

            {/* 제목 */}
            <p className="text-[13px] text-zinc-300 leading-snug">
              {lang === "ko" ? cip.summary_ko : cip.summary_en}
            </p>

            {/* 영향 */}
            <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
              <span className="text-zinc-600">{L.impact}:</span>{" "}
              {lang === "ko" ? cip.impact_ko : cip.impact_en}
            </p>

            {/* 링크 */}
            <div className="flex gap-3 mt-1.5">
              <a
                href={cip.github_url}
                target="_blank"
                rel="noopener"
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
              >
                {L.viewOriginal} →
              </a>
              <a
                href={cip.vote_url}
                target="_blank"
                rel="noopener"
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
              >
                {L.viewVote} →
              </a>
            </div>
          </div>
        ))
      ) : (
        <p className="text-[13px] text-zinc-600 py-2">{L.loading}</p>
      )}
    </div>
  );
}
