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
