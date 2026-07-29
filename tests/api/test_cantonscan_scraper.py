"""
CantonScan 홈페이지 스크래퍼 파싱/저장 테스트.

회귀 대상(2026-07-29): 렌더 대기 조건이 Active Addresses 하나뿐이라
Private Updates 값이 아직 안 그려진 시점에 스냅샷을 떠 버렸다.
그 반쪽 결과가 JSON 파일을 통째로 덮어써서 직전의 정상 private_tx 값까지 날아갔고,
대시보드의 Private TX 카드가 N/A가 됐다.
"""
import json

import pytest

from collectors import cantonscan_scraper as m


# 실제 페이지에서 딴 텍스트 (2026-07-29). 값이 모두 렌더된 상태.
FULL_TEXT = """Network Overview
Active Addresses (24hr)
91 856
Unique addresses with activity
-28.88%
Burn Volume (24hr)
$1 682 652.63
USD burned in last 24 hours
Private Updates (24h)
1 061 202 (78.8%)
Private network updates
+2.06%
Total Transfers (24hr)
484 742
CC transfers
-2.36%
Latest Updates
"""

# 라벨만 그려지고 값은 아직 없는 중간 스냅샷 — 사고 당시 실제로 저장된 상태.
RACE_TEXT = """Network Overview
Active Addresses (24hr)
91 856
Unique addresses with activity
-28.88%
Private Updates (24h)
Total Transfers (24hr)
Latest Updates
"""


# ---------------------------------------------------------------- 파싱


def test_parses_all_kpis_from_fully_rendered_page():
    got = m._parse_homepage_text(FULL_TEXT)

    assert got["active_addresses_24h"] == 91856
    assert got["active_addresses_change"] == -28.88
    assert got["private_tx_count"] == 1061202
    assert got["private_tx_ratio"] == 78.8
    assert got["total_transfers_24h"] == 484742


def test_partial_render_yields_no_private_tx_keys():
    got = m._parse_homepage_text(RACE_TEXT)

    assert got["active_addresses_24h"] == 91856
    assert "private_tx_count" not in got
    assert "private_tx_ratio" not in got


def test_is_complete_distinguishes_partial_from_full():
    """대기 루프의 판정 기준 — 이게 Active Addresses만 보면 사고가 재발한다."""
    assert m._is_complete(m._parse_homepage_text(FULL_TEXT)) is True
    assert m._is_complete(m._parse_homepage_text(RACE_TEXT)) is False


# ---------------------------------------------------------------- 저장


@pytest.fixture
def data_file(tmp_path, monkeypatch):
    f = tmp_path / "cantonscan_homepage.json"
    monkeypatch.setattr(m, "DATA_FILE", f)
    return f


def test_partial_scrape_does_not_destroy_previous_values(data_file):
    """핵심 회귀 방지: 반쪽 스크랩이 직전의 정상 값을 지우면 안 된다."""
    data_file.write_text(json.dumps({
        "active_addresses_24h": 116597,
        "private_tx_count": 1074056,
        "private_tx_ratio": 79.2,
        "total_transfers_24h": 500000,
    }))

    m._merge_and_save(m._parse_homepage_text(RACE_TEXT))

    saved = json.loads(data_file.read_text())
    assert saved["active_addresses_24h"] == 91856, "새로 얻은 값은 갱신돼야 한다"
    assert saved["private_tx_count"] == 1074056, "못 얻은 값은 직전 값을 지켜야 한다"
    assert saved["private_tx_ratio"] == 79.2


def test_full_scrape_overwrites_stale_values(data_file):
    data_file.write_text(json.dumps({
        "private_tx_count": 1074056,
        "private_tx_ratio": 79.2,
    }))

    m._merge_and_save(m._parse_homepage_text(FULL_TEXT))

    saved = json.loads(data_file.read_text())
    assert saved["private_tx_count"] == 1061202
    assert saved["private_tx_ratio"] == 78.8


def test_merge_works_with_no_existing_file(data_file):
    assert not data_file.exists()

    m._merge_and_save(m._parse_homepage_text(FULL_TEXT))

    saved = json.loads(data_file.read_text())
    assert saved["private_tx_ratio"] == 78.8


def test_corrupt_existing_file_does_not_block_save(data_file):
    data_file.write_text("{ not json")

    m._merge_and_save(m._parse_homepage_text(FULL_TEXT))

    saved = json.loads(data_file.read_text())
    assert saved["active_addresses_24h"] == 91856
