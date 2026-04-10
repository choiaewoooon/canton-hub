"use client";

import { useFeed } from "@/lib/api";

interface FeedCardProps {
  lang: string;
}

const TITLES: Record<string, string> = { ko: "캔톤 소식", en: "Canton News", ja: "キャントンニュース", zh: "Canton 新闻" };

export default function FeedCard({ lang }: FeedCardProps) {
  const { data } = useFeed(lang);

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold text-zinc-400">{TITLES[lang] || TITLES.en}</span>
        <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">AI 번역</span>
      </div>

      {data?.items && data.items.length > 0 ? (
        data.items.slice(0, 3).map((item, i) => (
          <div key={i} className={`py-2.5 ${i < Math.min(data.items.length, 3) - 1 ? "border-b border-canton-border" : ""}`}>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              {item.source}
              <span className="text-zinc-700 normal-case tracking-normal">{item.time_ago}</span>
            </div>
            <a href={item.url} target="_blank" rel="noopener" className="text-[13px] text-zinc-400 leading-relaxed hover:text-zinc-300 transition">
              {item.text}
            </a>
          </div>
        ))
      ) : (
        <p className="text-[13px] text-zinc-600 py-4">소식을 불러오는 중...</p>
      )}

      {data?.ai_summary && (
        <div className="mt-3 pt-3 border-t border-canton-border">
          <div className="flex items-center gap-1.5 text-[10px] mb-1" style={{ color: "#c8e64a80" }}>
            AI 요약
          </div>
          <p className="text-[13px] text-zinc-400 leading-relaxed">{data.ai_summary}</p>
        </div>
      )}

      <a href="#" className="block text-center py-2.5 text-zinc-500 text-xs mt-1 hover:text-zinc-400 transition">
        {lang === "ko" ? "모든 소식 보기 →" : "View all updates →"}
      </a>
    </div>
  );
}
