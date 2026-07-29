"""
$CC 코인 가격 수집 모듈
CoinGecko API를 사용하여 Canton($CC) 토큰의 가격 데이터를 수집합니다.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

import config

from . import net_guard

logger = logging.getLogger(__name__)


@dataclass
class PriceData:
    """$CC 가격 데이터"""
    current_price_usd: Optional[float] = None
    price_change_24h: Optional[float] = None          # 24시간 변동 (USD)
    price_change_percentage_24h: Optional[float] = None  # 24시간 변동률 (%)
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    market_cap: Optional[float] = None
    total_volume_24h: Optional[float] = None
    circulating_supply: Optional[float] = None
    fetched: bool = False


class PriceCollector:
    """CoinGecko 가격 수집기"""

    def __init__(self):
        headers = {
            "Accept": "application/json",
            "User-Agent": "CantonTelegramBot/1.0",
        }
        if config.COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = config.COINGECKO_API_KEY

        # net_guard 경유: 다른 호스트가 DNS 단에서 멈춰도 가격 수집이 같이 죽지 않게 한다.
        self.client = net_guard.make_client(
            timeout=15,
            headers=headers,
        )

    async def collect(self) -> PriceData:
        """$CC 가격 데이터 수집"""
        data = PriceData()

        # 방법 1: /coins/markets (상세 데이터)
        try:
            data = await self._fetch_markets_data()
            if data.fetched:
                return data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                # 429에서 simple/price로 폴백하면 **같은 레이트리밋 버킷**을 한 번 더
                # 두드려 호출량이 2배가 된다. 이미 막힌 상태에서 더 세게 미는 꼴이라
                # 회복만 늦어진다. 미수집으로 반환하면 스케줄러가 직전 캐시를 유지한다.
                logger.warning("CoinGecko 429 (레이트리밋) — 폴백 생략, 직전 캐시 유지")
                return data
            logger.warning(f"markets API 실패: {e!r}")
        except Exception as e:
            # {e!r} 사용: 타임아웃류 예외는 str(e)가 빈 문자열이라
            # "markets API 실패: " 만 남아 진단이 불가능했음 (2026-07 stale-process 사고)
            logger.warning(f"markets API 실패: {e!r}")

        # 방법 2: /simple/price (기본 데이터, 폴백)
        try:
            data = await self._fetch_simple_price()
        except Exception as e:
            logger.error(f"simple price API도 실패: {e!r}")

        return data

    async def _fetch_markets_data(self) -> PriceData:
        """상세 마켓 데이터 가져오기"""
        url = f"{config.COINGECKO_API_URL}/coins/markets"
        params = {
            "ids": config.COINGECKO_COIN_ID,
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 1,
            "page": 1,
            "sparkline": "false",
            "price_change_percentage": "24h",
        }

        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        coins = resp.json()

        if not coins:
            logger.warning(f"CoinGecko에서 '{config.COINGECKO_COIN_ID}' 토큰을 찾을 수 없습니다.")
            return PriceData()

        coin = coins[0]
        data = PriceData(
            current_price_usd=coin.get("current_price"),
            price_change_24h=coin.get("price_change_24h"),
            price_change_percentage_24h=coin.get("price_change_percentage_24h"),
            high_24h=coin.get("high_24h"),
            low_24h=coin.get("low_24h"),
            market_cap=coin.get("market_cap"),
            total_volume_24h=coin.get("total_volume"),
            circulating_supply=coin.get("circulating_supply"),
            fetched=True,
        )

        logger.info(f"$CC 가격 수집 완료: ${data.current_price_usd} ({data.price_change_percentage_24h:+.2f}%)")
        return data

    async def _fetch_simple_price(self) -> PriceData:
        """간단한 가격 데이터 (폴백)"""
        url = f"{config.COINGECKO_API_URL}/simple/price"
        params = {
            "ids": config.COINGECKO_COIN_ID,
            "vs_currencies": "usd",
            "include_market_cap": "true",
            "include_24hr_vol": "true",
            "include_24hr_change": "true",
        }

        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        result = resp.json()

        coin_data = result.get(config.COINGECKO_COIN_ID, {})
        if not coin_data:
            return PriceData()

        data = PriceData(
            current_price_usd=coin_data.get("usd"),
            price_change_percentage_24h=coin_data.get("usd_24h_change"),
            market_cap=coin_data.get("usd_market_cap"),
            total_volume_24h=coin_data.get("usd_24h_vol"),
            fetched=True,
        )

        logger.info(f"$CC 가격 수집 완료 (simple): ${data.current_price_usd}")
        return data

    async def close(self):
        await self.client.aclose()
