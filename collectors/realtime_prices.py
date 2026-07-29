"""
실시간 Canton (CC) 가격 수집기 — DEX + CEX 통합

5초 간격으로 모든 거래소에서 가격을 가져와서 아비트라지 기회 추적용.

Sources:
- DEX Perp: Hyperliquid, Extended, Aster, Lighter
- CEX Spot: OKX, Kraken
- CEX Perp: OKX Futures, Binance Futures

호출은 net_guard의 서킷 브레이커를 거친다 — 한 거래소가 DNS 단에서 멈춰도
나머지 수집기까지 끌고 들어가지 않게 하기 위함(2026-07-29 전체 마비 사고).
"""
import asyncio
import logging
from dataclasses import dataclass

import httpx

from . import net_guard

logger = logging.getLogger(__name__)


@dataclass
class LivePrice:
    source: str  # exchange name
    venue_type: str  # "DEX" or "CEX"
    market: str  # "spot", "perpetual", "futures"
    pair: str  # e.g. "CC/USDT"
    price: float  # USD
    api_source: str  # API endpoint identifier


# ============================================================
# DEX Perp Sources
# ============================================================

async def fetch_hyperliquid(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "metaAndAssetCtxs"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        universe = data[0].get("universe", [])
        ctxs = data[1]
        for i, asset in enumerate(universe):
            if asset.get("name", "").upper() in ("CC", "CANTON"):
                ctx = ctxs[i] if i < len(ctxs) else {}
                price = float(ctx.get("markPx", 0))
                return LivePrice("Hyperliquid", "DEX", "perpetual", "CC/USD", price, "hyperliquid.xyz")
    except Exception as e:
        logger.warning(f"Hyperliquid live price failed: {e}")
    return None


async def fetch_extended(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://api.starknet.extended.exchange/api/v1/info/markets",
            timeout=5,
        )
        resp.raise_for_status()
        for m in resp.json().get("data", []):
            if m.get("name") == "CC-USD":
                stats = m.get("marketStats", {})
                price = float(stats.get("markPrice", 0))
                return LivePrice("Extended", "DEX", "perpetual", "CC/USD", price, "extended.exchange")
    except Exception as e:
        logger.warning(f"Extended live price failed: {e}")
    return None


async def fetch_aster(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://fapi.asterdex.com/fapi/v1/ticker/price",
            params={"symbol": "CCUSDT"},
            timeout=5,
        )
        resp.raise_for_status()
        d = resp.json()
        price = float(d.get("price", 0))
        return LivePrice("Aster", "DEX", "perpetual", "CC/USDT", price, "asterdex.com")
    except Exception as e:
        logger.warning(f"Aster live price failed: {e}")
    return None


async def fetch_lighter(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://mainnet.zklighter.elliot.ai/api/v1/exchangeStats",
            timeout=5,
        )
        resp.raise_for_status()
        for s in resp.json().get("order_book_stats", []):
            if s.get("symbol") == "CC":
                price = float(s.get("last_trade_price", 0))
                return LivePrice("Lighter", "DEX", "perpetual", "CC/USDC", price, "zklighter.elliot.ai")
    except Exception as e:
        logger.warning(f"Lighter live price failed: {e}")
    return None


# ============================================================
# CEX Spot Sources
# ============================================================

# Bybit(spot/perp)은 2026-07-29에 제거됐다.
# 한국망에서 api.bybit.com의 getaddrinfo가 30초 행 → gaierror다.
# uvloop이 DNS를 넘기는 libuv 스레드풀(기본 4개)을 이게 포화시켜
# 프로세스 안의 모든 수집기가 함께 죽었다 (net_guard 모듈 docstring 참조).
# 되살리려면 먼저 `python3 -c "import socket; socket.getaddrinfo('api.bybit.com', 443)"`가
# 즉시 끝나는지 확인할 것.


async def fetch_okx_spot(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://www.okx.com/api/v5/market/ticker",
            params={"instId": "CC-USDT"},
            timeout=5,
        )
        resp.raise_for_status()
        items = resp.json().get("data", [])
        if items:
            price = float(items[0].get("last", 0))
            return LivePrice("OKX", "CEX", "spot", "CC/USDT", price, "okx.com")
    except Exception as e:
        logger.warning(f"OKX spot live price failed: {e}")
    return None


async def fetch_kraken_spot(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://api.kraken.com/0/public/Ticker",
            params={"pair": "CCUSD"},
            timeout=5,
        )
        resp.raise_for_status()
        result = resp.json().get("result", {})
        for pair_key, pair_data in result.items():
            close = pair_data.get("c", [])
            if close:
                return LivePrice("Kraken", "CEX", "spot", "CC/USD", float(close[0]), "api.kraken.com")
    except Exception as e:
        logger.warning(f"Kraken live price failed: {e}")
    return None


# ============================================================
# CEX Perp Sources
# ============================================================

async def fetch_okx_perp(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://www.okx.com/api/v5/market/ticker",
            params={"instId": "CC-USDT-SWAP"},
            timeout=5,
        )
        resp.raise_for_status()
        items = resp.json().get("data", [])
        if items:
            price = float(items[0].get("last", 0))
            return LivePrice("OKX Perp", "CEX", "perpetual", "CC/USDT", price, "okx.com")
    except Exception as e:
        logger.warning(f"OKX perp live price failed: {e}")
    return None


async def fetch_binance_perp(client: httpx.AsyncClient) -> LivePrice | None:
    try:
        resp = await client.get(
            "https://fapi.binance.com/fapi/v1/ticker/price",
            params={"symbol": "CCUSDT"},
            timeout=5,
        )
        resp.raise_for_status()
        d = resp.json()
        price = float(d.get("price", 0))
        return LivePrice("Binance Perp", "CEX", "perpetual", "CC/USDT", price, "binance.com")
    except Exception as e:
        logger.warning(f"Binance perp live price failed: {e}")
    return None


# ============================================================
# Aggregator
# ============================================================

async def collect_all_realtime_prices() -> list[LivePrice]:
    """모든 소스에서 가격 동시 수집."""
    async with net_guard.make_client() as client:
        results = await asyncio.gather(
            # DEX Perp
            fetch_hyperliquid(client),
            fetch_extended(client),
            fetch_aster(client),
            fetch_lighter(client),
            # CEX Spot
            fetch_okx_spot(client),
            fetch_kraken_spot(client),
            # CEX Perp
            fetch_okx_perp(client),
            fetch_binance_perp(client),
            return_exceptions=True,
        )
    return [r for r in results if isinstance(r, LivePrice) and r.price > 0]
