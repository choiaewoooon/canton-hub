"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import TwitterArchive from "@/components/feed-page/twitter-archive";
import GovernanceCalendar from "@/components/feed-page/governance-calendar";
import EcosystemGuide from "@/components/feed-page/ecosystem-guide";
import ParticipationGuide from "@/components/feed-page/participation-guide";
import InstitutionalPartners from "@/components/feed-page/institutional-partners";
import { useLang } from "@/lib/use-lang";
import { usePrice } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";

export default function FeedPage() {
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
            {lang === "ko" ? "Feed" : "Feed"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {lang === "ko"
              ? "Canton 소식, 거버넌스 캘린더, 생태계 가이드 — 한 곳에서 모든 것을."
              : "Canton news, governance calendar, ecosystem guides — all in one place."}
          </p>
        </div>

        {/* Top row — Twitter + Governance */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-5">
          <TwitterArchive lang={lang} />
          <GovernanceCalendar lang={lang} />
        </div>

        {/* Mid row — Ecosystem + Participation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <EcosystemGuide lang={lang} />
          <ParticipationGuide lang={lang} />
        </div>

        {/* Bottom row — Partners (full width) */}
        <div className="mb-5">
          <InstitutionalPartners lang={lang} />
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
