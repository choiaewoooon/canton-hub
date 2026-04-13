"use client";

interface Props {
  lang: string;
}

interface Path {
  icon: string;
  title_ko: string;
  title_en: string;
  desc_ko: string;
  desc_en: string;
  href: string;
  color: string;
}

const PATHS: Path[] = [
  {
    icon: "🧬",
    title_ko: "Daml로 자산 모델링 배우기",
    title_en: "Learn Daml & Model Assets Natively",
    desc_ko: "Canton의 핵심 언어 Daml을 학습하고 멀티파티 워크플로우를 직접 작성합니다.",
    desc_en: "Learn Daml, Canton's smart contract language, and write multi-party workflows.",
    href: "https://docs.daml.com/",
    color: "#c8e64a",
  },
  {
    icon: "🏗️",
    title_ko: "처음부터 앱 만들기",
    title_en: "Build Apps from First Principles",
    desc_ko: "Canton SDK로 처음부터 dApp을 설계하고 배포하는 전체 과정을 경험합니다.",
    desc_en: "Design and deploy dApps from scratch using the Canton SDK.",
    href: "https://docs.canton.network/",
    color: "#60a5fa",
  },
  {
    icon: "⚡",
    title_ko: "Canton Utilities로 빠르게 토큰화",
    title_en: "Tokenize Quickly with Canton Utilities",
    desc_ko: "기존에 만들어진 표준 컴포넌트를 활용해 RWA 토큰화를 빠르게 시작합니다.",
    desc_en: "Use pre-built standard components to bootstrap RWA tokenization.",
    href: "https://docs.canton.network/",
    color: "#a78bfa",
  },
  {
    icon: "🔗",
    title_ko: "기존 앱과 컴포저블 연동",
    title_en: "Compose with Existing Apps",
    desc_ko: "Canton의 합성성을 활용해 기존 dApp과 데이터·자산을 연결합니다.",
    desc_en: "Leverage Canton's composability to connect with existing dApps.",
    href: "https://docs.canton.network/",
    color: "#34d399",
  },
  {
    icon: "🏛️",
    title_ko: "CIP-56 기관 자산 표준 통합",
    title_en: "Integrate CIP-56 Institutional Asset Standards",
    desc_ko: "기관급 자산 표준을 적용해 컴플라이언스가 검증된 토큰을 만듭니다.",
    desc_en: "Apply institutional-grade asset standards for compliance-verified tokens.",
    href: "https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md",
    color: "#fb923c",
  },
];

export default function EcosystemGuide({ lang }: Props) {
  const title = lang === "ko" ? "Canton 입문자를 위한 5가지 경로" : "5 Paths for Canton Builders";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "Canton Network에 처음 진입한다면 이 경로 중 하나로 시작하세요."
            : "Pick one of these paths to begin building on Canton Network."}
        </p>
      </div>

      <div className="space-y-2">
        {PATHS.map((p, i) => (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener"
            className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition group"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0"
                style={{ background: `${p.color}1a`, border: `1px solid ${p.color}40` }}
              >
                {p.icon}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-zinc-100 group-hover:text-canton-lime transition">
                  {lang === "ko" ? p.title_ko : p.title_en}
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                  {lang === "ko" ? p.desc_ko : p.desc_en}
                </p>
              </div>
              <span className="text-zinc-600 group-hover:text-canton-lime transition">→</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
