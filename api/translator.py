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
