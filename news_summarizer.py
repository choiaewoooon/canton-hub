# news_summarizer.py
"""뉴스 한줄 요약 + 유형 분류 (gemq=Gemini 헤드리스, 1회 호출).

canton-hub가 Mac 로컬(launchd)에서 돌게 되면서 토큰 과금되는 Anthropic API 대신
구독으로 도는 gemq(Gemini)를 쓴다(키 불필요·토큰 과금 없음). LLM 실패/부재 시
폴백({"summary_ko":"","category":"other"}). 요약은 한국어 한 문장, 분류는
CATEGORY_KEYS 중 하나(불확실하면 other).
"""
import json
import logging

from llm_cli import run_llm

logger = logging.getLogger(__name__)

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
    """LLM이 돌려준 텍스트(JSON)를 파싱. 실패/이상치는 안전 폴백.

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


async def summarize_and_classify(title: str, description: str, runner=None) -> dict:
    """제목+내용 → {"summary_ko", "category"}. CLI 실패/부재 시 폴백.

    runner: 테스트용 주입 포인트(기본 run_llm) — 프롬프트→텍스트 비동기 함수.
    """
    run = runner or run_llm
    prompt = _PROMPT.format(title=title or "", description=(description or "")[:1500])
    try:
        text = await run(prompt)
    except Exception as e:
        logger.warning(f"news summarize/classify failed: {e}")
        return {"summary_ko": "", "category": "other"}
    if not text:
        return {"summary_ko": "", "category": "other"}
    return _parse_classification(text)


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


async def classify_text(text: str, runner=None) -> str:
    """짧은 글(트윗)을 유형 키 하나로 분류. CLI 실패/부재 시 'other'.

    runner: 테스트용 주입 포인트(기본 run_llm).
    """
    run = runner or run_llm
    prompt = _CLASSIFY_PROMPT.format(text=(text or "")[:600])
    try:
        out = await run(prompt)
    except Exception as e:
        logger.warning(f"tweet classify failed: {e}")
        return "other"
    return _extract_category(out) if out else "other"
