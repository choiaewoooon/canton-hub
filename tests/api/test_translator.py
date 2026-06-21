# tests/api/test_translator.py
import pytest
import config
from api.translator import translate, translate_ko


@pytest.mark.asyncio
async def test_translate_returns_none_for_empty_text():
    assert await translate("", "ko", "en") is None
    assert await translate("   ", "ko", "en") is None


@pytest.mark.asyncio
async def test_translate_returns_none_for_unsupported_target():
    async def fake_run(prompt, model=None):
        raise AssertionError("미지원 언어면 claude를 부르면 안 된다")

    assert await translate("hello", "en", "xx", runner=fake_run) is None


@pytest.mark.asyncio
async def test_translate_same_lang_returns_input_unchanged():
    async def fake_run(prompt, model=None):
        raise AssertionError("source==target면 claude를 부르면 안 된다")

    assert await translate("그대로", "ko", "ko", runner=fake_run) == "그대로"


@pytest.mark.asyncio
async def test_translate_calls_claude_strips_and_passes_model():
    seen = {}

    async def fake_run(prompt, model=None):
        seen["prompt"] = prompt
        seen["model"] = model
        return '  Hello <a href="u">link</a>  '

    out = await translate('안녕 <a href="u">링크</a>', "ko", "en", runner=fake_run)
    assert out == 'Hello <a href="u">link</a>'  # strip 적용
    assert "Korean" in seen["prompt"] and "English" in seen["prompt"]
    assert '안녕 <a href="u">링크</a>' in seen["prompt"]  # 원문 포함
    assert seen["model"] == config.ANTHROPIC_TRANSLATE_MODEL


@pytest.mark.asyncio
async def test_translate_returns_none_when_runner_returns_empty():
    async def fake_none(prompt, model=None):
        return None

    async def fake_blank(prompt, model=None):
        return "   "

    assert await translate("안녕", "ko", "ja", runner=fake_none) is None
    assert await translate("안녕", "ko", "ja", runner=fake_blank) is None


@pytest.mark.asyncio
async def test_translate_swallows_runner_exception():
    async def fake_boom(prompt, model=None):
        raise RuntimeError("claude 죽음")

    assert await translate("안녕", "ko", "zh", runner=fake_boom) is None


@pytest.mark.asyncio
async def test_translate_ko_delegates_with_ko_source(monkeypatch):
    # translate_ko는 translate(text, "ko", target)로 위임되어야 한다.
    calls = {}

    async def fake_translate(text, source, target):
        calls["args"] = (text, source, target)
        return "OK"

    monkeypatch.setattr("api.translator.translate", fake_translate)
    out = await translate_ko("안녕", "en")
    assert out == "OK"
    assert calls["args"] == ("안녕", "ko", "en")
