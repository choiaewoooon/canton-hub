"use client";

interface Props {
  lang: string;
}

interface Step {
  number: string;
  title_ko: string;
  title_en: string;
  desc_ko: string;
  desc_en: string;
  href: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title_ko: "Super Validator 되는 법",
    title_en: "Become a Super Validator",
    desc_ko: "Canton Foundation에 가입 → Tech & Ops Committee에서 챔피언 확보 → CIP 제안서 GitHub PR 제출 → SV 투표 통과",
    desc_en: "Join the Foundation → secure a Tech & Ops champion → submit CIP via GitHub PR → pass SV vote",
    href: "https://canton.foundation/join-the-foundation/",
  },
  {
    number: "02",
    title_ko: "CIP 제안하기",
    title_en: "Propose a CIP",
    desc_ko: "GitHub canton-foundation/cips 레포에서 PR 생성 → CIP 템플릿 작성 → 메일링 리스트로 토론 → SV 투표",
    desc_en: "Create PR on canton-foundation/cips → use CIP template → discuss on mailing list → SV vote",
    href: "https://github.com/canton-foundation/cips",
  },
  {
    number: "03",
    title_ko: "Canton Foundation 그랜트 신청",
    title_en: "Apply for a Foundation Grant",
    desc_ko: "Protocol Development Fund(CIP-0100)에서 5%의 네트워크 보상이 그랜트로 지급됩니다. 분기별 지원, 마일스톤 기반.",
    desc_en: "5% of network rewards fund grants via Protocol Development Fund (CIP-0100). Quarterly, milestone-based.",
    href: "https://canton.foundation/grants-program/",
  },
  {
    number: "04",
    title_ko: "Validator 노드 운영",
    title_en: "Run a Validator Node",
    desc_ko: "Super Validator가 아닌 일반 Validator는 누구나 운영 가능합니다. 자신이 참여하는 트랜잭션의 합의에 기여합니다.",
    desc_en: "Anyone can run a regular Validator. Participate in consensus for transactions you're a party to.",
    href: "https://docs.canton.network/",
  },
];

export default function ParticipationGuide({ lang }: Props) {
  const title = lang === "ko" ? "참여 가이드" : "How to Participate";

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {lang === "ko"
            ? "Canton 거버넌스에 참여하고 인센티브를 받는 방법"
            : "How to participate in Canton governance and earn incentives"}
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <a
            key={i}
            href={step.href}
            target="_blank"
            rel="noopener"
            className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition group"
          >
            <div className="flex gap-3">
              <div className="text-[20px] font-black text-canton-lime/30 w-8 shrink-0 leading-none">
                {step.number}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-zinc-100 group-hover:text-canton-lime transition">
                  {lang === "ko" ? step.title_ko : step.title_en}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {lang === "ko" ? step.desc_ko : step.desc_en}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
