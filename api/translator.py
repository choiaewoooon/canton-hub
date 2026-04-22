"""DeepL Free API 번역 헬퍼 — 한국어 요약을 en/ja/zh로 번역.

링크 `<a href="...">원문</a>` 같은 태그는 DeepL의 `tag_handling=html` 옵션으로 보존된다.
실패 시 None 반환 → 호출 측에서 한국어 폴백 처리.
"""
import logging

import httpx

import config

logger = logging.getLogger(__name__)

DEEPL_TARGETS = {
    "en": "EN-US",
    "ja": "JA",
    "zh": "ZH-HANS",
}


async def translate_ko(text: str, target: str) -> str | None:
    if not config.DEEPL_API_KEY or not text:
        return None
    target_code = DEEPL_TARGETS.get(target)
    if not target_code:
        logger.warning(f"DeepL: unsupported target lang '{target}'")
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                config.DEEPL_API_URL,
                headers={"Authorization": f"DeepL-Auth-Key {config.DEEPL_API_KEY}"},
                data={
                    "text": text,
                    "source_lang": "KO",
                    "target_lang": target_code,
                    "tag_handling": "html",
                },
            )
            resp.raise_for_status()
            return resp.json()["translations"][0]["text"]
    except Exception as e:
        logger.warning(f"DeepL translate ko→{target} failed: {e}")
        return None
