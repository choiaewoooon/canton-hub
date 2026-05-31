"""
Canton DAT(Digital Asset Treasury) tracker collector.

$CC를 재무자산으로 보유한 상장사(시드: CNTN)의 보유량·평단 등 정적 데이터를
data/dat_companies.json에서 로드하고, 주가(Yahoo Finance)·USD/KRW(open.er-api.com)를
실시간 조회해 mNAV / P/L / 리스크를 계산한다. $CC 현재가는 호출자(scheduler)가 주입한다.

순수 모듈: cache를 모름. 예외는 내부에서 삼키고 빈/부분 데이터를 반환한다 (절대 throw 금지).
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

import config

logger = logging.getLogger(__name__)

_COMPANIES_FILE = Path(__file__).parent.parent / "data" / "dat_companies.json"
_CACHE_FILE = Path(__file__).parent.parent / "data" / "dat_cache.json"

# mNAV bands. 1.0x is the only structurally-meaningful line (premium↔discount,
# below which equity raises turn dilutive → death-spiral zone). 1.2x is a tunable
# heuristic buffer for the "watch" warning — not a theoretical optimum.
MNAV_NAV_FLOOR = 1.0
MNAV_WATCH_THRESHOLD = 1.2


def compute_nav(cc_holdings: float, cc_price: float) -> float:
    """$CC NAV = 보유 수량 × 현재가."""
    return float(cc_holdings) * float(cc_price)


def compute_mnav(
    market_cap: Optional[float], debt: float, cash: float, nav: float
) -> tuple[Optional[float], Optional[str]]:
    """EV식 mNAV = (시총 + 부채 − 현금) / NAV.

    nav 또는 market_cap이 없으면 (None, None). debt/cash가 둘 다 0이면
    시총/NAV 폴백 + 라벨로 어떤 공식을 썼는지 표시.
    """
    if not nav or market_cap is None:
        return None, None
    if debt or cash:
        mnav = (market_cap + (debt or 0) - (cash or 0)) / nav
        return mnav, "mNAV (EV / $CC Reserve)"
    return market_cap / nav, "mNAV (Market Cap / $CC NAV)"


def compute_pl(
    cc_price: float, avg_buy_price: float, cc_holdings: float
) -> tuple[Optional[float], Optional[float]]:
    """평가손익. 보유량 또는 평단이 0이면 (None, None)."""
    if not cc_holdings or not avg_buy_price:
        return None, None
    pl_usd = (cc_price - avg_buy_price) * cc_holdings
    pl_pct = pl_usd / (avg_buy_price * cc_holdings) * 100
    return pl_usd, pl_pct


def classify_risk(mnav: Optional[float]) -> Optional[str]:
    """mNAV → 리스크 밴드. None이면 None (배지 숨김)."""
    if mnav is None:
        return None
    if mnav >= MNAV_WATCH_THRESHOLD:
        return "healthy"
    if mnav >= MNAV_NAV_FLOOR:
        return "watch"
    return "below_nav"
