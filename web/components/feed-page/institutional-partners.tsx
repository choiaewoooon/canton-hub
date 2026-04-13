"use client";

import Image from "next/image";
import { useState } from "react";

interface Props {
  lang: string;
}

interface SV {
  name: string;
  domain: string;
  weight?: string;
  earned?: string;
  note_ko?: string;
  note_en?: string;
}

interface Validator {
  name: string;
  domain: string;
  category: string; // "infrastructure" | "custody" | "exchange" | "ecosystem"
  note_ko?: string;
  note_en?: string;
}

// === Verified Super Validators (출처: ccview.io/super-validators 2026-04-13) ===
const SUPER_VALIDATORS: SV[] = [
  {
    name: "Digital Asset",
    domain: "digitalasset.com",
    weight: "31.85",
    earned: "5.36B CC",
    note_ko: "3개 노드 · Canton 프로토콜 개발사",
    note_en: "3 nodes · Builder of Canton Protocol",
  },
  {
    name: "Cumberland (DRW)",
    domain: "cumberland.io",
    weight: "27.23",
    earned: "4.61B CC",
    note_ko: "2개 노드 · 시장 조성자",
    note_en: "2 nodes · Market maker",
  },
  {
    name: "Global Synchronizer Foundation",
    domain: "sync.global",
    weight: "195.5",
    earned: "1.66B CC",
    note_ko: "Canton Foundation 운영",
    note_en: "Run by Canton Foundation",
  },
  { name: "Tradeweb Markets", domain: "tradeweb.com", weight: "10", earned: "1.83B CC" },
  { name: "SV Nodeops Limited", domain: "svnodeops.com", weight: "10.25", earned: "1.84B CC" },
  { name: "MPC Holding", domain: "mpch.io", weight: "14", earned: "434M CC" },
  { name: "C7 Technology Services", domain: "c7tech.com", weight: "10.58", earned: "547M CC", note_ko: "Tier 1 · 100% 컴플라이언스", note_en: "Tier 1 · 100% compliant" },
  { name: "Liberty City Ventures", domain: "libertycityventures.com", weight: "10", earned: "1.40B CC" },
  { name: "Five North", domain: "fivenorth.com" },
  { name: "Orb LP", domain: "orb.land" },
  { name: "Coin Metrics", domain: "coinmetrics.io", note_ko: "온체인 데이터 분석", note_en: "On-chain data analytics" },
  { name: "Chainlink", domain: "chain.link", note_ko: "오라클 네트워크", note_en: "Decentralized oracles" },
  { name: "Ubyx", domain: "ubyx.com" },
  { name: "TRM Labs", domain: "trmlabs.com", note_ko: "블록체인 컴플라이언스", note_en: "Blockchain compliance" },
  { name: "Obsidian Systems", domain: "obsidian.systems" },
  { name: "Taurus", domain: "taurushq.com", note_ko: "디지털 자산 인프라", note_en: "Digital asset infrastructure" },
  { name: "Quantstamp", domain: "quantstamp.com", note_ko: "스마트컨트랙트 감사", note_en: "Smart contract auditing" },
  { name: "Republic", domain: "republic.com", note_ko: "투자 플랫폼", note_en: "Investment platform" },
  { name: "BitGo", domain: "bitgo.com", note_ko: "기관급 커스터디", note_en: "Institutional custody" },
  { name: "IntellectEU", domain: "intellecteu.com" },
  { name: "Elliptic", domain: "elliptic.co", note_ko: "블록체인 분석 / AML", note_en: "Blockchain analytics / AML" },
  { name: "Zenith", domain: "zenith.com" },
  { name: "Proof Group", domain: "proof.group" },
  { name: "GhostSV", domain: "ghostsv.io" },
];

// === Notable Regular Validators ===
// 출처: ccview.io/validators 직접 관찰 + canton.foundation/validators (NaaS 제공자)
const NOTABLE_VALIDATORS: Validator[] = [
  // NaaS providers (canton.foundation/validators 페이지 명시)
  { name: "Kiln", domain: "kiln.fi", category: "infrastructure", note_ko: "Canton 공인 NaaS 제공자", note_en: "Canton-approved NaaS provider" },
  { name: "P2P.org", domain: "p2p.org", category: "infrastructure", note_ko: "Canton 공인 NaaS 제공자", note_en: "Canton-approved NaaS provider" },
  { name: "Figment", domain: "figment.io", category: "infrastructure", note_ko: "Canton 공인 NaaS 제공자", note_en: "Canton-approved NaaS provider" },
  { name: "Blockdaemon", domain: "blockdaemon.com", category: "infrastructure", note_ko: "기관급 노드 인프라", note_en: "Institutional node infra" },
  { name: "01node", domain: "01node.com", category: "infrastructure", note_ko: "ccview에서 활성 확인", note_en: "Active on ccview" },
  // Custody (잘 알려진 기관)
  { name: "Copper", domain: "copper.co", category: "custody", note_ko: "기관 커스터디 · 활성 검증됨", note_en: "Institutional custody · verified active" },
  { name: "Fireblocks", domain: "fireblocks.com", category: "custody", note_ko: "디지털 자산 커스터디", note_en: "Digital asset custody" },
  { name: "Anchorage Digital", domain: "anchorage.com", category: "custody", note_ko: "디지털 자산 은행", note_en: "Digital asset bank" },
  { name: "Crypto Finance", domain: "cryptofinance.ag", category: "custody" },
  // Exchanges (CC 거래소)
  { name: "Coinone", domain: "coinone.co.kr", category: "exchange", note_ko: "한국 거래소 · ccview 활성 확인", note_en: "Korean exchange · verified active" },
  // Apps/Ecosystem participants who run validators
  { name: "Hashnote", domain: "hashnote.com", category: "ecosystem", note_ko: "토큰화 머니마켓 펀드", note_en: "Tokenized money market fund" },
  { name: "Brale", domain: "brale.xyz", category: "ecosystem", note_ko: "스테이블코인 발행 플랫폼", note_en: "Stablecoin issuance platform" },
  { name: "Cantonloop", domain: "cantonloop.io", category: "ecosystem", note_ko: "Canton 생태계 앱", note_en: "Canton ecosystem app" },
  { name: "Cantex", domain: "cantex.io", category: "ecosystem" },
  { name: "AngelHack", domain: "angelhack.com", category: "ecosystem", note_ko: "개발자 커뮤니티", note_en: "Developer community" },
  { name: "Cantor 8 Digik", domain: "cantorfitzgerald.com", category: "ecosystem", note_ko: "최상위 보상 앱", note_en: "Top reward app" },
  { name: "Temple Digital Group", domain: "templedg.com", category: "ecosystem" },
  { name: "Hello Moon", domain: "hellomoon.io", category: "ecosystem" },
  { name: "Alpha DNA", domain: "alphadna.io", category: "ecosystem" },
  { name: "Tradefast", domain: "tradefast.io", category: "ecosystem" },
];

const CATEGORY_COLOR: Record<string, string> = {
  infrastructure: "#60a5fa",
  custody: "#a78bfa",
  exchange: "#34d399",
  ecosystem: "#fb923c",
};

const CATEGORY_LABEL_KO: Record<string, string> = {
  infrastructure: "노드 인프라",
  custody: "커스터디",
  exchange: "거래소",
  ecosystem: "생태계 앱",
};

const CATEGORY_LABEL_EN: Record<string, string> = {
  infrastructure: "Infrastructure",
  custody: "Custody",
  exchange: "Exchange",
  ecosystem: "Ecosystem App",
};

function PartnerLogo({ domain, name, size = 24 }: { domain: string; name: string; size?: number }) {
  const [error, setError] = useState(false);
  const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  if (error) {
    return (
      <div
        className="rounded bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

export default function ConsensusParticipants({ lang }: Props) {
  const title = lang === "ko" ? "Canton 컨센서스 참여자" : "Canton Consensus Participants";

  // Group validators by category
  const grouped = NOTABLE_VALIDATORS.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, Validator[]>);

  const categoryLabels = lang === "ko" ? CATEGORY_LABEL_KO : CATEGORY_LABEL_EN;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "Canton Network의 합의를 운영하는 검증된 기관들"
            : "Verified organizations running Canton Network consensus"}
        </p>
      </div>

      {/* === Super Validators === */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-canton-lime" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-canton-lime">
            Super Validators
          </span>
          <span className="text-[10px] text-zinc-700">{SUPER_VALIDATORS.length}</span>
          <span className="text-[10px] text-zinc-700 ml-auto">
            {lang === "ko" ? "Total Earned 기준 정렬" : "Sorted by Total Earned"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPER_VALIDATORS.map((sv) => {
            const note = lang === "ko" ? sv.note_ko : sv.note_en;
            return (
              <div
                key={sv.name}
                className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/50 border border-canton-border rounded-md hover:border-canton-lime/30 transition"
              >
                <PartnerLogo domain={sv.domain} name={sv.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-100 font-medium truncate">{sv.name}</div>
                  {note && <div className="text-[10px] text-zinc-600 truncate">{note}</div>}
                </div>
                {sv.weight && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-zinc-600">W</div>
                    <div className="text-[11px] text-canton-lime font-bold">{sv.weight}</div>
                  </div>
                )}
                {sv.earned && (
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-[10px] text-zinc-600">{lang === "ko" ? "획득" : "Earned"}</div>
                    <div className="text-[11px] text-zinc-300 font-bold">{sv.earned}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === Notable Regular Validators === */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
            {lang === "ko" ? "주요 일반 Validators" : "Notable Validators"}
          </span>
          <span className="text-[10px] text-zinc-700">{NOTABLE_VALIDATORS.length}</span>
          <span className="text-[10px] text-zinc-700 ml-auto">
            {lang === "ko" ? "전체 1,007개 활성 (881)" : "1,007 total · 881 active"}
          </span>
        </div>

        {(["infrastructure", "custody", "exchange", "ecosystem"] as const).map((cat) => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-4 last:mb-0">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: CATEGORY_COLOR[cat] }}>
                  {categoryLabels[cat]}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((v) => {
                  const note = lang === "ko" ? v.note_ko : v.note_en;
                  return (
                    <div
                      key={v.name}
                      className="flex items-center gap-2.5 px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
                    >
                      <PartnerLogo domain={v.domain} name={v.name} size={22} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-zinc-200 truncate">{v.name}</div>
                        {note && <div className="text-[10px] text-zinc-600 truncate">{note}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <a
          href="https://ccview.io/validators"
          target="_blank"
          rel="noopener"
          className="block text-center mt-4 py-2 text-[11px] text-zinc-500 hover:text-canton-lime transition border border-canton-border rounded-md"
        >
          {lang === "ko" ? "전체 1,007개 Validator 보기 (ccview.io) →" : "View all 1,007 validators on ccview.io →"}
        </a>
      </div>

      <div className="mt-4 pt-3 border-t border-canton-border space-y-1">
        <p className="text-[10px] text-zinc-700 leading-relaxed">
          {lang === "ko"
            ? "출처: ccview.io/super-validators (실시간 데이터), canton.foundation/validators (NaaS 제공자 목록)"
            : "Sources: ccview.io/super-validators (live data), canton.foundation/validators (NaaS providers)"}
        </p>
      </div>
    </div>
  );
}
