# Daily Report Image Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 매일 텔레그램에 전송하는 Canton Daily 리포트를 깔끔한 데이터 카드 이미지로도 함께 전송한다.

**Architecture:** Jinja2 HTML 템플릿에 수집된 데이터를 바인딩 → Playwright로 스크린샷 → 텔레그램에 이미지 + 텍스트 함께 전송. Playwright는 이미 프로젝트 의존성에 포함되어 있어 추가 설치 불필요.

**Tech Stack:** Playwright (스크린샷), Jinja2 (템플릿 엔진), HTML/CSS (카드 디자인)

---

### Task 1: Jinja2 의존성 추가

**Files:**
- Modify: `requirements.txt`

**Step 1: requirements.txt에 Jinja2 추가**

```
Jinja2>=3.1
```

**Step 2: 설치**

Run: `pip install Jinja2`
Expected: Successfully installed Jinja2

**Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add Jinja2 dependency for image template"
```

---

### Task 2: HTML/CSS 데이터 카드 템플릿 생성

**Files:**
- Create: `templates/daily_card.html`

**Step 1: 디자인 요구사항**

코블린 채널 톤에 맞는 다크 테마 데이터 카드:
- 800x420px (텔레그램 미리보기 최적 비율)
- 다크 배경 (#0f0f23 계열)
- Canton 브랜드 컬러 활용
- 깔끔한 그리드 레이아웃: 가격 섹션 + 네트워크 지표 섹션
- B/M Ratio 강조 표시 (>1 초록, <1 빨강)
- 하단에 날짜 + 출처

**Step 2: HTML 템플릿 작성**

`templates/daily_card.html` — Jinja2 변수 사용:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  
  body {
    width: 800px;
    height: 420px;
    font-family: 'Inter', -apple-system, sans-serif;
    background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
    color: #e0e0e0;
    padding: 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.5px;
  }
  .header .date {
    font-size: 14px;
    color: #888;
  }

  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #333, transparent);
    margin: 12px 0;
  }

  .content {
    display: flex;
    gap: 32px;
    flex: 1;
  }

  .section {
    flex: 1;
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #666;
    margin-bottom: 12px;
  }

  .price-main {
    font-size: 36px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
  }
  .price-change {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  .price-change.up { color: #00d68f; }
  .price-change.down { color: #ff5a5a; }

  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #1a1a3e;
    font-size: 13px;
  }
  .stat-label { color: #888; }
  .stat-value { color: #ccc; font-weight: 600; }

  .ratio-box {
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    text-align: center;
  }
  .ratio-value {
    font-size: 28px;
    font-weight: 700;
  }
  .ratio-value.deflationary { color: #00d68f; }
  .ratio-value.inflationary { color: #ff5a5a; }
  .ratio-label {
    font-size: 11px;
    color: #888;
    margin-top: 2px;
  }

  .mint-burn {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .mint-burn .tag {
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 600;
  }
  .mint-burn .mint { background: rgba(0,214,143,0.15); color: #00d68f; }
  .mint-burn .burn { background: rgba(255,90,90,0.15); color: #ff5a5a; }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #555;
    padding-top: 8px;
    border-top: 1px solid #1a1a3e;
  }
</style>
</head>
<body>

<div>
  <div class="header">
    <h1>Canton Daily</h1>
    <span class="date">{{ date_str }}</span>
  </div>
  <div class="divider"></div>
</div>

<div class="content">
  <!-- 왼쪽: 가격 -->
  <div class="section">
    <div class="section-title">$CC Price</div>
    {% if price.fetched %}
    <div class="price-main">{{ price_usd }}</div>
    <div class="price-change {{ 'up' if price_change_pct >= 0 else 'down' }}">
      {{ '%+.2f' | format(price_change_pct) }}%
    </div>
    <div class="stat-row">
      <span class="stat-label">24h Range</span>
      <span class="stat-value">{{ low_24h }} ~ {{ high_24h }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Volume</span>
      <span class="stat-value">{{ volume_24h }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Market Cap</span>
      <span class="stat-value">{{ market_cap }}</span>
    </div>
    {% else %}
    <div style="color: #666;">데이터 수집 실패</div>
    {% endif %}
  </div>

  <!-- 오른쪽: 네트워크 -->
  <div class="section">
    <div class="section-title">Network Stats</div>
    {% if scan.fetched %}
    <div class="ratio-box">
      <div class="ratio-value {{ 'deflationary' if bm_ratio >= 1 else 'inflationary' }}">
        {{ '%.4f' | format(bm_ratio) }}x
      </div>
      <div class="ratio-label">B/M Ratio · {{ '디플레이션' if bm_ratio >= 1 else '인플레이션' }}</div>
    </div>
    <div class="mint-burn">
      <span class="tag mint">Mint {{ mint_cc }}</span>
      <span style="color:#555;">→</span>
      <span class="tag burn">Burn {{ burn_cc }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">App Rewards</span>
      <span class="stat-value">{{ app_rewards }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Validator</span>
      <span class="stat-value">{{ val_rewards }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">총 소각</span>
      <span class="stat-value">{{ total_burned }}</span>
    </div>
    {% else %}
    <div style="color: #666;">데이터 수집 실패</div>
    {% endif %}
  </div>
</div>

<div class="footer">
  <span>cantonscan.com · coingecko.com</span>
  <span>@ozzycanton</span>
</div>

</body>
</html>
```

**Step 3: Commit**

```bash
git add templates/daily_card.html
git commit -m "feat: add HTML template for daily report card"
```

---

### Task 3: 이미지 생성 모듈 구현

**Files:**
- Create: `image_generator.py`

**Step 1: image_generator.py 작성**

Playwright로 HTML → PNG 변환하는 모듈:

```python
"""
일일 리포트 데이터 카드 이미지 생성
HTML 템플릿 + Playwright 스크린샷 방식
"""
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright

from collectors import CantonScanData, PriceData

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).parent / "templates"


def _fmt_cc(n: float | None) -> str:
    if n is None:
        return "N/A"
    if abs(n) >= 1_000_000_000:
        return f"{n / 1_000_000_000:,.2f}B CC"
    if abs(n) >= 1_000_000:
        return f"{n / 1_000_000:,.1f}M CC"
    return f"{n:,.0f} CC"


def _fmt_usd(n: float | None) -> str:
    if n is None:
        return "N/A"
    if n >= 1:
        return f"${n:,.2f}"
    return f"${n:.4f}"


def _fmt_large_usd(n: float | None) -> str:
    if n is None:
        return "N/A"
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:,.2f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:,.1f}M"
    return f"${n:,.0f}"


async def generate_daily_card(
    scan_data: CantonScanData,
    price_data: PriceData,
    date_str: str,
) -> bytes | None:
    """데이터 카드 이미지 생성, PNG bytes 반환"""

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("daily_card.html")

    bm_ratio = scan_data.burn_mint_ratio or 0

    html = template.render(
        date_str=date_str,
        price=price_data,
        price_usd=_fmt_usd(price_data.current_price_usd),
        price_change_pct=price_data.price_change_percentage_24h or 0,
        low_24h=_fmt_usd(price_data.low_24h),
        high_24h=_fmt_usd(price_data.high_24h),
        volume_24h=_fmt_large_usd(price_data.total_volume_24h),
        market_cap=_fmt_large_usd(price_data.market_cap),
        scan=scan_data,
        bm_ratio=bm_ratio,
        mint_cc=_fmt_cc(scan_data.daily_mint),
        burn_cc=_fmt_cc(scan_data.daily_burn),
        app_rewards=_fmt_cc(scan_data.app_rewards),
        val_rewards=_fmt_cc(scan_data.validator_rewards),
        total_burned=_fmt_cc(scan_data.cumulative_burn),
    )

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                viewport={"width": 800, "height": 420},
                device_scale_factor=2,  # 레티나 품질
            )
            await page.set_content(html, wait_until="networkidle")
            await page.wait_for_timeout(500)  # 폰트 로딩 대기

            image_bytes = await page.screenshot(type="png")
            await browser.close()

        logger.info(f"데이터 카드 이미지 생성 완료 ({len(image_bytes)} bytes)")
        return image_bytes

    except Exception as e:
        logger.error(f"이미지 생성 실패: {e}")
        return None
```

**Step 2: Commit**

```bash
git add image_generator.py
git commit -m "feat: add image generator module (HTML + Playwright)"
```

---

### Task 4: bot.py에 이미지 전송 로직 추가

**Files:**
- Modify: `bot.py` — `collect_and_post()` 함수

**Step 1: import 추가**

```python
from image_generator import generate_daily_card
```

**Step 2: 이미지 생성 + 전송 로직 추가**

`collect_and_post()` 함수에서 텍스트 메시지 전송 직전에 이미지 생성 및 전송을 추가:

```python
# 텍스트 메시지 전송 후, 이미지 카드도 전송
try:
    image_bytes = await generate_daily_card(scan_data, price_data, date_str)
    if image_bytes:
        from io import BytesIO
        await bot.send_photo(
            chat_id=config.TELEGRAM_CHANNEL_ID,
            photo=BytesIO(image_bytes),
            caption="Canton Daily Report",
        )
        logger.info("이미지 카드 전송 완료")
except Exception as e:
    logger.warning(f"이미지 카드 전송 실패 (텍스트는 전송됨): {e}")
```

핵심: 이미지 실패해도 텍스트 메시지는 이미 전송된 상태이므로 리포트 자체는 항상 전달됨.

**Step 3: 테스트**

Run: `python bot.py --now`
Expected: 텔레그램 채널에 텍스트 메시지 + 이미지 카드 둘 다 전송됨

**Step 4: Commit**

```bash
git add bot.py
git commit -m "feat: send daily report as image card + text"
```

---

### Task 5: 이미지 단독 테스트 스크립트

**Files:**
- Create: `test_image.py`

**Step 1: 테스트 스크립트 작성**

로컬에서 이미지만 빠르게 확인할 수 있는 스크립트:

```python
"""이미지 생성 단독 테스트 — 로컬 파일로 저장"""
import asyncio
from collectors import CantonScanCollector, PriceCollector
from image_generator import generate_daily_card
from datetime import datetime
from zoneinfo import ZoneInfo

async def main():
    scan = CantonScanCollector()
    price = PriceCollector()
    
    scan_data, price_data = await asyncio.gather(
        scan.collect(), price.collect()
    )
    
    kst = ZoneInfo("Asia/Seoul")
    date_str = datetime.now(kst).strftime("%Y.%m.%d %a")
    
    image = await generate_daily_card(scan_data, price_data, date_str)
    if image:
        with open("test_card.png", "wb") as f:
            f.write(image)
        print(f"저장 완료: test_card.png ({len(image):,} bytes)")
    else:
        print("이미지 생성 실패")
    
    await scan.close()
    await price.close()

asyncio.run(main())
```

**Step 2: 실행 및 확인**

Run: `python test_image.py && open test_card.png`
Expected: 데이터 카드 이미지가 생성되고 미리보기가 열림

**Step 3: Commit**

```bash
git add test_image.py
git commit -m "chore: add image generation test script"
```

---

### Task 6: 디자인 미세 조정

**Files:**
- Modify: `templates/daily_card.html`

**Step 1: 실제 데이터로 확인하고 조정**

`test_image.py`로 반복 확인하며:
- 폰트 크기, 간격 미세 조정
- 숫자가 넘치는 경우 대응 (overflow 처리)
- B/M Ratio 색상 확인
- 다크/라이트 대비 확인

**Step 2: .gitignore에 테스트 파일 추가**

```
test_card.png
```

**Step 3: Commit**

```bash
git add templates/daily_card.html .gitignore
git commit -m "style: fine-tune daily card design"
```

---

## 구현 순서 요약

| Task | 내용 | 예상 시간 |
|------|------|----------|
| 1 | Jinja2 의존성 추가 | 1분 |
| 2 | HTML/CSS 카드 템플릿 | 10분 |
| 3 | image_generator.py 모듈 | 5분 |
| 4 | bot.py 이미지 전송 연동 | 5분 |
| 5 | 테스트 스크립트 | 3분 |
| 6 | 디자인 미세 조정 | 5~10분 |

**총 예상: ~35분**

## 파일 구조 변경

```
canton-telegram-bot/
  templates/
    daily_card.html      (NEW — 데이터 카드 HTML 템플릿)
  image_generator.py     (NEW — Playwright 스크린샷 모듈)
  test_image.py          (NEW — 로컬 테스트 스크립트)
  bot.py                 (MODIFY — 이미지 전송 추가)
  requirements.txt       (MODIFY — Jinja2 추가)
```
