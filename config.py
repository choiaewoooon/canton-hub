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
# DeepL Free API — ko→en/ja/zh feed summary translation
# ============================================================
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")
DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"

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
# 뉴스 한줄 요약+분류용 모델 (트윗 요약은 Sonnet, 뉴스는 저렴한 Haiku)
ANTHROPIC_NEWS_MODEL = "claude-haiku-4-5-20251001"
