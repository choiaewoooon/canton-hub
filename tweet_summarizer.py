"""
트윗 요약 모듈 (canton-hub backend 버전)

gemq(Gemini) 헤드리스로 한국어 요약을 생성한다. canton-hub가 Fly.io에서 Mac
로컬(launchd)로 옮겨오면서, 토큰 과금되는 Anthropic API 대신 구독으로 도는 gemq를
쓴다(키 불필요·토큰 과금 없음). 같은 Mac의 canton-telegram-bot와 동일 백엔드.

동작:
  - gemq 호출 성공 → 요약 텍스트
  - LLM 부재/실패/빈 응답 → _fallback_format (트윗 원문 bullet)
"""
import logging

from llm_cli import run_llm
from collectors import TweetData

logger = logging.getLogger(__name__)


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

    try:
        summary = await run_llm(prompt)
    except Exception as e:
        logger.error(f"트윗 요약 실패: {e}")
        return _fallback_format(all_tweets)
    if not summary:
        logger.warning("gemq 빈 응답/실패 — fallback 포맷으로 대체")
        return _fallback_format(all_tweets)
    logger.info(f"트윗 요약 완료 ({len(summary)} chars)")
    return summary


def _fallback_format(all_tweets: list[TweetData]) -> str:
    """API 키가 없거나 호출 실패 시 기본 포맷 — 트윗 원문 5개 bullet."""
    lines = []
    for tw in all_tweets[:5]:
        text = tw.text.replace("<", "&lt;").replace(">", "&gt;")
        if len(text) > 120:
            text = text[:117] + "..."
        lines.append(f"· {text}")
    return "\n\n".join(lines)
