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
# 뉴스 한줄 요약+분류용 모델 (트윗 요약은 Sonnet, 뉴스는 저렴한 Haiku)
ANTHROPIC_NEWS_MODEL = "claude-haiku-4-5-20251001"
