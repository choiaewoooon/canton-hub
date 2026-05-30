"""
트윗 요약 모듈 (canton-hub backend 버전)

Anthropic Messages API를 직접 호출(httpx)해서 한국어로 요약한다. canton-bot의
원본 버전은 `claude` CLI를 subprocess로 부르는 macOS 전용이라 Linux Fly.io
환경에서는 동작하지 않아서 cloud-native로 다시 작성했다.

동작:
  - ANTHROPIC_API_KEY 환경변수가 있으면 → Anthropic Messages API 호출
  - 없거나 호출 실패 → _fallback_format (트윗 원문 bullet)
"""
import json
import logging
import os
from typing import Any

import httpx

from collectors import TweetData

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# Sonnet 4.6 — 한국어 톤 정확도 좋고 ~월 $0.5 수준 비용. Haiku 4.5로 더 절약 가능.
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1024
TIMEOUT_SECONDS = 30.0


async def summarize_tweets(tweets: dict[str, list[TweetData]], news_lines=None) -> str:
    """수집된 트윗들을 AI로 요약. HTML 태그 포함 (formatter에서 strip).

    news_lines: 최근 Canton 미디어 헤드라인 리스트(선택). 주어지면 요약 소스에 추가해
                모델이 주요 뉴스를 기존 bullet 포맷 안에서 언급할 수 있게 한다.
    """
    total = sum(len(tw_list) for tw_list in tweets.values())
    if total == 0:
        return ""

    all_tweets: list[TweetData] = []
    raw_lines = []
    for account, tw_list in tweets.items():
        for tw in sorted(tw_list, key=lambda t: t.created_at, reverse=True):
            all_tweets.append(tw)
            raw_lines.append(
                f"@{tw.username} ({tw.created_at.strftime('%m/%d %H:%M')}): "
                f"{tw.text} "
                f"[likes:{tw.likes} RT:{tw.retweets} views:{tw.views}]"
            )
    raw_text = "\n".join(raw_lines)
    if news_lines:
        raw_text += "\n\n[최근 Canton 미디어 헤드라인]\n" + "\n".join(news_lines)

    tweet_refs = []
    for i, tw in enumerate(all_tweets):
        tweet_refs.append(f"[{i+1}] @{tw.username}: {tw.text[:100]} → {tw.url}")
    ref_text = "\n".join(tweet_refs)

    prompt = f"""아래는 Canton Network 트위터 계정들의 최근 24시간 트윗이다.

텔레그램 채널 공지에 들어갈 트위터 요약을 작성해라.

톤앤매너 (코블린 @cobling 채널 스타일):
- 반말 + "~됨/~함/~인 듯/~하는 중" 체의 간결한 구어체
- 팩트 나열 위주, 과장이나 실러 톤 없이 건조하게
- 감상은 짧게 1문장 이내, 자조적 유머 OK ("제발ㅋㅋ", "ㅇㄱㅈ" 등)
- 이모지 최소한. 거의 안 씀

포맷 규칙:
- 텔레그램 HTML 태그만 사용 (<b>, <a href="URL">텍스트</a> 만 가능. 마크다운 금지)
- 핵심 3-5개 항목만. 비슷한 내용은 하나로 합쳐라
- 각 항목 앞에 · 사용
- 각 항목 사이에 빈 줄 한 줄을 반드시 넣어 시각적으로 분리 (즉, 항목 구분은 \n\n)
- 각 항목 문장 끝에 해당 트윗 원문 링크를 넣어라. 형식: <a href="트윗URL">원문</a>
- 반응(likes/views) 높은 트윗에 가중치
- 항목별 길이는 자유롭게(빈 줄 포함 8~12줄 가능)
- 앞뒤에 빈 줄이나 제목 붙이지 마라. 요약 본문만 출력해라

트윗 원문 (번호 → URL):
{raw_text}

URL 참조:
{ref_text}"""

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY 미설정 — fallback 포맷으로 대체")
        return _fallback_format(all_tweets)

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            r = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": MAX_TOKENS,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            r.raise_for_status()
            payload: dict[str, Any] = r.json()
            content_blocks = payload.get("content", [])
            if not content_blocks:
                logger.error(f"Anthropic 응답에 content 없음: {payload}")
                return _fallback_format(all_tweets)
            summary = "".join(
                block.get("text", "") for block in content_blocks if block.get("type") == "text"
            ).strip()
            if not summary:
                logger.error("Anthropic 응답 텍스트가 비어있음")
                return _fallback_format(all_tweets)
            usage = payload.get("usage", {})
            logger.info(
                f"트윗 요약 완료 ({len(summary)} chars · "
                f"in={usage.get('input_tokens', 0)} out={usage.get('output_tokens', 0)})"
            )
            return summary
    except httpx.HTTPStatusError as e:
        logger.error(f"Anthropic API HTTP {e.response.status_code}: {e.response.text[:200]}")
        return _fallback_format(all_tweets)
    except Exception as e:
        logger.error(f"트윗 요약 실패: {e}")
        return _fallback_format(all_tweets)


def _fallback_format(all_tweets: list[TweetData]) -> str:
    """API 키가 없거나 호출 실패 시 기본 포맷 — 트윗 원문 5개 bullet."""
    lines = []
    for tw in all_tweets[:5]:
        text = tw.text.replace("<", "&lt;").replace(">", "&gt;")
        if len(text) > 120:
            text = text[:117] + "..."
        lines.append(f"· {text}")
    return "\n\n".join(lines)
