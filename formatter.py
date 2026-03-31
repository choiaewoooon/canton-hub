"""
텔레그램 메시지 포매터
수집된 데이터를 코블린 채널 톤앤매너에 맞게 변환합니다.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from collectors import TweetData, CantonScanData, PriceData
import config


def _fmt_cc(n: float | None) -> str:
    """CC 수량 축약 (M 단위)"""
    if n is None:
        return "N/A"
    if abs(n) >= 1_000_000_000:
        return f"{n / 1_000_000_000:,.2f}B"
    if abs(n) >= 1_000_000:
        return f"{n / 1_000_000:,.1f}M"
    if abs(n) >= 1_000:
        return f"{n / 1_000:,.1f}K"
    return f"{n:,.0f}"


def _fmt_usd(n: float | None) -> str:
    """USD 금액 포맷"""
    if n is None:
        return "N/A"
    if n >= 1:
        return f"${n:,.2f}"
    return f"${n:.4f}"


def _fmt_large_usd(n: float | None) -> str:
    """큰 USD 축약"""
    if n is None:
        return "N/A"
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:,.2f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:,.1f}M"
    if n >= 1_000:
        return f"${n / 1_000:,.0f}K"
    return f"${n:,.2f}"


def build_daily_report(
    tweets: dict[str, list[TweetData]],
    scan_data: CantonScanData,
    price_data: PriceData,
) -> str:
    """일일 리포트 텔레그램 메시지 생성 (HTML 파싱 모드)"""

    kst = ZoneInfo(config.TIMEZONE)
    now = datetime.now(kst)
    date_str = now.strftime("%Y.%m.%d %a")

    lines = []

    # ── 헤더 ──
    lines.append(f"<b>Canton Daily | {date_str}</b>")
    lines.append("")

    # ── $CC 가격 ──
    if price_data.fetched:
        pct = price_data.price_change_percentage_24h
        if pct is not None:
            arrow = "+" if pct >= 0 else ""
            lines.append(
                f"<b>$CC {_fmt_usd(price_data.current_price_usd)}</b>"
                f"  ({arrow}{pct:.2f}%)"
            )
        else:
            lines.append(f"<b>$CC {_fmt_usd(price_data.current_price_usd)}</b>")

        parts = []
        if price_data.low_24h and price_data.high_24h:
            parts.append(f"24h {_fmt_usd(price_data.low_24h)} ~ {_fmt_usd(price_data.high_24h)}")
        if price_data.total_volume_24h:
            parts.append(f"Vol {_fmt_large_usd(price_data.total_volume_24h)}")
        if price_data.market_cap:
            parts.append(f"MCap {_fmt_large_usd(price_data.market_cap)}")
        if parts:
            lines.append(" | ".join(parts))
    else:
        lines.append("$CC 가격 데이터 수집 실패")
    lines.append("")

    # ── 네트워크 지표 ──
    if scan_data.fetched:
        # B/M Ratio 강조
        if scan_data.burn_mint_ratio is not None:
            ratio = scan_data.burn_mint_ratio
            status = "디플레이션" if ratio >= 1 else "인플레이션"
            lines.append(f"<b>B/M Ratio: {ratio:.4f}x</b> ({status})")

        # Mint / Burn 한 줄
        if scan_data.daily_mint is not None and scan_data.daily_burn is not None:
            lines.append(
                f"Mint {_fmt_cc(scan_data.daily_mint)} CC"
                f" → Burn {_fmt_cc(scan_data.daily_burn)} CC"
            )

        # 리워드 분배
        reward_parts = []
        if scan_data.app_rewards is not None:
            reward_parts.append(f"App {_fmt_cc(scan_data.app_rewards)}")
        if scan_data.validator_rewards is not None:
            reward_parts.append(f"Val {_fmt_cc(scan_data.validator_rewards)}")
        if scan_data.sv_rewards is not None:
            reward_parts.append(f"SV {_fmt_cc(scan_data.sv_rewards)}")
        if reward_parts:
            lines.append("Rewards: " + " | ".join(reward_parts))

        # 누적 지표
        cum_parts = []
        if scan_data.cumulative_burn is not None:
            cum_parts.append(f"총 소각 {_fmt_cc(scan_data.cumulative_burn)}")
        if scan_data.total_supply is not None:
            cum_parts.append(f"총 공급 {_fmt_cc(scan_data.total_supply)}")
        if cum_parts:
            lines.append(" | ".join(cum_parts))
    else:
        lines.append("네트워크 데이터 수집 실패")
    lines.append("")

    # ── 트위터 ──
    total_tweets = sum(len(tw_list) for tw_list in tweets.values())
    if total_tweets > 0:
        lines.append("<b>Twitter</b>")
        for account, tw_list in tweets.items():
            if not tw_list:
                continue
            for tw in sorted(tw_list, key=lambda t: t.created_at, reverse=True)[:3]:
                text = tw.text.replace("<", "&lt;").replace(">", "&gt;")
                if len(text) > 150:
                    text = text[:147] + "..."
                lines.append(f"@{account}: {text}")
                lines.append(f'<a href="{tw.url}">원문</a>')
                lines.append("")

    # ── 푸터 ──
    lines.append(
        f'<a href="https://www.cantonscan.com/stats">CantonScan</a>'
        f' · <a href="https://www.coingecko.com/en/coins/canton-network">CoinGecko</a>'
        f' · <a href="https://x.com/CantonNetwork">@CantonNetwork</a>'
    )

    return "\n".join(lines)
