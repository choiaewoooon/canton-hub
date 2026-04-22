"use client";

import { useState } from "react";

const CATEGORIES = [
  { key: "all", label: "전체", pip: "var(--canton-lime)", count: 128 },
  { key: "protocol", label: "프로토콜", pip: "var(--canton-mint)", count: 34 },
  { key: "institutional", label: "기관 뉴스", pip: "var(--canton-private)", count: 42 },
  { key: "tokenomics", label: "토큰 이코노믹스", pip: "var(--canton-burn)", count: 18 },
  { key: "governance", label: "거버넌스", pip: "#facc15", count: 22 },
  { key: "tech", label: "기술", pip: "var(--zinc-600)", count: 12 },
];

const LANGUAGES = [
  { key: "all", label: "모두", count: 128 },
  { key: "ko", label: "한국어", count: 34 },
  { key: "en", label: "English", count: 82 },
  { key: "ja", label: "日本語", count: 12 },
];

const PERIODS = [
  { key: "today", label: "오늘", count: 14 },
  { key: "7d", label: "지난 7일", count: 58 },
  { key: "30d", label: "지난 30일", count: 128 },
];

export default function FeedFilters() {
  const [cat, setCat] = useState("all");
  const [lang, setLang] = useState("all");
  const [period, setPeriod] = useState("7d");

  return (
    <aside className="ch-filters">
      <div className="ch-filter-group">
        <div className="title">카테고리</div>
        <div className="ch-filter-list">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`ch-filter-item${cat === c.key ? " active" : ""}`}
              onClick={() => setCat(c.key)}
            >
              <span>
                <span className="pip" style={{ background: c.pip }} />
                {c.label}
              </span>
              <span className="count">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ch-filter-group">
        <div className="title">언어</div>
        <div className="ch-filter-list">
          {LANGUAGES.map((l) => (
            <button
              key={l.key}
              className={`ch-filter-item${lang === l.key ? " active" : ""}`}
              onClick={() => setLang(l.key)}
            >
              <span>{l.label}</span>
              <span className="count">{l.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ch-filter-group">
        <div className="title">기간</div>
        <div className="ch-filter-list">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`ch-filter-item${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
            >
              <span>{p.label}</span>
              <span className="count">{p.count}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
