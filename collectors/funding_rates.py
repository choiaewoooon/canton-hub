"""
거래소별 펀딩비(Funding Rate) 수집기 — 7개 Perp 거래소

60초 간격으로 fetch. 양빵(델타뉴트럴) 페어 추천용 raw 데이터 제공.
1h 정산(HL/Extended/Lighter) ↔ 8h 정산(Aster/Binance/Bybit/OKX) 혼재 →
to_apr()로 연환산 정규화.

수집기 규약(../CLAUDE.md §0): 예외는 내부에서 삼키고 None 반환. 절대 raise 금지.
"""
import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class FundingRate:
    source: str          # "Hyperliquid", "Bybit Perp" 등 (고유명사, 번역 안 함)
    venue_type: str      # "DEX" | "CEX"
    market: str          # "perpetual"
    pair: str            # "CC/USD", "CC/USDT"
    fr_raw: float        # 0.00012 = 0.012%
    period_hours: int    # 1 | 8
    fr_apr: float        # 연환산 % (미리 계산해서 프론트에 제공)
    next_funding_ts: int # unix epoch seconds
    api_source: str      # endpoint hostname (디버깅용)


def to_apr(fr_raw: float, period_hours: int) -> float:
    periods_per_year = (24 * 365) // period_hours  # 8760 (1h) | 1095 (8h)
    return fr_raw * periods_per_year * 100


def _next_hourly_ts() -> int:
    """1h 정산 거래소: 다음 정각 unix ts."""
    now = int(time.time())
    return now - (now % 3600) + 3600


async def fetch_hyperliquid_funding(client: httpx.AsyncClient) -> FundingRate | None:
    try:
        resp = await client.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "metaAndAssetCtxs"}, timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        universe = data[0].get("universe", [])
        ctxs = data[1]
        for i, asset in enumerate(universe):
            if asset.get("name", "").upper() in ("CC", "CANTON"):
                fr_raw = float(ctxs[i].get("funding", 0))
                return FundingRate(
                    "Hyperliquid", "DEX", "perpetual", "CC/USD",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "hyperliquid.xyz",
                )
    except Exception as e:
        logger.warning(f"Hyperliquid funding rate failed: {e}")
    return None


async def fetch_lighter_funding(client: httpx.AsyncClient) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates", timeout=5,
        )
        resp.raise_for_status()
        for r in resp.json().get("funding_rates", []):
            if r.get("exchange") == "lighter" and r.get("symbol") == "CC":
                fr_raw = float(r.get("rate", 0))
                return FundingRate(
                    "Lighter", "DEX", "perpetual", "CC/USDC",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "zklighter.elliot.ai",
                )
    except Exception as e:
        logger.warning(f"Lighter funding rate failed: {e}")
    return None


async def fetch_aster_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://fapi.asterdex.com/fapi/v1/premiumIndex",
            params={"symbol": "CCUSDT"}, timeout=5,
        )
        resp.raise_for_status()
        d = resp.json()
        fr_raw = float(d.get("lastFundingRate", 0))
        next_ts = int(d.get("nextFundingTime", 0)) // 1000
        return FundingRate(
            "Aster", "DEX", "perpetual", "CC/USDT",
            fr_raw, 8, to_apr(fr_raw, 8), next_ts, "asterdex.com",
        )
    except Exception as e:
        logger.warning(f"Aster funding rate failed: {e}")
    return None


async def fetch_extended_funding(client) -> FundingRate | None:
    try:
        resp = await client.get(
            "https://api.starknet.extended.exchange/api/v1/info/markets", timeout=5,
        )
        resp.raise_for_status()
        for m in resp.json().get("data", []):
            if m.get("name") == "CC-USD":
                fr_raw = float(m.get("marketStats", {}).get("fundingRate", 0))
                return FundingRate(
                    "Extended", "DEX", "perpetual", "CC/USD",
                    fr_raw, 1, to_apr(fr_raw, 1), _next_hourly_ts(),
                    "extended.exchange",
                )
    except Exception as e:
        logger.warning(f"Extended funding rate failed: {e}")
    return None
