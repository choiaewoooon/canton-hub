"use client";

import RechartsSparkline from "../recharts-sparkline";
import { useChart } from "@/lib/api";
import { CH_DATA } from "@/lib/dummy-data";
import { priceSeries } from "@/lib/chart-utils";
import { fmtUsd, fmtLargeUsd, fmtPct, fmtCc, fmtNum } from "@/lib/format";
import type { PriceData, NetworkData } from "@/lib/types";

interface Props {
  price: PriceData | undefined;
  network: NetworkData | undefined;
}

export default function Hero3Up({ price, network }: Props) {
  const priceVal = price?.current_price_usd ?? CH_DATA.price;
  const priceChange = price?.price_change_percentage_24h ?? CH_DATA.priceChangePct;
  const high24 = price?.high_24h ?? CH_DATA.high24;
  const low24 = price?.low_24h ?? CH_DATA.low24;
  const volume = price?.total_volume_24h ?? CH_DATA.vol24;
  const mcap = price?.market_cap ?? CH_DATA.mcap;

  const bmRatio = network?.bm_ratio ?? CH_DATA.bmRatio;
  const bmStatus = network?.bm_status ?? CH_DATA.bmStatus;
  const dailyMint = network?.daily_mint ?? CH_DATA.dailyMint;
  const dailyBurn = network?.daily_burn ?? CH_DATA.dailyBurn;
  const netSupply = network?.net_supply_change ?? dailyMint - dailyBurn;

  const privPct = network?.private_tx_ratio ?? CH_DATA.privateTxPct;
  const privCount = network?.private_tx_count ?? CH_DATA.privateTxCount;
  const publicCount = Math.max(0, Math.round(privCount / (privPct / 100) - privCount));

  // Real 24h price sparkline
  const { data: priceChart } = useChart("price", "24h");
  const realSpark = priceSeries(priceChart);
  const spark = realSpark.length > 1 ? realSpark : CH_DATA.priceSpark;

  const pointerPct = Math.max(0, Math.min(100, ((bmRatio - 0.5) / 1.0) * 100));
  const priceUp = priceChange >= 0;
  const bmDeflationary = bmStatus === "deflationary";

  return (
    <div className="ch-hero-3up">
      <div className="ch-hero-cell">
        <div className="eyebrow-row">
          <span className="ch-eyebrow">CC Price</span>
          <span className={`ch-chip ${priceUp ? "up" : "down"}`}>{fmtPct(priceChange)}</span>
        </div>
        <div className="v-row">
          <span className="value">{fmtUsd(priceVal)}</span>
        </div>
        <RechartsSparkline data={spark} color="var(--canton-lime)" height={40} className="spark" />
        <div className="row-stats">
          <div className="stat">
            <span className="k">24h High</span>
            <span className="v">{fmtUsd(high24)}</span>
          </div>
          <div className="stat">
            <span className="k">24h Low</span>
            <span className="v">{fmtUsd(low24)}</span>
          </div>
          <div className="stat">
            <span className="k">Volume</span>
            <span className="v">{fmtLargeUsd(volume)}</span>
          </div>
          <div className="stat">
            <span className="k">Market Cap</span>
            <span className="v">{fmtLargeUsd(mcap)}</span>
          </div>
        </div>
      </div>

      <div className="ch-hero-cell">
        <div className="eyebrow-row">
          <span className="ch-eyebrow">B/M Ratio</span>
          <span className={`ch-chip ${bmDeflationary ? "up" : "down"}`}>
            {bmDeflationary ? "Deflationary" : "Inflationary"}
          </span>
        </div>
        <div className="v-row">
          <span className="value lime">{bmRatio.toFixed(4)}x</span>
        </div>
        <div className="sub">Canton 고유 지표 — 번/민트 비율. 1.0x 초과 시 순공급 감소.</div>
        <div className="ch-bm-dial">
          <div className="track" />
          <div className="pointer" style={{ left: `${pointerPct}%` }} />
          <div className="axis">
            <span>0.5x</span>
            <span>1.0x</span>
            <span>1.5x</span>
          </div>
        </div>
        <div className="row-stats">
          <div className="stat">
            <span className="k">Minted (24h)</span>
            <span className="v">{fmtCc(dailyMint)}</span>
          </div>
          <div className="stat">
            <span className="k">Burned (24h)</span>
            <span className="v">{fmtCc(dailyBurn)}</span>
          </div>
          <div className="stat">
            <span className="k">Net Supply</span>
            <span
              className="v"
              style={{ color: netSupply < 0 ? "var(--canton-up)" : "var(--canton-down)" }}
            >
              {netSupply < 0 ? "−" : "+"}
              {fmtCc(Math.abs(netSupply))}
            </span>
          </div>
        </div>
      </div>

      <div className="ch-hero-cell">
        <div className="eyebrow-row">
          <span className="ch-eyebrow">Private TX (Institutional)</span>
          <span className="ch-chip private ch-chip-xs">기관</span>
        </div>
        <div className="v-row">
          <span className="value private">{privPct.toFixed(1)}%</span>
        </div>
        <div className="sub">Canton의 프라이빗 레이어 사용 비율. 기관 채택 신호.</div>
        <div className="ch-priv-bar-wrap">
          <div className="ch-priv-bar">
            <div className="fill" style={{ width: `${privPct}%` }} />
          </div>
          <div className="ch-priv-labels">
            <span className="p">Private {privPct.toFixed(1)}%</span>
            <span className="pu">Public {(100 - privPct).toFixed(1)}%</span>
          </div>
        </div>
        <div className="row-stats">
          <div className="stat">
            <span className="k">Private Updates</span>
            <span className="v">{fmtNum(privCount)}</span>
          </div>
          <div className="stat">
            <span className="k">Public Updates</span>
            <span className="v">{fmtNum(publicCount)}</span>
          </div>
          <div className="stat">
            <span className="k">Total (24h)</span>
            <span className="v">{fmtNum(privCount + publicCount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
