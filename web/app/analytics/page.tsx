"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import ArbitrageTracker from "@/components/analytics/arbitrage-tracker";
import FundingRateMatrix from "@/components/analytics/funding-rate-matrix";
import ExchangesSection from "@/components/analytics/exchanges-section";
import RewardSplitChart from "@/components/analytics/reward-split-chart";
import AmuletPriceChart from "@/components/analytics/amulet-price-chart";
import CumulativeChart from "@/components/analytics/cumulative-chart";
import BurnBreakdown from "@/components/analytics/burn-breakdown";
import MajorHolders from "@/components/analytics/major-holders";
import SupplyTable from "@/components/ch/analytics/supply-table";
import { usePrice } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";
import { useLang } from "@/lib/use-lang";

export default function AnalyticsPage() {
  const [lang, setLang] = useLang();
  const { data: swrPrice } = usePrice();
  const { connected } = useRealtimePrice(swrPrice);

  return (
    <div className="min-h-screen bg-canton-bg flex flex-col">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />
      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-5 flex-1">
        <ArbitrageTracker lang={lang} />
        <FundingRateMatrix lang={lang} />
        <div className="mt-5">
          <ExchangesSection lang={lang} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
          <RewardSplitChart lang={lang} />
          <AmuletPriceChart lang={lang} />
        </div>
        <div className="mt-5">
          <CumulativeChart lang={lang} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
          <BurnBreakdown lang={lang} />
          <MajorHolders lang={lang} />
        </div>
        <div className="mt-5">
          <SupplyTable />
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
