"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import RewardSplitChart from "@/components/analytics/reward-split-chart";
import CumulativeChart from "@/components/analytics/cumulative-chart";
import AmuletPriceChart from "@/components/analytics/amulet-price-chart";
import BurnBreakdownCard from "@/components/analytics/burn-breakdown";
import ExchangesSection from "@/components/analytics/exchanges-section";
import ArbitrageTracker from "@/components/analytics/arbitrage-tracker";
import MajorHolders from "@/components/analytics/major-holders";
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

        {/* Live Arbitrage Tracker — 5초 갱신 */}
        <ArbitrageTracker lang={lang} />

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

        {/* Major CC Holders — 온체인 데이터 기반 */}
        <div className="mb-5">
          <MajorHolders lang={lang} />
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
