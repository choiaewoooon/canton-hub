"use client";

interface Props {
  lang: string;
}

interface Partner {
  name: string;
  role_ko: string;
  role_en: string;
  category: "founding" | "validator" | "investor" | "app";
}

// Source: Canton Network public partner list and CIP records
const PARTNERS: Partner[] = [
  // Founding consortium
  { name: "BNP Paribas", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  { name: "Goldman Sachs", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  { name: "Microsoft", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  { name: "Deutsche Börse", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  { name: "Cboe", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  { name: "Moody's", role_ko: "창립 컨소시엄", role_en: "Founding Consortium", category: "founding" },
  // Super Validators
  { name: "Visa", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  { name: "Cumberland (DRW)", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  { name: "Broadridge", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  { name: "DTCC", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  { name: "Tradeweb", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  { name: "Apollo", role_ko: "Super Validator", role_en: "Super Validator", category: "validator" },
  // Investors
  { name: "DRW Trading", role_ko: "주요 투자자", role_en: "Lead Investor", category: "investor" },
  { name: "Tradeweb", role_ko: "주요 투자자", role_en: "Lead Investor", category: "investor" },
  // Apps
  { name: "Brale", role_ko: "토큰화 앱", role_en: "Tokenization App", category: "app" },
  { name: "Hashnote", role_ko: "RWA 앱", role_en: "RWA App", category: "app" },
  { name: "Cantor 8 Digik", role_ko: "최상위 앱", role_en: "Top Reward App", category: "app" },
  { name: "Temple Digital Group", role_ko: "토큰화 앱", role_en: "Tokenization App", category: "app" },
];

const COLORS: Record<string, string> = {
  founding: "#c8e64a",
  validator: "#60a5fa",
  investor: "#fb923c",
  app: "#a78bfa",
};

const LABELS_KO: Record<string, string> = {
  founding: "창립 컨소시엄",
  validator: "Super Validator",
  investor: "주요 투자자",
  app: "주요 앱",
};

const LABELS_EN: Record<string, string> = {
  founding: "Founding",
  validator: "Validators",
  investor: "Investors",
  app: "Top Apps",
};

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
            ? "Canton Network에 참여 중인 기관들 — 월스트리트가 직접 운영하는 블록체인"
            : "Institutions running Canton — the blockchain Wall Street built"}
        </p>
      </div>

      <div className="space-y-4">
        {(["founding", "validator", "investor", "app"] as const).map((cat) => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[cat] }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: COLORS[cat] }}>
                  {labels[cat]}
                </span>
                <span className="text-[10px] text-zinc-700">{items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((p) => (
                  <div
                    key={p.name}
                    className="px-3 py-2 bg-zinc-900/50 border border-canton-border rounded-md text-[12px] text-zinc-300"
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-canton-border">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {lang === "ko"
            ? "💡 Canton은 토큰화된 자산 규모가 $6T+ 입니다. 대부분 국가의 GDP보다 큽니다."
            : "💡 Canton hosts $6T+ in tokenized assets — larger than the GDP of most countries."}
        </p>
      </div>
    </div>
  );
}
