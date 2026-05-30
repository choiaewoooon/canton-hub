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

const REL_LABELS: Record<
  string,
  { now: string; min: (n: number) => string; hour: (n: number) => string; day: (n: number) => string }
> = {
  ko: { now: "방금 전", min: (n) => `${n}분 전`, hour: (n) => `${n}시간 전`, day: (n) => `${n}일 전` },
  en: { now: "just now", min: (n) => `${n}m ago`, hour: (n) => `${n}h ago`, day: (n) => `${n}d ago` },
  ja: { now: "たった今", min: (n) => `${n}分前`, hour: (n) => `${n}時間前`, day: (n) => `${n}日前` },
  zh: { now: "刚刚", min: (n) => `${n}分钟前`, hour: (n) => `${n}小时前`, day: (n) => `${n}天前` },
};

/**
 * ISO 타임스탬프 → 현지화된 상대시간 문자열.
 * `now`(ms)를 인자로 받아 useNow 틱마다 재계산되도록 한다.
 */
export function relativeTime(iso: string | undefined, lang: string, now: number = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const labels = REL_LABELS[lang] || REL_LABELS.en;
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return labels.now;
  if (s < 3600) return labels.min(Math.floor(s / 60));
  if (s < 86400) return labels.hour(Math.floor(s / 3600));
  return labels.day(Math.floor(s / 86400));
}

/** ISO 타임스탬프 → 절대 시각(한국시간) 문자열. 툴팁/병기용. */
export function kstTimestamp(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " KST"
  );
}

// 남은 시간(초) → "5h 21m" / "43m" / "Settling..." (lang 분기)
export function formatDuration(seconds: number, lang: string, short = false): string {
  if (seconds <= 0) return lang === "ko" ? "정산 중..." : "Settling...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return short ? `${h}h` : `${h}h ${m}m`;
  return `${m}m`;
}

// 경과 시간(초) → "12s ago" / "12초 전"
export function formatAgo(seconds: number, lang: string): string {
  const ko = lang === "ko";
  if (seconds < 60) return ko ? `${seconds}초 전` : `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  return ko ? `${m}분 전` : `${m}m ago`;
}
