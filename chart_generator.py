"""
$CC 24시간 가격 차트 생성
CoinGecko OHLC 데이터 → matplotlib 캔들스틱 차트 → base64 이미지
"""
import base64
import logging
from io import BytesIO
from datetime import datetime, timezone

import httpx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import FancyBboxPatch

import config

logger = logging.getLogger(__name__)

# 다크 테마 색상 (이미지 카드와 통일)
BG_COLOR = "#0f0f23"
GRID_COLOR = "#1a1a3e"
TEXT_COLOR = "#888888"
UP_COLOR = "#00d68f"
DOWN_COLOR = "#ff5a5a"
LINE_COLOR = "#6366f1"


async def fetch_ohlc_data() -> list[dict]:
    """CoinGecko에서 24시간 OHLC 데이터 가져오기"""
    url = f"{config.COINGECKO_API_URL}/coins/{config.COINGECKO_COIN_ID}/ohlc"
    params = {"vs_currency": "usd", "days": "1"}

    headers = {"Accept": "application/json"}
    if config.COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = config.COINGECKO_API_KEY

    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        raw = resp.json()

    candles = []
    for item in raw:
        ts, o, h, l, c = item
        candles.append({
            "time": datetime.fromtimestamp(ts / 1000, tz=timezone.utc),
            "open": o,
            "high": h,
            "low": l,
            "close": c,
        })

    return candles


def render_chart(candles: list[dict]) -> str:
    """캔들스틱 차트를 base64 PNG로 렌더링"""
    if not candles:
        return ""

    fig, ax = plt.subplots(figsize=(7.2, 2.8), dpi=150)
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)

    times = [c["time"] for c in candles]
    opens = [c["open"] for c in candles]
    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    closes = [c["close"] for c in candles]

    # 캔들 폭 계산
    if len(times) >= 2:
        width = (times[1] - times[0]).total_seconds() / 86400 * 0.6
    else:
        width = 0.01

    for i in range(len(candles)):
        color = UP_COLOR if closes[i] >= opens[i] else DOWN_COLOR

        # 심지 (wick)
        ax.plot(
            [times[i], times[i]], [lows[i], highs[i]],
            color=color, linewidth=0.8, solid_capstyle="round"
        )

        # 몸통 (body)
        body_low = min(opens[i], closes[i])
        body_high = max(opens[i], closes[i])
        body_height = max(body_high - body_low, (highs[i] - lows[i]) * 0.01)

        rect = plt.Rectangle(
            (mdates.date2num(times[i]) - width / 2, body_low),
            width, body_height,
            facecolor=color, edgecolor=color, linewidth=0.5,
            alpha=0.9
        )
        ax.add_patch(rect)

    # 스타일링
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
    ax.xaxis.set_major_locator(mdates.HourLocator(interval=4))
    ax.tick_params(colors=TEXT_COLOR, labelsize=7, length=0)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:.4f}"))

    for spine in ax.spines.values():
        spine.set_visible(False)

    ax.grid(True, axis="y", color=GRID_COLOR, linewidth=0.5, alpha=0.5)
    ax.grid(True, axis="x", color=GRID_COLOR, linewidth=0.3, alpha=0.3)

    # 현재가 점선
    last_price = closes[-1]
    ax.axhline(y=last_price, color=LINE_COLOR, linewidth=0.6, linestyle="--", alpha=0.5)

    # 여백
    plt.subplots_adjust(left=0.12, right=0.98, top=0.95, bottom=0.15)

    # PNG → base64
    buf = BytesIO()
    fig.savefig(buf, format="png", facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)
    buf.seek(0)

    b64 = base64.b64encode(buf.read()).decode("utf-8")
    logger.info(f"차트 이미지 생성 완료 ({len(candles)}개 캔들)")
    return b64


async def generate_chart_base64() -> str:
    """OHLC 데이터 가져와서 base64 차트 반환"""
    try:
        candles = await fetch_ohlc_data()
        return render_chart(candles)
    except Exception as e:
        logger.error(f"차트 생성 실패: {e}")
        return ""
