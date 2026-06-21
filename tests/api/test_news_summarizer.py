# tests/api/test_news_summarizer.py
import pytest
from news_summarizer import _parse_classification, summarize_and_classify, CATEGORY_KEYS


def test_parse_valid_json():
    out = _parse_classification('{"summary": "파트너십 체결됨", "category": "partnership"}')
    assert out == {"summary_ko": "파트너십 체결됨", "category": "partnership"}


def test_parse_fenced_json():
    # 모델이 ```json ... ``` 펜스로 감싸 반환해도 파싱돼야 한다.
    raw = '```json\n{"summary": "파트너십 체결됨", "category": "partnership"}\n```'
    out = _parse_classification(raw)
    assert out == {"summary_ko": "파트너십 체결됨", "category": "partnership"}


def test_parse_unknown_category_falls_back_to_other():
    out = _parse_classification('{"summary": "x", "category": "banana"}')
    assert out["category"] == "other"


def test_parse_malformed_json_falls_back():
    out = _parse_classification("not json at all")
    assert out == {"summary_ko": "", "category": "other"}


def test_category_keys_cover_taxonomy():
    for k in ("partnership", "validator", "etf_product", "institutional",
              "dat_vehicle", "tokenomics", "funding", "network_metric", "other"):
        assert k in CATEGORY_KEYS


@pytest.mark.asyncio
async def test_summarize_and_classify_parses_cli_response():
    async def fake_runner(prompt):
        return '{"summary": "21Shares가 ETF를 출시함", "category": "etf_product"}'
    out = await summarize_and_classify("21Shares launches TCAN", "...", runner=fake_runner)
    assert out["category"] == "etf_product"
    assert "ETF" in out["summary_ko"]


@pytest.mark.asyncio
async def test_summarize_and_classify_falls_back_on_error():
    async def boom(prompt):
        raise RuntimeError("boom")
    out = await summarize_and_classify("t", "d", runner=boom)
    assert out == {"summary_ko": "", "category": "other"}


@pytest.mark.asyncio
async def test_summarize_and_classify_falls_back_on_empty():
    async def empty(prompt):
        return None
    out = await summarize_and_classify("t", "d", runner=empty)
    assert out == {"summary_ko": "", "category": "other"}


def test_extract_category_plain():
    from news_summarizer import _extract_category
    assert _extract_category("partnership") == "partnership"


def test_extract_category_fenced_or_noisy():
    from news_summarizer import _extract_category
    assert _extract_category("```\netf_product\n```") == "etf_product"
    assert _extract_category("Category: tokenomics.") == "tokenomics"


def test_extract_category_unknown_falls_back():
    from news_summarizer import _extract_category
    assert _extract_category("i have no idea") == "other"


@pytest.mark.asyncio
async def test_classify_text_parses_response():
    from news_summarizer import classify_text

    async def fake_runner(prompt):
        return "validator"

    assert await classify_text("Global Settlement Network joins as a validator", runner=fake_runner) == "validator"


@pytest.mark.asyncio
async def test_classify_text_falls_back_on_error():
    from news_summarizer import classify_text

    async def boom(prompt):
        raise RuntimeError("boom")

    assert await classify_text("anything", runner=boom) == "other"


@pytest.mark.asyncio
async def test_classify_text_falls_back_on_empty():
    from news_summarizer import classify_text

    async def empty(prompt):
        return None

    assert await classify_text("anything", runner=empty) == "other"
