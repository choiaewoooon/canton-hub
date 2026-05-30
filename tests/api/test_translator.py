# tests/api/test_translator.py
import pytest
import config
from api.translator import translate, translate_ko


@pytest.mark.asyncio
async def test_translate_returns_none_without_key(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "")
    assert await translate("hello", "en", "ko") is None


@pytest.mark.asyncio
async def test_translate_returns_none_for_unsupported_target(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "dummy-key")
    assert await translate("hello", "en", "xx") is None


@pytest.mark.asyncio
async def test_translate_returns_none_for_empty_text(monkeypatch):
    monkeypatch.setattr(config, "DEEPL_API_KEY", "dummy-key")
    assert await translate("", "en", "ko") is None


@pytest.mark.asyncio
async def test_translate_ko_still_works_as_wrapper(monkeypatch):
    # translate_ko는 translate(text, "ko", target)로 위임되어야 한다.
    calls = {}

    async def fake_translate(text, source, target):
        calls["args"] = (text, source, target)
        return "OK"

    monkeypatch.setattr("api.translator.translate", fake_translate)
    out = await translate_ko("안녕", "en")
    assert out == "OK"
    assert calls["args"] == ("안녕", "ko", "en")
