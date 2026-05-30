# collectors/media_collector.py
"""Canton 미디어 RSS 수집기.

fetch_raw(httpx) ↔ parse_entries(순수)를 분리해 파싱 로직을 테스트 가능하게 한다.
링버퍼(data/media_items.json)에 최근 config.MEDIA_MAX건을 ts 내림차순 보관.
수집기 규약(../CLAUDE.md §0): 예외는 내부에서 삼키고 빈 결과 반환, raise 금지.
"""
import calendar
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import feedparser

import config

logger = logging.getLogger(__name__)

_MEDIA_FILE = Path(__file__).parent.parent / "data" / "media_items.json"
_TAG_RE = re.compile(r"<[^>]+>")


async def fetch_raw(url: str, client) -> str:
    """RSS 원문 XML을 가져온다 (httpx async)."""
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.text


def parse_entries(raw_xml: str, feed_name: str) -> list[dict]:
    """RSS 문자열 → 원시 아이템 dict 리스트 (순수, 네트워크 없음)."""
    parsed = feedparser.parse(raw_xml)
    out: list[dict] = []
    for e in parsed.entries:
        link = e.get("link") or ""
        guid = e.get("id") or e.get("guid") or link
        if not guid:
            continue
        title = (e.get("title") or "").strip()
        desc = e.get("summary") or e.get("description") or ""
        desc = _TAG_RE.sub("", desc).strip()
        # Google News는 item마다 <source>로 실제 매체명을 준다 → 우선 사용
        src = e.get("source")
        publisher = None
        if isinstance(src, dict):
            publisher = (src.get("title") or "").strip() or None
        publisher = publisher or feed_name
        ts = ""
        if e.get("published_parsed"):
            ts = datetime.fromtimestamp(
                calendar.timegm(e.published_parsed), tz=timezone.utc
            ).isoformat()
        out.append({
            "url": link,
            "guid": guid,
            "ts": ts,
            "publisher": publisher,
            "title_raw": title,
            "description": desc,
        })
    return out


def dedup_new(existing: list[dict], fetched: list[dict]) -> list[dict]:
    """기존 guid에 없는 신규 아이템만 반환."""
    seen = {i.get("guid") for i in existing}
    return [f for f in fetched if f.get("guid") not in seen]


def load_media_items() -> list[dict]:
    if not _MEDIA_FILE.exists():
        return []
    try:
        data = json.loads(_MEDIA_FILE.read_text())
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning(f"media_items load failed: {e}")
        return []


def save_media_items(items: list[dict]) -> None:
    """ts 내림차순 정렬 + MEDIA_MAX 캡 후 저장."""
    items = sorted(items, key=lambda x: x.get("ts") or "", reverse=True)[: config.MEDIA_MAX]
    _MEDIA_FILE.parent.mkdir(exist_ok=True)
    _MEDIA_FILE.write_text(json.dumps(items, ensure_ascii=False))
