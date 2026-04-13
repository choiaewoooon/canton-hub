"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import RewardSplitChart from "@/components/analytics/reward-split-chart";
import CumulativeChart from "@/components/analytics/cumulative-chart";
import AmuletPriceChart from "@/components/analytics/amulet-price-chart";
import BurnBreakdownCard from "@/components/analytics/burn-breakdown";
import ExchangesSection from "@/components/analytics/exchanges-section";
import { useLang } from "@/lib/use-lang";
import { usePrice } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";

export default function AnalyticsPage() {
  const [lang, setLang] = useLang();
  const { data: swrPrice } = usePrice();
  const { connected } = useRealtimePrice(swrPrice);

  return (
    <div className="min-h-screen bg-canton-bg flex flex-col">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />

      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">
            {lang === "ko" ? "Analytics" : "Analytics"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {lang === "ko"
              ? "Canton 네트워크의 보상 분배, 토큰 이코노믹스, 누적 지표를 심화 분석합니다."
              : "Deep dive into Canton's reward distribution, tokenomics, and cumulative metrics."}
          </p>
        </div>

        {/* Exchanges & Markets — 가장 자주 보는 정보 */}
        <div className="mb-5">
          <ExchangesSection lang={lang} />
        </div>

        {/* Reward split */}
        <div className="mb-5">
          <RewardSplitChart lang={lang} />
        </div>

        {/* Cumulative chart */}
        <div className="mb-5">
          <CumulativeChart lang={lang} />
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <AmuletPriceChart lang={lang} />
          <BurnBreakdownCard lang={lang} />
        </div>

        {/* Note about future features */}
        <div className="bg-canton-card/50 border border-dashed border-canton-border rounded-[10px] p-5 mt-6">
          <h3 className="text-[13px] font-semibold text-zinc-300 mb-2">
            {lang === "ko" ? "🚧 추가 예정" : "🚧 Coming Soon"}
          </h3>
          <ul className="text-[12px] text-zinc-500 space-y-1.5 list-disc list-inside">
            <li>
              {lang === "ko"
                ? "Validator / Super Validator 리더보드 (스테이크·보상·업타임 기준)"
                : "Validator / Super Validator leaderboard (stake, rewards, uptime)"}
            </li>
            <li>
              {lang === "ko"
                ? "Top Apps by Rewards — 30일 기준 앱별 누적 보상 랭킹"
                : "Top Apps by Rewards — 30-day cumulative ranking"}
            </li>
            <li>
              {lang === "ko"
                ? "주요 CC 홀더 (Brale, Broadridge, GSF 등 기관 보유량)"
                : "Major CC holders (Brale, Broadridge, GSF — institutional holdings)"}
            </li>
            <li>
              {lang === "ko"
                ? "시간대별 트랜잭션 활동 히트맵"
                : "Hourly transaction activity heatmap"}
            </li>
          </ul>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
