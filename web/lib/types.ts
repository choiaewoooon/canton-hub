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
  summary_ko: string;
  summary_en: string;
  impact: string;
  github_url: string;
  vote_url: string;
}

export interface GovernanceData {
  active_proposals: number;
  recent_cips: CIPItem[];
}
