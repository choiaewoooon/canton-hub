"""
CantonScan 데이터 수집 모듈
CantonScan 내부 API에서 네트워크 지표를 수집합니다.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

# curl_cffi impersonates Chrome's TLS/JA3 fingerprint. Cloudflare in front of
# fossil-outlook-levitate-gloomy.cantonscan.com blocks stock python-httpx on
# datacenter IPs (Fly.io / AWS / GCP). Chrome-impersonating TLS handshake
# passes the block. See kr_companies_collector.py for more detail.
from curl_cffi.requests import AsyncSession

import config

logger = logging.getLogger(__name__)

# CantonScan 내부 API (Playwright로 발견)
CANTONSCAN_API_BASE = "https://fossil-outlook-levitate-gloomy.cantonscan.com"
TIMESERIES_URL = f"{CANTONSCAN_API_BASE}/api/mining-rounds/timeseries?interval=day"


@dataclass
class CantonScanData:
    """CantonScan 네트워크 지표 데이터"""
    daily_burn: Optional[float] = None
    daily_mint: Optional[float] = None
    burn_mint_ratio: Optional[float] = None
    total_burned: Optional[float] = None
    total_supply: Optional[float] = None
    daily_transactions: Optional[int] = None
    daily_active_addresses: Optional[int] = None
    # 추가 상세 데이터
    app_rewards: Optional[float] = None
    validator_rewards: Optional[float] = None
    sv_rewards: Optional[float] = None
    burned_from_fees: Optional[float] = None
    burned_from_traffic: Optional[float] = None
    avg_amulet_price: Optional[float] = None
    cumulative_mint: Optional[float] = None
    cumulative_burn: Optional[float] = None
    raw_data: dict = field(default_factory=dict)
    fetched: bool = False


class CantonScanCollector:
    """CantonScan 데이터 수집기"""

    def __init__(self):
        # curl_cffi impersonate="chrome124" handles User-Agent + sec-* headers +
        # TLS JA3 fingerprint. Explicit Accept/Referer/Origin reinforce browser
        # signal beyond TLS-level identity.
        self.client = AsyncSession(
            impersonate="chrome124",
            timeout=30,
            headers={
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
                "Referer": "https://www.cantonscan.com/",
                "Origin": "https://www.cantonscan.com",
            },
        )

    async def collect(self) -> CantonScanData:
        """CantonScan에서 네트워크 지표 수집"""
        try:
            resp = await self.client.get(TIMESERIES_URL)
            resp.raise_for_status()
            result = resp.json()

            items = result.get("data", [])
            if not items:
                logger.warning("CantonScan API: 데이터 없음")
                return CantonScanData()

            # 최신 데이터 (마지막 항목)
            latest = items[-1]
            data = self._parse_day(latest)
            logger.info(
                f"CantonScan 수집 완료 ({latest['date']}): "
                f"Burn={data.daily_burn:,.0f} CC, Mint={data.daily_mint:,.0f} CC, "
                f"Ratio={data.burn_mint_ratio:.4f}"
            )
            return data

        except Exception as e:
            logger.error(f"CantonScan API 수집 실패: {e}")
            return CantonScanData()

    def _parse_day(self, day: dict) -> CantonScanData:
        """하루치 데이터 파싱"""
        mint = day.get("mintAmount", 0)
        burn = day.get("burnAmount", 0)
        ratio = burn / mint if mint > 0 else 0

        return CantonScanData(
            daily_burn=burn,
            daily_mint=mint,
            burn_mint_ratio=ratio,
            total_burned=day.get("cumulativeBurn"),
            total_supply=day.get("cumulativeSupply"),
            app_rewards=day.get("appRewards"),
            validator_rewards=day.get("validatorRewards"),
            sv_rewards=day.get("superValidatorRewards"),
            burned_from_fees=day.get("burnedFromFees"),
            burned_from_traffic=day.get("burnedFromTrafficPurchases"),
            avg_amulet_price=day.get("avgAmuletPrice"),
            cumulative_mint=day.get("cumulativeMint"),
            cumulative_burn=day.get("cumulativeBurn"),
            raw_data=day,
            fetched=True,
        )

    async def close(self):
        await self.client.close()
