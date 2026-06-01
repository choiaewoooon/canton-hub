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


_HTTP_HEADERS = {
    # Yahoo's chart endpoint 429s requests without a browser-like UA.
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}


def _load_companies() -> list[dict]:
    """data/dat_companies.json 로드. 부재/손상 시 빈 리스트."""
    if not _COMPANIES_FILE.exists():
        return []
    try:
        data = json.loads(_COMPANIES_FILE.read_text())
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning(f"dat_companies.json load failed: {e}")
        return []


async def _fetch_stooq(client: httpx.AsyncClient, ticker: str) -> Optional[float]:
    """stooq CSV로 종가 조회 (1순위, 키 불필요). 실패/없음 시 None.

    응답 예: 'Symbol,Date,Time,Open,High,Low,Close,Volume\\nCNTN.US,2026-05-29,...,3.1,...'
    값이 없으면 필드가 'N/D'로 옴.
    """
    try:
        r = await client.get(
            config.STOOQ_QUOTE_URL,
            params={"s": f"{ticker.lower()}.us", "f": "sd2t2ohlcv", "h": "", "e": "csv"},
            timeout=10,
        )
        if r.status_code != 200:
            return None
        lines = r.text.strip().splitlines()
        if len(lines) < 2:
            return None
        cols = lines[1].split(",")
        close = cols[6] if len(cols) > 6 else "N/D"
        if close in ("", "N/D"):
            return None
        return float(close)
    except Exception as e:
        logger.warning(f"stooq fetch failed for {ticker}: {e}")
        return None


async def _fetch_yahoo(client: httpx.AsyncClient, ticker: str) -> Optional[float]:
    """Yahoo Finance chart로 현재가 조회 (2순위 폴백). 실패 시 None."""
    try:
        url = f"{config.YAHOO_FINANCE_CHART_URL}/{ticker}"
        r = await client.get(url, params={"interval": "1d", "range": "1d"}, timeout=10)
        if r.status_code != 200:
            logger.warning(f"Yahoo {ticker} status {r.status_code}")
            return None
        meta = (r.json().get("chart", {}).get("result") or [{}])[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        return float(price) if price is not None else None
    except Exception as e:
        logger.warning(f"Yahoo fetch failed for {ticker}: {e}")
        return None


async def _fetch_stock(client: httpx.AsyncClient, ticker: str) -> tuple[Optional[float], Optional[float]]:
    """주가 (현재가, 시총) 조회. stooq 1순위 → Yahoo 2순위 폴백.

    시총은 어느 소스에도 안정적으로 없어 항상 None을 반환하고,
    호출부에서 `현재가 × shares_outstanding`로 산출한다.
    """
    price = await _fetch_stooq(client, ticker)
    if price is None:
        price = await _fetch_yahoo(client, ticker)
    return price, None


async def _history_stooq(client: httpx.AsyncClient, ticker: str) -> list[dict]:
    """stooq 일봉 히스토리 (1순위, apikey 필요). 키 없거나 실패 시 []."""
    if not config.STOOQ_APIKEY:
        return []
    try:
        r = await client.get(
            config.STOOQ_HISTORY_URL,
            params={"s": f"{ticker.lower()}.us", "i": "d", "apikey": config.STOOQ_APIKEY},
            timeout=12,
        )
        if r.status_code != 200:
            return []
        lines = r.text.strip().splitlines()
        # 헤더: Date,Open,High,Low,Close,Volume  → 키 안내 텍스트가 오면 'Date' 헤더 없음
        if not lines or not lines[0].lower().startswith("date"):
            logger.warning(f"stooq history {ticker}: unexpected response (apikey?)")
            return []
        out: list[dict] = []
        for ln in lines[1:]:
            cols = ln.split(",")
            if len(cols) < 5 or cols[4] in ("", "N/D"):
                continue
            out.append({"ts": cols[0], "close": round(float(cols[4]), 4)})
        # 최근 6개월(~126 거래일)만
        return out[-126:]
    except Exception as e:
        logger.warning(f"stooq history fetch failed for {ticker}: {e}")
        return []


async def _history_yahoo(client: httpx.AsyncClient, ticker: str) -> list[dict]:
    """Yahoo Finance chart 6개월 일봉 (2순위 폴백, 키 불필요·429 잦음)."""
    try:
        url = f"{config.YAHOO_FINANCE_CHART_URL}/{ticker}"
        r = await client.get(url, params={"interval": "1d", "range": "6mo"}, timeout=10)
        if r.status_code != 200:
            logger.warning(f"Yahoo history {ticker} status {r.status_code}")
            return []
        res = (r.json().get("chart", {}).get("result") or [{}])[0]
        stamps = res.get("timestamp") or []
        closes = (((res.get("indicators") or {}).get("quote") or [{}])[0]).get("close") or []
        out: list[dict] = []
        for ts, close in zip(stamps, closes):
            if close is None:
                continue
            day = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            out.append({"ts": day, "close": round(float(close), 4)})
        return out
    except Exception as e:
        logger.warning(f"Yahoo history fetch failed for {ticker}: {e}")
        return []


async def _fetch_price_history(client: httpx.AsyncClient, ticker: str) -> list[dict]:
    """6개월 일봉 종가 히스토리. stooq(apikey) 1순위 → Yahoo 2순위.

    반환: [{"ts": "YYYY-MM-DD", "close": float}, ...] (오름차순). 둘 다 실패 시 [].
    """
    hist = await _history_stooq(client, ticker)
    if not hist:
        hist = await _history_yahoo(client, ticker)
    return hist


async def _fetch_krw_rate(client: httpx.AsyncClient) -> Optional[float]:
    """USD/KRW 환율. 실패 시 None."""
    try:
        r = await client.get(config.EXCHANGERATE_API_URL, timeout=10)
        if r.status_code == 200:
            return float(r.json().get("rates", {}).get("KRW"))
    except Exception as e:
        logger.warning(f"KRW rate fetch failed: {e}")
    return None


async def collect_dat(cc_price: Optional[float]) -> dict:
    """DAT 트래커 수집. cc_price는 호출자(scheduler)가 cache의 $CC 현재가를 주입.

    각 기업: 정적값(JSON) + 라이브(주가/시총/환율) + 계산(nav/mnav/pl/risk).
    """
    companies = _load_companies()
    out_companies: list[dict] = []

    async with httpx.AsyncClient(headers=_HTTP_HEADERS) as client:
        krw_rate = await _fetch_krw_rate(client)

        for co in companies:
            ticker = co.get("ticker", "")
            stock_price, market_cap = await _fetch_stock(client, ticker)
            price_history = await _fetch_price_history(client, ticker)

            # 시총이 응답에 없으면 주가 × 발행주식수로 폴백
            shares = co.get("shares_outstanding") or 0
            if market_cap is None and stock_price is not None and shares:
                market_cap = stock_price * shares

            cc_holdings = co.get("cc_holdings") or 0
            avg_buy = co.get("avg_buy_price") or 0
            debt = co.get("debt") or 0
            cash = co.get("cash") or 0

            nav = compute_nav(cc_holdings, cc_price) if cc_price else 0.0
            mnav, mnav_label = compute_mnav(market_cap, debt, cash, nav)
            pl_usd, pl_pct = compute_pl(cc_price, avg_buy, cc_holdings) if cc_price else (None, None)
            risk = classify_risk(mnav)

            value_usd = nav if nav else None
            out_companies.append({
                **co,
                "stock_price": stock_price,
                "market_cap": market_cap,
                "cc_price": cc_price,
                "nav": nav or None,
                "mnav": mnav,
                "mnav_label": mnav_label,
                "pl_usd": pl_usd,
                "pl_pct": pl_pct,
                "krw_rate": krw_rate,
                "value_krw": (value_usd * krw_rate) if (value_usd and krw_rate) else None,
                "pl_krw": (pl_usd * krw_rate) if (pl_usd is not None and krw_rate) else None,
                "risk": risk,
                "price_history": price_history,
            })

    result = {
        "companies": out_companies,
        "company_count": len(out_companies),
        "total_cc_holdings": sum((c.get("cc_holdings") or 0) for c in out_companies),
        "total_pl_usd": sum((c.get("pl_usd") or 0) for c in out_companies),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        _CACHE_FILE.parent.mkdir(exist_ok=True)
        _CACHE_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"DAT cache save failed: {e}")

    logger.info(f"DAT collected: {len(out_companies)} companies, krw_rate={krw_rate}")
    return result


def load_cached_dat() -> Optional[dict]:
    """파일 캐시 폴백 로드."""
    if not _CACHE_FILE.exists():
        return None
    try:
        return json.loads(_CACHE_FILE.read_text())
    except Exception:
        return None
