"use client";

import Navbar from "@/components/nav/navbar";
import Footer from "@/components/footer";
import CompanyCard from "@/components/dat/company-card";
import { usePrice, useDat } from "@/lib/api";
import { useRealtimePrice } from "@/lib/sse";
import { useLang } from "@/lib/use-lang";
import { fmtCc, fmtLargeUsd } from "@/lib/format";

const T: Record<string, Record<string, string>> = {
  sub: {
    ko: "Canton 재무자산($CC)을 보유한 상장 기업 — 보유량 · mNAV · 평가손익. 참고용이며 투자 조언이 아닙니다.",
    en: "Public companies holding Canton ($CC) as a treasury asset — holdings, mNAV, P/L. For reference only, not investment advice.",
    ja: "Canton($CC)を財務資産として保有する上場企業 — 保有量・mNAV・損益。参考用であり投資助言ではありません。",
    zh: "将 Canton($CC) 作为储备资产持有的上市公司 — 持有量、mNAV、盈亏。仅供参考，非投资建议。",
  },
  companies: { ko: "추적 기업", en: "Companies", ja: "追跡企業", zh: "追踪公司" },
  totalCc: { ko: "합산 $CC 보유", en: "Total $CC Held", ja: "$CC保有合計", zh: "$CC 持有合计" },
  totalPl: { ko: "합산 평가손익", en: "Total P/L", ja: "損益合計", zh: "盈亏合计" },
  avgMnav: { ko: "평균 mNAV", en: "Avg mNAV", ja: "平均mNAV", zh: "平均 mNAV" },
  loading: { ko: "로딩 중", en: "Loading…", ja: "読み込み中", zh: "加载中" },
};
const tr = (k: string, lang: string) => T[k]?.[lang] ?? T[k]?.en ?? k;

export default function DatPage() {
  const [lang, setLang] = useLang();
  const { data: swrPrice } = usePrice();
  const { connected } = useRealtimePrice(swrPrice);
  const { data, isLoading } = useDat();

  const companies = data?.companies ?? [];
  const avgMnav = (() => {
    const vals = companies.map((c) => c.mnav).filter((m): m is number => m != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();
  const totalPlPositive = (data?.total_pl_usd ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-canton-bg flex flex-col">
      <Navbar lang={lang} onLangChange={setLang} connected={connected} />
      <main className="max-w-[1200px] w-full mx-auto px-6 py-5 flex-1">
        <div className="ch-page-header">
          <div>
            <h1>DAT Tracker</h1>
            <div className="sub">{tr("sub", lang)}</div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="ch-kpi-strip">
          <div className="ch-kpi">
            <div className="label">{tr("companies", lang)}</div>
            <div className="value-row"><span className="value">{data?.company_count ?? 0}</span></div>
          </div>
          <div className="ch-kpi">
            <div className="label">{tr("totalCc", lang)}</div>
            <div className="value-row"><span className="value">{fmtCc(data?.total_cc_holdings ?? 0)}</span></div>
          </div>
          <div className="ch-kpi">
            <div className="label">{tr("totalPl", lang)}</div>
            <div className="value-row">
              <span className="value" style={{ color: totalPlPositive ? "var(--canton-up)" : "var(--canton-down)" }}>
                {totalPlPositive ? "▲" : "▼"} {fmtLargeUsd(Math.abs(data?.total_pl_usd ?? 0))}
              </span>
            </div>
          </div>
          <div className="ch-kpi">
            <div className="label">{tr("avgMnav", lang)}</div>
            <div className="value-row"><span className="value">{avgMnav != null ? `${avgMnav.toFixed(2)}x` : "—"}</span></div>
          </div>
        </div>

        {/* Company cards */}
        {isLoading && companies.length === 0 ? (
          <div className="ch-skel" style={{ height: 320 }}>{tr("loading", lang)}</div>
        ) : (
          <div className="ch-dat-list">
            {companies.map((c) => (
              <CompanyCard key={c.ticker} c={c} lang={lang} />
            ))}
          </div>
        )}

        {/* Data sources */}
        <div className="ch-card" style={{ marginTop: 24 }}>
          <div className="ch-card-title" style={{ marginBottom: 8 }}>Data Sources</div>
          <div style={{ overflowX: "auto" }}>
            <table className="ch-data-table" style={{ minWidth: 360 }}>
              <thead>
                <tr><th>Data</th><th>Source</th><th>Update</th></tr>
              </thead>
              <tbody>
                <tr><td>Stock Price / Market Cap</td><td>stooq.com → Yahoo Finance</td><td>5 min</td></tr>
                <tr><td>$CC Price</td><td>CoinGecko (Canton Hub)</td><td>30 sec</td></tr>
                <tr><td>CC Holdings / Avg Buy</td><td>Official filings (manual)</td><td>On announcement</td></tr>
                <tr><td>USD/KRW</td><td>open.er-api.com</td><td>5 min</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
