"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import TwitterArchive from "@/components/feed-page/twitter-archive";
import GovernanceCalendar from "@/components/feed-page/governance-calendar";
import EcosystemGuide from "@/components/feed-page/ecosystem-guide";
import ParticipationGuide from "@/components/feed-page/participation-guide";
import KoreanCompanies from "@/components/feed-page/korean-companies";
import { usePrice } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";
import { useLang } from "@/lib/use-lang";

export default function FeedPage() {
  const [lang, setLang] = useLang();
  const { data: swrPrice } = usePrice();
  const { connected } = useRealtimePrice(swrPrice);

  return (
    <div className="min-h-screen bg-canton-bg flex flex-col">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />
      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-5 flex-1">
        <div className="flex flex-col gap-4">
          <TwitterArchive lang={lang} />
          <GovernanceCalendar lang={lang} />
          <KoreanCompanies lang={lang} />
          <EcosystemGuide lang={lang} />
          <ParticipationGuide lang={lang} />
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
