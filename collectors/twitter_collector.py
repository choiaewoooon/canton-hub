"""
Twitter/X 데이터 수집 모듈
twscrape를 사용하여 @CantonNetwork, @CantonFdn의 최근 트윗을 수집합니다.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Optional

from twscrape import API, gather
from twscrape.logger import set_log_level

import config

logger = logging.getLogger(__name__)


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
    media_urls: list = field(default_factory=list)


class TwitterCollector:
    """트위터 데이터 수집기"""

    def __init__(self):
        self.api = API()
        self._initialized = False

    async def initialize(self):
        """twscrape 계정 풀 초기화"""
        if self._initialized:
            return

        set_log_level("WARNING")

        # 이미 등록된 계정이 있는지 확인
        accounts = await self.api.pool.accounts_info()
        if accounts:
            logger.info(f"기존 계정 {len(accounts)}개 발견, 재사용합니다.")
            self._initialized = True
            return

        # 쿠키 기반 인증 (더 안정적)
        if config.TWITTER_COOKIES:
            logger.info("쿠키 기반 인증을 시도합니다...")
            await self.api.pool.add_account(
                username=config.TWITTER_USERNAME,
                password=config.TWITTER_PASSWORD,
                email=config.TWITTER_EMAIL,
                email_password=config.TWITTER_EMAIL_PASSWORD,
                cookies=config.TWITTER_COOKIES,
            )
        elif config.TWITTER_USERNAME and config.TWITTER_PASSWORD:
            logger.info("계정/패스워드 인증을 시도합니다...")
            await self.api.pool.add_account(
                username=config.TWITTER_USERNAME,
                password=config.TWITTER_PASSWORD,
                email=config.TWITTER_EMAIL,
                email_password=config.TWITTER_EMAIL_PASSWORD,
            )
            await self.api.pool.login_all()
        else:
            logger.warning("트위터 인증 정보가 없습니다. .env 파일을 확인하세요.")
            return

        self._initialized = True
        logger.info("트위터 인증 완료")

    async def get_user_id(self, username: str) -> Optional[int]:
        """사용자명으로 user_id 조회"""
        try:
            user = await self.api.user_by_login(username)
            if user:
                return user.id
        except Exception as e:
            logger.error(f"유저 ID 조회 실패 (@{username}): {e}")
        return None

    async def collect_recent_tweets(self, username: str) -> list[TweetData]:
        """특정 계정의 최근 트윗 수집 (지난 24시간)"""
        await self.initialize()
        tweets = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.TWEET_HOURS_LOOKBACK)

        try:
            # 방법 1: user_tweets (유저 타임라인)
            user_id = await self.get_user_id(username)
            if user_id is None:
                logger.warning(f"@{username} 유저를 찾을 수 없습니다. search로 폴백합니다.")
                return await self._collect_via_search(username, cutoff)

            raw_tweets = await gather(
                self.api.user_tweets(user_id, limit=config.MAX_TWEETS_PER_ACCOUNT)
            )

            for tw in raw_tweets:
                if tw.date < cutoff:
                    continue

                media_urls = []
                if tw.media and tw.media.photos:
                    media_urls = [p.url for p in tw.media.photos]

                tweet = TweetData(
                    username=username,
                    text=tw.rawContent,
                    created_at=tw.date,
                    url=tw.url,
                    likes=tw.likeCount or 0,
                    retweets=tw.retweetCount or 0,
                    replies=tw.replyCount or 0,
                    media_urls=media_urls,
                )
                tweets.append(tweet)

            logger.info(f"@{username}: {len(tweets)}개 트윗 수집 완료")

        except Exception as e:
            logger.error(f"@{username} 트윗 수집 실패: {e}")
            # search API로 폴백
            try:
                tweets = await self._collect_via_search(username, cutoff)
            except Exception as e2:
                logger.error(f"@{username} search 폴백도 실패: {e2}")

        return tweets

    async def _collect_via_search(self, username: str, cutoff: datetime) -> list[TweetData]:
        """검색 API를 통한 트윗 수집 (폴백)"""
        tweets = []
        query = f"from:{username}"

        try:
            raw_tweets = await gather(
                self.api.search(query, limit=config.MAX_TWEETS_PER_ACCOUNT)
            )

            for tw in raw_tweets:
                if tw.date < cutoff:
                    continue

                tweet = TweetData(
                    username=username,
                    text=tw.rawContent,
                    created_at=tw.date,
                    url=tw.url,
                    likes=tw.likeCount or 0,
                    retweets=tw.retweetCount or 0,
                    replies=tw.replyCount or 0,
                )
                tweets.append(tweet)

            logger.info(f"@{username} (search): {len(tweets)}개 트윗 수집 완료")
        except Exception as e:
            logger.error(f"@{username} search 수집 실패: {e}")

        return tweets

    async def collect_all(self) -> dict[str, list[TweetData]]:
        """모든 대상 계정의 트윗 수집"""
        results = {}
        for account in config.TWITTER_ACCOUNTS:
            tweets = await self.collect_recent_tweets(account)
            results[account] = tweets
            # Rate limit 방지를 위한 짧은 딜레이
            await asyncio.sleep(2)
        return results
