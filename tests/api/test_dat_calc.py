"""Unit tests for DAT pure calc helpers (no network)."""
from collectors.dat_collector import (
    compute_nav,
    compute_mnav,
    compute_pl,
    classify_risk,
    MNAV_NAV_FLOOR,
    MNAV_WATCH_THRESHOLD,
)


def test_compute_nav():
    assert compute_nav(1000, 2.0) == 2000.0
    assert compute_nav(0, 2.0) == 0.0


def test_mnav_ev_formula_when_debt_cash_present():
    # nav = 1000*2 = 2000; EV = mcap(2400)+debt(200)-cash(100) = 2500; mnav = 1.25
    mnav, label = compute_mnav(market_cap=2400, debt=200, cash=100, nav=2000.0)
    assert round(mnav, 4) == 1.25
    assert "EV" in label


def test_mnav_falls_back_to_marketcap_when_no_debt_cash():
    mnav, label = compute_mnav(market_cap=2400, debt=0, cash=0, nav=2000.0)
    assert round(mnav, 4) == 1.2
    assert "Market Cap" in label


def test_mnav_none_when_nav_zero():
    mnav, label = compute_mnav(market_cap=2400, debt=0, cash=0, nav=0.0)
    assert mnav is None
    assert label is None


def test_compute_pl():
    # (cc_price 2.5 - avg 2.0) * holdings 1000 = 500 ; pct = 500 / (2.0*1000) = 25%
    pl_usd, pl_pct = compute_pl(cc_price=2.5, avg_buy_price=2.0, cc_holdings=1000)
    assert pl_usd == 500.0
    assert round(pl_pct, 4) == 25.0


def test_compute_pl_none_when_no_holdings():
    pl_usd, pl_pct = compute_pl(cc_price=2.5, avg_buy_price=0, cc_holdings=0)
    assert pl_usd is None
    assert pl_pct is None


def test_classify_risk_bands():
    assert classify_risk(1.3) == "healthy"
    assert classify_risk(MNAV_WATCH_THRESHOLD) == "healthy"   # >= 1.2 inclusive
    assert classify_risk(1.1) == "watch"
    assert classify_risk(MNAV_NAV_FLOOR) == "watch"           # >= 1.0 inclusive
    assert classify_risk(0.9) == "below_nav"
    assert classify_risk(None) is None
