"""
Major CC Holders Collector — CantonScan internal API 기반

전략:
1. Seed list: super-validators + validators + featured-apps의 party ID 수집
2. 각 party에 `/api/parties/{id}` 병렬 호출 (동시 10개, rate limit 배려)
3. balance = availableAmuletBalance + lockedAmuletBalance 계산
4. 정렬 후 top 50 반환
5. 파일 캐시 폴백

출처: fossil-outlook-levitate-gloomy.cantonscan.com (CantonScan 내부 API)
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

CANTONSCAN_API = "https://fossil-outlook-levitate-gloomy.cantonscan.com"
CACHE_FILE = Path(__file__).parent.parent / "data" / "holders_cache.json"
CONCURRENCY = 10  # 동시 요청 수
MAX_PARTIES = 500  # seed 리스트 상한 (balance check 부담 방지)


@dataclass
class Holder:
    party_id: str
    organization: str  # 가독성 있는 이름 (예: "Cumberland-1")
    category: str  # "super_validator" | "validator" | "app"
    available_balance: float
    locked_balance: float
    total_balance: float
    rewards_earned: float = 0.0  # validator/SV만 해당


def _extract_org_name(party_id: str) -> str:
    """
    Canton party ID 형식: "Organization::1220abcd..."
    Organization 부분만 추출해서 가독성 좋게 반환.
    """
    if "::" in party_id:
        name = party_id.split("::")[0]
    else:
        name = party_id
    # Clean up common patterns
    name = name.replace("_", " ").replace("-", " ")
    # Capitalize first letter of each word
    return name.strip()


async def _fetch_party_balance(client: httpx.AsyncClient, party_id: str) -> tuple[str, float, float] | None:
    """단일 party의 balance 조회. (party_id, avail, locked) 반환 or None."""
    try:
        enc = quote(party_id, safe="")
        resp = await client.get(f"{CANTONSCAN_API}/api/parties/{enc}", timeout=8)
        if resp.status_code != 200:
            return None
        data = resp.json()
        avail = float(data.get("availableAmuletBalance", 0) or 0)
        locked = float(data.get("lockedAmuletBalance", 0) or 0)
        return (party_id, avail, locked)
    except Exception:
        return None


async def _fetch_seed_parties(client: httpx.AsyncClient) -> list[tuple[str, str]]:
    """Seed list 수집: (party_id, category) 튜플 목록."""
    seeds: list[tuple[str, str]] = []
    seen: set[str] = set()

    # 1. Super Validators (가장 큰 holder들이 여기에 몰려있음)
    try:
        resp = await client.get(f"{CANTONSCAN_API}/api/super-validators", timeout=15)
        resp.raise_for_status()
        for sv in resp.json().get("data", []):
            pid = sv.get("id")
            if pid and pid not in seen:
                seen.add(pid)
                seeds.append((pid, "super_validator"))
    except Exception as e:
        logger.warning(f"SV fetch failed: {e}")

    # 2. Validators
    try:
        resp = await client.get(f"{CANTONSCAN_API}/api/validators", timeout=15)
        resp.raise_for_status()
        for v in resp.json().get("data", []):
            pid = v.get("id")
            if pid and pid not in seen:
                seen.add(pid)
                seeds.append((pid, "validator"))
    except Exception as e:
        logger.warning(f"Validators fetch failed: {e}")

    # 3. Featured Apps (앱 계정들)
    try:
        resp = await client.get(f"{CANTONSCAN_API}/api/featured-apps", timeout=15)
        resp.raise_for_status()
        for a in resp.json().get("data", []):
            pid = a.get("id")
            if pid and pid not in seen:
                seen.add(pid)
                seeds.append((pid, "app"))
    except Exception as e:
        logger.warning(f"Featured apps fetch failed: {e}")

    # 상한 적용
    return seeds[:MAX_PARTIES]


async def collect_major_holders() -> list[Holder]:
    """
    모든 seed party의 balance를 조회하고 정렬된 holder 리스트 반환.
    """
    async with httpx.AsyncClient() as client:
        logger.info("Fetching seed party list (SV + validators + apps)...")
        seeds = await _fetch_seed_parties(client)
        logger.info(f"Got {len(seeds)} seed parties, fetching balances...")

        # Build category lookup
        category_map: dict[str, str] = {pid: cat for pid, cat in seeds}

        # Concurrent balance fetch with semaphore
        semaphore = asyncio.Semaphore(CONCURRENCY)

        async def fetch_one(pid: str):
            async with semaphore:
                return await _fetch_party_balance(client, pid)

        results = await asyncio.gather(*[fetch_one(pid) for pid, _ in seeds])

    holders: list[Holder] = []
    for r in results:
        if r is None:
            continue
        party_id, avail, locked = r
        total = avail + locked
        if total <= 0:
            continue  # 0 balance는 스킵
        holders.append(Holder(
            party_id=party_id,
            organization=_extract_org_name(party_id),
            category=category_map.get(party_id, "unknown"),
            available_balance=avail,
            locked_balance=locked,
            total_balance=total,
        ))

    # 정렬 (balance 내림차순)
    holders.sort(key=lambda h: -h.total_balance)
    logger.info(f"Collected {len(holders)} holders with non-zero balance")

    # 파일 캐시 저장
    try:
        CACHE_FILE.parent.mkdir(exist_ok=True)
        CACHE_FILE.write_text(json.dumps({
            "holders": [
                {
                    "party_id": h.party_id,
                    "organization": h.organization,
                    "category": h.category,
                    "available_balance": h.available_balance,
                    "locked_balance": h.locked_balance,
                    "total_balance": h.total_balance,
                }
                for h in holders
            ],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Holders cache save failed: {e}")

    return holders


def load_cached_holders() -> list[dict] | None:
    """파일 캐시에서 holder 리스트 로드."""
    if not CACHE_FILE.exists():
        return None
    try:
        data = json.loads(CACHE_FILE.read_text())
        return data.get("holders", [])
    except Exception:
        return None
