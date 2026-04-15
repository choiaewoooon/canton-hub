"use client";

import Image from "next/image";
import { useState } from "react";
import { useKrCompanies } from "@/lib/api";
import { fmtCc } from "@/lib/format";
import type { KrCompany, KrWallet } from "@/lib/types";

interface Props {
  lang: string;
}

const ROLE_STYLE: Record<string, { ko: string; en: string; color: string; icon: string }> = {
  cold_wallet: { ko: "Cold Storage", en: "Cold Storage", color: "#60a5fa", icon: "🥶" },
  validator: { ko: "Validator", en: "Validator", color: "#c8e64a", icon: "⚡" },
  operational: { ko: "Operational", en: "Operational", color: "#a78bfa", icon: "🏦" },
  test: { ko: "Test", en: "Test", color: "#71717a", icon: "🧪" },
  subsidiary: { ko: "자회사", en: "Subsidiary", color: "#fb923c", icon: "🏢" },
};

const CONFIDENCE_STYLE: Record<string, { ko: string; en: string; color: string; bg: string }> = {
  high: { ko: "증거 강함", en: "Strong", color: "#4ade80", bg: "#4ade8014" },
  medium: { ko: "증거 중간", en: "Medium", color: "#fbbf24", bg: "#fbbf2414" },
  low: { ko: "증거 약함", en: "Weak", color: "#fb7185", bg: "#fb718514" },
};

function CompanyLogo({ domain, name, size = 40 }: { domain: string; name: string; size?: number }) {
  const [error, setError] = useState(false);
  if (error || !domain) {
    return (
      <div
        className="rounded-md bg-canton-lime/10 border border-canton-lime/30 flex items-center justify-center font-black text-canton-lime shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded-md shrink-0 bg-white/5"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

function WalletRow({ wallet, lang }: { wallet: KrWallet; lang: string }) {
  const style = ROLE_STYLE[wallet.role] || ROLE_STYLE.operational;
  const note = lang === "ko" ? wallet.note_ko : wallet.note_en;
  const roleLabel = lang === "ko" ? style.ko : style.en;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/40 border border-canton-border rounded-md">
      <div className="shrink-0 w-6 text-center text-lg">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <code className="text-[11px] text-zinc-300 font-mono truncate">{wallet.short_id}</code>
          <span
            className="text-[9px] font-bold px-1 rounded shrink-0"
            style={{ color: style.color, background: `${style.color}1a` }}
          >
            {roleLabel}
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 truncate mt-0.5">{note}</div>
      </div>
      <div className="text-right shrink-0 w-24">
        <div className="text-[12px] text-zinc-100 font-bold">{fmtCc(wallet.total_balance)}</div>
        {wallet.locked_balance > 0 && (
          <div className="text-[9px] text-canton-private">
            {((wallet.locked_balance / wallet.total_balance) * 100).toFixed(0)}%{" "}
            {lang === "ko" ? "잠김" : "locked"}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ company, lang, expanded, onToggle }: {
  company: KrCompany;
  lang: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const name = lang === "ko" ? company.name_ko : company.name_en;
  const desc = lang === "ko" ? company.description_ko : company.description_en;
  const insight = lang === "ko" ? company.insight_ko : company.insight_en;
  const evidence = lang === "ko" ? company.evidence_ko : company.evidence_en;
  const confStyle = CONFIDENCE_STYLE[company.confidence] || CONFIDENCE_STYLE.medium;
  const confLabel = lang === "ko" ? confStyle.ko : confStyle.en;
  const verifyBadge =
    company.verification_status === "confirmed"
      ? { ko: "✓ 공식 확인", en: "✓ Confirmed", color: "#4ade80", bg: "#4ade8014" }
      : { ko: "⚠ 온체인 근거만", en: "⚠ On-chain only", color: "#fbbf24", bg: "#fbbf2414" };
  const verifyLabel = lang === "ko" ? verifyBadge.ko : verifyBadge.en;

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 hover:bg-zinc-900/30 transition text-left"
      >
        <CompanyLogo domain={company.domain} name={company.name_en} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[16px] font-bold text-zinc-50">{name}</h3>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: verifyBadge.color, background: verifyBadge.bg }}
            >
              {verifyLabel}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: confStyle.color, background: confStyle.bg }}
            >
              {confLabel}
            </span>
            <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">
              {company.wallet_count} {lang === "ko" ? "지갑" : "wallets"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{desc}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
            {lang === "ko" ? "총 보유량" : "Total Balance"}
          </div>
          <div className="text-[18px] font-bold text-canton-lime">{fmtCc(company.total_balance)}</div>
        </div>
        <div className={`text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`}>
          ▼
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-canton-border pt-4">
          {/* Insight */}
          <div className="text-[12px] text-zinc-300 leading-relaxed bg-canton-lime/5 border-l-2 border-canton-lime px-3 py-2 rounded">
            {insight}
          </div>

          {/* Evidence */}
          {evidence && evidence.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                <span>{lang === "ko" ? "검증 근거" : "Verification Evidence"}</span>
                <span
                  className="text-[9px] font-bold px-1 rounded normal-case tracking-normal"
                  style={{ color: confStyle.color, background: confStyle.bg }}
                >
                  {confLabel}
                </span>
              </div>
              <ul className="space-y-1">
                {evidence.map((item, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-zinc-400 leading-relaxed flex gap-2 pl-1"
                  >
                    <span className="text-canton-lime shrink-0 mt-0.5">›</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Wallets */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "지갑 목록 (잔액 순)" : "Wallet List (by balance)"}
            </div>
            {company.wallets.map((w) => (
              <WalletRow key={w.short_id} wallet={w} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KoreanCompanies({ lang }: Props) {
  const { data } = useKrCompanies();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const companies = data?.companies || [];
  const grandTotal = data?.grand_total_balance || 0;

  const title = lang === "ko" ? "🏢 주요 거래소 Canton 참여 현황" : "🏢 Major Exchanges on Canton";
  const subtitle =
    lang === "ko"
      ? "한국 4개 거래소 + Binance (글로벌) · CantonScan 온체인 데이터 + 트랜잭션 역추적으로 검증 · 30분마다 갱신"
      : "4 Korean exchanges + Binance (global) · verified via CantonScan on-chain data + transaction tracing · refreshed every 30 min";

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="bg-gradient-to-br from-canton-lime/5 to-transparent border border-canton-lime/20 rounded-[10px] p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-zinc-50">{title}</h2>
            <p className="text-[11px] text-zinc-500 mt-1">{subtitle}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
              {lang === "ko" ? "전체 합계" : "Grand Total"}
            </div>
            <div className="text-[22px] font-bold text-canton-lime">{fmtCc(grandTotal)}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              {companies.length} {lang === "ko" ? "기업" : "companies"} ·{" "}
              {data?.total_wallet_count ?? 0} {lang === "ko" ? "지갑" : "wallets"}
            </div>
          </div>
        </div>
      </div>

      {/* Companies list */}
      {companies.length === 0 ? (
        <div className="bg-canton-card border border-canton-border rounded-[10px] p-5 text-center text-[12px] text-zinc-600">
          {lang === "ko" ? "로딩 중..." : "Loading..."}
        </div>
      ) : (
        companies.map((company) => (
          <CompanyCard
            key={company.slug}
            company={company}
            lang={lang}
            expanded={expandedSlug === company.slug}
            onToggle={() =>
              setExpandedSlug(expandedSlug === company.slug ? null : company.slug)
            }
          />
        ))
      )}

      {/* Footer note */}
      <div className="text-[10px] text-zinc-700 leading-relaxed px-2 space-y-1">
        <div>
          {lang === "ko"
            ? "⚠ Canton Network는 공식 KYC/verification 시스템이 없어 모든 기업은 '온체인 근거만'으로 식별됨. Validator 등록 시 기업 도메인 이메일과 GSF(Global Synchronizer Foundation) sponsor 승인이 필요하므로 사칭은 어려우나, 절대적 확실성은 보장되지 않음."
            : "⚠ Canton Network has no official KYC/verification system — all companies are identified via on-chain evidence only. Validator registration requires corporate domain email + GSF (Global Synchronizer Foundation) sponsor approval, making impersonation hard but not impossible."}
        </div>
        <div>
          {lang === "ko"
            ? "* 지갑 구조는 CantonScan API 온체인 데이터 + 트랜잭션 역추적으로 교차 검증됨 · 각 기업의 '검증 근거' 섹션에서 상세 출처 확인 가능."
            : "* Wallet clusters cross-verified via CantonScan API on-chain data + transaction tracing · See each company's 'Verification Evidence' section for sources."}
        </div>
      </div>
    </div>
  );
}
