"use client";

import { useState } from "react";
import Navbar from "@/components/nav/navbar";
import HeroPrice from "@/components/hero/hero-price";
import KpiGrid from "@/components/kpi/kpi-grid";
import ChartArea from "@/components/charts/chart-area";
import BmSection from "@/components/charts/bm-section";
import { usePrice, useNetwork } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";

export default function Dashboard() {
  const [lang, setLang] = useState("ko");
  const { data: swrPrice } = usePrice();
  const { data: realtimePrice, connected } = useRealtimePrice(swrPrice);
  const { data: networkData } = useNetwork();

  return (
    <div className="min-h-screen bg-canton-bg">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />
      <main className="max-w-[1200px] mx-auto px-6 py-5">
        <HeroPrice data={realtimePrice} />
        <KpiGrid data={networkData} />
        <ChartArea />
        <BmSection network={networkData} />
      </main>
    </div>
  );
}
