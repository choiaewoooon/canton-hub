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


_OUTLET_SEP = " - "


def _title_of(item: dict) -> str:
    """fetched(title_raw)와 stored(title.en/dict) 양쪽에서 원제목을 뽑는다."""
    if item.get("title_raw"):
        return item["title_raw"]
    t = item.get("title")
    if isinstance(t, dict):
        return t.get("en") or next((v for v in t.values() if v), "") or ""
    return t or ""


def _normalize_title(title: str) -> str:
    """같은 기사 syndication 비교용 키.

    Google News 제목은 "헤드라인 - 매체명" 형태라 끝의 매체명을 떼고,
    소문자화 + 영숫자/한글만 남겨 구두점($ , . ' 등) 차이를 무시한다.
    """
    t = (title or "").strip()
    if _OUTLET_SEP in t:
        t = t.rsplit(_OUTLET_SEP, 1)[0]  # 마지막 ' - 매체명'만 제거
    t = t.lower()
    t = re.sub(r"[^a-z0-9가-힣\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _token_set(norm_title: str) -> set:
    """유사도 비교용 토큰셋 (2글자 이하 불용어성 토큰 제외)."""
    return {w for w in norm_title.split() if len(w) > 2}


def _is_near_dup(toks: set, others: list[set], threshold: float) -> bool:
    """토큰 자카드 유사도가 threshold 이상인 제목이 있으면 같은 기사로 간주."""
    if not toks:
        return False
    for o in others:
        if not o:
            continue
        union = len(toks | o)
        if union and len(toks & o) / union >= threshold:
            return True
    return False


def dedup_new(existing: list[dict], fetched: list[dict]) -> list[dict]:
    """LLM 호출 전에 '실제로 새로운 기사'만 남긴다.

    guid 중복뿐 아니라, Google News가 같은 기사를 여러 매체로 syndication 해서
    guid는 다르지만 제목이 같거나 거의 같은 경우까지 걸러낸다. 동일 기사를 매체
    수만큼 Haiku 요약+번역하던 비용 낭비를 막는 게 목적.

    필터 단계 (보수적: 놓치는 건 약간의 비용, 잘못 합치면 뉴스 누락이라 정밀도 우선):
      1) guid 완전일치 → 기존 처리분
      2) 정규화 제목 완전일치 → 동일 헤드라인 syndication
      3) 토큰 자카드 ≥ config.MEDIA_DUP_SIM_THRESHOLD → 거의 같은 헤드라인
    기존 아이템 + 같은 배치에서 이미 채택된 아이템 양쪽과 비교한다.
    """
    threshold = getattr(config, "MEDIA_DUP_SIM_THRESHOLD", 0.8)
    seen_guids = {i.get("guid") for i in existing}

    seen_norms: set[str] = set()
    seen_tokensets: list[set] = []
    for i in existing:
        n = _normalize_title(_title_of(i))
        if n:
            seen_norms.add(n)
            seen_tokensets.append(_token_set(n))

    out: list[dict] = []
    for f in fetched:
        if f.get("guid") in seen_guids:
            continue
        n = _normalize_title(_title_of(f))
        if not n:
            out.append(f)  # 제목 없으면 보수적으로 통과
            continue
        if n in seen_norms:
            continue
        toks = _token_set(n)
        if _is_near_dup(toks, seen_tokensets, threshold):
            continue
        out.append(f)
        seen_norms.add(n)
        seen_tokensets.append(toks)
    return out


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
