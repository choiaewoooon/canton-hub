# claude_cli.py
"""Claude Code 헤드리스(`claude -p`) 호출 래퍼.

canton-hub는 이제 Fly.io가 아니라 Mac 로컬(launchd)에서 돌기 때문에, 토큰 단위로
과금되는 Anthropic Messages API 대신 구독으로 도는 `claude -p`를 쓴다. API 키가
필요 없고 별도 토큰 과금도 없다(같은 Mac의 canton-telegram-bot / kospi-morning-bot
와 동일한 subprocess 패턴).
"""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

# Homebrew 기본 경로. 다른 환경이면 CLAUDE_BIN 환경변수로 덮어쓴다.
CLAUDE_BIN = os.getenv("CLAUDE_BIN", "/opt/homebrew/bin/claude")
DEFAULT_TIMEOUT = 120.0


async def run_claude(
    prompt: str, *, model: str | None = None, timeout: float = DEFAULT_TIMEOUT
) -> str | None:
    """`claude -p <prompt> --output-format text` 실행 → 모델 텍스트 응답 반환.

    실패/타임아웃/바이너리 부재 → None (호출부가 폴백 처리). 구독으로 돌아 토큰
    과금이 없다. model 지정 시 `--model <model>` 추가(미지정이면 구독 기본 모델).
    """
    args = [CLAUDE_BIN, "-p", prompt, "--output-format", "text"]
    if model:
        args += ["--model", model]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        logger.warning("claude CLI를 %s 에서 찾을 수 없음 — 폴백", CLAUDE_BIN)
        return None
    except Exception as e:  # noqa: BLE001 — 수집기 규약: 삼키고 None
        logger.warning("claude -p 실행 실패: %s", e)
        return None

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        logger.warning("claude -p 타임아웃 (%.0fs)", timeout)
        return None

    if proc.returncode != 0:
        logger.warning(
            "claude -p 실패 (rc=%s): %s", proc.returncode, (stderr or b"").decode()[:200]
        )
        return None
    return ((stdout or b"").decode().strip()) or None
