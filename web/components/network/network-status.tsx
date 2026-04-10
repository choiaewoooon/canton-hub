"use client";

import { useNetworkStatus } from "@/lib/api";
import { fmtCc, fmtNum } from "@/lib/format";

export default function NetworkStatusCard() {
  const { data } = useNetworkStatus();

  const items = [
    { label: "Total Supply", value: data?.total_supply != null ? fmtCc(data.total_supply) : "N/A" },
    { label: "Super Validators", value: data?.super_validators != null ? String(data.super_validators) : "N/A" },
    { label: "Validator Nodes", value: data?.validator_nodes != null ? String(data.validator_nodes) : "N/A" },
    { label: "Transfers (24h)", value: data?.total_transfers_24h != null ? fmtNum(data.total_transfers_24h) : "N/A" },
    { label: "Cumulative Burned", value: data?.cumulative_burned != null ? fmtCc(data.cumulative_burned) : "N/A" },
    { label: "Burn Rate", value: data?.cumulative_burn_rate != null ? `${data.cumulative_burn_rate}%` : "N/A" },
  ];

  return (
    <div className="bg-canton-card border border-canton-border rounded-[10px] p-4">
      <span className="text-[13px] font-semibold text-zinc-400">Network Status</span>
      <div className="mt-3">
        {items.map((item, i) => (
          <div key={i} className={`flex justify-between items-center py-2 ${i < items.length - 1 ? "border-b border-canton-border" : ""}`}>
            <span className="text-[13px] text-zinc-500">{item.label}</span>
            <span className="text-[13px] text-zinc-200 font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
