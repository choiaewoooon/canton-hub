# claude_cli.py
"""LLM 헤드리스 호출 래퍼 (이제 gemq=Gemini 백엔드).

과거엔 `claude -p`(Max 구독)로 분류/요약/번역을 돌렸으나, 작은 작업마다 Claude Code
시스템 프롬프트 전체가 입력에 붙어 토큰(구독 사용량)이 과하게 소모됐다. 분류·요약·번역은
오프로드하기 좋은 작업이라 유료 구독 Gemini(`gemq`, 풀패스 래퍼)로 전환한다.

- gemq는 `gemq [flash|pro] "<지시문>"` 형태, 출력은 순수 텍스트(claude의 JSON 래퍼 없음).
- 모델 키 생략 시 pro(Gemini 3.1 Pro High, 품질) 기본.
- run_claude 시그니처/반환 규약은 그대로 유지(호출부 무변경): 실패/타임아웃/바이너리
  부재 → None (호출부가 폴백 처리).

함수명은 호환을 위해 run_claude로 유지하지만 실제 백엔드는 gemq다.
"""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

# gemq 풀패스 래퍼. 다른 환경이면 GEMQ_BIN 환경변수로 덮어쓴다.
GEMQ_BIN = os.getenv("GEMQ_BIN", "/Users/choejaewon/.local/bin/gemq")
DEFAULT_TIMEOUT = 120.0


async def run_claude(
    prompt: str, *, model: str | None = None, timeout: float = DEFAULT_TIMEOUT
) -> str | None:
    """`gemq pro <prompt>` 실행 → 모델 텍스트 응답 반환.

    실패/타임아웃/바이너리 부재 → None (호출부가 폴백 처리). 구독 Gemini라 토큰
    과금이 없다. model 인자는 하위호환용으로 받기만 하고, 품질 유지를 위해 항상
    gemq pro(Gemini 3.1 Pro High)로 라우팅한다(Anthropic 모델 ID는 무시).
    """
    args = [GEMQ_BIN, "pro", prompt]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        logger.warning("gemq 래퍼를 %s 에서 찾을 수 없음 — 폴백", GEMQ_BIN)
        return None
    except Exception as e:  # noqa: BLE001 — 수집기 규약: 삼키고 None
        logger.warning("gemq 실행 실패: %s", e)
        return None

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        logger.warning("gemq 타임아웃 (%.0fs)", timeout)
        return None

    if proc.returncode != 0:
        logger.warning(
            "gemq 실패 (rc=%s): %s", proc.returncode, (stderr or b"").decode()[:200]
        )
        return None
    return ((stdout or b"").decode().strip()) or None
