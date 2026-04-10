export function fmtUsd(n: number | null): string {
  if (n === null) return "N/A";
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(4)}`;
}

export function fmtLargeUsd(n: number | null): string {
  if (n === null) return "N/A";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtCc(n: number | null): string {
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B CC`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M CC`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K CC`;
  return `${n.toLocaleString()} CC`;
}

export function fmtNum(n: number | null): string {
  if (n === null) return "N/A";
  return n.toLocaleString("en-US");
}

export function fmtPct(n: number | null): string {
  if (n === null) return "";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
