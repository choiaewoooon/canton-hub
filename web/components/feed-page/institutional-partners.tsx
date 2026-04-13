"use client";

import Image from "next/image";
import { useState } from "react";

interface Props {
  lang: string;
}

interface Partner {
  name: string;
  domain: string; // for favicon lookup
  category: "founding" | "super_validator" | "investor" | "app" | "ecosystem";
  note_ko?: string;
  note_en?: string;
  source?: string; // citation
}

// 모든 항목은 공식 발표 또는 CIP/CantonScan 데이터로 검증됨
// Sources:
// - Founding consortium: Canton Network May 2023 launch announcement
// - $135M funding: Digital Asset June 2025 press release
// - Super Validators: CIPs from canton-foundation/cips repo
// - Apps: cantonscan.com Top Apps Leaderboard (verified via cantonecosystem.com)
const PARTNERS: Partner[] = [
  // === Founding Consortium (May 2023, 30+ institutions) ===
  { name: "Digital Asset", domain: "digitalasset.com", category: "founding", note_ko: "Canton 프로토콜 개발사", note_en: "Builder of Canton Protocol" },
  { name: "BNP Paribas", domain: "bnpparibas.com", category: "founding" },
  { name: "Goldman Sachs", domain: "goldmansachs.com", category: "founding" },
  { name: "Microsoft", domain: "microsoft.com", category: "founding" },
  { name: "Deutsche Börse", domain: "deutsche-boerse.com", category: "founding" },
  { name: "Cboe Global Markets", domain: "cboe.com", category: "founding" },
  { name: "Moody's", domain: "moodys.com", category: "founding" },
  { name: "Capgemini", domain: "capgemini.com", category: "founding" },
  { name: "Deloitte", domain: "deloitte.com", category: "founding" },
  { name: "Paxos", domain: "paxos.com", category: "founding" },
  { name: "Broadridge", domain: "broadridge.com", category: "founding" },
  { name: "S&P Global", domain: "spglobal.com", category: "founding" },

  // === Super Validators (검증된 CIP) ===
  { name: "Visa", domain: "visa.com", category: "super_validator", note_ko: "CIP-0109 · Weight 10", note_en: "CIP-0109 · Weight 10" },
  { name: "Apollo Global", domain: "apollo.com", category: "super_validator", note_ko: "CIP-0110 · Weight 7", note_en: "CIP-0110 · Weight 7" },
  { name: "Cumberland (DRW)", domain: "cumberland.io", category: "super_validator" },
  { name: "Talos / Coin Metrics", domain: "talos.com", category: "super_validator" },
  { name: "Tharimmune", domain: "tharimmune.com", category: "super_validator" },
  { name: "AngelHack", domain: "angelhack.com", category: "super_validator", note_ko: "CIP-0053 · Weight 2.5", note_en: "CIP-0053 · Weight 2.5" },
  { name: "Chainlink", domain: "chain.link", category: "super_validator" },
  { name: "Circle", domain: "circle.com", category: "super_validator" },

  // === $135M 투자자 (June 2025, Digital Asset 라운드) ===
  { name: "DRW Venture Capital", domain: "drw.com", category: "investor", note_ko: "주도 투자자", note_en: "Lead Investor" },
  { name: "Tradeweb Markets", domain: "tradeweb.com", category: "investor", note_ko: "주도 투자자", note_en: "Lead Investor" },
  { name: "Citadel Securities", domain: "citadelsecurities.com", category: "investor" },
  { name: "DTCC", domain: "dtcc.com", category: "investor", note_ko: "2026 Treasury 토큰화 파트너", note_en: "2026 Treasury tokenization partner" },
  { name: "Optiver", domain: "optiver.com", category: "investor" },
  { name: "Virtu Financial", domain: "virtu.com", category: "investor" },
  { name: "Polychain Capital", domain: "polychain.capital", category: "investor" },
  { name: "Liberty City Ventures", domain: "libertycityventures.com", category: "investor" },

  // === Top Apps (CantonScan 30-day leaderboard 기준) ===
  { name: "Hashnote (USYC)", domain: "hashnote.com", category: "app", note_ko: "토큰화 머니마켓 펀드", note_en: "Tokenized Money Market Fund" },
  { name: "Brale", domain: "brale.xyz", category: "app", note_ko: "스테이블코인 발행 플랫폼", note_en: "Stablecoin issuance platform" },
  { name: "Cantor 8 Digik", domain: "cantorfitzgerald.com", category: "app", note_ko: "최상위 보상 앱", note_en: "Top Reward App" },
  { name: "Temple Digital Group", domain: "templedg.com", category: "app" },
  { name: "Cantonloop", domain: "cantonloop.io", category: "app" },
  { name: "3Trade", domain: "3trade.io", category: "app" },
];

const COLORS: Record<string, string> = {
  founding: "#c8e64a",
  super_validator: "#60a5fa",
  investor: "#fb923c",
  app: "#a78bfa",
  ecosystem: "#34d399",
};

const LABELS_KO: Record<string, string> = {
  founding: "창립 멤버 (2023.05)",
  super_validator: "Super Validators",
  investor: "투자자 ($135M, 2025.06)",
  app: "주요 앱 (보상 기준)",
  ecosystem: "생태계 파트너",
};

const LABELS_EN: Record<string, string> = {
  founding: "Founding (May 2023)",
  super_validator: "Super Validators",
  investor: "Investors ($135M, Jun 2025)",
  app: "Top Apps (by rewards)",
  ecosystem: "Ecosystem Partners",
};

function PartnerLogo({ domain, name }: { domain: string; name: string }) {
  const [error, setError] = useState(false);
  const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  if (error) {
    return (
      <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`${name} logo`}
      width={24}
      height={24}
      className="rounded shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

export default function InstitutionalPartners({ lang }: Props) {
  const title = lang === "ko" ? "주요 기관 파트너" : "Institutional Partners";
  const labels = lang === "ko" ? LABELS_KO : LABELS_EN;

  // Group by category
  const grouped = PARTNERS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Partner[]>);

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "Canton Network에 참여 중인 검증된 기관들 — 월스트리트가 직접 운영하는 블록체인"
            : "Verified institutions on Canton Network — the blockchain Wall Street built"}
        </p>
      </div>

      <div className="space-y-5">
        {(["founding", "super_validator", "investor", "app"] as const).map((cat) => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[cat] }} />
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: COLORS[cat] }}>
                  {labels[cat]}
                </span>
                <span className="text-[10px] text-zinc-700">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((p) => {
                  const note = lang === "ko" ? p.note_ko : p.note_en;
                  return (
                    <div
                      key={p.name}
                      className="flex items-center gap-2.5 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
                    >
                      <PartnerLogo domain={p.domain} name={p.name} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-zinc-200 truncate">{p.name}</div>
                        {note && (
                          <div className="text-[10px] text-zinc-600 truncate">{note}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-canton-border space-y-2">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 Canton은 토큰화된 자산 규모가 $6T+ 입니다. 대부분 국가의 GDP보다 큽니다."
            : "💡 Canton hosts $6T+ in tokenized assets — larger than the GDP of most countries."}
        </p>
        <p className="text-[10px] text-zinc-700 leading-relaxed">
          {lang === "ko"
            ? "출처: Canton Network 2023.05 런칭 공지, Digital Asset 2025.06 자금 조달 발표, canton-foundation/cips GitHub, cantonscan.com, cantonecosystem.com"
            : "Sources: Canton Network May 2023 launch press release, Digital Asset June 2025 funding announcement, canton-foundation/cips GitHub, cantonscan.com, cantonecosystem.com"}
        </p>
      </div>
    </div>
  );
}
