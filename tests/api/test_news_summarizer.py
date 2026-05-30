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


class _FakeResp:
    def __init__(self, payload): self._p = payload
    def raise_for_status(self): pass
    def json(self): return self._p


class _FakeClient:
    def __init__(self, payload): self._p = payload
    async def post(self, *a, **k): return _FakeResp(self._p)


@pytest.mark.asyncio
async def test_summarize_and_classify_parses_anthropic_response():
    payload = {"content": [{"type": "text",
               "text": '{"summary": "21Shares가 ETF를 출시함", "category": "etf_product"}'}]}
    out = await summarize_and_classify("21Shares launches TCAN", "...", client=_FakeClient(payload))
    assert out["category"] == "etf_product"
    assert "ETF" in out["summary_ko"]


@pytest.mark.asyncio
async def test_summarize_and_classify_falls_back_on_error():
    class _BoomClient:
        async def post(self, *a, **k): raise RuntimeError("boom")
    out = await summarize_and_classify("t", "d", client=_BoomClient())
    assert out == {"summary_ko": "", "category": "other"}
