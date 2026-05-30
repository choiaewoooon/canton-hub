"use client";

import { useFeed } from "@/lib/api";
import { relativeTime, kstTimestamp } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { categoryLabel, categoryClass } from "@/components/feed/news-category";

interface Props {
  lang: string;
}

const TITLE: Record<string, string> = {
  ko: "Canton 피드",
  en: "Canton Feed",
  ja: "Canton フィード",
  zh: "Canton 动态",
};

const TRANSLATED_LABEL: Record<string, string> = {
  ko: "번역",
  en: "Translated",
  ja: "翻訳",
  zh: "翻译",
};

const BRIEF_LABEL: Record<string, string> = {
  ko: "오늘의 요약",
  en: "Today's Brief",
  ja: "本日の要約",
  zh: "今日摘要",
};

const LOADING_LABEL: Record<string, string> = {
  ko: "트윗을 불러오는 중...",
  en: "Loading tweets...",
  ja: "ツイートを読み込み中...",
  zh: "正在加载推文...",
};

const CADENCE_LABEL: Record<string, string> = {
  ko: "트위터 0시·12시 · 미디어 매시 갱신",
  en: "Twitter 00:00·12:00 · Media hourly",
  ja: "Twitter 0時・12時 · メディア毎時",
  zh: "Twitter 0点·12点 · 媒体每小时",
};

const UPDATED_PREFIX: Record<string, string> = {
  ko: "마지막 갱신",
  en: "Updated",
  ja: "最終更新",
  zh: "最后更新",
};

export default function TwitterArchive({ lang }: Props) {
  const { data } = useFeed(lang);
  const items = data?.items || [];
  const now = useNow();

  const title = TITLE[lang] || TITLE.en;
  const translatedLabel = TRANSLATED_LABEL[lang] || TRANSLATED_LABEL.en;
  const briefLabel = BRIEF_LABEL[lang] || BRIEF_LABEL.en;
  const loadingLabel = LOADING_LABEL[lang] || LOADING_LABEL.en;
  const cadenceLabel = CADENCE_LABEL[lang] || CADENCE_LABEL.en;
  const updatedPrefix = UPDATED_PREFIX[lang] || UPDATED_PREFIX.en;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            @CantonNetwork · @CantonFdn
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">
            {cadenceLabel}
            {data?.fetched_at ? ` · ${updatedPrefix} ${relativeTime(data.fetched_at, lang, now)}` : ""}
          </p>
        </div>
        <span className="text-[10px] text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
          AI {translatedLabel}
        </span>
      </div>

      {data?.ai_summary && (
        <div className="mb-4 p-3 bg-canton-lime/5 border border-canton-lime/20 rounded-md">
          <div className="text-[10px] text-canton-lime/70 uppercase tracking-wider mb-2">
            {briefLabel}
          </div>
          <ul className="space-y-2.5">
            {data.ai_summary.split("·").filter(Boolean).map((line, i) => (
              <li key={i} className="text-[12px] text-zinc-300 leading-relaxed flex gap-2">
                <span className="text-canton-lime mt-0.5 shrink-0">•</span>
                <span>{line.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-[12px] text-zinc-600 py-3">{loadingLabel}</p>
        )}
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener"
            className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
          >
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
              {item.kind === "news" && (
                <span className={`px-1.5 py-0.5 rounded normal-case tracking-normal ${categoryClass(item.category)}`}>
                  {categoryLabel(item.category, lang)}
                </span>
              )}
              <span className="text-canton-lime normal-case tracking-normal">{item.source}</span>
              <span className="text-zinc-700 normal-case tracking-normal">·</span>
              <span className="normal-case tracking-normal" title={kstTimestamp(item.ts)}>
                {item.ts ? relativeTime(item.ts, lang, now) : item.time_ago}
              </span>
            </div>
            {item.kind === "news" && item.title && (
              <p className="text-[13px] font-semibold text-zinc-100 leading-snug mb-1">{item.title}</p>
            )}
            <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">
              {item.text}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
