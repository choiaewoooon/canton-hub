"use client";

import { useFeed } from "@/lib/api";
import { relativeTime, kstTimestamp } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { categoryLabel, categoryClass } from "@/components/feed/news-category";

interface FeedCardProps {
  lang: string;
}

const TITLES: Record<string, string> = { ko: "캔톤 소식", en: "Canton News", ja: "キャントンニュース", zh: "Canton 新闻" };

export default function FeedCard({ lang }: FeedCardProps) {
  const { data } = useFeed(lang);
  const visibleItems = data?.items?.slice(0, 3) || [];
  const now = useNow();

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold text-zinc-400">{TITLES[lang] || TITLES.en}</span>
        <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">AI 번역</span>
        {data?.fetched_at && (
          <span className="ml-auto text-[10px] text-zinc-600" title={kstTimestamp(data.fetched_at)}>
            {(lang === "ko" ? "갱신 " : "Updated ") + relativeTime(data.fetched_at, lang, now)}
          </span>
        )}
      </div>

      {data?.ai_summary && (
        <div className="mb-3 pb-3 border-b border-canton-border">
          <div className="flex items-center gap-1.5 text-[10px] mb-2" style={{ color: "var(--canton-lime)", opacity: 0.85 }}>
            <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: "var(--canton-lime)" }} />
            AI 요약
          </div>
          <ul className="space-y-1.5">
            {data.ai_summary.split("·").filter(Boolean).map((line, i) => (
              <li key={i} className="text-[12px] text-zinc-400 leading-relaxed flex gap-2">
                <span className="text-zinc-600 mt-0.5 shrink-0">•</span>
                <span>{line.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibleItems.length > 0 ? (
        visibleItems.map((item, i) => (
          <div key={i} className={`py-2.5 ${i < visibleItems.length - 1 ? "border-b border-canton-border" : ""}`}>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 uppercase tracking-wider mb-1 flex-wrap">
              <span className="normal-case tracking-normal">{item.kind === "news" ? "📰" : "🐦"}</span>
              {item.category && item.category !== "other" && (
                <span className={`px-1.5 py-0.5 rounded normal-case tracking-normal ${categoryClass(item.category)}`}>
                  {categoryLabel(item.category, lang)}
                </span>
              )}
              {item.source}
              <span className="text-zinc-700 normal-case tracking-normal" title={kstTimestamp(item.ts)}>
                {item.ts ? relativeTime(item.ts, lang, now) : item.time_ago}
              </span>
            </div>
            <a href={item.url} target="_blank" rel="noopener" className="block hover:text-zinc-300 transition">
              {item.kind === "news" && item.title && (
                <span className="block text-[13px] font-semibold text-zinc-300 leading-snug">{item.title}</span>
              )}
              <span className="text-[13px] text-zinc-400 leading-relaxed">{item.text}</span>
            </a>
          </div>
        ))
      ) : data?.ai_summary ? null : (
        <p className="text-[13px] text-zinc-600 py-4">소식을 불러오는 중...</p>
      )}

      <a href="#" className="block text-center py-2.5 text-zinc-500 text-xs mt-1 hover:text-zinc-400 transition">
        {lang === "ko" ? "모든 소식 보기 →" : "View all updates →"}
      </a>
    </div>
  );
}
