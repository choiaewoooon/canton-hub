"""Background data collection scheduler."""
import asyncio
import logging
from datetime import datetime, timezone

from api.cache import TTLCache

logger = logging.getLogger(__name__)

# CantonScan API
CANTONSCAN_API_BASE = "https://fossil-outlook-levitate-gloomy.cantonscan.com"
TIMESERIES_URL = f"{CANTONSCAN_API_BASE}/api/mining-rounds/timeseries?interval=day"


async def collect_price(cache: TTLCache):
    from collectors import PriceCollector
    collector = PriceCollector()
    try:
        data = await collector.collect()
        if data.fetched:
            cache.set("price", {
                "current_price_usd": data.current_price_usd,
                "price_change_percentage_24h": data.price_change_percentage_24h,
                "price_change_24h": data.price_change_24h,
                "high_24h": data.high_24h,
                "low_24h": data.low_24h,
                "market_cap": data.market_cap,
                "total_volume_24h": data.total_volume_24h,
                "circulating_supply": data.circulating_supply,
            }, ttl=60)
            logger.info(f"Price cached: ${data.current_price_usd}")
    except Exception as e:
        logger.error(f"Price collection failed: {e}")
    finally:
        await collector.close()


async def collect_network(cache: TTLCache):
    from collectors import CantonScanCollector
    collector = CantonScanCollector()
    try:
        data = await collector.collect()
        if data.fetched:
            bm = data.burn_mint_ratio or 0
            price_data = cache.get("price") or {}
            daily_burn_usd = (data.daily_burn or 0) * price_data.get("current_price_usd", 0)
            # cantonscan 홈페이지에서 스크래핑한 데이터 (하루 1회)
            from collectors.cantonscan_scraper import load_cached_homepage_data
            homepage = load_cached_homepage_data()

            cache.set("network", {
                "bm_ratio": round(bm, 4),
                "bm_status": "deflationary" if bm >= 1 else "inflationary",
                "active_addresses_24h": homepage.get("active_addresses_24h", data.daily_active_addresses),
                "active_addresses_change": homepage.get("active_addresses_change"),
                "daily_burn_usd": round(daily_burn_usd, 2),
                "daily_burn_change": None,
                "private_tx_ratio": homepage.get("private_tx_ratio"),
                "private_tx_count": homepage.get("private_tx_count"),
                "daily_mint": data.daily_mint,
                "daily_burn": data.daily_burn,
                "net_supply_change": (data.daily_mint or 0) - (data.daily_burn or 0),
            }, ttl=300)
            cache.set("network_status", {
                "total_supply": data.total_supply or data.cumulative_mint,
                "super_validators": 45,
                "validator_nodes": 866,
                "total_transfers_24h": homepage.get("total_transfers_24h", data.daily_transactions),
                "cumulative_burned": data.cumulative_burn,
                "cumulative_burn_rate": round(
                    (data.cumulative_burn / data.cumulative_mint * 100) if data.cumulative_mint and data.cumulative_burn else 0, 2
                ),
            }, ttl=3600)
            logger.info(f"Network cached: B/M={bm:.4f}")
    except Exception as e:
        logger.error(f"Network collection failed: {e}")
    finally:
        await collector.close()


async def collect_charts(cache: TTLCache):
    import httpx
    # Price chart
    try:
        from chart_generator import fetch_ohlc_data
        candles = await fetch_ohlc_data()
        chart_data = [{"time": c["time"].isoformat(), "open": c["open"], "high": c["high"], "low": c["low"], "close": c["close"]} for c in candles]
        cache.set("chart:price:24h", chart_data, ttl=300)
        cache.set("chart:price:7d", chart_data, ttl=300)
        logger.info(f"Price chart cached: {len(chart_data)} candles")
    except Exception as e:
        logger.error(f"Price chart failed: {e}")

    # Burn + B/M chart
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(TIMESERIES_URL)
            resp.raise_for_status()
            items = resp.json().get("data", [])
        if items:
            burn_data = [{"date": d["date"], "burn": d.get("burnAmount", 0), "cumulative_burn": d.get("cumulativeBurn", 0)} for d in items[-30:]]
            bm_data = [{"date": d["date"], "ratio": round(d.get("burnAmount", 0) / d.get("mintAmount", 1), 4) if d.get("mintAmount") else 0} for d in items[-90:]]
            cache.set("chart:burn:7d", burn_data[-7:], ttl=900)
            cache.set("chart:burn:1m", burn_data, ttl=900)
            cache.set("chart:burn:3m", [{"date": d["date"], "burn": d.get("burnAmount", 0), "cumulative_burn": d.get("cumulativeBurn", 0)} for d in items[-90:]], ttl=900)
            cache.set("chart:bm-ratio:7d", bm_data[-7:], ttl=900)
            cache.set("chart:bm-ratio:1m", bm_data[-30:], ttl=900)
            cache.set("chart:bm-ratio:3m", bm_data, ttl=900)
            logger.info(f"Burn/BM charts cached: {len(burn_data)} days")
    except Exception as e:
        logger.error(f"Burn chart failed: {e}")


async def collect_feed(cache: TTLCache):
    from collectors import TwitterCollector
    collector = TwitterCollector()
    try:
        tweets = await collector.collect_all()
        if not tweets:
            return
        from tweet_summarizer import summarize_tweets
        raw_summary = await summarize_tweets(tweets)
        # 텔레그램 HTML 태그를 웹용으로 변환
        en_summary = _convert_telegram_html(raw_summary)
        all_tweets = []
        for account, tw_list in tweets.items():
            for tw in sorted(tw_list, key=lambda t: t.created_at, reverse=True)[:5]:
                all_tweets.append({"source": f"@{tw.username}", "time_ago": _relative_time(tw.created_at), "text": tw.text, "url": tw.url})
        cache.set("feed:en", {"lang": "en", "items": all_tweets[:5], "ai_summary": en_summary}, ttl=900)
        for lang in ("ko", "ja", "zh"):
            cache.set(f"feed:{lang}", {"lang": lang, "items": all_tweets[:5], "ai_summary": en_summary}, ttl=900)
        logger.info(f"Feed cached: {len(all_tweets)} tweets")
    except Exception as e:
        logger.error(f"Feed collection failed: {e}")


async def collect_governance(cache: TTLCache):
    from collectors.governance_collector import GovernanceCollector
    collector = GovernanceCollector()
    try:
        data = await collector.collect()
        if data.fetched:
            cache.set("governance", {
                "active_proposals": data.active_proposals,
                "recent_cips": [{"number": c.number, "title": c.title, "status": c.status, "summary_ko": c.summary_ko, "summary_en": c.summary_en, "impact": c.impact, "github_url": c.github_url, "vote_url": c.vote_url} for c in data.recent_cips],
            }, ttl=3600)
            logger.info(f"Governance cached: {data.active_proposals} active")
    except Exception as e:
        logger.error(f"Governance collection failed: {e}")
    finally:
        await collector.close()


def _convert_telegram_html(html: str) -> str:
    """텔레그램 HTML 포맷을 웹용 순수 텍스트로 변환.

    <a href="URL">텍스트</a> → 텍스트 (URL)
    <b>텍스트</b> → 텍스트
    <blockquote>텍스트</blockquote> → 텍스트
    """
    import re
    # <a href="URL">텍스트</a> → 텍스트
    text = re.sub(r'<a\s+href="[^"]*">([^<]*)</a>', r'\1', html)
    # Remove other HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def _relative_time(dt) -> str:
    now = datetime.now(timezone.utc)
    diff = now - dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60: return f"{seconds}s ago"
    if seconds < 3600: return f"{seconds // 60}m ago"
    if seconds < 86400: return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


async def run_all_collectors(cache: TTLCache):
    await asyncio.gather(collect_price(cache), collect_network(cache), collect_charts(cache), collect_feed(cache), collect_governance(cache), return_exceptions=True)


async def start_scheduler(cache: TTLCache):
    # 빠른 데이터(가격, 네트워크)만 먼저 수집하고 서버 시작
    logger.info("Running priority data collection (price + network)...")
    await asyncio.gather(collect_price(cache), collect_network(cache), return_exceptions=True)
    logger.info("Priority collection complete — server ready")

    # 느린 데이터(차트, 피드, 거버넌스)는 백그라운드로
    asyncio.create_task(_deferred_initial(cache))

    async def _loop(fn, interval: int, name: str):
        while True:
            await asyncio.sleep(interval)
            try:
                await fn(cache)
            except Exception as e:
                logger.error(f"Scheduled {name} failed: {e}")

async def collect_homepage(cache: TTLCache):
    """CantonScan 홈페이지 스크래핑 (하루 1회). 완료 후 network 데이터 갱신."""
    try:
        from collectors.cantonscan_scraper import scrape_cantonscan_homepage
        await scrape_cantonscan_homepage()
        logger.info("Homepage scrape complete, refreshing network data...")
        await collect_network(cache)
    except Exception as e:
        logger.error(f"Homepage scrape failed: {e}")


async def _deferred_initial(cache: TTLCache):
    """느린 collector들을 백그라운드에서 수집."""
    logger.info("Running deferred collection (charts, feed, governance, homepage)...")
    await asyncio.gather(collect_charts(cache), collect_feed(cache), collect_governance(cache), collect_homepage(cache), return_exceptions=True)
    logger.info("Deferred collection complete")

    asyncio.create_task(_loop(collect_price, 30, "price"))
    asyncio.create_task(_loop(collect_network, 300, "network"))
    asyncio.create_task(_loop(collect_charts, 900, "charts"))
    asyncio.create_task(_loop(collect_feed, 900, "feed"))
    asyncio.create_task(_loop(collect_governance, 3600, "governance"))
    asyncio.create_task(_loop(collect_homepage, 86400, "homepage"))  # 하루 1회
