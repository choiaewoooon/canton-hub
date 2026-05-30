# tests/api/test_media.py
import pytest
from collectors.media_collector import parse_entries, dedup_new


_SAMPLE_RSS = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>Google News</title>
<item>
  <title>21Shares launches Canton ETF</title>
  <link>https://example.com/a</link>
  <guid>guid-a</guid>
  <description>&lt;p&gt;21Shares listed TCAN on Nasdaq.&lt;/p&gt;</description>
  <pubDate>Wed, 07 May 2026 13:00:00 GMT</pubDate>
  <source url="https://coindesk.com">CoinDesk</source>
</item>
<item>
  <title>Canton blog post</title>
  <link>https://example.com/b</link>
  <guid>guid-b</guid>
  <description>Privacy by design.</description>
  <pubDate>Tue, 06 May 2026 09:00:00 GMT</pubDate>
</item>
</channel></rss>"""


def test_parse_entries_maps_fields():
    items = parse_entries(_SAMPLE_RSS, "Google News")
    assert len(items) == 2
    a = items[0]
    assert a["url"] == "https://example.com/a"
    assert a["guid"] == "guid-a"
    assert a["title_raw"] == "21Shares launches Canton ETF"
    assert "21Shares listed TCAN" in a["description"]  # HTML 제거됨
    assert "<p>" not in a["description"]
    assert a["ts"].startswith("2026-05-07T13:00:00")
    assert a["publisher"] == "CoinDesk"  # <source> 우선


def test_parse_entries_falls_back_to_feed_name_when_no_source():
    items = parse_entries(_SAMPLE_RSS, "Google News")
    assert items[1]["publisher"] == "Google News"


def test_dedup_new_filters_existing_guids():
    existing = [{"guid": "guid-a"}]
    fetched = [{"guid": "guid-a"}, {"guid": "guid-c"}]
    new = dedup_new(existing, fetched)
    assert [i["guid"] for i in new] == ["guid-c"]
