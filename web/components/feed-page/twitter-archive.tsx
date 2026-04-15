"use client";

import { useFeed } from "@/lib/api";

interface Props {
  lang: string;
}

const TITLE: Record<string, string> = {
  ko: "Canton 트위터 아카이브",
  en: "Canton Twitter Archive",
  ja: "Canton ツイッターアーカイブ",
  zh: "Canton 推特档案",
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

export default function TwitterArchive({ lang }: Props) {
  const { data } = useFeed(lang);
  const items = data?.items || [];

  const title = TITLE[lang] || TITLE.en;
  const translatedLabel = TRANSLATED_LABEL[lang] || TRANSLATED_LABEL.en;
  const briefLabel = BRIEF_LABEL[lang] || BRIEF_LABEL.en;
  const loadingLabel = LOADING_LABEL[lang] || LOADING_LABEL.en;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            @CantonNetwork · @CantonFdn
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
          <ul className="space-y-1.5">
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
              <span className="text-canton-lime">{item.source}</span>
              <span className="text-zinc-700 normal-case tracking-normal">·</span>
              <span className="normal-case tracking-normal">{item.time_ago}</span>
            </div>
            <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">
              {item.text}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
