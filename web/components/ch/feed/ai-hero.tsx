"use client";

import { useState } from "react";

const RANGES = ["6H", "오늘", "7D"] as const;
type Range = (typeof RANGES)[number];

export default function AiHero({ aiSummary }: { aiSummary?: string }) {
  const [range, setRange] = useState<Range>("오늘");
  const hasReal = !!aiSummary?.trim();

  return (
    <div className="ch-ai-hero">
      <div className="head">
        <div className="head-left">
          <div className="ch-ai-badge">AI</div>
          <div>
            <div className="head-title">오늘의 Canton 요약</div>
            <div className="head-sub">
              <span className="d" />
              LAST UPDATED · 2 MIN AGO
            </div>
          </div>
        </div>
        <div className="ch-ai-range">
          {RANGES.map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="ch-ai-body">
        {hasReal ? (
          <div
            className="ch-ai-highlight"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {aiSummary}
          </div>
        ) : (
          <div className="ch-ai-highlight">
            <em>기관 채택 가속</em> — 24시간 동안 Canton은 <strong>CC +4.72%</strong> 상승,{" "}
            <strong>B/M 1.28x</strong> 디플레이션 기조를 유지하며, 아시아 기반 금융사 4곳이 새로
            Super Validator로 합류했습니다.
          </div>
        )}
        {!hasReal && (
        <div className="ch-ai-bullets">
          <div className="ch-ai-bullet">
            <div className="num">1</div>
            <div>
              <b>Global Synchronizer v2.1</b>이 배포되어 블록 파이널리티 평균이 2.3초에서{" "}
              <b>1.8초로 단축</b>. 프라이빗 트랜잭션 처리량 +18% 개선.
            </div>
          </div>
          <div className="ch-ai-bullet">
            <div className="num">2</div>
            <div>
              <b>CIP-47 거버넌스 제안</b>이 투표 73% 찬성으로 진행 중. 통과 시 장기 스테이커 보상
              +15%, 연간 발행량 약 8% 감소 예상.
            </div>
          </div>
          <div className="ch-ai-bullet">
            <div className="num">3</div>
            <div>
              Broadridge, Paxos 등 <b>5개 기관</b>이 Super Validator에 추가 합류 — 총 42개 운영.
              토큰화 국채 파일럿 처리 비중 확대.
            </div>
          </div>
          <div className="ch-ai-bullet">
            <div className="num">4</div>
            <div>
              프라이빗 레이어 사용률 <b>67.4%</b>로 지난달 대비 +4.3%p 상승. 기관 활동 증가 신호.
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="ch-ai-footer">
        <div className="ch-ai-sources">
          <span>Sources:</span>
          <span className="ch-src-chip">Canton Foundation</span>
          <span className="ch-src-chip">Digital Asset</span>
          <span className="ch-src-chip">Cointelegraph</span>
          <span className="ch-src-chip">+11</span>
        </div>
        <span>14 기사 · 3,428 단어 요약</span>
      </div>
    </div>
  );
}
