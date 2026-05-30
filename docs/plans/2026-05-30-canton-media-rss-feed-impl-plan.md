# Canton 미디어 RSS 피드 + 유형 태깅 Implementation Plan (Spec 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canton 관련 미디어(Google News + 공식 블로그 2종) RSS를 1시간마다 수집해, 기존 트위터 피드와 시간순 통합 타임라인으로 보여주고, 각 뉴스를 Haiku로 한국어 한줄 요약 + 유형 자동 태깅한다.

**Architecture:** 신규 collector(`media_collector.py`)가 feedparser로 RSS를 파싱(파싱은 순수 함수로 분리해 테스트), `news_summarizer.py`가 Haiku 1회 호출로 요약+분류, 기존 DeepL 번역기로 4개국어화. `collect_media`(scheduler)가 60분마다 신규 아이템만 처리해 `data/media_items.json` 링버퍼 + `media:items` 캐시에 적재. `/api/feed` 라우트가 요청 시 트윗 캐시(`feed:{lang}`) + 미디어 캐시를 `ts` 내림차순으로 병합해 통합 타임라인을 반환. 프론트는 `kind`로 트윗/뉴스를 분기 렌더(상대시간은 이미 `ts` 기반 클라이언트 계산).

**Tech Stack:** Python 3.12 / FastAPI / httpx / feedparser / Anthropic Haiku / DeepL · Next.js 16 / React 19 / TypeScript / SWR

**Spec:** [2026-05-30-canton-media-rss-feed-design.md](./2026-05-30-canton-media-rss-feed-design.md)

---

## 선행 의존성 / 베이스 브랜치

- 본 계획은 `feat/feed-timestamp-fix` 브랜치의 변경(트윗 아이템 `ts` + 피드 `fetched_at`, 프론트 `relativeTime`/`useNow`, `FeedItem.ts?`/`FeedData.fetched_at?`)이 **이미 적용된 상태**를 전제로 한다. 새 작업은 해당 브랜치(또는 그것이 머지된 main)에서 분기한 전용 워크트리에서 진행한다.
- 따라서 "트윗에 ts 추가"는 **이미 완료**되어 본 계획의 태스크에서 제외한다. 라우트 병합 정렬은 이 `ts`에 의존한다.

## Scope

단일 plan. backend(FastAPI 수집/라우트) + frontend(Next.js 렌더) 두 레이어를 다루지만 하나의 feature이고 `FeedItem` 타입 동기화가 필수라 분리하지 않는다. backend → frontend 순서(백엔드가 먼저 `kind:"news"` 아이템을 내려줘야 프론트를 실데이터로 검증).

## File Structure

### Backend
- **Create** `collectors/media_collector.py` — `fetch_raw()` + `parse_entries()`(순수) + `dedup_new()` + `load_media_items()`/`save_media_items()`(링버퍼 I/O)
- **Create** `news_summarizer.py` — `CATEGORY_KEYS` + `_parse_classification()`(순수) + `summarize_and_classify()`(Haiku)
- **Modify** `api/translator.py` — `translate(text, source, target)` 일반화 + `translate_ko()`를 그 위로 재정의(하위호환)
- **Modify** `api/scheduler.py` — `collect_media` job + 3600s loop 등록 + `_deferred_initial` 추가
- **Modify** `api/routes/feed.py` — 트윗 + 미디어 병합(`ts` desc) 반환
- **Modify** `config.py` — `MEDIA_FEEDS`, `MEDIA_MAX`, `ANTHROPIC_NEWS_MODEL`
- **Modify** `requirements.txt` — `feedparser`
- **Test** `tests/api/test_media.py`, `tests/api/test_news_summarizer.py`, `tests/api/test_feed.py`(병합 케이스 추가)

### Frontend
- **Modify** `web/lib/types.ts` — `FeedItem`에 `kind`/`title?`/`category?` 추가
- **Create** `web/components/feed/news-category.ts` — 유형 key→{ko,en,color} 메타 맵
- **Modify** `web/components/feed-page/twitter-archive.tsx` — `kind` 분기 통합 타임라인
- **Modify** `web/components/feed/feed-card.tsx` — 뉴스 아이템 렌더
- **Modify** `docs/ARCHITECTURE.md`, `docs/DATA_GUIDE.md`, `web/docs/ARCHITECTURE.md`

---

## Task 0: feedparser 의존성 추가

**Files:** Modify `requirements.txt`

- [ ] **Step 1: requirements.txt에 feedparser 추가**

`requirements.txt`의 HTTP/파싱 의존성 그룹(예: `beautifulsoup4` 줄 근처)에 추가:

```
feedparser>=6.0
```

- [ ] **Step 2: venv 설치**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pip install "feedparser>=6.0"`
Expected: `Successfully installed feedparser-6.x ...`

- [ ] **Step 3: import smoke**

Run: `./venv/bin/python -c "import feedparser; print(feedparser.__version__)"`
Expected: 버전 출력 (에러 없음)

- [ ] **Step 4: Commit**

```bash
git add requirements.txt
git commit -m "chore(deps): feedparser 추가 (RSS 미디어 피드)"
```

---

## Task 1: config — 미디어 피드 상수

**Files:** Modify `config.py`

- [ ] **Step 1: config.py 끝(Misc 섹션 아래)에 추가**

```python
# ============================================================
# Media RSS feeds — used by media_collector (무료, 키 불필요)
# ============================================================
MEDIA_FEEDS = [
    {"name": "Google News", "url": "https://news.google.com/rss/search?q=%22Canton+Network%22&hl=en-US&gl=US&ceid=US:en"},
    {"name": "Canton Blog", "url": "https://www.canton.network/blog/rss.xml"},
    {"name": "Digital Asset", "url": "https://blog.digitalasset.com/blog/rss.xml"},
]
# data/media_items.json 링버퍼 보관 건수
MEDIA_MAX = 60
# 뉴스 한줄 요약+분류용 모델 (트윗 요약은 Sonnet, 뉴스는 저렴한 Haiku)
ANTHROPIC_NEWS_MODEL = "claude-haiku-4-5-20251001"
```

- [ ] **Step 2: import smoke**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -c "import config; print(len(config.MEDIA_FEEDS), config.MEDIA_MAX, config.ANTHROPIC_NEWS_MODEL)"`
Expected: `3 60 claude-haiku-4-5-20251001`

- [ ] **Step 3: Commit**

```bash
git add config.py
git commit -m "feat(config): MEDIA_FEEDS + MEDIA_MAX + ANTHROPIC_NEWS_MODEL"
```

---

## Task 2: DeepL 번역기 일반화 (EN-source 지원)

**문제:** 기존 `translate_ko(text, target)`는 `source_lang="KO"` 고정이라 영문 기사 제목(EN→ko/ja/zh) 번역에 못 쓴다. `translate(text, source, target)`로 일반화하고 `translate_ko`는 그 위에서 하위호환 유지.

**Files:** Modify `api/translator.py`, Test `tests/api/test_translator.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_translator.py
import pytest
import config
from api.translator import translate, translate_ko


@pytest.mark.asyncio
async def test_translate_returns_none_without_key(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "")
    assert await translate("hello", "en", "ko") is None


@pytest.mark.asyncio
async def test_translate_returns_none_for_unsupported_target(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "dummy-key")
    assert await translate("hello", "en", "xx") is None


@pytest.mark.asyncio
async def test_translate_returns_none_for_empty_text(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "dummy-key")
    assert await translate("", "en", "ko") is None


@pytest.mark.asyncio
async def test_translate_ko_still_works_as_wrapper(monkeypatch):
    # translate_ko는 translate(text, "ko", target)로 위임되어야 한다.
    calls = {}

    async def fake_translate(text, source, target):
        calls["args"] = (text, source, target)
        return "OK"

    monkeypatch.setattr("api.translator.translate", fake_translate)
    out = await translate_ko("안녕", "en")
    assert out == "OK"
    assert calls["args"] == ("안녕", "ko", "en")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/api/test_translator.py -v`
Expected: FAIL — `ImportError: cannot import name 'translate' from 'api.translator'`

- [ ] **Step 3: Rewrite `api/translator.py`**

```python
"""DeepL Free API 번역 헬퍼.

translate(text, source, target): 임의 source→target 번역.
translate_ko(text, target): 한국어 소스 전용 하위호환 래퍼 (기존 호출부 유지).
링크 태그는 tag_handling=html로 보존. 실패 시 None → 호출 측에서 폴백.
"""
import logging

import httpx

import config

logger = logging.getLogger(__name__)

# target 언어 → DeepL target_lang 코드
DEEPL_TARGETS = {
    "en": "EN-US",
    "ja": "JA",
    "zh": "ZH-HANS",
    "ko": "KO",
}
# source 언어 → DeepL source_lang 코드
DEEPL_SOURCES = {
    "en": "EN",
    "ja": "JA",
    "zh": "ZH",
    "ko": "KO",
}


async def translate(text: str, source: str, target: str) -> str | None:
    if not config.DEEPL_API_KEY or not text:
        return None
    target_code = DEEPL_TARGETS.get(target)
    source_code = DEEPL_SOURCES.get(source)
    if not target_code:
        logger.warning(f"DeepL: unsupported target lang '{target}'")
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            data = {
                "text": text,
                "target_lang": target_code,
                "tag_handling": "html",
            }
            if source_code:
                data["source_lang"] = source_code
            resp = await client.post(
                config.DEEPL_API_URL,
                headers={"Authorization": f"DeepL-Auth-Key {config.DEEPL_API_KEY}"},
                data=data,
            )
            resp.raise_for_status()
            return resp.json()["translations"][0]["text"]
    except Exception as e:
        logger.warning(f"DeepL translate {source}->{target} failed: {e}")
        return None


async def translate_ko(text: str, target: str) -> str | None:
    """한국어 소스 전용 하위호환 래퍼 (기존 feed 요약 번역 호출부)."""
    return await translate(text, "ko", target)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/api/test_translator.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: 회귀 — 기존 feed 테스트도 통과 확인**

Run: `./venv/bin/python -m pytest tests/api/test_feed.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit**

```bash
git add api/translator.py tests/api/test_translator.py
git commit -m "feat(translator): translate(source,target) 일반화 + translate_ko 하위호환"
```

---

## Task 3: news_summarizer — Haiku 요약 + 유형 분류

**Files:** Create `news_summarizer.py`, Test `tests/api/test_news_summarizer.py`

**Context:** 기존 `tweet_summarizer.py`처럼 Anthropic Messages API를 httpx로 직접 호출. 단 모델은 `config.ANTHROPIC_NEWS_MODEL`(Haiku)에서 읽고, **요약과 분류를 1회 호출로** 받아 JSON으로 파싱. 키 없거나 실패 시 `{"summary_ko": "", "category": "other"}` 폴백.

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_news_summarizer.py
import pytest
from news_summarizer import _parse_classification, summarize_and_classify, CATEGORY_KEYS


def test_parse_valid_json():
    out = _parse_classification('{"summary": "파트너십 체결됨", "category": "partnership"}')
    assert out == {"summary_ko": "파트너십 체결됨", "category": "partnership"}


def test_parse_unknown_category_falls_back_to_other():
    out = _parse_classification('{"summary": "x", "category": "banana"}')
    assert out["category"] == "other"


def test_parse_malformed_json_falls_back():
    out = _parse_classification("not json at all")
    assert out == {"summary_ko": "", "category": "other"}


def test_category_keys_cover_taxonomy():
    for k in ("partnership", "validator", "etf_product", "institutional",
              "dat_vehicle", "tokenomics", "funding", "network_metric", "other"):
        assert k in CATEGORY_KEYS


class _FakeResp:
    def __init__(self, payload): self._p = payload
    def raise_for_status(self): pass
    def json(self): return self._p


class _FakeClient:
    def __init__(self, payload): self._p = payload
    async def post(self, *a, **k): return _FakeResp(self._p)


@pytest.mark.asyncio
async def test_summarize_and_classify_parses_anthropic_response():
    payload = {"content": [{"type": "text",
               "text": '{"summary": "21Shares가 ETF를 출시함", "category": "etf_product"}'}]}
    out = await summarize_and_classify("21Shares launches TCAN", "...", client=_FakeClient(payload))
    assert out["category"] == "etf_product"
    assert "ETF" in out["summary_ko"]


@pytest.mark.asyncio
async def test_summarize_and_classify_falls_back_on_error():
    class _BoomClient:
        async def post(self, *a, **k): raise RuntimeError("boom")
    out = await summarize_and_classify("t", "d", client=_BoomClient())
    assert out == {"summary_ko": "", "category": "other"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/api/test_news_summarizer.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'news_summarizer'`

- [ ] **Step 3: Write implementation**

```python
# news_summarizer.py
"""뉴스 한줄 요약 + 유형 분류 (Anthropic Haiku, 1회 호출).

ANTHROPIC_API_KEY 있으면 호출, 없거나 실패 시 폴백({"summary_ko":"","category":"other"}).
요약은 한국어 한 문장, 분류는 CATEGORY_KEYS 중 하나(불확실하면 other).
"""
import json
import logging
import os

import httpx

import config

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
MAX_TOKENS = 256
TIMEOUT_SECONDS = 30.0

# 유형 분류 키 (프론트 news-category.ts와 1:1)
CATEGORY_KEYS = [
    "partnership", "validator", "etf_product", "institutional",
    "dat_vehicle", "tokenomics", "funding", "network_metric", "other",
]

_PROMPT = """Canton Network 관련 뉴스다. 아래 제목과 내용을 보고 두 가지를 한다.
1) 한국어로 핵심을 한 문장(최대 60자)으로 요약
2) 아래 유형 중 정확히 하나로 분류 (불확실하면 other)

유형:
- partnership: 파트너십·생태계 통합
- validator: 밸리데이터·슈퍼밸리데이터 합류
- etf_product: ETF·ETP 상장 등 상장 상품
- institutional: 기관 파일럿·채택(은행/DTCC/자산운용 등)
- dat_vehicle: DAT·상장사 비클(트레저리 기업)
- tokenomics: 토크노믹스·거버넌스·CIP·보상 구조
- funding: 펀딩·기업가치(투자 라운드 등)
- network_metric: 네트워크 지표·마일스톤(수수료/트랜잭션 등)
- other: 위에 안 맞는 분석·논평 등

JSON만 출력해라(설명 금지): {{"summary": "...", "category": "키"}}

제목: {title}
내용: {description}"""


def _parse_classification(text: str) -> dict:
    """Anthropic이 돌려준 텍스트(JSON)를 파싱. 실패/이상치는 안전 폴백."""
    try:
        d = json.loads(text)
        cat = d.get("category", "other")
        if cat not in CATEGORY_KEYS:
            cat = "other"
        return {"summary_ko": (d.get("summary") or "").strip(), "category": cat}
    except Exception:
        return {"summary_ko": "", "category": "other"}


async def summarize_and_classify(title: str, description: str, client=None) -> dict:
    """제목+내용 → {"summary_ko", "category"}. 키 없거나 실패 시 폴백."""
    own = client is None
    if own and not os.getenv("ANTHROPIC_API_KEY"):
        return {"summary_ko": "", "category": "other"}
    prompt = _PROMPT.format(title=title or "", description=(description or "")[:1500])
    try:
        c = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
        try:
            resp = await c.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": os.getenv("ANTHROPIC_API_KEY", ""),
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": config.ANTHROPIC_NEWS_MODEL,
                    "max_tokens": MAX_TOKENS,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            text = resp.json()["content"][0]["text"]
            return _parse_classification(text)
        finally:
            if own:
                await c.aclose()
    except Exception as e:
        logger.warning(f"news summarize/classify failed: {e}")
        return {"summary_ko": "", "category": "other"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/api/test_news_summarizer.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add news_summarizer.py tests/api/test_news_summarizer.py
git commit -m "feat(news): Haiku 요약+유형분류 (summarize_and_classify)"
```

---

## Task 4: media_collector — RSS 파싱 + dedup + 링버퍼

**Files:** Create `collectors/media_collector.py`, Test `tests/api/test_media.py`

**Context:** feedparser는 동기 함수이고 네트워크 fetch도 자체 처리하지만, **테스트 가능성**을 위해 fetch(httpx async)와 parse(순수)를 분리한다. `parse_entries(raw_xml, feed_name)`는 RSS 문자열만 받아 dict 리스트를 반환(순수). 링버퍼는 `data/media_items.json`.

- [ ] **Step 1: Write the failing test**

```python
# tests/api/test_media.py
import pytest
from collectors.media_collector import parse_entries, dedup_new


_SAMPLE_RSS = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>Google News</title>
<item>
  <title>21Shares launches Canton ETF</title>
  <link>https://example.com/a</link>
  <guid>guid-a</guid>
  <description>&lt;p&gt;21Shares listed TCAN on Nasdaq.&lt;/p&gt;</description>
  <pubDate>Wed, 07 May 2026 13:00:00 GMT</pubDate>
  <source url="https://coindesk.com">CoinDesk</source>
</item>
<item>
  <title>Canton blog post</title>
  <link>https://example.com/b</link>
  <guid>guid-b</guid>
  <description>Privacy by design.</description>
  <pubDate>Tue, 06 May 2026 09:00:00 GMT</pubDate>
</item>
</channel></rss>"""


def test_parse_entries_maps_fields():
    items = parse_entries(_SAMPLE_RSS, "Google News")
    assert len(items) == 2
    a = items[0]
    assert a["url"] == "https://example.com/a"
    assert a["guid"] == "guid-a"
    assert a["title_raw"] == "21Shares launches Canton ETF"
    assert "21Shares listed TCAN" in a["description"]  # HTML 제거됨
    assert "<p>" not in a["description"]
    assert a["ts"].startswith("2026-05-07T13:00:00")
    assert a["publisher"] == "CoinDesk"  # <source> 우선


def test_parse_entries_falls_back_to_feed_name_when_no_source():
    items = parse_entries(_SAMPLE_RSS, "Google News")
    assert items[1]["publisher"] == "Google News"


def test_dedup_new_filters_existing_guids():
    existing = [{"guid": "guid-a"}]
    fetched = [{"guid": "guid-a"}, {"guid": "guid-c"}]
    new = dedup_new(existing, fetched)
    assert [i["guid"] for i in new] == ["guid-c"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/api/test_media.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'collectors.media_collector'`

- [ ] **Step 3: Write implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/api/test_media.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add collectors/media_collector.py tests/api/test_media.py
git commit -m "feat(collectors): media_collector — RSS 파싱/dedup/링버퍼"
```

---

## Task 5: scheduler — collect_media 오케스트레이션 + 등록

**Files:** Modify `api/scheduler.py`

**Context — 실제 scheduler 패턴:** `api/scheduler.py`는 직접 만든 asyncio 루프다. 각 수집기는 `async def collect_X(cache: TTLCache):`로 cache를 파라미터 주입받고, `start_scheduler` 안에서 `asyncio.create_task(_loop(collect_X, cache, interval, "name"))`로 등록 + 즉시 1회 실행. `_deferred_initial`(line ~829)에서 느린 수집기를 함께 gather. `logger`는 모듈에 이미 존재.

- [ ] **Step 1: import 추가 — `api/scheduler.py` 상단 import 그룹 부근**

기존 `from api.cache import TTLCache` 아래에 추가:

```python
import httpx
```
(httpx가 이미 함수 내부 지역 import로 쓰이지만, collect_media에서 모듈 상단 사용을 위해 추가. 이미 상단에 있으면 생략)

- [ ] **Step 2: `collect_media` 함수 추가 — `collect_feed` 정의 아래에**

```python
async def collect_media(cache: TTLCache):
    """Canton 미디어 RSS 수집. 신규 아이템만 Haiku 요약+분류 + DeepL 번역.

    비용: 폴링은 무료, 신규 기사만 LLM 처리(하루 ~수 건). 전부 기존이면 LLM 0회.
    """
    from collectors.media_collector import (
        fetch_raw, parse_entries, dedup_new, load_media_items, save_media_items,
    )
    from news_summarizer import summarize_and_classify
    from api.translator import translate, translate_ko
    import config

    existing = load_media_items()
    fetched: list[dict] = []
    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (CantonHub RSS)"},
        ) as client:
            for feed in config.MEDIA_FEEDS:
                try:
                    raw = await fetch_raw(feed["url"], client)
                    fetched.extend(parse_entries(raw, feed["name"]))
                except Exception as e:
                    logger.warning(f"Media feed failed ({feed['name']}): {e}")
    except Exception as e:
        logger.error(f"Media collection failed: {e}")
        return

    new_items = dedup_new(existing, fetched)
    processed: list[dict] = []
    for item in new_items:
        try:
            cls = await summarize_and_classify(item["title_raw"], item["description"])
            title_en = item["title_raw"]
            summary_ko = cls["summary_ko"]
            # 제목: 원문(영문 가정) en, 나머지는 EN→X 번역
            title = {"en": title_en, "ko": title_en, "ja": title_en, "zh": title_en}
            for lng in ("ko", "ja", "zh"):
                t = await translate(title_en, "en", lng)
                if t:
                    title[lng] = t
            # 요약: ko=Haiku, 나머지는 KO→X 번역
            summary = {"ko": summary_ko, "en": summary_ko, "ja": summary_ko, "zh": summary_ko}
            if summary_ko:
                for lng in ("en", "ja", "zh"):
                    s = await translate_ko(summary_ko, lng)
                    if s:
                        summary[lng] = s
            processed.append({
                "url": item["url"], "guid": item["guid"], "ts": item["ts"],
                "publisher": item["publisher"], "category": cls["category"],
                "title": title, "summary": summary,
            })
        except Exception as e:
            logger.warning(f"Media item processing failed ({item.get('url')}): {e}")

    if processed:
        save_media_items(processed + existing)
        cache.set("media:items", load_media_items(), ttl=7200)
        logger.info(f"Media cached: +{len(processed)} new")
    else:
        cache.set("media:items", existing, ttl=7200)
        logger.info("Media: no new items")
```

- [ ] **Step 3: `start_scheduler`에 등록 — `_loop(collect_feed, ...)` 줄 아래에 추가**

```python
    asyncio.create_task(_loop(collect_media, cache, 3600, "media"))  # 60분
```

그리고 `_deferred_initial`의 `asyncio.gather(...)` 인자 목록에 `collect_media(cache),`를 추가(첫 페이지 로드 시 미디어도 적재).

- [ ] **Step 4: py_compile + 백엔드 재기동 smoke**

```bash
cd /Users/choejaewon/project/Ozzycanton/canton-hub
./venv/bin/python -m py_compile api/scheduler.py
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
```
약 30~60초 후:
```bash
curl -s "http://localhost:8000/api/feed?lang=ko" | python3 -c "import sys,json; d=json.load(sys.stdin); print('news:', sum(1 for i in d['items'] if i.get('kind')=='news'))"
```
Expected: 라우트 병합 전이므로 아직 0일 수 있음(병합은 Task 6). 대신 로그 확인:
```bash
grep "Media cached\|Media: no new" /tmp/canton-hub-backend.err.log | tail -3
```
Expected: `Media cached: +N new` 또는 `Media: no new items` 출현

- [ ] **Step 5: Commit**

```bash
git add api/scheduler.py
git commit -m "feat(scheduler): collect_media 60분 수집 job 등록"
```

---

## Task 6: feed 라우트 — 트윗 + 미디어 통합 병합

**Files:** Modify `api/routes/feed.py`, Test `tests/api/test_feed.py`

**Context:** 현재 라우트는 `feed:{lang}`만 반환. 이제 `media:items`(lang-무관 레코드)를 `FeedItem`(news)으로 매핑해 트윗과 합치고 `ts` 내림차순 정렬. 상대시간은 프론트가 `ts`로 계산하므로 라우트는 time_ago를 새로 만들지 않는다(news는 `time_ago=""`).

- [ ] **Step 1: Write the failing test — `tests/api/test_feed.py`에 추가**

```python
@pytest.mark.asyncio
async def test_feed_merges_tweets_and_media_sorted_by_ts():
    cache = TTLCache()
    cache.set("feed:ko", {
        "lang": "ko", "ai_summary": "", "fetched_at": "2026-05-30T12:00:00+00:00",
        "items": [
            {"kind": "tweet", "source": "@CantonNetwork", "time_ago": "1시간 전",
             "ts": "2026-05-30T11:00:00+00:00", "text": "tweet A", "url": "https://x/1"},
        ],
    }, ttl=900)
    cache.set("media:items", [
        {"url": "https://n/1", "guid": "g1", "ts": "2026-05-30T11:30:00+00:00",
         "publisher": "CoinDesk", "category": "etf_product",
         "title": {"ko": "ETF 상장", "en": "ETF listed"},
         "summary": {"ko": "코인데스크 요약", "en": "summary"}},
    ], ttl=7200)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/feed?lang=ko")
    data = resp.json()
    assert [i["kind"] for i in data["items"]] == ["news", "tweet"]  # 11:30 > 11:00
    news = data["items"][0]
    assert news["title"] == "ETF 상장"
    assert news["text"] == "코인데스크 요약"
    assert news["category"] == "etf_product"
    assert news["source"] == "CoinDesk"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_feed_news_lang_fallback_to_en():
    cache = TTLCache()
    cache.set("media:items", [
        {"url": "https://n/2", "guid": "g2", "ts": "2026-05-30T10:00:00+00:00",
         "publisher": "Canton Blog", "category": "tokenomics",
         "title": {"en": "Only English"}, "summary": {"en": "english only"}},
    ], ttl=7200)
    app.dependency_overrides[get_cache] = lambda: cache
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/feed?lang=ja")  # ja 없음 → en 폴백
    data = resp.json()
    assert data["items"][0]["title"] == "Only English"
    assert data["items"][0]["text"] == "english only"
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/api/test_feed.py -k "merges or lang_fallback" -v`
Expected: FAIL — 병합 미구현이라 news 아이템이 없음(AssertionError)

- [ ] **Step 3: Rewrite `api/routes/feed.py`**

```python
# api/routes/feed.py
"""Feed endpoint — 트위터 + 미디어(RSS) 통합 타임라인."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

SUPPORTED_LANGS = {"ko", "en", "ja", "zh"}
_MERGED_MAX = 25


def _pick(d: dict, lang: str) -> str:
    """언어별 필드 선택, 없으면 en 폴백, 그것도 없으면 빈 문자열."""
    if not isinstance(d, dict):
        return ""
    return d.get(lang) or d.get("en") or ""


def _media_to_item(rec: dict, lang: str) -> dict:
    return {
        "kind": "news",
        "source": rec.get("publisher", ""),
        "time_ago": "",  # 프론트가 ts로 계산
        "ts": rec.get("ts", ""),
        "text": _pick(rec.get("summary", {}), lang),
        "url": rec.get("url", ""),
        "title": _pick(rec.get("title", {}), lang),
        "category": rec.get("category", "other"),
    }


@router.get("/feed")
async def get_feed(lang: str = "en", cache: TTLCache = Depends(get_cache)):
    if lang not in SUPPORTED_LANGS:
        lang = "en"
    feed = cache.get(f"feed:{lang}") or {"items": [], "ai_summary": "", "fetched_at": None}

    tweets = [{**t, "kind": t.get("kind", "tweet")} for t in feed.get("items", [])]
    media = cache.get("media:items") or []
    news = [_media_to_item(r, lang) for r in media]

    merged = tweets + news
    merged.sort(key=lambda x: x.get("ts") or "", reverse=True)
    merged = merged[:_MERGED_MAX]

    return {
        "lang": lang,
        "items": merged,
        "ai_summary": feed.get("ai_summary", ""),
        "fetched_at": feed.get("fetched_at"),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/api/test_feed.py -v`
Expected: PASS (기존 4 + 신규 2 = 6 passed)

- [ ] **Step 5: 백엔드 재기동 후 라이브 smoke**

```bash
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend
# 30~60초 후
curl -s "http://localhost:8000/api/feed?lang=ko" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(i['kind'], '|', i.get('category',''), '|', (i.get('title') or i['text'])[:40]) for i in d['items'][:8]]"
```
Expected: `news`/`tweet`이 시간순 섞여 출력, news에 category 표시

- [ ] **Step 6: Commit**

```bash
git add api/routes/feed.py tests/api/test_feed.py
git commit -m "feat(feed): 트위터+미디어 통합 타임라인 병합 (ts desc)"
```

---

## Task 7: 프론트 타입 — FeedItem 확장

**Files:** Modify `web/lib/types.ts`

- [ ] **Step 1: `FeedItem` 인터페이스 수정** (기존 `ts?` 위에 `kind`, 아래에 `title?`/`category?` 추가)

```typescript
export interface FeedItem {
  kind?: "tweet" | "news"; // 미지정 시 tweet 취급(하위호환)
  source: string;
  time_ago: string;
  ts?: string; // ISO UTC — 프론트에서 상대시간 실시간 계산용 (time_ago는 폴백)
  text: string; // tweet=본문 / news=번역된 한줄 요약
  url: string;
  title?: string; // news 헤드라인(번역본). tweet은 없음
  category?: string; // news 유형 key. tweet은 없음
}
```

- [ ] **Step 2: 타입 검증**

Run: `cd /Users/choejaewon/project/Ozzycanton/canton-hub/web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web): FeedItem에 kind/title/category 추가"
```

---

## Task 8: 프론트 유형 메타 맵

**Files:** Create `web/components/feed/news-category.ts`

**Context:** 유형 key → 라벨(ko/en) + 색상. 색상은 하드코딩 hex 금지 규칙에 따라 Tailwind 유틸 클래스(zinc/canton 계열)를 문자열로 둔다(인라인 배지 className용).

- [ ] **Step 1: 파일 생성**

```typescript
// web/components/feed/news-category.ts
// 뉴스 유형 메타 (news_summarizer.CATEGORY_KEYS와 1:1)
export interface CategoryMeta {
  ko: string;
  en: string;
  className: string; // 배지 색상 (Tailwind 유틸, 하드코딩 hex 금지)
}

export const NEWS_CATEGORIES: Record<string, CategoryMeta> = {
  partnership:    { ko: "파트너십",   en: "Partnership",   className: "bg-canton-lime/10 text-canton-lime" },
  validator:      { ko: "밸리데이터", en: "Validator",     className: "bg-sky-500/10 text-sky-400" },
  etf_product:    { ko: "ETF·ETP",   en: "ETF / ETP",     className: "bg-violet-500/10 text-violet-400" },
  institutional:  { ko: "기관 채택",  en: "Institutional", className: "bg-amber-500/10 text-amber-400" },
  dat_vehicle:    { ko: "DAT·상장사", en: "Treasury",      className: "bg-orange-500/10 text-orange-400" },
  tokenomics:     { ko: "토크노믹스", en: "Tokenomics",    className: "bg-emerald-500/10 text-emerald-400" },
  funding:        { ko: "펀딩",       en: "Funding",       className: "bg-pink-500/10 text-pink-400" },
  network_metric: { ko: "네트워크",   en: "Network",       className: "bg-zinc-500/10 text-zinc-300" },
  other:          { ko: "기타",       en: "Other",         className: "bg-zinc-700/20 text-zinc-400" },
};

export function categoryLabel(key: string | undefined, lang: string): string {
  const meta = NEWS_CATEGORIES[key || "other"] || NEWS_CATEGORIES.other;
  return lang === "ko" ? meta.ko : meta.en;
}

export function categoryClass(key: string | undefined): string {
  return (NEWS_CATEGORIES[key || "other"] || NEWS_CATEGORIES.other).className;
}
```

- [ ] **Step 2: 타입 검증**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/news-category.ts
git commit -m "feat(web): 뉴스 유형 메타 맵 (라벨+배지색)"
```

---

## Task 9: 통합 타임라인 렌더 — twitter-archive.tsx

**Files:** Modify `web/components/feed-page/twitter-archive.tsx`

**Context:** 기존은 트윗만 렌더. `item.kind === "news"`면 유형 배지 + 제목(굵게) + 한줄요약 + 출처, 아니면 기존 트윗 모양. 제목 라벨은 lang에 따라. 상대시간/툴팁/`useNow`는 이미 적용돼 있음.

- [ ] **Step 1: import 추가** (기존 format/use-now import 아래)

```typescript
import { categoryLabel, categoryClass } from "@/components/feed/news-category";
```

- [ ] **Step 2: 헤더 제목 문자열을 통합 피드로 변경**

`TITLE` 맵을 교체:

```typescript
const TITLE: Record<string, string> = {
  ko: "Canton 피드",
  en: "Canton Feed",
  ja: "Canton フィード",
  zh: "Canton 动态",
};
```

통합 피드가 되면서 기존 "매일 0시·12시 갱신" 라벨은 트윗 전용 주기라 혼동되므로, 부제/갱신 라벨을 혼합 주기에 맞게 교체:

```typescript
const CADENCE_LABEL: Record<string, string> = {
  ko: "트위터 0시·12시 · 미디어 매시 갱신",
  en: "Twitter 00:00·12:00 · Media hourly",
  ja: "Twitter 0時・12時 · メディア毎時",
  zh: "Twitter 0点·12点 · 媒体每小时",
};
```

(`@CantonNetwork · @CantonFdn` 부제 줄은 그대로 두어도 무방 — 트위터 소스 표기)

- [ ] **Step 3: 아이템 렌더를 kind 분기로 교체**

기존 `{items.map((item, i) => ( <a ...> ... </a> ))}` 블록을 아래로 교체:

```tsx
{items.map((item, i) => (
  <a
    key={i}
    href={item.url}
    target="_blank"
    rel="noopener"
    className="block p-3 bg-zinc-900/50 border border-canton-border rounded-md hover:border-zinc-700 transition"
  >
    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
      {item.kind === "news" && (
        <span className={`px-1.5 py-0.5 rounded normal-case tracking-normal ${categoryClass(item.category)}`}>
          {categoryLabel(item.category, lang)}
        </span>
      )}
      <span className="text-canton-lime normal-case tracking-normal">{item.source}</span>
      <span className="text-zinc-700 normal-case tracking-normal">·</span>
      <span className="normal-case tracking-normal" title={kstTimestamp(item.ts)}>
        {item.ts ? relativeTime(item.ts, lang, now) : item.time_ago}
      </span>
    </div>
    {item.kind === "news" && item.title && (
      <p className="text-[13px] font-semibold text-zinc-100 leading-snug mb-1">{item.title}</p>
    )}
    <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">
      {item.text}
    </p>
  </a>
))}
```

- [ ] **Step 4: 타입 검증 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: exit 0, `/feed` ○ prerender

- [ ] **Step 5: Commit**

```bash
git add web/components/feed-page/twitter-archive.tsx
git commit -m "feat(web): /feed 통합 타임라인 (트윗+뉴스 kind 분기)"
```

---

## Task 10: 대시보드 카드 뉴스 렌더 — feed-card.tsx

**Files:** Modify `web/components/feed/feed-card.tsx`

**Context:** 상위 3건 렌더 시 news면 유형 배지 + 제목 + 요약. 대시보드 카드 라벨은 기존 ko/en 유지(스펙 §6).

- [ ] **Step 1: import 추가**

```typescript
import { categoryLabel, categoryClass } from "@/components/feed/news-category";
```

- [ ] **Step 2: 아이템 렌더 교체**

기존 `visibleItems.map(...)` 블록을 아래로 교체:

```tsx
{visibleItems.map((item, i) => (
  <div key={i} className={`py-2.5 ${i < visibleItems.length - 1 ? "border-b border-canton-border" : ""}`}>
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
      {item.kind === "news" && (
        <span className={`px-1.5 py-0.5 rounded normal-case tracking-normal ${categoryClass(item.category)}`}>
          {categoryLabel(item.category, lang)}
        </span>
      )}
      {item.source}
      <span className="text-zinc-700 normal-case tracking-normal" title={kstTimestamp(item.ts)}>
        {item.ts ? relativeTime(item.ts, lang, now) : item.time_ago}
      </span>
    </div>
    <a href={item.url} target="_blank" rel="noopener" className="block hover:text-zinc-300 transition">
      {item.kind === "news" && item.title && (
        <span className="block text-[13px] font-semibold text-zinc-300 leading-snug">{item.title}</span>
      )}
      <span className="text-[13px] text-zinc-400 leading-relaxed">{item.text}</span>
    </a>
  </div>
))}
```

- [ ] **Step 3: 타입 검증 + 빌드**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: exit 0, `/` ○ prerender

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/feed-card.tsx
git commit -m "feat(web): 대시보드 카드에 뉴스 아이템 렌더"
```

---

## Task 11: 문서 갱신

**Files:** Modify `docs/ARCHITECTURE.md`, `docs/DATA_GUIDE.md`, `web/docs/ARCHITECTURE.md`

- [ ] **Step 1: `docs/ARCHITECTURE.md`**
  - Cache Key Map: `media:items` (TTL 7200s, collector 3600s, 소비처 `/api/feed`) 추가
  - API Contracts: `GET /api/feed` 응답에 `kind`/`title`/`category` 필드 + 병합 동작 설명 갱신
  - Data Sources: `collectors/media_collector.py`(RSS 3종) + `news_summarizer.py` 추가

- [ ] **Step 2: `docs/DATA_GUIDE.md`**
  - 신규 소스: Google News(`"Canton Network"`), Canton 공식 블로그, Digital Asset 블로그 RSS + 수집 흐름(요약 Haiku, 번역 DeepL) 추가

- [ ] **Step 3: `web/docs/ARCHITECTURE.md`**
  - `useFeed`가 이제 통합 타임라인(트윗+뉴스)을 반환함을 명시
  - Component 트리에 `feed/news-category.ts` 추가

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md docs/DATA_GUIDE.md web/docs/ARCHITECTURE.md
git commit -m "docs: RSS 미디어 피드 반영 (Cache Key/API/Data Sources)"
```

---

## Final Verification

- [ ] 백엔드 전체 테스트: `cd /Users/choejaewon/project/Ozzycanton/canton-hub && ./venv/bin/python -m pytest tests/ -v` → 전체 PASS
- [ ] 프론트 빌드: `cd web && npx tsc --noEmit && npm run build` → exit 0
- [ ] 백엔드 재기동 후 라이브: `curl -s "http://localhost:8000/api/feed?lang=ko"` → items에 `kind:"news"`(category/title 포함) + `kind:"tweet"`이 ts 내림차순 혼합
- [ ] 4개국어: `?lang=ja`/`zh`/`en`에서 news title/text가 해당 언어로(미번역분은 en 폴백)
- [ ] 로그: `grep "Media cached\|Media: no new" /tmp/canton-hub-backend.err.log` → 수집 라인 관측
- [ ] 비용 가드 확인: 신규 0건인 폴링 사이클에서 LLM 호출 로그 없음(`Media: no new items`)
- [ ] 프로덕션: 프론트 `vercel --prod` 재배포 후 `/feed`에서 트윗+뉴스 통합 타임라인 + 유형 배지 육안 확인
