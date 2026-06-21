"""번역 헬퍼 — 헤드리스 claude -p 백엔드.

translate(text, source, target): 임의 source→target 번역.
translate_ko(text, target): 한국어 소스 전용 하위호환 래퍼 (기존 호출부 유지).

DeepL Free API를 쓰다가 무료 쿼터 소진(456)으로 2026-06-21 claude -p로 교체.
같은 Mac launchd에서 Max 구독으로 도는 `claude -p`(claude_cli)라 토큰 과금이
없다 — 뉴스/트윗 요약과 동일 백엔드. HTML 태그(<a> 링크 등)는 프롬프트로 보존을
강제한다. 실패/빈입력 시 None → 호출 측에서 ko 원문으로 폴백.
"""
import asyncio
import logging

import config
from claude_cli import run_claude

logger = logging.getLogger(__name__)

# 지원 언어 코드 → 프롬프트용 영어 언어명
LANG_NAMES = {
    "en": "English",
    "ja": "Japanese",
    "zh": "Simplified Chinese",
    "ko": "Korean",
}

# 콜드스타트 시 다수 항목을 한꺼번에 번역해도 claude 서브프로세스가 폭주하지
# 않도록 동시 실행 수를 제한한다(현재 호출부는 대부분 순차지만 방어적으로).
_SEM = asyncio.Semaphore(4)

_PROMPT = """You are a professional translator. Translate the text below from {src} into {tgt}.

Output rules (strict):
- Output ONLY the translated text. No preamble, no quotes, no notes, no explanation.
- Preserve every HTML tag exactly as-is (e.g. <a href="...">, </a>, <b>); translate only the human-readable text, never tag names, attributes, or URLs.
- Keep "$CC", ticker symbols, URLs, numbers, @handles, and proper nouns unchanged.
- Preserve line breaks and the leading "·" bullet of each line.
- Match the original tone and length; never add or drop information.

Text:
{text}"""


async def translate(text: str, source: str, target: str, *, runner=None) -> str | None:
    """source→target 번역. 빈입력·미지원언어·실패 → None. runner는 테스트 주입용."""
    if not text or not text.strip():
        return None
    tgt = LANG_NAMES.get(target)
    if not tgt:
        logger.warning(f"translate: unsupported target lang '{target}'")
        return None
    if source == target:
        return text

    src = LANG_NAMES.get(source, source)
    prompt = _PROMPT.format(src=src, tgt=tgt, text=text)
    run = runner or run_claude
    try:
        async with _SEM:
            out = await run(prompt, model=config.ANTHROPIC_TRANSLATE_MODEL)
    except Exception as e:  # 수집기 규약: 삼키고 None
        logger.warning(f"translate {source}->{target} failed: {e}")
        return None

    if not out or not out.strip():
        logger.warning(f"translate {source}->{target}: empty result")
        return None
    return out.strip()


async def translate_ko(text: str, target: str) -> str | None:
    """한국어 소스 전용 하위호환 래퍼 (기존 feed 요약 번역 호출부)."""
    return await translate(text, "ko", target)
