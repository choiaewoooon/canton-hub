"use client";

import Link from "next/link";
import { useFeed } from "@/lib/api";

interface Props {
  lang: string;
}

const FALLBACK_ITEMS = [
  {
    source: "CANTON FOUNDATION",
    color: "var(--canton-lime)",
    time: "2h ago",
    text: "3분기 기관 온보딩 로드맵 공개 — 아시아 기반 4개 금융사 파트너십 체결.",
    url: "#",
  },
  {
    source: "DIGITAL ASSET",
    color: "var(--canton-mint)",
    time: "5h ago",
    text: "Global Synchronizer v2.1 배포 — 블록 파이널리티 평균 1.8초로 단축.",
    url: "#",
  },
  {
    source: "COINTELEGRAPH",
    color: "var(--canton-private)",
    time: "9h ago",
    text: "Canton의 프라이빗 레이어, 토큰화 국채 파일럿에서 실질 활용 사례 확대.",
    url: "#",
  },
];

function colorForSource(i: number): string {
  return ["var(--canton-lime)", "var(--canton-mint)", "var(--canton-private)"][i % 3];
}

export default function NewsCard({ lang }: Props) {
  const { data: feed, isLoading } = useFeed(lang);
  const items =
    feed?.items?.slice(0, 3).map((it, i) => ({
      source: it.source.toUpperCase(),
      color: colorForSource(i),
      time: it.time_ago,
      text: it.text,
      url: it.url,
    })) ?? FALLBACK_ITEMS;

  const aiSummary = feed?.ai_summary?.trim();
  const articleCount = feed?.items?.length ?? 14;

  return (
    <div className="ch-card ch-news-card">
      <div className="head">
        <div>
          <span className="ch-card-title">캔톤 소식</span>
          <span className="ch-chip muted ch-chip-xs" style={{ marginLeft: "8px" }}>
            AI 번역
          </span>
        </div>
        <Link href="/feed" className="ch-card-sub" style={{ color: "var(--zinc-500)" }}>
          모든 소식 →
        </Link>
      </div>

      <div className="ch-ai-summary-block">
        <div className="ch-ai-head">
          <span className="d" />
          AI Summary · 지난 24시간
        </div>
        {aiSummary ? (
          <div
            style={{
              fontSize: "13px",
              color: "var(--zinc-200)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {aiSummary}
          </div>
        ) : isLoading ? (
          <>
            <div className="ch-skel" style={{ height: 16, marginBottom: 8 }}>loading</div>
            <div className="ch-skel" style={{ height: 16, marginBottom: 8, width: "90%" }}>
              loading
            </div>
            <div className="ch-skel" style={{ height: 16, width: "75%" }}>loading</div>
          </>
        ) : (
          <ul>
            <li>
              <span className="bullet">▸</span>
              <span>
                CC 가격 24시간 <strong style={{ color: "var(--canton-up)" }}>+4.72%</strong>, B/M
                비율 <strong style={{ color: "var(--canton-lime)" }}>1.28x</strong>로 디플레이션
                기조 지속.
              </span>
            </li>
            <li>
              <span className="bullet">▸</span>
              <span>
                Super Validator <strong>5곳 추가 승인</strong> — 총 42개 운영, 아시아 기반 금융사
                4곳 신규 온보딩.
              </span>
            </li>
            <li>
              <span className="bullet">▸</span>
              <span>
                <strong>CIP-47</strong> 거버넌스 제안 투표 진행 중 — 73% 찬성, 장기 스테이킹 보상
                개편안.
              </span>
            </li>
          </ul>
        )}
        <div className="meta">{articleCount} 기사 기반 · 마지막 업데이트 2분 전</div>
      </div>

      <div className="ch-news-list">
        {items.map((it, i) => (
          <div key={i} className="ch-news-item">
            <div className="ch-news-meta">
              <span
                className="ch-src-badge"
                style={{
                  background: `color-mix(in oklab, ${it.color} 15%, transparent)`,
                  color: it.color,
                }}
              >
                {it.source}
              </span>
              <span className="time">{it.time}</span>
            </div>
            <a
              href={it.url || "#"}
              className="title"
              target={it.url && it.url !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {it.text}
            </a>
          </div>
        ))}
      </div>

      <Link className="ch-view-all" href="/feed">
        피드 페이지에서 전체 보기 →
      </Link>
    </div>
  );
}
