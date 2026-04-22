"use client";

import { usePrice, useNetwork, useFeed, useTrending } from "@/lib/api";
import { fmtUsd, fmtPct, fmtNum } from "@/lib/format";
import { useLang } from "@/lib/use-lang";

const FALLBACK_TRENDING = [
  { rank: 1, text: "Super Validator 신규 승인", meta: "+428% · 지난 24h" },
  { rank: 2, text: "CIP-47 거버넌스 투표", meta: "+312% · 지난 24h" },
  { rank: 3, text: "Global Synchronizer v2.1", meta: "+218% · 지난 24h" },
  { rank: 4, text: "토큰화 국채 파일럿", meta: "+142% · 지난 24h" },
  { rank: 5, text: "B/M Ratio 분석", meta: "+98% · 지난 24h" },
];

const FALLBACK_SOURCES = [
  { name: "Canton Foundation", count: 14 },
  { name: "Digital Asset", count: 11 },
  { name: "Cointelegraph", count: 8 },
  { name: "Blockworks", count: 7 },
  { name: "CoinDesk Korea", count: 6 },
  { name: "Governance Forum", count: 5 },
  { name: "The Block", count: 4 },
];

export default function RightRail() {
  const [lang] = useLang();
  const { data: price } = usePrice();
  const { data: network } = useNetwork();
  const { data: feed } = useFeed(lang);
  const { data: trendingData } = useTrending();

  const realTrending = (trendingData?.keywords ?? []).slice(0, 5).map((t, i) => ({
    rank: i + 1,
    text: t.keyword,
    meta: `${t.count}회 · 최근 ${t.last_seen || "수집"}`,
  }));
  const trending = realTrending.length > 0 ? realTrending : FALLBACK_TRENDING;
  const isTrendingFallback = realTrending.length === 0;

  // Aggregate source counts from feed items
  const sourceCounts: Record<string, number> = {};
  if (feed?.items) {
    for (const it of feed.items) {
      const s = it.source || "Unknown";
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    }
  }
  const realSources = Object.entries(sourceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
  const sources = realSources.length > 0 ? realSources : FALLBACK_SOURCES;
  const isFallbackSources = realSources.length === 0;

  const priceVal = price?.current_price_usd;
  const priceChange = price?.price_change_percentage_24h ?? 0;
  const bmRatio = network?.bm_ratio;
  const privPct = network?.private_tx_ratio;
  const activeAddrs = network?.active_addresses_24h;

  return (
    <aside className="ch-right-rail">
      <div className="ch-card">
        <div className="ch-card-head">
          <span className="ch-card-title">트렌딩 키워드</span>
          <span className="ch-card-sub">
            {isTrendingFallback ? "샘플" : "실시간"}
          </span>
        </div>
        {trending.map((t) => (
          <div key={t.rank} className="ch-trending-item">
            <span className="rank">{t.rank}</span>
            <span className="txt">
              {t.text}
              <span className="meta">{t.meta}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="ch-card">
        <div className="ch-card-head">
          <span className="ch-card-title">소스별 기사 수</span>
          <span className="ch-card-sub">{isFallbackSources ? "샘플" : "현재 피드"}</span>
        </div>
        {sources.map((s) => (
          <div key={s.name} className="ch-src-stat-row">
            <span>{s.name}</span>
            <span className="c">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="ch-card">
        <div className="ch-card-head">
          <span className="ch-card-title">시장 스냅샷</span>
        </div>
        <div className="ch-src-stat-row">
          <span>CC Price</span>
          <span className="c" style={{ color: priceChange >= 0 ? "var(--canton-up)" : "var(--canton-down)" }}>
            {priceVal != null ? `${fmtUsd(priceVal)} ${fmtPct(priceChange)}` : "—"}
          </span>
        </div>
        <div className="ch-src-stat-row">
          <span>B/M Ratio</span>
          <span className="c" style={{ color: "var(--canton-lime)" }}>
            {bmRatio != null ? `${bmRatio.toFixed(4)}x` : "—"}
          </span>
        </div>
        <div className="ch-src-stat-row">
          <span>Private TX</span>
          <span className="c" style={{ color: "var(--canton-private)" }}>
            {privPct != null ? `${privPct.toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="ch-src-stat-row">
          <span>Active Addrs</span>
          <span className="c">{activeAddrs != null ? fmtNum(activeAddrs) : "—"}</span>
        </div>
      </div>
    </aside>
  );
}
