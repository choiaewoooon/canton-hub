"""
Canton Consensus Collector — CantonScan API 기반 실시간 SV/Validator 데이터

출처:
- /api/super-validators: 모든 active SV + 상세 (weight, rewards, uptime, status)
- /api/validators: 1000개 validator + rewards 기준 정렬
- /api/parties/{id}: 개별 balance 조회 (선택적, 성능 고려)
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
CACHE_FILE = Path(__file__).parent.parent / "data" / "consensus_cache.json"
TOP_VALIDATORS_COUNT = 20


# === Organization name → logo domain mapping ===
# API에서 받는 org name이 하드코딩하기 어려우니 휴리스틱으로 처리
KNOWN_DOMAINS: dict[str, str] = {
    # SV
    "digital-asset": "digitalasset.com",
    "digital_asset": "digitalasset.com",
    "cumberland": "cumberland.io",
    "tradeweb-markets": "tradeweb.com",
    "tradeweb": "tradeweb.com",
    "mpc-holding": "mpch.io",
    "sv-nodeops-limited": "sync.global",
    "c7-technology-services-limited": "c7tech.com",
    "liberty-city-ventures": "libertycityventures.com",
    "global-synchronizer-foundation": "sync.global",
    "five-north": "fivenorth.com",
    "orb-1-lp": "orb.land",
    "coinmetrics": "coinmetrics.io",
    "chainlink-mainnet": "chain.link",
    "ubyx": "ubyx.com",
    "trm": "trmlabs.com",
    "obsidiansystems": "obsidian.systems",
    "taurus-wallet": "taurushq.com",
    "quantstamp": "quantstamp.com",
    "republic": "republic.com",
    "bitgo-mainnetvalidator": "bitgo.com",
    "intellecteu-svrewards": "intellecteu.com",
    "elliptic": "elliptic.co",
    "proof-group": "proof.group",
    # Validators
    "the_tie_validator": "thetie.io",
    "the-tie-validator": "thetie.io",
    "cantonloop-mainnet": "cantonloop.io",
    "temple-mainnet": "templedg.com",
    "cumberland-gasstation": "cumberland.io",
    "cantor8-digik": "cantorfitzgerald.com",
    "copper-mainnet-validator": "copper.co",
    "brale-prodmainnet": "brale.xyz",
    "validator_hashnote": "hashnote.com",
    "hellomoon-validator": "hellomoon.io",
    "alphadna-mainnet": "alphadna.io",
    "angelhack-mainnet": "angelhack.com",
    "tradefast-mainnet": "tradefast.io",
    "upbit-validator": "upbit.com",
    "coinone-node": "coinone.co.kr",
    "kiln": "kiln.fi",
    "p2p": "p2p.org",
    "figment": "figment.io",
    "blockdaemon": "blockdaemon.com",
    "fireblocks": "fireblocks.com",
    "anchorage": "anchorage.com",
    "cantex-validator": "cantex.io",
    "digitalasset_utility_validator": "digitalasset.com",
    "socgen": "societegenerale.com",
    "validator_broadridge": "broadridge.com",
    "castleisland": "castleisland.vc",
    "bitwave": "bitwave.io",
    "texturecapital": "texturecap.com",
    "elk-validator": "elklog.com",
    "stakeup-validator": "stakeup.fi",
    "01node-validator": "01node.com",
    "validator_dfns": "dfns.co",
    "validator_gsf": "sync.global",
    "validator_service": "digitalasset.com",
    "tw-canton-main": "tradeweb.com",
    "3trade_validator": "3trade.io",
    "digital-asset-2": "digitalasset.com",
    "digital-asset-1": "digitalasset.com",
    "cantex": "cantex.io",
}


def _extract_org_name(party_id: str) -> str:
    """Party ID → human-readable organization name."""
    if "::" in party_id:
        name = party_id.split("::")[0]
    else:
        name = party_id
    # Clean underscore/hyphen
    return name.replace("_", " ").replace("-", " ").strip()


def _resolve_domain(party_id: str) -> str | None:
    """Party ID → logo domain (best effort)."""
    if "::" not in party_id:
        return None
    org = party_id.split("::")[0].lower()
    # Try exact match first
    if org in KNOWN_DOMAINS:
        return KNOWN_DOMAINS[org]
    # Try substring match
    for key, domain in KNOWN_DOMAINS.items():
        if key in org:
            return domain
    return None


@dataclass
class SVInfo:
    party_id: str
    name: str
    organization: str
    domain: str | None
    status: str
    weight: float  # svRewardWeight / 10000 (e.g. 102500 → 10.25)
    rewards_total: float
    rewards_change_24h: float
    active_rounds: int
    total_rounds: int
    uptime_pct: float
    rounds_missed: int
    last_active_at: str | None
    amulet_price_vote: float | None
    balance: float = 0.0  # from parties API (optional)


@dataclass
class ValidatorInfo:
    party_id: str
    organization: str
    domain: str | None
    sponsor: str
    rewards_total: float
    rewards_change_24h: float
    rounds_missed: int
    last_active_at: str | None
    balance: float = 0.0


async def _fetch_party_balance(client: httpx.AsyncClient, party_id: str) -> float:
    try:
        enc = quote(party_id, safe="")
        resp = await client.get(f"{CANTONSCAN_API}/api/parties/{enc}", timeout=8)
        if resp.status_code == 200:
            d = resp.json()
            return float(d.get("availableAmuletBalance", 0) or 0) + float(d.get("lockedAmuletBalance", 0) or 0)
    except Exception:
        pass
    return 0.0


async def collect_consensus() -> dict:
    """SV + top validator 수집."""
    async with httpx.AsyncClient(timeout=15) as client:
        # 1. Super Validators
        svs_resp = await client.get(f"{CANTONSCAN_API}/api/super-validators")
        svs_resp.raise_for_status()
        svs_raw = svs_resp.json().get("data", [])

        # 2. Validators (전체 1000)
        vals_resp = await client.get(f"{CANTONSCAN_API}/api/validators")
        vals_resp.raise_for_status()
        vals_raw = vals_resp.json().get("data", [])

        # Top N validators by rewardsTotal (단, validator ID가 SV party와 동일한 경우 제외)
        sv_ids = {sv["id"] for sv in svs_raw}
        top_vals_raw = sorted(
            [v for v in vals_raw if v["id"] not in sv_ids],
            key=lambda v: v.get("rewardsTotal", 0) or 0,
            reverse=True,
        )[:TOP_VALIDATORS_COUNT]

        # 3. Balance fetch (병렬, semaphore 제한) — SV 전체 + top validator
        targets = [sv["id"] for sv in svs_raw] + [v["id"] for v in top_vals_raw]
        semaphore = asyncio.Semaphore(10)

        async def fetch_bal(pid: str):
            async with semaphore:
                return pid, await _fetch_party_balance(client, pid)

        balance_results = await asyncio.gather(*[fetch_bal(p) for p in targets])
        balance_map = dict(balance_results)

    # Build SV objects
    svs: list[SVInfo] = []
    for sv in svs_raw:
        pid = sv["id"]
        raw_name = sv.get("name") or _extract_org_name(pid)
        weight_raw = sv.get("svRewardWeight", 0) or 0
        active = sv.get("activeRoundsInPeriod", 0) or 0
        total = sv.get("totalRoundsInPeriod", 0) or 0
        uptime = (active / total * 100) if total > 0 else 100
        vote = sv.get("priceVote") or {}
        svs.append(SVInfo(
            party_id=pid,
            name=raw_name,
            organization=_extract_org_name(pid),
            domain=_resolve_domain(pid),
            status=sv.get("status", "unknown"),
            weight=round(weight_raw / 10000, 2),
            rewards_total=sv.get("rewardsTotal", 0) or 0,
            rewards_change_24h=sv.get("rewardsChange", 0) or 0,
            active_rounds=active,
            total_rounds=total,
            uptime_pct=round(uptime, 2),
            rounds_missed=sv.get("numberOfRoundsMissed", 0) or 0,
            last_active_at=sv.get("lastActiveAt"),
            amulet_price_vote=vote.get("amuletPrice"),
            balance=balance_map.get(pid, 0.0),
        ))

    # Sort SVs by rewardsTotal desc
    svs.sort(key=lambda s: -s.rewards_total)

    # Build Validator objects
    vals: list[ValidatorInfo] = []
    for v in top_vals_raw:
        pid = v["id"]
        sponsor_raw = v.get("sponsor", "") or ""
        sponsor_name = sponsor_raw.split("::")[0] if "::" in sponsor_raw else sponsor_raw
        vals.append(ValidatorInfo(
            party_id=pid,
            organization=_extract_org_name(pid),
            domain=_resolve_domain(pid),
            sponsor=sponsor_name,
            rewards_total=v.get("rewardsTotal", 0) or 0,
            rewards_change_24h=v.get("rewardsChange", 0) or 0,
            rounds_missed=v.get("numberOfRoundsMissed", 0) or 0,
            last_active_at=v.get("lastActiveAt"),
            balance=balance_map.get(pid, 0.0),
        ))

    result = {
        "super_validators": [
            {
                "party_id": s.party_id,
                "name": s.name,
                "organization": s.organization,
                "domain": s.domain,
                "status": s.status,
                "weight": s.weight,
                "rewards_total": s.rewards_total,
                "rewards_change_24h": s.rewards_change_24h,
                "uptime_pct": s.uptime_pct,
                "active_rounds": s.active_rounds,
                "total_rounds": s.total_rounds,
                "rounds_missed": s.rounds_missed,
                "last_active_at": s.last_active_at,
                "amulet_price_vote": s.amulet_price_vote,
                "balance": s.balance,
            }
            for s in svs
        ],
        "top_validators": [
            {
                "party_id": v.party_id,
                "organization": v.organization,
                "domain": v.domain,
                "sponsor": v.sponsor,
                "rewards_total": v.rewards_total,
                "rewards_change_24h": v.rewards_change_24h,
                "rounds_missed": v.rounds_missed,
                "last_active_at": v.last_active_at,
                "balance": v.balance,
            }
            for v in vals
        ],
        "total_sv_count": len(svs),
        "total_validator_count": len(vals_raw),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    # Save to file cache for fallback
    try:
        CACHE_FILE.parent.mkdir(exist_ok=True)
        CACHE_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Consensus cache save failed: {e}")

    return result


def load_cached_consensus() -> dict | None:
    if not CACHE_FILE.exists():
        return None
    try:
        return json.loads(CACHE_FILE.read_text())
    except Exception:
        return None
