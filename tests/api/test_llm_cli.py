# tests/api/test_llm_cli.py
import pytest

import llm_cli


@pytest.mark.asyncio
async def test_run_llm_missing_binary_returns_none(monkeypatch):
    """CLI 바이너리가 없으면 예외가 아니라 None을 반환해 호출부가 폴백하게 한다."""
    monkeypatch.setattr(llm_cli, "GEMQ_BIN", "/nonexistent/path/gemq-xyz")
    assert await llm_cli.run_llm("hello") is None


@pytest.mark.asyncio
async def test_run_llm_nonzero_exit_returns_none(monkeypatch):
    """프로세스가 0이 아닌 코드로 종료하면 None."""
    monkeypatch.setattr(llm_cli, "GEMQ_BIN", "/usr/bin/false")
    assert await llm_cli.run_llm("hello") is None


@pytest.mark.asyncio
async def test_run_llm_returns_stdout_text(monkeypatch):
    """정상 종료 시 stdout 텍스트를 그대로 반환한다(echo로 대체 검증)."""
    monkeypatch.setattr(llm_cli, "GEMQ_BIN", "/bin/echo")
    # /bin/echo 는 모든 인자를 출력 → 응답이 비어있지 않고 strip된 텍스트가 돌아온다
    out = await llm_cli.run_llm("ping")
    assert out is not None and "ping" in out
