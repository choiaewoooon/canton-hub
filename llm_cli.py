# llm_cli.py
"""LLM 헤드리스 호출 래퍼 — 백엔드는 gemq(Gemini).

분류·요약·번역용 LLM 호출을 한 곳으로 모은다. 현재 백엔드는 유료 구독 Gemini를
부르는 `gemq` 풀패스 래퍼다(토큰 과금 없음).

연혁:
- 최초: Anthropic Messages API(httpx 직접 POST) — API 키 과금.
- 2026-06-21: 헤드리스 `claude -p`(Max 구독)로 전환 — 키 과금 제거. 그러나 호출마다
  Claude Code 시스템 프롬프트가 입력에 붙어 구독 사용량이 과하게 소모됐다.
- 2026-06: 분류·요약·번역은 오프로드하기 좋은 작업이라 구독 Gemini(`gemq`)로 전환.

gemq 규약: `gemq [flash|pro] "<지시문>"`, 출력은 순수 텍스트. 모델 키 생략 시 pro
(Gemini 3.1 Pro High, 품질) 기본. 여기선 항상 pro로 라우팅한다.

`run_llm`은 실패/타임아웃/바이너리 부재 시 예외 대신 None을 반환한다(호출부가 폴백 처리).
"""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

# gemq 풀패스 래퍼. 다른 환경이면 GEMQ_BIN 환경변수로 덮어쓴다.
GEMQ_BIN = os.getenv("GEMQ_BIN", "/Users/choejaewon/.local/bin/gemq")
DEFAULT_TIMEOUT = 120.0


async def run_llm(
    prompt: str, *, model: str | None = None, timeout: float = DEFAULT_TIMEOUT
) -> str | None:
    """`gemq pro <prompt>` 실행 → 모델 텍스트 응답 반환.

    실패/타임아웃/바이너리 부재 → None (호출부가 폴백 처리). 구독 Gemini라 토큰
    과금이 없다. `model` 인자는 하위호환용 시그니처로 남겨둘 뿐 현재는 무시된다
    (gemq는 항상 pro 티어로 라우팅).
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
