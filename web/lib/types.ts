export interface PriceData {
  current_price_usd: number | null;
  price_change_percentage_24h: number | null;
  price_change_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  market_cap: number | null;
  total_volume_24h: number | null;
  circulating_supply: number | null;
}

export interface NetworkData {
  bm_ratio: number | null;
  bm_status: "deflationary" | "inflationary" | null;
  active_addresses_24h: number | null;
  active_addresses_change: number | null;
  daily_burn_usd: number | null;
  daily_burn_change: number | null;
  private_tx_ratio: number | null;
  private_tx_count: number | null;
  daily_mint: number | null;
  daily_burn: number | null;
  net_supply_change: number | null;
}

export interface NetworkStatus {
  total_supply: number | null;
  super_validators: number | null;
  validator_nodes: number | null;
  total_transfers_24h: number | null;
  cumulative_burned: number | null;
  cumulative_burn_rate: number | null;
}

export interface ChartPoint {
  time?: string;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  burn?: number;
  cumulative_burn?: number;
  ratio?: number;
}

export interface FeedItem {
  source: string;
  time_ago: string;
  text: string;
  url: string;
}

export interface FeedData {
  lang: string;
  items: FeedItem[];
  ai_summary: string;
}

export interface CIPItem {
  number: string;
  title: string;
  status: string;
  category_key: string;
  category_ko: string;
  category_en: string;
  category_color: string;
  summary_ko: string;
  summary_en: string;
  impact_ko: string;
  impact_en: string;
  github_url: string;
  vote_url: string;
}

export interface HistoryStat {
  count: number;
  name_ko: string;
  name_en: string;
  color: string;
}

export interface RewardSplitPoint {
  date: string;
  app: number;
  validator: number;
  super_validator: number;
}

export interface AmuletPricePoint {
  date: string;
  price: number;
}

export interface CumulativePoint {
  date: string;
  cumulative_mint: number;
  cumulative_burn: number;
  cumulative_supply: number;
}

export interface ExchangePair {
  pair: string;
  volume_usd: number;
  last_price: number;
  trust: string;
}

export interface SpotExchange {
  name: string;
  identifier: string;
  logo: string;
  volume_usd: number;
  pairs: ExchangePair[];
  trust_scores: string[];
  trade_url: string;
  last_price: number;
}

export interface DerivativeMarket {
  market: string;
  symbol: string;
  contract_type: string;
  volume_usd: number;
  open_interest_usd: number;
  funding_rate: number | null;
  last_price: number | null;
}

export interface ExchangesData {
  spot: SpotExchange[];
  derivatives: DerivativeMarket[];
  total_spot_volume_usd: number;
  total_derivatives_volume_usd: number;
  total_open_interest_usd: number;
  spot_exchange_count: number;
  derivatives_count: number;
  fetched_at: string | null;
}

export interface BurnBreakdown {
  burned_from_fees: number | null;
  burned_from_traffic: number | null;
  cumulative_burned_from_fees: number | null;
  cumulative_burned_from_traffic: number | null;
}

export interface GovernanceData {
  active_proposals: number;
  total_final: number;
  history_stats: Record<string, HistoryStat>;
  recent_cips: CIPItem[];
}
