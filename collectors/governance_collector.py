# collectors/governance_collector.py
"""Canton CIP governance data collector via GitHub API."""
import base64
import json
import logging
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

import httpx

from . import net_guard

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
CIP_REPO = "canton-foundation/cips"
GOVERNANCE_CACHE_FILE = Path(__file__).parent.parent / "data" / "governance_cache.json"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


# CIP 유형 분류
# 각 유형: (감지 키워드, 한국어 이름, 영문 이름, 아이콘 이모지, 설명)
CIP_CATEGORIES = [
    {
        "key": "sv_onboarding",
        "keywords": ["as max weight", "as a weight", "as weight", "add ", "super validator"],
        "name_ko": "SV 온보딩",
        "name_en": "SV Onboarding",
        "color": "#60a5fa",
        "impact_ko": "새 슈퍼 밸리데이터 합류 → 네트워크 분산화 및 보안 강화",
        "impact_en": "New super validator joins → decentralization & security boost",
    },
    {
        "key": "tokenomics",
        "keywords": ["reward", "fee", "burn", "mint", "tokenomics", "canton coin", "traffic"],
        "name_ko": "토큰이코노믹스",
        "name_en": "Tokenomics",
        "color": "#c8e64a",
        "impact_ko": "보상/소각/수수료 구조 변경 → CC 가격 및 인플레이션에 직접 영향",
        "impact_en": "Reward/burn/fee structure change → directly impacts CC price & inflation",
    },
    {
        "key": "token_standard",
        "keywords": ["token standard", "cip-56", "asset standard"],
        "name_ko": "토큰 표준",
        "name_en": "Token Standard",
        "color": "#a78bfa",
        "impact_ko": "토큰 표준 개선 → DApp 상호운용성 및 프라이버시 향상",
        "impact_en": "Token standard upgrade → DApp interoperability & privacy improvements",
    },
    {
        "key": "governance",
        "keywords": ["governance", "voting", "foundation", "proposal", "cip-0000", "cip-0006"],
        "name_ko": "거버넌스 프로세스",
        "name_en": "Governance Process",
        "color": "#f472b6",
        "impact_ko": "거버넌스 규칙 변경 → 제안·투표·참여 방식에 영향",
        "impact_en": "Governance rule change → affects proposal/voting/participation",
    },
    {
        "key": "infra",
        "keywords": ["upgrade", "migration", "sync", "protocol", "synchronizer", "dapp standard", "automation"],
        "name_ko": "인프라/프로토콜",
        "name_en": "Infra / Protocol",
        "color": "#fb923c",
        "impact_ko": "프로토콜/인프라 업그레이드 → 네트워크 성능 및 안정성 개선",
        "impact_en": "Protocol/infra upgrade → network performance & stability",
    },
]

DEFAULT_CATEGORY = {
    "key": "other",
    "name_ko": "기타",
    "name_en": "Other",
    "color": "#71717a",
    "impact_ko": "네트워크 기타 변경 사항",
    "impact_en": "Miscellaneous network change",
}


def classify_cip(title: str) -> dict:
    """CIP 제목을 보고 카테고리 분류."""
    lower = title.lower()
    for cat in CIP_CATEGORIES:
        if any(kw in lower for kw in cat["keywords"]):
            return cat
    return DEFAULT_CATEGORY


@dataclass
class CIPData:
    number: str = ""
    title: str = ""
    status: str = ""
    category_key: str = ""
    category_ko: str = ""
    category_en: str = ""
    category_color: str = ""
    summary_ko: str = ""
    summary_en: str = ""
    impact_ko: str = ""
    impact_en: str = ""
    github_url: str = ""
    vote_url: str = ""


@dataclass
class GovernanceData:
    active_proposals: int = 0
    recent_cips: list[CIPData] = field(default_factory=list)
    # 이전에 통과된(Final/Approved) CIP 유형별 통계
    history_stats: dict[str, dict] = field(default_factory=dict)
    total_final: int = 0
    fetched: bool = False


class GovernanceCollector:
    """Fetches CIP data from GitHub API."""

    def __init__(self):
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CantonHub/1.0",
        }
        if GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
        self.client = net_guard.make_client(timeout=20, headers=headers)

    async def collect(self) -> GovernanceData:
        try:
            resp = await self.client.get(f"{GITHUB_API}/repos/{CIP_REPO}/contents")
            resp.raise_for_status()
            items = resp.json()

            cip_dirs = [
                item for item in items
                if item["type"] == "dir"
                and item["name"].startswith("cip-")
                and re.match(r"^cip-\d{4}$", item["name"])  # cip-NNNN 형식만 (템플릿 제외)
            ]

            recent_cips: list[CIPData] = []
            active_count = 0
            history_stats: dict[str, dict] = {}
            total_final = 0

            # 최근 40개 CIP를 살펴봄 (더 넓은 샘플로 통계 정확도 향상)
            for cip_dir in sorted(cip_dirs, key=lambda x: x["name"], reverse=True)[:40]:
                cip_name = cip_dir["name"]
                cip_number = cip_name.upper().replace("CIP-", "CIP-")

                md_url = f"{GITHUB_API}/repos/{CIP_REPO}/contents/{cip_name}/{cip_name}.md"
                try:
                    md_resp = await self.client.get(md_url)
                    if md_resp.status_code != 200:
                        continue
                    content = base64.b64decode(md_resp.json()["content"]).decode("utf-8")

                    status = self._parse_status(content)
                    title = self._parse_title(content)
                    category = classify_cip(title)

                    # 진행 중 제안 카운트
                    if status in ("Proposed", "Draft"):
                        active_count += 1

                    # 최근 CIP 목록 (모든 유형 포함, 상위 5개)
                    if len(recent_cips) < 5:
                        recent_cips.append(CIPData(
                            number=cip_number,
                            title=title,
                            status=status,
                            category_key=category["key"],
                            category_ko=category["name_ko"],
                            category_en=category["name_en"],
                            category_color=category["color"],
                            summary_ko=title,
                            summary_en=title,
                            impact_ko=category["impact_ko"],
                            impact_en=category["impact_en"],
                            github_url=f"https://github.com/{CIP_REPO}/blob/main/{cip_name}/{cip_name}.md",
                            vote_url="https://ccview.io/governance/",
                        ))

                    # 통과된 CIP 통계 (Final/Approved)
                    if status in ("Final", "Approved"):
                        total_final += 1
                        key = category["key"]
                        if key not in history_stats:
                            history_stats[key] = {
                                "count": 0,
                                "name_ko": category["name_ko"],
                                "name_en": category["name_en"],
                                "color": category["color"],
                            }
                        history_stats[key]["count"] += 1

                except Exception as e:
                    logger.warning(f"Failed to fetch {cip_name}: {e}")
                    continue

            data = GovernanceData(
                active_proposals=active_count,
                recent_cips=recent_cips,
                history_stats=history_stats,
                total_final=total_final,
                fetched=True,
            )
            logger.info(
                f"Governance: {active_count} active, {len(recent_cips)} recent, "
                f"{total_final} passed across {len(history_stats)} categories"
            )
            # 성공한 데이터를 파일에 캐시 (다음 rate limit 시 폴백용)
            self._save_cache(data)
            return data

        except Exception as e:
            logger.error(f"Governance collection failed: {e}")
            # 파일 캐시에서 로드 시도
            cached = self._load_cache()
            if cached is not None:
                logger.info("Loaded governance data from file cache")
                return cached
            return GovernanceData()

    def _save_cache(self, data: GovernanceData) -> None:
        try:
            GOVERNANCE_CACHE_FILE.parent.mkdir(exist_ok=True)
            payload = {
                "active_proposals": data.active_proposals,
                "total_final": data.total_final,
                "history_stats": data.history_stats,
                "recent_cips": [asdict(c) for c in data.recent_cips],
            }
            GOVERNANCE_CACHE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        except Exception as e:
            logger.warning(f"Failed to save governance cache: {e}")

    def _load_cache(self) -> GovernanceData | None:
        if not GOVERNANCE_CACHE_FILE.exists():
            return None
        try:
            payload = json.loads(GOVERNANCE_CACHE_FILE.read_text())
            cips = [CIPData(**c) for c in payload.get("recent_cips", [])]
            return GovernanceData(
                active_proposals=payload.get("active_proposals", 0),
                total_final=payload.get("total_final", 0),
                history_stats=payload.get("history_stats", {}),
                recent_cips=cips,
                fetched=True,
            )
        except Exception as e:
            logger.warning(f"Failed to load governance cache: {e}")
            return None

    def _parse_status(self, content: str) -> str:
        for line in content.split("\n")[:20]:
            if "status:" in line.lower():
                return line.split(":", 1)[1].strip().strip('"').strip("'")
        return "Unknown"

    def _parse_title(self, content: str) -> str:
        for line in content.split("\n")[:20]:
            if line.startswith("# "):
                # Remove "CIP-NNNN: " prefix if present
                title = line[2:].strip()
                title = re.sub(r"^CIP-\d+\s*[:\-]\s*", "", title)
                return title
            if "title:" in line.lower():
                return line.split(":", 1)[1].strip().strip('"').strip("'")
        return "Untitled"

    async def close(self):
        await self.client.aclose()
