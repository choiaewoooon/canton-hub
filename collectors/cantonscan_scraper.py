"""
CantonScan 홈페이지 스크래핑 — Active Addresses, Private Updates 등
Playwright로 하루 1회 수집하여 JSON 파일에 저장.
API 서버가 이 파일을 읽어서 캐시에 로드.
"""
import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent.parent / "data" / "cantonscan_homepage.json"


async def scrape_cantonscan_homepage() -> dict:
    """Playwright로 cantonscan.com 홈페이지에서 KPI 데이터 스크래핑."""
    from playwright.async_api import async_playwright

    result = {}

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                viewport={"width": 1440, "height": 900},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0.0.0 Safari/537.36",
            )

            await page.goto("https://www.cantonscan.com/", wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(5000)

            text = await page.evaluate("() => document.body.innerText")
            await browser.close()

        # Active Addresses (24hr)\n82 156
        m = re.search(r"Active Addresses \(24hr?\)\n([\d\s]+)", text)
        if m:
            result["active_addresses_24h"] = int(m.group(1).replace(" ", ""))

        # Active Addresses 변동률
        m = re.search(r"Active Addresses.*?([+-]?\d+\.?\d*)%", text, re.DOTALL)
        if m:
            result["active_addresses_change"] = float(m.group(1))

        # Private Updates (24h)\n689 472 (35.9%)
        m = re.search(r"Private Updates \(24h\)\n([\d\s]+)\s*\((\d+\.?\d*)%\)", text)
        if m:
            result["private_tx_count"] = int(m.group(1).replace(" ", ""))
            result["private_tx_ratio"] = float(m.group(2))

        # Total Transfers (24hr)\n1 981 576
        m = re.search(r"Total Transfers \(24hr?\)\n([\d\s]+)", text)
        if m:
            result["total_transfers_24h"] = int(m.group(1).replace(" ", ""))

        # 파일에 저장
        DATA_FILE.parent.mkdir(exist_ok=True)
        DATA_FILE.write_text(json.dumps(result, indent=2))
        logger.info(f"CantonScan homepage scraped: {result}")

    except Exception as e:
        logger.error(f"CantonScan scrape failed: {e}")

    return result


def load_cached_homepage_data() -> dict:
    """저장된 JSON 파일에서 데이터 로드. 없으면 빈 dict."""
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text())
        except Exception:
            return {}
    return {}
