import useSWR from "swr";
import type { PriceData, NetworkData, NetworkStatus, ChartPoint, FeedData, GovernanceData } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePrice() {
  return useSWR<PriceData>(`${API}/api/price`, fetcher, { refreshInterval: 30_000 });
}

export function useNetwork() {
  return useSWR<NetworkData>(`${API}/api/network`, fetcher, { refreshInterval: 300_000 });
}

export function useNetworkStatus() {
  return useSWR<NetworkStatus>(`${API}/api/network/status`, fetcher, { refreshInterval: 3_600_000 });
}

export function useChart(type: string, period: string) {
  return useSWR<ChartPoint[]>(`${API}/api/chart/${type}?period=${period}`, fetcher, { refreshInterval: 300_000 });
}

export function useFeed(lang: string) {
  return useSWR<FeedData>(`${API}/api/feed?lang=${lang}`, fetcher, { refreshInterval: 900_000 });
}

export function useGovernance() {
  return useSWR<GovernanceData>(`${API}/api/governance`, fetcher, { refreshInterval: 3_600_000 });
}
