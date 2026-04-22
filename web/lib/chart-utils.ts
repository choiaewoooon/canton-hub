import type { ChartPoint } from "./types";

export function extractNumbers<T>(
  data: T[] | undefined,
  key: keyof T,
): number[] {
  if (!data || data.length === 0) return [];
  const out: number[] = [];
  for (const row of data) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function priceSeries(data: ChartPoint[] | undefined): number[] {
  return extractNumbers(data, "close");
}

export function burnSeries(data: ChartPoint[] | undefined): number[] {
  return extractNumbers(data, "burn");
}

export function bmSeries(data: ChartPoint[] | undefined): number[] {
  return extractNumbers(data, "ratio");
}

/** Map handoff-style uppercase period label to backend lowercase period string. */
export function normalizePeriod(period: string): string {
  return period.toLowerCase();
}
