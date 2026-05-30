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
    """Anthropic이 돌려준 텍스트(JSON)를 파싱. 실패/이상치는 안전 폴백.

    모델이 종종 ```json ... ``` 코드펜스나 앞뒤 설명을 붙이므로,
    첫 '{'부터 마지막 '}'까지의 블록만 추출해 파싱한다.
    """
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {"summary_ko": "", "category": "other"}
        d = json.loads(text[start:end + 1])
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


_CLASSIFY_PROMPT = """다음은 Canton Network 관련 짧은 글(트윗)이다.
아래 유형 중 정확히 하나로 분류하고, 유형 키만 한 단어로 출력해라(설명 금지, 불확실하면 other).

유형: partnership, validator, etf_product, institutional, dat_vehicle, tokenomics, funding, network_metric, other

글: {text}"""


def _extract_category(text: str) -> str:
    """모델 출력(잡텍스트/펜스 포함 가능)에서 유효한 카테고리 키를 추출. 없으면 other."""
    t = (text or "").strip().lower()
    for key in CATEGORY_KEYS:
        if key == "other":
            continue
        if key in t:
            return key
    return "other"


async def classify_text(text: str, client=None) -> str:
    """짧은 글(트윗)을 유형 키 하나로 분류. 키 없거나 실패 시 'other'."""
    own = client is None
    if own and not os.getenv("ANTHROPIC_API_KEY"):
        return "other"
    prompt = _CLASSIFY_PROMPT.format(text=(text or "")[:600])
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
                    "max_tokens": 16,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            return _extract_category(resp.json()["content"][0]["text"])
        finally:
            if own:
                await c.aclose()
    except Exception as e:
        logger.warning(f"tweet classify failed: {e}")
        return "other"
