"""
CantonScan 홈페이지 스크래핑 — Active Addresses, Private Updates 등
Playwright로 하루 1회 수집하여 JSON 파일에 저장.
API 서버가 이 파일을 읽어서 캐시에 로드.

주의(2026-07-29 사고): KPI 카드들은 **서로 다른 시점에** 렌더된다.
예전에는 Private Updates가 먼저 그려져서 Active Addresses만 기다리면 충분했지만,
지금은 순서가 뒤집혀 Active Addresses가 2초 만에 뜨고 Private Updates가 나중에 뜬다.
그래서 하나만 보고 스냅샷을 뜨면 라벨만 있고 값이 없는 반쪽 텍스트를 파싱하게 된다.
→ 필요한 KPI가 **전부** 렌더될 때까지 기다리고(REQUIRED_KEYS),
   그래도 못 얻은 값은 직전 파일 값을 보존한다(_merge_and_save).
"""
import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent.parent / "data" / "cantonscan_homepage.json"

# 이 키들이 다 모여야 "완전히 렌더된 스냅샷"으로 본다.
# 하나라도 빠지면 대시보드 카드가 N/A가 되므로 대기 조건에 포함해야 한다.
REQUIRED_KEYS = (
    "active_addresses_24h",
    "private_tx_count",
    "private_tx_ratio",
    "total_transfers_24h",
)


def _parse_homepage_text(text: str) -> dict:
    """홈페이지 innerText에서 KPI를 뽑는다. 못 뽑은 값은 키 자체를 넣지 않는다."""
    result: dict = {}

    def _parse_int_after(label_re: str) -> int | None:
        # Tolerate missing trailing "r", arbitrary whitespace/newlines between label
        # and value, and digits grouped with spaces/commas ("137 041", "137,041").
        m = re.search(rf"{label_re}\s*[\r\n]+\s*([\d][\d\s,]*?)(?=\s*\n|\s*$)", text)
        if not m:
            return None
        try:
            return int(m.group(1).replace(" ", "").replace(",", ""))
        except ValueError:
            return None

    # Active Addresses (24hr)\n137 041
    v = _parse_int_after(r"Active Addresses \(24hr?\)")
    if v is not None:
        result["active_addresses_24h"] = v

    # Active Addresses 변동률
    m = re.search(r"Active Addresses.*?([+-]?\d+\.?\d*)%", text, re.DOTALL)
    if m:
        result["active_addresses_change"] = float(m.group(1))

    # Private Updates (24h)\n689 472 (35.9%) — both legacy "24h" and "24hr" layouts
    m = re.search(r"Private Updates \(24hr?\)\s*[\r\n]+\s*([\d][\d\s,]*?)\s*\((\d+\.?\d*)%\)", text)
    if m:
        try:
            result["private_tx_count"] = int(m.group(1).replace(" ", "").replace(",", ""))
            result["private_tx_ratio"] = float(m.group(2))
        except ValueError:
            pass

    # Total Transfers (24hr)\n1 981 576
    v = _parse_int_after(r"Total Transfers \(24hr?\)")
    if v is not None:
        result["total_transfers_24h"] = v

    return result


def _is_complete(parsed: dict) -> bool:
    """필요한 KPI가 전부 잡혔는지 — 렌더 대기 루프의 종료 조건."""
    return all(k in parsed for k in REQUIRED_KEYS)


def _merge_and_save(result: dict) -> dict:
    """직전 파일 값 위에 이번 결과를 덮어써서 저장한다.

    반쪽 스크랩이 멀쩡하던 값을 지우지 않게 하는 것이 핵심이다.
    (2026-07-29: 반쪽 결과가 파일을 통째로 덮어써 Private TX 카드가 N/A가 됐다)
    """
    merged = {**load_cached_homepage_data(), **result}
    DATA_FILE.parent.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps(merged, indent=2))
    return merged


async def scrape_cantonscan_homepage() -> dict:
    """Playwright로 cantonscan.com 홈페이지에서 KPI 데이터 스크래핑."""
    from playwright.async_api import async_playwright

    result: dict = {}

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

            # 2초 간격 30회(=최대 60초). KPI 카드가 제각각 늦게 뜨므로
            # 특정 하나가 아니라 REQUIRED_KEYS가 전부 잡힐 때까지 기다린다.
            for _ in range(30):
                await page.wait_for_timeout(2000)
                text = await page.evaluate("() => document.body.innerText")
                result = _parse_homepage_text(text)
                if _is_complete(result):
                    break
            else:
                missing = [k for k in REQUIRED_KEYS if k not in result]
                logger.warning(
                    f"CantonScan: 60초 안에 렌더되지 않은 KPI {missing} — "
                    f"얻은 값만 저장하고 나머지는 직전 값을 유지한다"
                )

            await browser.close()

        merged = _merge_and_save(result)
        logger.info(f"CantonScan homepage scraped: {result} (merged: {merged})")

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
