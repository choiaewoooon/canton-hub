"""
레퍼런스 사이트 3개를 Playwright로 스크래핑하여 UI/UX 요소 분석
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUTPUT_DIR = Path(__file__).parent / "reference_analysis"
OUTPUT_DIR.mkdir(exist_ok=True)

SITES = [
    {
        "name": "cantonscan",
        "url": "https://www.cantonscan.com/",
        "pages": [
            ("home", "https://www.cantonscan.com/"),
            ("stats", "https://www.cantonscan.com/stats"),
        ],
    },
    {
        "name": "canton_thetie",
        "url": "https://canton.thetie.io/",
        "pages": [
            ("home", "https://canton.thetie.io/"),
            ("overview", "https://canton.thetie.io/overview"),
        ],
    },
    {
        "name": "stockhub",
        "url": "https://stockhub.kr/",
        "pages": [
            ("home", "https://stockhub.kr/"),
        ],
    },
]

EXTRACT_JS = """
() => {
    // 네비게이션 요소
    const navItems = [];
    document.querySelectorAll('nav a, header a, [role="navigation"] a, .nav a, .navbar a, .sidebar a, .menu a').forEach(el => {
        navItems.push({ text: el.innerText.trim(), href: el.href });
    });

    // 카드/섹션 요소
    const cards = [];
    document.querySelectorAll('[class*="card"], [class*="Card"], [class*="panel"], [class*="Panel"], [class*="widget"], [class*="Widget"], [class*="tile"], [class*="Tile"], [class*="stat"], [class*="Stat"], [class*="metric"], [class*="Metric"]').forEach(el => {
        const heading = el.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"], [class*="heading"], [class*="label"], [class*="Label"]');
        const value = el.querySelector('[class*="value"], [class*="Value"], [class*="number"], [class*="Number"], [class*="amount"], [class*="price"], [class*="Price"]');
        cards.push({
            className: el.className,
            heading: heading ? heading.innerText.trim() : '',
            value: value ? value.innerText.trim() : '',
            text: el.innerText.trim().substring(0, 300),
        });
    });

    // 차트/그래프 요소
    const charts = [];
    document.querySelectorAll('canvas, svg, [class*="chart"], [class*="Chart"], [class*="graph"], [class*="Graph"], [class*="recharts"], [class*="apexcharts"], [class*="highcharts"], [class*="d3"]').forEach(el => {
        charts.push({
            tag: el.tagName,
            className: el.className || '',
            id: el.id || '',
            width: el.offsetWidth,
            height: el.offsetHeight,
        });
    });

    // 테이블
    const tables = [];
    document.querySelectorAll('table, [class*="table"], [class*="Table"], [role="table"], [class*="grid"], [class*="Grid"]').forEach(el => {
        const headers = [];
        el.querySelectorAll('th, [class*="header"] td, thead td').forEach(th => {
            headers.push(th.innerText.trim());
        });
        tables.push({
            className: el.className,
            headers: headers,
            rowCount: el.querySelectorAll('tr, [class*="row"], [role="row"]').length,
        });
    });

    // 탭/필터
    const tabs = [];
    document.querySelectorAll('[role="tab"], [class*="tab"], [class*="Tab"], [class*="filter"], [class*="Filter"], [class*="toggle"], [class*="Toggle"]').forEach(el => {
        tabs.push({ text: el.innerText.trim(), className: el.className });
    });

    // 버튼
    const buttons = [];
    document.querySelectorAll('button, [role="button"], input[type="submit"], [class*="btn"], [class*="Btn"], [class*="button"], [class*="Button"]').forEach(el => {
        buttons.push({ text: el.innerText.trim(), className: el.className });
    });

    // 입력/검색
    const inputs = [];
    document.querySelectorAll('input, select, textarea, [class*="search"], [class*="Search"]').forEach(el => {
        inputs.push({
            tag: el.tagName,
            type: el.type || '',
            placeholder: el.placeholder || '',
            className: el.className,
        });
    });

    // 전체 페이지 구조 (최상위 섹션)
    const sections = [];
    document.querySelectorAll('main > *, body > div > *, [class*="section"], [class*="Section"], [class*="container"], [class*="Container"]').forEach(el => {
        if (el.offsetHeight > 50) {
            sections.push({
                tag: el.tagName,
                className: el.className,
                id: el.id || '',
                height: el.offsetHeight,
                childCount: el.children.length,
                text: el.innerText.trim().substring(0, 200),
            });
        }
    });

    // 색상 테마 추출
    const bodyStyle = getComputedStyle(document.body);
    const theme = {
        bgColor: bodyStyle.backgroundColor,
        textColor: bodyStyle.color,
        fontFamily: bodyStyle.fontFamily,
    };

    // 전체 텍스트 (핵심 수치 파악용)
    const fullText = document.body.innerText.substring(0, 5000);

    return {
        title: document.title,
        navItems,
        cards,
        charts,
        tables,
        tabs,
        buttons,
        inputs,
        sections: sections.slice(0, 30),
        theme,
        fullText,
    };
}
"""


async def scrape_site(browser, site_info):
    results = {}
    for page_name, url in site_info["pages"]:
        print(f"\n--- Scraping {site_info['name']}/{page_name}: {url} ---")
        page = await browser.new_page(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

            # 스크린샷
            screenshot_path = OUTPUT_DIR / f"{site_info['name']}_{page_name}.png"
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"  Screenshot saved: {screenshot_path}")

            # DOM 분석
            data = await page.evaluate(EXTRACT_JS)
            results[page_name] = data
            print(f"  Extracted: {len(data.get('cards', []))} cards, {len(data.get('charts', []))} charts, {len(data.get('tables', []))} tables")

        except Exception as e:
            print(f"  Error: {e}")
            # 타임아웃이어도 스크린샷 시도
            try:
                screenshot_path = OUTPUT_DIR / f"{site_info['name']}_{page_name}.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                data = await page.evaluate(EXTRACT_JS)
                results[page_name] = data
            except Exception as e2:
                print(f"  Fallback also failed: {e2}")
                results[page_name] = {"error": str(e)}
        finally:
            await page.close()

    # JSON 저장
    json_path = OUTPUT_DIR / f"{site_info['name']}_analysis.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    print(f"  Analysis saved: {json_path}")

    return results


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        all_results = {}
        for site in SITES:
            all_results[site["name"]] = await scrape_site(browser, site)

        await browser.close()

    print("\n=== All done ===")
    print(f"Results saved in: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
