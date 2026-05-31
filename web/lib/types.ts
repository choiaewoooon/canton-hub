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
  kind?: "tweet" | "news"; // 미지정 시 tweet 취급(하위호환)
  source: string;
  time_ago: string;
  ts?: string; // ISO UTC — 프론트에서 상대시간 실시간 계산용 (time_ago는 폴백)
  text: string; // tweet=본문 / news=번역된 한줄 요약
  url: string;
  title?: string | null; // news 헤드라인(번역본). tweet은 없음(null)
  category?: string; // news 유형 key. tweet은 없음
}

export interface FeedData {
  lang: string;
  items: FeedItem[];
  ai_summary: string;
  fetched_at?: string | null;
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
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

export interface MarketEntry {
  rank: number;
  exchange: string;
  type: "CEX" | "DEX" | "";
  pair: string;
  price: number;
  spread_pct: number;
  depth_plus_2pct: number;
  depth_minus_2pct: number;
  volume_24h_usd: number;
  volume_pct: number;
  logo: string;
  trade_url: string;
  contract_type?: "perpetual" | "futures";
}

export interface LivePrice {
  source: string;
  venue_type: "DEX" | "CEX";
  market: "spot" | "perpetual" | "futures";
  pair: string;
  price: number;
  api_source: string;
  depth_plus_2pct?: number;
  depth_minus_2pct?: number;
  trade_url?: string;
}

export interface PriceExtreme {
  source: string;
  venue_type: "DEX" | "CEX";
  market: string;
  price: number;
}

export interface RealtimePrices {
  prices: LivePrice[];
  lowest: PriceExtreme | null;
  highest: PriceExtreme | null;
  spread_pct: number;
  spread_usd: number;
  fetched_at: string | null;
}

export interface FundingRate {
  source: string;
  venue_type: "DEX" | "CEX";
  market: "perpetual";
  pair: string;
  fr_raw: number;
  period_hours: 1 | 8;
  fr_apr: number;
  next_funding_ts: number;
  api_source: string;
}

export interface FundingRates {
  rates: FundingRate[];
  updated_at: string | null;
}

export interface DexOI {
  name: string;
  symbol: string;
  open_interest_base: number;
  open_interest_usd: number;
  mark_price: number;
  funding_rate: number | null;
  daily_volume_usd: number;
  max_leverage: number | null;
  api_source: string;
}

export interface ExchangesData {
  spot: MarketEntry[];
  derivatives: MarketEntry[];
  dex_oi: DexOI[];
  total_spot_volume_usd: number;
  total_derivatives_volume_usd: number;
  total_perpetuals_volume_usd: number;
  total_futures_volume_usd: number;
  total_open_interest_usd: number;
  spot_exchange_count: number;
  derivatives_count: number;
  perpetuals_count: number;
  futures_count: number;
  fetched_at: string | null;
}

export interface KrWallet {
  short_id: string;
  party_id: string;
  role: "cold_wallet" | "validator" | "operational" | "test" | "subsidiary" | string;
  note_ko: string;
  note_en: string;
  available_balance: number;
  locked_balance: number;
  total_balance: number;
}

export interface KrCompany {
  slug: string;
  name_ko: string;
  name_en: string;
  domain: string;
  description_ko: string;
  description_en: string;
  insight_ko: string;
  insight_en: string;
  verification_status: "on_chain_only" | "confirmed" | string;
  confidence: "high" | "medium" | "low" | string;
  evidence_ko: string[];
  evidence_en: string[];
  total_balance: number;
  wallet_count: number;
  wallets: KrWallet[];
}

export interface KrCompaniesData {
  companies: KrCompany[];
  grand_total_balance: number;
  total_wallet_count: number;
  fetched_at: string | null;
}

export interface Holder {
  party_id: string;
  organization: string;
  category: "super_validator" | "validator" | "app" | "unknown";
  available_balance: number;
  locked_balance: number;
  total_balance: number;
}

export interface HoldersData {
  holders: Holder[];
  total_tracked_balance: number;
  total_count: number;
  top1_share_pct: number;
  top10_share_pct: number;
  fetched_at: string | null;
}

export interface BurnBreakdown {
  burned_from_fees: number | null;
  burned_from_traffic: number | null;
  cumulative_burned_from_fees: number | null;
  cumulative_burned_from_traffic: number | null;
}

export interface TrendingKeyword {
  keyword: string;
  count: number;
  last_seen: string;
}

export interface TrendingData {
  keywords: TrendingKeyword[];
  fetched_at: string | null;
}

export interface KpiHistoryEntry {
  ts: string;
  active_addresses_24h: number | null;
  total_transfers_24h: number | null;
  private_tx_ratio: number | null;
  super_validators: number | null;
}

export interface KpiHistoryData {
  entries: KpiHistoryEntry[];
}

export interface GovernanceData {
  active_proposals: number;
  total_final: number;
  history_stats: Record<string, HistoryStat>;
  recent_cips: CIPItem[];
}

export interface DatMnavPoint {
  ts: string;
  mnav: number;
}

export interface DatCompany {
  ticker: string;
  name: string;
  exchange: string;
  cc_holdings: number;
  avg_buy_price: number;
  debt: number;
  cash: number;
  shares_outstanding: number;
  super_validator: boolean;
  source: string;
  as_of: string;
  // computed / live (nullable when data missing)
  stock_price: number | null;
  market_cap: number | null;
  cc_price: number | null;
  nav: number | null;
  mnav: number | null;
  mnav_label: string | null;
  pl_usd: number | null;
  pl_pct: number | null;
  krw_rate: number | null;
  value_krw: number | null;
  pl_krw: number | null;
  risk: "healthy" | "watch" | "below_nav" | null;
  mnav_history: DatMnavPoint[];
}

export interface DatData {
  companies: DatCompany[];
  company_count: number;
  total_cc_holdings: number;
  total_pl_usd: number;
  fetched_at: string | null;
}
