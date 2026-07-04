"""
Canton Hub backend — configuration.
Loads environment variables from .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# Twitter/X (RapidAPI - Twitter API45) — used by /api/feed
# ============================================================
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")

# Monitored twitter accounts for Canton news feed
TWITTER_ACCOUNTS = ["CantonNetwork", "CantonFdn"]

# ============================================================
# CoinGecko — used by price_collector
# ============================================================
COINGECKO_COIN_ID = "canton-network"
COINGECKO_API_URL = "https://api.coingecko.com/api/v3"
# Free Demo API Key — optional but recommended to avoid 429s in production.
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")

# ============================================================
# DAT Tracker — stock price + FX (no API key required)
# ============================================================
# 주가 소스 (다중 폴백): stooq CSV 1순위(가볍고 안정적), Yahoo query2 2순위.
# query1은 datacenter/가정용 IP 모두 429 빈발 → query2 호스트 사용.
STOOQ_QUOTE_URL = "https://stooq.com/q/l/"  # ?s=<ticker>.us&f=sd2t2ohlcv&h&e=csv (실시간 1줄, 키 불필요)
STOOQ_HISTORY_URL = "https://stooq.com/q/d/l/"  # ?s=<ticker>.us&i=d&apikey=... (일봉 히스토리, apikey 필요)
STOOQ_APIKEY = os.getenv("STOOQ_APIKEY", "")  # 무료 발급: https://stooq.com/q/d/?s=cntn.us&get_apikey
YAHOO_FINANCE_CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart"
# Finnhub 실시간 quote (DAT 주가 1순위). 무료 키 60req/분, 단일 티커 폴링엔 충분.
# Yahoo/stooq 키리스 소스가 백엔드 IP를 429하는 문제로 정식 키 소스로 전환(ADR-0004).
FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote"  # ?symbol=<TICKER>&token=<KEY>
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")  # 무료 발급: https://finnhub.io/register
# Nasdaq 공개 quote (키리스, Yahoo와 다른 인프라 → Yahoo IP-throttle 시에도 동작).
# 호출: {URL}/<TICKER>/info?assetclass=stocks  (Referer/Origin nasdaq.com 헤더 필요)
NASDAQ_QUOTE_URL = "https://api.nasdaq.com/api/quote"
EXCHANGERATE_API_URL = "https://open.er-api.com/v6/latest/USD"

# ============================================================
# CantonScan — used by cantonscan_collector
# ============================================================
CANTONSCAN_STATS_URL = "https://www.cantonscan.com/stats"
CANTONSCAN_BASE_URL = "https://www.cantonscan.com"

# ============================================================
# GitHub PAT — used by governance_collector for CIP fetching
# ============================================================
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# ============================================================
# 다국어 번역 (ko↔en/ja/zh feed·media): gemq(Gemini), `llm_cli.run_llm` 경유.
# DeepL Free는 무료 쿼터 소진(456)으로 2026-06-21 폐기. 구독 gemq라 토큰 과금 없음.
# 모델은 `llm_cli`에서 항상 gemq pro로 고정하므로 여기 모델 상수는 두지 않는다.
# ============================================================

# ============================================================
# Misc collector settings
# ============================================================
# Number of recent tweets per account to fetch
MAX_TWEETS_PER_ACCOUNT = 10
# Only collect tweets from the last N hours
TWEET_HOURS_LOOKBACK = 24

# ============================================================
# Timezone (used in logging / scheduler display)
# ============================================================
TIMEZONE = os.getenv("TIMEZONE", "Asia/Seoul")

# ============================================================
# Media RSS feeds — used by media_collector (무료, 키 불필요)
# ============================================================
MEDIA_FEEDS = [
    {"name": "Google News", "url": "https://news.google.com/rss/search?q=%22Canton+Network%22&hl=en-US&gl=US&ceid=US:en"},
    {"name": "Canton Blog", "url": "https://www.canton.network/blog/rss.xml"},
    {"name": "Digital Asset", "url": "https://blog.digitalasset.com/blog/rss.xml"},
]
# data/media_items.json 링버퍼 보관 건수
MEDIA_MAX = 60
# 회당(폴링 1회) 처리할 신규 아이템 최대 수 — 콜드스타트 폭주 방지
MEDIA_MAX_NEW_PER_RUN = 12
# 같은 기사 syndication 판정용 제목 토큰 자카드 임계값. 높을수록 보수적(거의
# 동일한 제목만 합침). 낮추면 같은 사건의 다른 헤드라인까지 더 공격적으로 합쳐
# LLM 비용은 더 줄지만 서로 다른 기사를 합칠 위험이 커진다. 0.8 = 안전 기본값.
MEDIA_DUP_SIM_THRESHOLD = 0.8
# 뉴스 요약·분류도 gemq(Gemini)로 처리(모델은 llm_cli에 고정). 별도 모델 상수 없음.
