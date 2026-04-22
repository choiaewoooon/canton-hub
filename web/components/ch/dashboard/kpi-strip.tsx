"use client";

import RechartsSparkline from "../recharts-sparkline";
import { useChart } from "@/lib/api";
import { burnSeries } from "@/lib/chart-utils";
import { CH_DATA } from "@/lib/dummy-data";
import { fmtLargeUsd, fmtNum, fmtPct } from "@/lib/format";
import type { NetworkData, NetworkStatus } from "@/lib/types";

interface Props {
  network: NetworkData | undefined;
  status: NetworkStatus | undefined;
}

export default function KpiStrip({ network, status }: Props) {
  const activeAddrs = network?.active_addresses_24h ?? CH_DATA.activeAddrs;
  const activeDelta = network?.active_addresses_change ?? CH_DATA.activeDelta;
  const burnUsd = network?.daily_burn_usd ?? CH_DATA.dailyBurnUsd;
  const burnDelta = network?.daily_burn_change ?? CH_DATA.burnDelta;
  const transfers = status?.total_transfers_24h ?? CH_DATA.transfers24;
  const sv = status?.super_validators ?? CH_DATA.superValidators;
  const validatorNodes = status?.validator_nodes ?? CH_DATA.validatorNodes;

  // Real 7-day burn sparkline
  const { data: burnChart } = useChart("burn", "7d");
  const realBurn = burnSeries(burnChart);
  const burnSpark = realBurn.length > 1 ? realBurn : CH_DATA.burnSpark.slice(-14);

  return (
    <div className="ch-kpi-strip">
      <div className="ch-kpi">
        <div className="label">Active Addresses (24h)</div>
        <div className="value-row">
          <span className="value">{fmtNum(activeAddrs)}</span>
          <span className={`ch-chip ${activeDelta >= 0 ? "up" : "down"} ch-chip-xs`}>
            {fmtPct(activeDelta)}
          </span>
        </div>
        <RechartsSparkline data={CH_DATA.addrSeries} color="var(--canton-up)" height={22} className="spark" />
      </div>
      <div className="ch-kpi">
        <div className="label">Daily Burn (USD)</div>
        <div className="value-row">
          <span className="value">{fmtLargeUsd(burnUsd)}</span>
          <span className={`ch-chip ${burnDelta >= 0 ? "up" : "down"} ch-chip-xs`}>
            {fmtPct(burnDelta)}
          </span>
        </div>
        <RechartsSparkline data={burnSpark} color="var(--canton-burn)" height={22} className="spark" />
      </div>
      <div className="ch-kpi">
        <div className="label">Transfers (24h)</div>
        <div className="value-row">
          <span className="value">{fmtNum(transfers)}</span>
          <span className="ch-chip up ch-chip-xs">+3.7%</span>
        </div>
        <RechartsSparkline
          data={CH_DATA.privateSpark.slice(-14)}
          color="var(--canton-mint)"
          height={22}
          className="spark"
        />
      </div>
      <div className="ch-kpi">
        <div className="label">Super Validators</div>
        <div className="value-row">
          <span className="value">{sv}</span>
          <span className="ch-chip muted ch-chip-xs">+2</span>
        </div>
        <div className="delta">{validatorNodes} validator nodes · 99.98% uptime</div>
      </div>
    </div>
  );
}
