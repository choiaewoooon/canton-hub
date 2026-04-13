"""
실패한 페이지 재시도 + canton.thetie.io 대시보드 접근
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUTPUT_DIR = Path(__file__).parent / "reference_analysis"
OUTPUT_DIR.mkdir(exist_ok=True)

EXTRACT_JS = """
() => {
    const navItems = [];
    document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(el => {
        if (el.innerText && el.innerText.trim()) {
            navItems.push({ text: el.innerText.trim(), href: el.href || '' });
        }
    });

    const allText = document.body ? document.body.innerText.substring(0, 8000) : '';

    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4').forEach(el => {
        if (el.innerText && el.innerText.trim()) {
            headings.push({ tag: el.tagName, text: el.innerText.trim() });
        }
    });

    const links = [];
    document.querySelectorAll('a').forEach(el => {
        if (el.innerText && el.innerText.trim() && el.href) {
            links.push({ text: el.innerText.trim().substring(0, 100), href: el.href });
        }
    });

    const svgCount = document.querySelectorAll('svg').length;
    const canvasCount = document.querySelectorAll('canvas').length;
    const tableCount = document.querySelectorAll('table').length;

    return {
        title: document.title,
        url: window.location.href,
        navItems: navItems.slice(0, 30),
        headings: headings.slice(0, 50),
        links: links.slice(0, 50),
        svgCount,
        canvasCount,
        tableCount,
        allText,
    };
}
"""

PAGES = [
    ("cantonscan_home", "https://www.cantonscan.com/", "domcontentloaded"),
    ("canton_thetie_home", "https://canton.thetie.io/", "domcontentloaded"),
    ("canton_thetie_network", "https://canton.thetie.io/network-activity", "domcontentloaded"),
    ("canton_thetie_tokenomics", "https://canton.thetie.io/tokenomics", "domcontentloaded"),
    ("canton_thetie_validators", "https://canton.thetie.io/validators", "domcontentloaded"),
    ("canton_thetie_ecosystem", "https://canton.thetie.io/ecosystem", "domcontentloaded"),
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for name, url, wait_until in PAGES:
            print(f"\n--- {name}: {url} ---")
            page = await browser.new_page(
                viewport={"width": 1440, "height": 900},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            try:
                await page.goto(url, wait_until=wait_until, timeout=45000)
                await page.wait_for_timeout(5000)  # SPA 렌더링 대기

                # 스크린샷
                ss_path = OUTPUT_DIR / f"{name}.png"
                await page.screenshot(path=str(ss_path), full_page=True)
                print(f"  Screenshot: {ss_path}")

                # DOM 분석
                data = await page.evaluate(EXTRACT_JS)
                json_path = OUTPUT_DIR / f"{name}.json"
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2, default=str)
                print(f"  JSON: {json_path}")
                print(f"  Title: {data.get('title', 'N/A')}")
                print(f"  Headings: {len(data.get('headings', []))}")
                print(f"  Nav items: {len(data.get('navItems', []))}")
                print(f"  SVGs: {data.get('svgCount', 0)}, Canvas: {data.get('canvasCount', 0)}, Tables: {data.get('tableCount', 0)}")
            except Exception as e:
                print(f"  Error: {e}")
                try:
                    ss_path = OUTPUT_DIR / f"{name}.png"
                    await page.screenshot(path=str(ss_path), full_page=True)
                    data = await page.evaluate(EXTRACT_JS)
                    json_path = OUTPUT_DIR / f"{name}.json"
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
                    print(f"  Fallback succeeded")
                except Exception as e2:
                    print(f"  Fallback failed: {e2}")
            finally:
                await page.close()

        await browser.close()
    print("\n=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
