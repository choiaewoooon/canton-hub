"""
Canton Telegram Bot - 메인 실행 파일
매일 아침 9시(KST)에 Canton 네트워크 일일 리포트를 텔레그램 채널에 포스팅합니다.

사용법:
  python bot.py          # 스케줄러 모드 (매일 9시 자동 실행)
  python bot.py --now    # 즉시 1회 실행 (테스트용)
"""
import asyncio
import argparse
import logging
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from telegram import Bot
from telegram.constants import ParseMode

import config
from collectors import TwitterCollector, CantonScanCollector, PriceCollector
from formatter import build_daily_report

# ── 로깅 설정 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bot.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("canton_bot")


async def collect_and_post():
    """데이터 수집 후 텔레그램 포스팅"""
    kst = ZoneInfo(config.TIMEZONE)
    logger.info(f"=== 일일 리포트 시작 ({datetime.now(kst).strftime('%Y-%m-%d %H:%M')}) ===")

    # ── 수집기 초기화 ──
    twitter = TwitterCollector()
    cantonscan = CantonScanCollector()
    price = PriceCollector()

    try:
        # ── 데이터 수집 (병렬) ──
        logger.info("데이터 수집 시작...")

        # 트위터는 30초 타임아웃 (twscrape가 멈출 수 있음)
        async def collect_tweets_with_timeout():
            try:
                return await asyncio.wait_for(twitter.collect_all(), timeout=30)
            except asyncio.TimeoutError:
                logger.warning("트위터 수집 타임아웃 (30초). 스킵합니다.")
                return {}

        tweets, scan_data, price_data = await asyncio.gather(
            collect_tweets_with_timeout(),
            cantonscan.collect(),
            price.collect(),
            return_exceptions=True,
        )

        # 예외 처리
        if isinstance(tweets, Exception):
            logger.error(f"트위터 수집 오류: {tweets}")
            tweets = {}
        if isinstance(scan_data, Exception):
            logger.error(f"CantonScan 수집 오류: {scan_data}")
            from collectors import CantonScanData
            scan_data = CantonScanData()
        if isinstance(price_data, Exception):
            logger.error(f"가격 수집 오류: {price_data}")
            from collectors import PriceData
            price_data = PriceData()

        # ── 메시지 생성 ──
        message = build_daily_report(tweets, scan_data, price_data)
        logger.info(f"메시지 생성 완료 ({len(message)} chars)")

        # ── 텔레그램 전송 ──
        if not config.TELEGRAM_BOT_TOKEN:
            logger.error("TELEGRAM_BOT_TOKEN이 설정되지 않았습니다!")
            logger.info("--- 미리보기 ---")
            # HTML 태그 제거한 미리보기
            import re
            preview = re.sub(r"<[^>]+>", "", message)
            print(preview)
            return

        bot = Bot(token=config.TELEGRAM_BOT_TOKEN)

        if not config.TELEGRAM_CHANNEL_ID:
            logger.error("TELEGRAM_CHANNEL_ID가 설정되지 않았습니다!")
            return

        await bot.send_message(
            chat_id=config.TELEGRAM_CHANNEL_ID,
            text=message,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )

        logger.info(f"텔레그램 전송 완료 -> {config.TELEGRAM_CHANNEL_ID}")

    except Exception as e:
        logger.error(f"리포트 처리 중 오류: {e}", exc_info=True)

    finally:
        await cantonscan.close()
        await price.close()

    logger.info("=== 일일 리포트 완료 ===")


def run_scheduler():
    """APScheduler로 매일 지정 시간에 실행"""
    kst = ZoneInfo(config.TIMEZONE)

    scheduler = AsyncIOScheduler(timezone=kst)
    scheduler.add_job(
        collect_and_post,
        trigger="cron",
        hour=config.SCHEDULE_HOUR,
        minute=config.SCHEDULE_MINUTE,
        id="daily_canton_report",
        name="Canton Daily Report",
        misfire_grace_time=3600,  # 최대 1시간 지연 허용
    )

    scheduler.start()
    logger.info(
        f"스케줄러 시작: 매일 {config.SCHEDULE_HOUR:02d}:{config.SCHEDULE_MINUTE:02d} KST 실행"
    )

    # 이벤트 루프 유지
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_forever()
    except (KeyboardInterrupt, SystemExit):
        logger.info("봇 종료")
        scheduler.shutdown()


def main():
    parser = argparse.ArgumentParser(description="Canton Telegram Bot")
    parser.add_argument("--now", action="store_true", help="즉시 1회 실행 (테스트용)")
    args = parser.parse_args()

    # 설정 검증
    warnings = []
    if not config.TELEGRAM_BOT_TOKEN:
        warnings.append("TELEGRAM_BOT_TOKEN 미설정 (미리보기 모드로 동작)")
    if not config.TELEGRAM_CHANNEL_ID:
        warnings.append("TELEGRAM_CHANNEL_ID 미설정")
    if not config.TWITTER_USERNAME:
        warnings.append("Twitter 인증 정보 미설정 (트윗 수집 불가)")

    for w in warnings:
        logger.warning(f"[설정] {w}")

    if args.now:
        logger.info("즉시 실행 모드")
        asyncio.run(collect_and_post())
    else:
        run_scheduler()


if __name__ == "__main__":
    main()
