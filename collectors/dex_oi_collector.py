"""
DEX Perpetual OI Collector for Canton (CC)

CoinGecko의 무료 API에는 OI 데이터가 없지만, 각 DEX의 공개 API에서 직접 가져올 수 있습니다.

지원 DEX:
- Hyperliquid (POST /info, type=metaAndAssetCtxs) → OI in CC
- Extended Exchange (Starknet) (/api/v1/info/markets) → OI in CC
- Aster Dex (Binance Futures fork) (/fapi/v1/openInterest) → OI in CC
- Lighter (no public OI endpoint)
"""
import asyncio
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class DexOI:
    name: str
    symbol: str
    open_interest_base: float  # in CC
    open_interest_usd: float  # USD equivalent
    mark_price: float
    funding_rate: float | None  # decimal (e.g., 0.0001 = 0.01%)
    daily_volume_usd: float
    max_leverage: int | None
    api_source: str  # which API was used


async def fetch_hyperliquid_cc(client: httpx.AsyncClient) -> DexOI | None:
    """Hyperliquid API — POST /info with metaAndAssetCtxs."""
    try:
        resp = await client.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "metaAndAssetCtxs"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list) or len(data) < 2:
            return None
        universe = data[0].get("universe", [])
        ctxs = data[1]

        for i, asset in enumerate(universe):
            name = asset.get("name", "")
            if name.upper() in ("CC", "CANTON"):
                ctx = ctxs[i] if i < len(ctxs) else {}
                oi = float(ctx.get("openInterest", 0))
                mark = float(ctx.get("markPx", 0))
                funding = float(ctx.get("funding", 0)) if ctx.get("funding") is not None else None
                vol = float(ctx.get("dayNtlVlm", 0))
                return DexOI(
                    name="Hyperliquid",
                    symbol=name,
                    open_interest_base=oi,
                    open_interest_usd=oi * mark,
                    mark_price=mark,
                    funding_rate=funding,
                    daily_volume_usd=vol,
                    max_leverage=asset.get("maxLeverage"),
                    api_source="hyperliquid.xyz/info",
                )
    except Exception as e:
        logger.warning(f"Hyperliquid fetch failed: {e}")
    return None


async def fetch_extended_cc(client: httpx.AsyncClient) -> DexOI | None:
    """Extended Exchange (Starknet) — GET /api/v1/info/markets."""
    try:
        resp = await client.get(
            "https://api.starknet.extended.exchange/api/v1/info/markets",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        markets = data.get("data", [])
        for m in markets:
            name = (m.get("name") or "").upper()
            asset = (m.get("assetName") or "").upper()
            if name == "CC-USD" or asset == "CC":
                stats = m.get("marketStats", {})
                oi_base = float(stats.get("openInterest", 0))
                mark = float(stats.get("markPrice", 0))
                vol = float(stats.get("dailyVolume", 0))
                # dailyVolume on Extended is typically in quote asset (USD)
                funding = float(stats.get("fundingRate", 0)) if stats.get("fundingRate") else None
                return DexOI(
                    name="Extended",
                    symbol="CC-USD",
                    open_interest_base=oi_base,
                    open_interest_usd=oi_base * mark,
                    mark_price=mark,
                    funding_rate=funding,
                    daily_volume_usd=vol,
                    max_leverage=None,
                    api_source="extended.exchange/api/v1",
                )
    except Exception as e:
        logger.warning(f"Extended fetch failed: {e}")
    return None


async def fetch_aster_cc(client: httpx.AsyncClient) -> DexOI | None:
    """Aster Dex — GET /fapi/v1/openInterest + /fapi/v1/ticker/24hr (Binance-like)."""
    try:
        oi_resp, ticker_resp = await asyncio.gather(
            client.get("https://fapi.asterdex.com/fapi/v1/openInterest", params={"symbol": "CCUSDT"}, timeout=10),
            client.get("https://fapi.asterdex.com/fapi/v1/ticker/24hr", params={"symbol": "CCUSDT"}, timeout=10),
            return_exceptions=True,
        )
        if isinstance(oi_resp, Exception) or isinstance(ticker_resp, Exception):
            return None
        oi_data = oi_resp.json()
        ticker = ticker_resp.json()

        oi_base = float(oi_data.get("openInterest", 0))
        mark = float(ticker.get("lastPrice", 0))
        vol_quote = float(ticker.get("quoteVolume", 0))  # USDT volume
        return DexOI(
            name="Aster",
            symbol="CCUSDT",
            open_interest_base=oi_base,
            open_interest_usd=oi_base * mark,
            mark_price=mark,
            funding_rate=None,  # Could fetch from premiumIndex but skip for now
            daily_volume_usd=vol_quote,
            max_leverage=None,
            api_source="asterdex.com/fapi/v1",
        )
    except Exception as e:
        logger.warning(f"Aster fetch failed: {e}")
    return None


async def fetch_lighter_cc(client: httpx.AsyncClient) -> DexOI | None:
    """Lighter — no OI endpoint, but we can return volume + price."""
    try:
        resp = await client.get(
            "https://mainnet.zklighter.elliot.ai/api/v1/exchangeStats",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        for s in data.get("order_book_stats", []):
            if s.get("symbol") == "CC":
                price = float(s.get("last_trade_price", 0))
                vol_quote = float(s.get("daily_quote_token_volume", 0))
                return DexOI(
                    name="Lighter",
                    symbol="CC",
                    open_interest_base=0,  # Not exposed
                    open_interest_usd=0,
                    mark_price=price,
                    funding_rate=None,
                    daily_volume_usd=vol_quote,
                    max_leverage=None,
                    api_source="zklighter.elliot.ai/api/v1",
                )
    except Exception as e:
        logger.warning(f"Lighter fetch failed: {e}")
    return None


async def collect_all_dex_oi() -> list[DexOI]:
    """모든 DEX에서 Canton (CC) OI 데이터 동시 수집."""
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            fetch_hyperliquid_cc(client),
            fetch_extended_cc(client),
            fetch_aster_cc(client),
            fetch_lighter_cc(client),
            return_exceptions=True,
        )
    valid: list[DexOI] = []
    for r in results:
        if isinstance(r, DexOI):
            valid.append(r)
        elif isinstance(r, Exception):
            logger.warning(f"DEX OI fetch error: {r}")
    return valid
