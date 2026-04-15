"""Background data collection scheduler."""
import asyncio
import logging
from datetime import datetime, timezone

from api.cache import TTLCache

logger = logging.getLogger(__name__)

# CantonScan API
CANTONSCAN_API_BASE = "https://fossil-outlook-levitate-gloomy.cantonscan.com"
TIMESERIES_URL = f"{CANTONSCAN_API_BASE}/api/mining-rounds/timeseries?interval=day"


async def collect_realtime_prices(cache: TTLCache):
    """모든 거래소에서 5초마다 가격 수집 + 아비트라지 스프레드 계산."""
    from datetime import datetime, timezone
    from collectors.realtime_prices import collect_all_realtime_prices

    try:
        prices = await collect_all_realtime_prices()
        if not prices:
            return

        # 가격 기준 정렬
        sorted_prices = sorted(prices, key=lambda p: p.price)
        lowest = sorted_prices[0]
        highest = sorted_prices[-1]
        spread_pct = ((highest.price - lowest.price) / lowest.price) * 100 if lowest.price > 0 else 0

        result = {
            "prices": [
                {
                    "source": p.source,
                    "venue_type": p.venue_type,
                    "market": p.market,
                    "pair": p.pair,
                    "price": p.price,
                    "api_source": p.api_source,
                }
                for p in prices
            ],
            "lowest": {
                "source": lowest.source,
                "venue_type": lowest.venue_type,
                "market": lowest.market,
                "price": lowest.price,
            },
            "highest": {
                "source": highest.source,
                "venue_type": highest.venue_type,
                "market": highest.market,
                "price": highest.price,
            },
            "spread_pct": round(spread_pct, 4),
            "spread_usd": round(highest.price - lowest.price, 6),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        cache.set("analytics:realtime-prices", result, ttl=10)
    except Exception as e:
        logger.error(f"Realtime prices failed: {e}")


async def collect_exchanges(cache: TTLCache):
    """CoinGecko 웹사이트에서 spot + perpetuals + futures 데이터 스크래핑 + DEX OI 직접 수집."""
    from datetime import datetime, timezone
    from collectors.coingecko_scraper import scrape_coingecko_markets, load_cached_markets
    from collectors.dex_oi_collector import collect_all_dex_oi

    try:
        # 병렬 수집: CoinGecko scrape + DEX OI APIs
        scrape_task = asyncio.create_task(scrape_coingecko_markets())
        dex_oi_task = asyncio.create_task(collect_all_dex_oi())
        data, dex_oi_list = await asyncio.gather(scrape_task, dex_oi_task)

        spot = data.get("spot", [])
        perps = data.get("perpetuals", [])
        futures = data.get("futures", [])

        total_spot_vol = sum(e.get("volume_24h_usd", 0) for e in spot)
        total_perp_vol = sum(e.get("volume_24h_usd", 0) for e in perps)
        total_futures_vol = sum(e.get("volume_24h_usd", 0) for e in futures)
        total_deriv_vol = total_perp_vol + total_futures_vol

        # Combine derivatives for unified view
        derivatives = []
        for p in perps:
            derivatives.append({**p, "contract_type": "perpetual"})
        for f in futures:
            derivatives.append({**f, "contract_type": "futures"})
        derivatives.sort(key=lambda x: -x.get("volume_24h_usd", 0))

        # DEX OI list → dicts
        dex_oi = [
            {
                "name": d.name,
                "symbol": d.symbol,
                "open_interest_base": d.open_interest_base,
                "open_interest_usd": d.open_interest_usd,
                "mark_price": d.mark_price,
                "funding_rate": d.funding_rate,
                "daily_volume_usd": d.daily_volume_usd,
                "max_leverage": d.max_leverage,
                "api_source": d.api_source,
            }
            for d in dex_oi_list
        ]
        total_oi_usd = sum(d["open_interest_usd"] for d in dex_oi)

        result = {
            "spot": spot[:30],
            "derivatives": derivatives[:30],
            "dex_oi": dex_oi,
            "total_spot_volume_usd": total_spot_vol,
            "total_derivatives_volume_usd": total_deriv_vol,
            "total_perpetuals_volume_usd": total_perp_vol,
            "total_futures_volume_usd": total_futures_vol,
            "total_open_interest_usd": total_oi_usd,
            "spot_exchange_count": len(spot),
            "derivatives_count": len(derivatives),
            "perpetuals_count": len(perps),
            "futures_count": len(futures),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        cache.set("analytics:exchanges", result, ttl=900)
        logger.info(
            f"Exchanges: {len(spot)} spot, {len(perps)} perps, {len(futures)} futures, "
            f"DEX OI {len(dex_oi)} sources (${total_oi_usd:,.0f})"
        )
    except Exception as e:
        logger.error(f"Exchanges scraping failed: {e}")
        # 파일 캐시 폴백
        try:
            from collectors.coingecko_scraper import load_cached_markets
            cached = load_cached_markets()
            if cached:
                spot = cached.get("spot", [])
                perps = cached.get("perpetuals", [])
                futures = cached.get("futures", [])
                derivatives = []
                for p in perps:
                    derivatives.append({**p, "contract_type": "perpetual"})
                for f in futures:
                    derivatives.append({**f, "contract_type": "futures"})
                derivatives.sort(key=lambda x: -x.get("volume_24h_usd", 0))
                cache.set("analytics:exchanges", {
                    "spot": spot[:30],
                    "derivatives": derivatives[:30],
                    "total_spot_volume_usd": sum(e.get("volume_24h_usd", 0) for e in spot),
                    "total_derivatives_volume_usd": sum(e.get("volume_24h_usd", 0) for e in derivatives),
                    "total_perpetuals_volume_usd": sum(e.get("volume_24h_usd", 0) for e in perps),
                    "total_futures_volume_usd": sum(e.get("volume_24h_usd", 0) for e in futures),
                    "total_open_interest_usd": 0,
                    "spot_exchange_count": len(spot),
                    "derivatives_count": len(derivatives),
                    "perpetuals_count": len(perps),
                    "futures_count": len(futures),
                    "fetched_at": cached.get("fetched_at"),
                }, ttl=900)
                logger.info("Loaded exchanges from file cache fallback")
        except Exception as fe:
            logger.error(f"Fallback load failed: {fe}")


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
            }, ttl=120)
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


async def _fetch_ohlc(days: str) -> list[dict]:
    """CoinGecko OHLC 데이터 가져오기."""
    import httpx
    import config
    url = f"{config.COINGECKO_API_URL}/coins/{config.COINGECKO_COIN_ID}/ohlc"
    params = {"vs_currency": "usd", "days": days}
    headers = {"Accept": "application/json"}
    if config.COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = config.COINGECKO_API_KEY
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        raw = resp.json()
    from datetime import datetime, timezone
    return [
        {"time": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%m/%d %H:%M"),
         "open": o, "high": h, "low": l, "close": c}
        for ts, o, h, l, c in raw
    ]


async def collect_charts(cache: TTLCache):
    import httpx
    import json
    from pathlib import Path

    chart_cache_file = Path(__file__).parent.parent / "data" / "chart_cache.json"
    chart_cache_file.parent.mkdir(exist_ok=True)

    # 기존 파일 캐시 로드 (폴백용)
    file_cache: dict = {}
    if chart_cache_file.exists():
        try:
            file_cache = json.loads(chart_cache_file.read_text())
        except Exception:
            file_cache = {}

    # Price chart — 기간별 CoinGecko OHLC (TTL 1시간)
    price_success = False
    for period, days in [("24h", "1"), ("7d", "7"), ("1m", "30"), ("3m", "90")]:
        key = f"chart:price:{period}"
        try:
            chart_data = await _fetch_ohlc(days)
            cache.set(key, chart_data, ttl=3600)
            file_cache[key] = chart_data
            price_success = True
            logger.info(f"Price chart {period} cached: {len(chart_data)} candles")
        except Exception as e:
            logger.warning(f"Price chart {period} failed: {e} — trying file cache")
            if key in file_cache:
                cache.set(key, file_cache[key], ttl=3600)
                logger.info(f"Price chart {period} loaded from file cache: {len(file_cache[key])} candles")

    # 성공한 데이터를 파일에 저장
    if price_success:
        try:
            chart_cache_file.write_text(json.dumps(file_cache, ensure_ascii=False))
        except Exception as e:
            logger.warning(f"Failed to save chart cache file: {e}")

    # Burn + B/M chart — hour interval for 24h, day for others.
    # Uses curl_cffi to impersonate Chrome TLS fingerprint so Cloudflare on
    # fossil-outlook-levitate-gloomy.cantonscan.com doesn't 403 datacenter IPs.
    try:
        from curl_cffi.requests import AsyncSession
        async with AsyncSession(
            impersonate="chrome124",
            timeout=30,
            headers={
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://www.cantonscan.com/",
                "Origin": "https://www.cantonscan.com",
            },
        ) as client:
            # Hour interval (24h 기간용)
            hour_resp = await client.get(f"{CANTONSCAN_API_BASE}/api/mining-rounds/timeseries?interval=hour")
            hour_resp.raise_for_status()
            hour_items = hour_resp.json().get("data", [])

            # Day interval (7d/1m/3m 기간용)
            day_resp = await client.get(TIMESERIES_URL)
            day_resp.raise_for_status()
            day_items = day_resp.json().get("data", [])

        # 24h용 (hour interval, 최근 24개 시간)
        if hour_items:
            hour_slice = hour_items[-24:]

            def fmt_hour(iso: str) -> str:
                # 2026-04-13T01:00:00.000Z → 04/13 01:00
                from datetime import datetime
                try:
                    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
                    return dt.strftime("%m/%d %H:%M")
                except Exception:
                    return iso

            burn_24h = [
                {"date": fmt_hour(d["date"]), "burn": d.get("burnAmount", 0),
                 "cumulative_burn": d.get("cumulativeBurn", 0)}
                for d in hour_slice
            ]
            bm_24h = [
                {"date": fmt_hour(d["date"]),
                 "ratio": round(d.get("burnAmount", 0) / d.get("mintAmount", 1), 4) if d.get("mintAmount") else 0}
                for d in hour_slice
            ]
            cache.set("chart:burn:24h", burn_24h, ttl=900)
            cache.set("chart:bm-ratio:24h", bm_24h, ttl=900)
            logger.info(f"Burn/BM 24h charts cached: {len(burn_24h)} hours")

        # 7d / 1m / 3m용 (day interval)
        if day_items:
            burn_data = [{"date": d["date"], "burn": d.get("burnAmount", 0), "cumulative_burn": d.get("cumulativeBurn", 0)} for d in day_items[-90:]]
            bm_data = [{"date": d["date"], "ratio": round(d.get("burnAmount", 0) / d.get("mintAmount", 1), 4) if d.get("mintAmount") else 0} for d in day_items[-90:]]
            cache.set("chart:burn:7d", burn_data[-7:], ttl=900)
            cache.set("chart:burn:1m", burn_data[-30:], ttl=900)
            cache.set("chart:burn:3m", burn_data, ttl=900)
            cache.set("chart:bm-ratio:7d", bm_data[-7:], ttl=900)
            cache.set("chart:bm-ratio:1m", bm_data[-30:], ttl=900)

            # === Analytics 데이터 ===
            # 1. Reward Split (App / Validator / Super Validator)
            reward_data = [
                {
                    "date": d["date"],
                    "app": round(d.get("appRewards", 0)),
                    "validator": round(d.get("validatorRewards", 0)),
                    "super_validator": round(d.get("superValidatorRewards", 0)),
                }
                for d in day_items[-90:]
            ]
            cache.set("analytics:reward-split:7d", reward_data[-7:], ttl=900)
            cache.set("analytics:reward-split:1m", reward_data[-30:], ttl=900)
            cache.set("analytics:reward-split:3m", reward_data, ttl=900)

            # 2. Amulet Price
            amulet_data = [
                {"date": d["date"], "price": round(d.get("avgAmuletPrice", 0), 6)}
                for d in day_items[-90:]
            ]
            cache.set("analytics:amulet-price:7d", amulet_data[-7:], ttl=900)
            cache.set("analytics:amulet-price:1m", amulet_data[-30:], ttl=900)
            cache.set("analytics:amulet-price:3m", amulet_data, ttl=900)

            # 3. Cumulative Mint / Burn / Supply
            cum_data = [
                {
                    "date": d["date"],
                    "cumulative_mint": round(d.get("cumulativeMint", 0)),
                    "cumulative_burn": round(d.get("cumulativeBurn", 0)),
                    "cumulative_supply": round(d.get("cumulativeSupply", 0)),
                }
                for d in day_items[-90:]
            ]
            cache.set("analytics:cumulative:7d", cum_data[-7:], ttl=900)
            cache.set("analytics:cumulative:1m", cum_data[-30:], ttl=900)
            cache.set("analytics:cumulative:3m", cum_data, ttl=900)

            # 4. Burn Breakdown (오늘 기준)
            latest = day_items[-1]
            cache.set("analytics:burn-breakdown", {
                "burned_from_fees": latest.get("burnedFromFees", 0),
                "burned_from_traffic": latest.get("burnedFromTrafficPurchases", 0),
                "cumulative_burned_from_fees": latest.get("cumulativeBurnedFromFees", 0),
                "cumulative_burned_from_traffic": latest.get("cumulativeBurnedFromTrafficPurchases", 0),
            }, ttl=900)

            logger.info(f"Analytics charts cached: {len(reward_data)} days")
            cache.set("chart:bm-ratio:3m", bm_data, ttl=900)
            logger.info(f"Burn/BM day charts cached: {len(burn_data)} days")
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
                "total_final": data.total_final,
                "history_stats": data.history_stats,
                "recent_cips": [
                    {
                        "number": c.number,
                        "title": c.title,
                        "status": c.status,
                        "category_key": c.category_key,
                        "category_ko": c.category_ko,
                        "category_en": c.category_en,
                        "category_color": c.category_color,
                        "summary_ko": c.summary_ko,
                        "summary_en": c.summary_en,
                        "impact_ko": c.impact_ko,
                        "impact_en": c.impact_en,
                        "github_url": c.github_url,
                        "vote_url": c.vote_url,
                    }
                    for c in data.recent_cips
                ],
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


async def collect_kr_companies(cache: TTLCache):
    """한국 기업 Canton 참여 현황 — 3개 기업의 모든 지갑 balance 수집."""
    from collectors.kr_companies_collector import collect_kr_companies as _collect, load_cached_kr_companies
    try:
        data = await _collect()
        if data and data.get("companies"):
            cache.set("analytics:kr-companies", data, ttl=1900)
            logger.info(
                f"KR companies cached: {len(data['companies'])} companies, "
                f"{data['total_wallet_count']} wallets, "
                f"{data['grand_total_balance']:,.0f} CC"
            )
    except Exception as e:
        logger.error(f"KR companies collection failed: {e}")
        cached = load_cached_kr_companies()
        if cached:
            cache.set("analytics:kr-companies", cached, ttl=1900)
            logger.info("KR companies loaded from file cache")


async def collect_holders(cache: TTLCache):
    """Major CC Holders 수집 — CantonScan API의 validator/SV/app party balance 병렬 조회."""
    from collectors.holders_collector import collect_major_holders, load_cached_holders
    try:
        holders = await collect_major_holders()
        if holders:
            # Convert dataclass → dict for cache
            holder_dicts = [
                {
                    "party_id": h.party_id,
                    "organization": h.organization,
                    "category": h.category,
                    "available_balance": h.available_balance,
                    "locked_balance": h.locked_balance,
                    "total_balance": h.total_balance,
                }
                for h in holders
            ]
            total = sum(h["total_balance"] for h in holder_dicts)
            cache.set("analytics:holders", {
                "holders": holder_dicts[:50],  # Top 50
                "total_tracked_balance": total,
                "total_count": len(holder_dicts),
                "top1_share_pct": (holder_dicts[0]["total_balance"] / total * 100) if holder_dicts and total > 0 else 0,
                "top10_share_pct": (sum(h["total_balance"] for h in holder_dicts[:10]) / total * 100) if total > 0 else 0,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }, ttl=3700)  # 1h + buffer
            logger.info(f"Holders cached: {len(holder_dicts)} total, top1 = {holder_dicts[0]['organization']}")
    except Exception as e:
        logger.error(f"Holders collection failed: {e}")
        # Fallback to file cache
        cached = load_cached_holders()
        if cached:
            total = sum(h["total_balance"] for h in cached)
            cache.set("analytics:holders", {
                "holders": cached[:50],
                "total_tracked_balance": total,
                "total_count": len(cached),
                "top1_share_pct": (cached[0]["total_balance"] / total * 100) if cached and total > 0 else 0,
                "top10_share_pct": (sum(h["total_balance"] for h in cached[:10]) / total * 100) if total > 0 else 0,
                "fetched_at": None,
            }, ttl=3700)
            logger.info(f"Holders loaded from file cache: {len(cached)}")


async def collect_homepage(cache: TTLCache):
    """CantonScan 홈페이지 스크래핑 (하루 1회). 완료 후 network 데이터 갱신."""
    try:
        from collectors.cantonscan_scraper import scrape_cantonscan_homepage
        await scrape_cantonscan_homepage()
        logger.info("Homepage scrape complete, refreshing network data...")
        await collect_network(cache)
    except Exception as e:
        logger.error(f"Homepage scrape failed: {e}")


async def run_all_collectors(cache: TTLCache):
    await asyncio.gather(
        collect_price(cache),
        collect_network(cache),
        collect_charts(cache),
        collect_feed(cache),
        collect_governance(cache),
        return_exceptions=True,
    )


async def _loop(fn, cache: TTLCache, interval: int, name: str):
    """주기적으로 collector를 실행하는 loop."""
    while True:
        await asyncio.sleep(interval)
        try:
            await fn(cache)
        except Exception as e:
            logger.error(f"Scheduled {name} failed: {e}")


async def _deferred_initial(cache: TTLCache):
    """느린 collector들을 백그라운드에서 수집."""
    logger.info("Running deferred collection (charts, feed, governance, homepage, exchanges, holders, consensus)...")
    await asyncio.gather(
        collect_charts(cache),
        collect_feed(cache),
        collect_governance(cache),
        collect_homepage(cache),
        collect_exchanges(cache),
        collect_holders(cache),
        collect_kr_companies(cache),
        return_exceptions=True,
    )
    logger.info("Deferred collection complete")


async def start_scheduler(cache: TTLCache):
    # 빠른 데이터(가격, 네트워크)만 먼저 수집하고 서버 시작
    logger.info("Running priority data collection (price + network)...")
    await asyncio.gather(collect_price(cache), collect_network(cache), return_exceptions=True)
    logger.info("Priority collection complete — server ready")

    # 느린 데이터(차트, 피드, 거버넌스)는 백그라운드로
    asyncio.create_task(_deferred_initial(cache))

    # 주기적 재수집 태스크 등록
    asyncio.create_task(_loop(collect_price, cache, 30, "price"))
    asyncio.create_task(_loop(collect_network, cache, 300, "network"))
    asyncio.create_task(_loop(collect_charts, cache, 900, "charts"))
    asyncio.create_task(_loop(collect_feed, cache, 900, "feed"))
    asyncio.create_task(_loop(collect_governance, cache, 3600, "governance"))
    asyncio.create_task(_loop(collect_homepage, cache, 86400, "homepage"))
    asyncio.create_task(_loop(collect_exchanges, cache, 900, "exchanges"))  # 15분
    asyncio.create_task(_loop(collect_realtime_prices, cache, 5, "realtime-prices"))  # 5초
    asyncio.create_task(_loop(collect_holders, cache, 3600, "holders"))  # 1시간
    asyncio.create_task(_loop(collect_kr_companies, cache, 1800, "kr-companies"))  # 30분

    # 즉시 1회 실행 — 첫 페이지 로드 시 빈 데이터 방지
    asyncio.create_task(collect_realtime_prices(cache))
