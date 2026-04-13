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
                        // Try to find link
                        const link = row.querySelector('a[href]');
                        const href = link ? link.href : '';
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
                    "trade_url": row.get("href", ""),
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
