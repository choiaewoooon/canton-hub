"use client";

import { CH_DATA } from "@/lib/dummy-data";
import { fmtNum } from "@/lib/format";
import type { NetworkStatus as NetworkStatusType } from "@/lib/types";

function fmtSupply(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B CC`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M CC`;
  return `${n.toLocaleString()} CC`;
}

export default function NetworkStatusCard({ status }: { status: NetworkStatusType | undefined }) {
  const totalSupply = status?.total_supply ? fmtSupply(status.total_supply) : CH_DATA.totalSupply;
  const sv = status?.super_validators ?? CH_DATA.superValidators;
  const nodes = status?.validator_nodes ?? CH_DATA.validatorNodes;
  const transfers = status?.total_transfers_24h ?? CH_DATA.transfers24;
  const cumBurned = status?.cumulative_burned
    ? fmtSupply(status.cumulative_burned)
    : CH_DATA.cumBurned;
  const burnRate = status?.cumulative_burn_rate ?? CH_DATA.burnRate;

  return (
    <div className="ch-card">
      <div className="ch-card-head">
        <span className="ch-card-title">Network Status</span>
        <span className="ch-card-sub">Updated 4s ago</span>
      </div>
      <div>
        <div className="ch-ns-row">
          <span className="k">Total Supply</span>
          <span className="v">{totalSupply}</span>
        </div>
        <div className="ch-ns-row">
          <span className="k">Super Validators</span>
          <span className="v">{sv}</span>
        </div>
        <div className="ch-ns-row">
          <span className="k">Validator Nodes</span>
          <span className="v">{nodes}</span>
        </div>
        <div className="ch-ns-row">
          <span className="k">Transfers (24h)</span>
          <span className="v">{fmtNum(transfers)}</span>
        </div>
        <div className="ch-ns-row">
          <span className="k">Cumulative Burned</span>
          <span className="v">{cumBurned}</span>
        </div>
        <div className="ch-ns-row">
          <span className="k">Burn Rate</span>
          <span className="v">{burnRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
