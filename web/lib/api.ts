import useSWR from "swr";
import type {
  PriceData,
  NetworkData,
  NetworkStatus,
  ChartPoint,
  FeedData,
  GovernanceData,
  RewardSplitPoint,
  AmuletPricePoint,
  CumulativePoint,
  BurnBreakdown,
  ExchangesData,
  RealtimePrices,
  HoldersData,
  KrCompaniesData,
  TrendingData,
  KpiHistoryData,
  FundingRates,
} from "./types";

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

export function useFeed(lang: string, page: number = 1) {
  return useSWR<FeedData>(`${API}/api/feed?lang=${lang}&page=${page}`, fetcher, { refreshInterval: 900_000 });
}

export function useGovernance() {
  return useSWR<GovernanceData>(`${API}/api/governance`, fetcher, { refreshInterval: 3_600_000 });
}

export function useRewardSplit(period: string) {
  return useSWR<RewardSplitPoint[]>(`${API}/api/analytics/reward-split?period=${period}`, fetcher, {
    refreshInterval: 900_000,
  });
}

export function useAmuletPrice(period: string) {
  return useSWR<AmuletPricePoint[]>(`${API}/api/analytics/amulet-price?period=${period}`, fetcher, {
    refreshInterval: 900_000,
  });
}

export function useCumulative(period: string) {
  return useSWR<CumulativePoint[]>(`${API}/api/analytics/cumulative?period=${period}`, fetcher, {
    refreshInterval: 900_000,
  });
}

export function useBurnBreakdown() {
  return useSWR<BurnBreakdown>(`${API}/api/analytics/burn-breakdown`, fetcher, {
    refreshInterval: 900_000,
  });
}

export function useExchanges() {
  return useSWR<ExchangesData>(`${API}/api/analytics/exchanges`, fetcher, {
    refreshInterval: 900_000,
  });
}

export function useRealtimePrices() {
  return useSWR<RealtimePrices>(`${API}/api/analytics/realtime-prices`, fetcher, {
    refreshInterval: 5_000,
    revalidateOnFocus: false,
  });
}

export function useHolders() {
  return useSWR<HoldersData>(`${API}/api/analytics/holders`, fetcher, {
    refreshInterval: 3_600_000, // 1h
  });
}

export function useKrCompanies() {
  return useSWR<KrCompaniesData>(`${API}/api/analytics/kr-companies`, fetcher, {
    refreshInterval: 1_800_000, // 30min
  });
}

export function useTrending() {
  return useSWR<TrendingData>(`${API}/api/analytics/trending`, fetcher, {
    refreshInterval: 900_000, // 15min
  });
}

export function useKpiHistory() {
  return useSWR<KpiHistoryData>(`${API}/api/analytics/kpi-history`, fetcher, {
    refreshInterval: 600_000, // 10min
  });
}

export function useFundingRates() {
  return useSWR<FundingRates>(`${API}/api/analytics/funding-rates`, fetcher, {
    refreshInterval: 30_000,
    fallbackData: { rates: [], updated_at: null },
  });
}
