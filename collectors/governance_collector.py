# collectors/governance_collector.py
"""Canton CIP governance data collector via GitHub API."""
import base64
import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
CIP_REPO = "canton-foundation/cips"

SV_ONBOARDING_KEYWORDS = {"super validator", "sv onboarding", "validator weight"}


@dataclass
class CIPData:
    number: str = ""
    title: str = ""
    status: str = ""
    summary_ko: str = ""
    summary_en: str = ""
    impact: str = ""
    github_url: str = ""
    vote_url: str = ""


@dataclass
class GovernanceData:
    active_proposals: int = 0
    recent_cips: list[CIPData] = field(default_factory=list)
    fetched: bool = False


class GovernanceCollector:
    """Fetches CIP data from GitHub API."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=15,
            headers={
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "CantonHub/1.0",
            },
        )

    async def collect(self) -> GovernanceData:
        try:
            resp = await self.client.get(f"{GITHUB_API}/repos/{CIP_REPO}/contents")
            resp.raise_for_status()
            items = resp.json()

            cip_dirs = [
                item for item in items
                if item["type"] == "dir" and item["name"].startswith("cip-")
            ]

            recent_cips = []
            active_count = 0

            for cip_dir in sorted(cip_dirs, key=lambda x: x["name"], reverse=True)[:10]:
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

                    if any(kw in title.lower() for kw in SV_ONBOARDING_KEYWORDS):
                        if status in ("Proposed", "Draft"):
                            active_count += 1
                        continue

                    if status in ("Proposed", "Draft"):
                        active_count += 1

                    if status in ("Final", "Approved", "Proposed", "Draft") and len(recent_cips) < 3:
                        recent_cips.append(CIPData(
                            number=cip_number,
                            title=title,
                            status=status,
                            summary_en=title,
                            summary_ko=title,
                            github_url=f"https://github.com/{CIP_REPO}/blob/main/{cip_name}/{cip_name}.md",
                            vote_url="https://ccview.io/governance/",
                        ))
                except Exception as e:
                    logger.warning(f"Failed to fetch {cip_name}: {e}")
                    continue

            data = GovernanceData(active_proposals=active_count, recent_cips=recent_cips, fetched=True)
            logger.info(f"Governance: {active_count} active, {len(recent_cips)} recent CIPs")
            return data

        except Exception as e:
            logger.error(f"Governance collection failed: {e}")
            return GovernanceData()

    def _parse_status(self, content: str) -> str:
        for line in content.split("\n")[:20]:
            if "status:" in line.lower():
                return line.split(":", 1)[1].strip().strip('"').strip("'")
        return "Unknown"

    def _parse_title(self, content: str) -> str:
        for line in content.split("\n")[:20]:
            if line.startswith("# "):
                return line[2:].strip()
            if "title:" in line.lower():
                return line.split(":", 1)[1].strip().strip('"').strip("'")
        return "Untitled"

    async def close(self):
        await self.client.aclose()
