"""
CoinGecko Canton markets scraper using Playwright.
공개 API에는 없는 perpetuals/futures 데이터를 웹사이트에서 직접 스크래핑.
"""
import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

CG_COIN_NUMERIC_ID = 70468  # canton-network on CoinGecko
DATA_FILE = Path(__file__).parent.parent / "data" / "coingecko_markets.json"


def _parse_usd(s: str) -> float:
    """'$1,234,567.89' or '$535,504' → 1234567.89"""
    if not s or s == "-" or s == "—":
        return 0.0
    s = s.replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_pct(s: str) -> float:
    if not s or s == "-":
        return 0.0
    s = s.replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def _strip_affiliate(url: str) -> str:
    """CoinGecko가 어필리에이트 ID를 붙여서 줄 때 제거 (?affiliate_id=, &ref=, etc.)"""
    if not url:
        return url
    from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
    try:
        parsed = urlparse(url)
        query = parse_qsl(parsed.query)
        affiliate_keys = {
            "affiliate_id", "ref", "referral", "refcode", "ref_id",
            "invitecode", "inviter", "from", "utm_source", "utm_medium",
            "utm_campaign", "utm_content", "utm_term",
            "channelid", "sharecode", "rcode", "ru", "inviter_id",
            "invite_code", "source", "aff", "affcode",
        }
        clean_query = [(k, v) for k, v in query if k.lower() not in affiliate_keys]
        return urlunparse(parsed._replace(query=urlencode(clean_query)))
    except Exception:
        return url


# ============================================================
# Derivatives URL Mapping
# ============================================================
# CoinGecko's derivatives pages don't include external trade links,
# only internal CoinGecko exchange page links. So we build the trade
# URLs ourselves based on the exchange name.
#
# Key: exchange name as it appears on CoinGecko (lowercase comparison)
# Value: URL template using {base} (e.g. "CC") and {quote} (e.g. "USDT")
DERIV_URL_TEMPLATES: dict[str, str] = {
    # === CEX perp ===
    "binance (futures)": "https://www.binance.com/en/futures/{base}{quote}",
    "bybit (futures)": "https://www.bybit.com/trade/usdt/{base}{quote}",
    "okx (futures)": "https://www.okx.com/trade-swap/{base_l}-{quote_l}-swap",
    "bingx (futures)": "https://bingx.com/en/futures/{base}{quote}",
    "xt.com (derivatives)": "https://www.xt.com/en/futures/trade/{base_l}_{quote_l}",
    "lbank (futures)": "https://www.lbank.com/futures/{base_l}_{quote_l}",
    "coinw (futures)": "https://www.coinw.com/futures/{base}_{quote}",
    "toobit futures": "https://www.toobit.com/en-US/futures/trade/{base}{quote}",
    "orangex futures": "https://www.orangex.com/futures/{base}{quote}",
    "bydfi (futures)": "https://www.bydfi.com/en/futures/{base_l}_{quote_l}",
    "mexc (futures)": "https://futures.mexc.com/exchange/{base}_{quote}",
    "flipster": "https://flipster.io/en/futures/{base}_{quote}",
    "ourbit (futures)": "https://www.ourbit.com/futures/{base}_{quote}",
    "phemex (perpetual)": "https://phemex.com/trade/{base}{quote}",
    "phemex (futures)": "https://phemex.com/futures/trade/{base}{quote}",
    "bitunix futures": "https://www.bitunix.com/contract-trade/{base}{quote}",
    "weex (futures)": "https://www.weex.com/futures/{base}{quote}",
    "bitrue (futures)": "https://www.bitrue.com/futures/{base}{quote}",
    "kcex (futures)": "https://www.kcex.com/futures/exchange/{base}_{quote}",
    "backpack (futures)": "https://backpack.exchange/trade/{base}_{quote}_PERP",
    "bitkan (futures)": "https://bitkan.com/en/futures/{base}{quote}",
    "bitmart futures": "https://futures.bitmart.com/en?symbol={base}_{quote}",
    "blofin (futures)": "https://blofin.com/futures/{base}-{quote}",
    "variational omni": "https://app.variational.io/perp/{base}-{quote}",
    "gate (futures)": "https://www.gate.com/futures_trade/USDT/{base}_{quote}",
    "kucoin futures": "https://www.kucoin.com/futures/trade/{base}{quote}M",
    "kraken (futures)": "https://futures.kraken.com/trade/futures/pi_{base_l}usd",
    # === DEX perp ===
    "hyperliquid (futures)": "https://app.hyperliquid.xyz/trade/{base}",
    "extended": "https://app.extended.exchange/trade/{base}-{quote}",
    "lighter": "https://app.lighter.xyz/trade/{base}",
    "aster (futures)": "https://www.asterdex.com/en/futures/{base}{quote}",
    "grvt": "https://app.grvt.io/trade/{base}_{quote}",
    "apex (futures)": "https://pro.apex.exchange/trade/{base}{quote}",
    "dydx (v4) (perpetual)": "https://dydx.trade/trade/{base}-{quote}",
    "paradex (perpetual)": "https://app.paradex.trade/trade/{base}-{quote}",
    "vertex (perpetual)": "https://app.vertexprotocol.com/trade/{base}-{quote}",
    "drift protocol (perpetual)": "https://app.drift.trade/{base}",
}


def _derive_trade_url(exchange_name: str, pair: str) -> str | None:
    """Derive a direct exchange trade URL from exchange name + pair."""
    if not exchange_name or not pair:
        return None
    key = exchange_name.lower().strip()
    template = DERIV_URL_TEMPLATES.get(key)
    if not template:
        return None
    # Parse pair "CC/USDT" → base=CC, quote=USDT
    parts = pair.split("/")
    if len(parts) != 2:
        return None
    base, quote = parts[0].strip().upper(), parts[1].strip().upper()
    try:
        return template.format(
            base=base,
            quote=quote,
            base_l=base.lower(),
            quote_l=quote.lower(),
        )
    except (KeyError, IndexError):
        return None


async def scrape_coingecko_markets() -> dict:
    """CoinGecko의 Canton markets 페이지에서 spot + perpetuals + futures 데이터 수집."""
    from playwright.async_api import async_playwright

    result = {
        "spot": [],
        "perpetuals": [],
        "futures": [],
        "fetched_at": None,
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for market_type in ["spot", "perpetuals", "futures"]:
                items = await _scrape_market_type(browser, market_type)
                result[market_type] = items
                logger.info(f"CoinGecko {market_type}: {len(items)} entries")
        finally:
            await browser.close()

    from datetime import datetime, timezone
    result["fetched_at"] = datetime.now(timezone.utc).isoformat()

    # 파일에 캐시
    try:
        DATA_FILE.parent.mkdir(exist_ok=True)
        DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Failed to save CoinGecko cache: {e}")

    return result


async def _scrape_market_type(browser, market_type: str) -> list[dict]:
    """특정 market type (spot/perpetuals/futures) 데이터 페이지네이션 포함 수집."""
    items: list[dict] = []
    context = await browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/120.0.0.0 Safari/537.36",
    )
    page = await context.new_page()

    try:
        # 페이지 1~5 순회 (rank_asc는 낮은 순위부터, 페이지당 10개 = 최대 50개)
        for page_num in range(1, 6):
            url = (
                f"https://www.coingecko.com/en/coins/{CG_COIN_NUMERIC_ID}/"
                f"markets/all/{market_type}/rank_asc"
            )
            if page_num > 1:
                url += f"?page={page_num}"
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                if not resp or resp.status != 200:
                    break
                await page.wait_for_timeout(2000)
            except Exception as e:
                logger.warning(f"{market_type} page {page_num} load failed: {e}")
                break

            # Extract rows
            rows = await page.evaluate(
                """
                () => {
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
                        // Try to find logo image
                        const img = row.querySelector('img');
                        const logo = img ? img.src : '';
                        // Find the trade URL — prefer external links (target=_blank)
                        // which point to the actual exchange's trading pair page,
                        // not CoinGecko's internal exchange overview page.
                        const links = Array.from(row.querySelectorAll('a[href]'));
                        const externalLink = links.find(a =>
                            a.target === '_blank' &&
                            !a.href.includes('coingecko.com')
                        );
                        const href = externalLink ? externalLink.href : (links[0] ? links[0].href : '');
                        return { cells, logo, href };
                    });
                }
                """
            )

            if not rows:
                break

            for row in rows:
                cells = row.get("cells", [])
                if len(cells) < 8:
                    continue
                # 실제 셀 구조 (CoinGecko canton-network markets 페이지):
                # [0] rank, [1] exchange name (e.g. "Hyperliquid (Futures)"),
                # [2] CEX/DEX, [3] pair (e.g. "CC/USD"), [4] price,
                # [5] spread, [6] +2% depth, [7] -2% depth,
                # [8] 24h volume, [9] volume %, [10] last updated
                try:
                    rank = int(cells[0]) if cells[0].isdigit() else len(items) + 1
                except ValueError:
                    rank = len(items) + 1

                exch_text = cells[1].split("\n")[0].strip() if cells[1] else "Unknown"

                # cells[2] may be "CEX" or "DEX"
                exch_type = cells[2].strip() if len(cells) > 2 else ""
                if exch_type not in ("CEX", "DEX"):
                    exch_type = ""

                pair = cells[3].strip() if len(cells) > 3 else ""
                price = _parse_usd(cells[4]) if len(cells) > 4 else 0
                spread = _parse_pct(cells[5]) if len(cells) > 5 else 0
                depth_pos = _parse_usd(cells[6]) if len(cells) > 6 else 0
                depth_neg = _parse_usd(cells[7]) if len(cells) > 7 else 0
                volume = _parse_usd(cells[8]) if len(cells) > 8 else 0
                volume_pct = _parse_pct(cells[9]) if len(cells) > 9 else 0

                # Trade URL: prefer scraped external link, fall back to derived URL.
                # Derivatives pages only expose CoinGecko internal links,
                # so we derive the URL from a hardcoded template.
                raw_url = row.get("href", "")
                if not raw_url or "coingecko.com" in raw_url:
                    derived = _derive_trade_url(exch_text, pair)
                    trade_url = derived or raw_url
                else:
                    trade_url = _strip_affiliate(raw_url)

                items.append({
                    "rank": rank,
                    "exchange": exch_text,
                    "type": exch_type,  # CEX or DEX
                    "pair": pair,
                    "price": price,
                    "spread_pct": spread,
                    "depth_plus_2pct": depth_pos,
                    "depth_minus_2pct": depth_neg,
                    "volume_24h_usd": volume,
                    "volume_pct": volume_pct,
                    "logo": row.get("logo", ""),
                    "trade_url": trade_url,
                })

            # Stop early if fewer than 10 rows on this page (last page reached)
            if len(rows) < 10:
                break
    finally:
        await page.close()
        await context.close()

    return items


def load_cached_markets() -> dict | None:
    """파일 캐시에서 로드. 없으면 None."""
    if not DATA_FILE.exists():
        return None
    try:
        return json.loads(DATA_FILE.read_text())
    except Exception:
        return None
