"""
Twitter/X 데이터 수집 모듈
RapidAPI Twitter API45를 사용하여 @CantonNetwork, @CantonFdn의 최근 트윗을 수집합니다.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from email.utils import parsedate_to_datetime

import httpx

import config

logger = logging.getLogger(__name__)

RAPIDAPI_HOST = "twitter-api45.p.rapidapi.com"
TIMELINE_URL = f"https://{RAPIDAPI_HOST}/timeline.php"


@dataclass
class TweetData:
    """수집된 트윗 데이터"""
    username: str
    text: str
    created_at: datetime
    url: str
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    views: int = 0
    media_urls: list = field(default_factory=list)


class TwitterCollector:
    """RapidAPI 기반 트위터 수집기"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=15,
            headers={
                "x-rapidapi-host": RAPIDAPI_HOST,
                "x-rapidapi-key": config.RAPIDAPI_KEY,
            },
        )

    async def collect_recent_tweets(self, username: str) -> list[TweetData]:
        """특정 계정의 최근 트윗 수집 (지난 24시간)"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.TWEET_HOURS_LOOKBACK)
        tweets = []

        try:
            resp = await self.client.get(TIMELINE_URL, params={"screenname": username})
            resp.raise_for_status()
            data = resp.json()

            for tw in data.get("timeline", []):
                created_at = parsedate_to_datetime(tw["created_at"])
                if created_at < cutoff:
                    continue

                tweet_id = tw.get("tweet_id", "")
                screen_name = tw.get("author", {}).get("screen_name", username)

                # 미디어 URL 추출
                media_urls = []
                media = tw.get("media", {})
                if isinstance(media, dict):
                    for photo in media.get("photo", []):
                        if url := photo.get("media_url_https"):
                            media_urls.append(url)

                tweets.append(TweetData(
                    username=screen_name,
                    text=tw.get("text", ""),
                    created_at=created_at,
                    url=f"https://x.com/{screen_name}/status/{tweet_id}",
                    likes=tw.get("favorites", 0),
                    retweets=tw.get("retweets", 0),
                    replies=tw.get("replies", 0),
                    views=int(tw.get("views", 0) or 0),
                    media_urls=media_urls,
                ))

            logger.info(f"@{username}: {len(tweets)}개 트윗 수집 완료")

        except Exception as e:
            logger.error(f"@{username} 트윗 수집 실패: {e}")

        return tweets

    async def collect_all(self) -> dict[str, list[TweetData]]:
        """모든 대상 계정의 트윗 수집"""
        if not config.RAPIDAPI_KEY:
            logger.warning("RAPIDAPI_KEY가 설정되지 않았습니다.")
            return {}

        results = {}
        for account in config.TWITTER_ACCOUNTS:
            tweets = await self.collect_recent_tweets(account)
            results[account] = tweets
            await asyncio.sleep(1)  # Rate limit 방지
        return results
