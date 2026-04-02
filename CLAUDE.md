# Canton Telegram Bot

매일 아침 9시(KST)에 Canton Network 일일 리포트를 텔레그램 채널에 자동 포스팅하는 Python 봇.

## 프로젝트 개요

- **언어**: Python 3.11+
- **유형**: 데이터 수집 파이프라인 + 텔레그램 봇
- **스케줄**: APScheduler 기반 cron 스케줄러 (매일 09:00 KST)
- **엔트리포인트**: `bot.py` (스케줄러 모드 또는 `--now` 즉시 실행)

## 아키텍처

```
bot.py (스케줄러 + 오케스트레이터)
  ├── collectors/twitter_collector.py    # RapidAPI Twitter API45로 트윗 수집
  ├── collectors/cantonscan_collector.py # CantonScan 네트워크 지표 수집
  ├── collectors/price_collector.py      # CoinGecko $CC 가격 수집
  ├── formatter.py                       # 수집 데이터 → HTML 텔레그램 메시지
  └── config.py                          # 환경변수 설정
```

## 데이터 흐름

1. `collect_and_post()`: 3개 수집기를 `asyncio.gather`로 병렬 실행
2. 수집된 데이터를 `build_daily_report()`로 HTML 메시지 생성
3. `python-telegram-bot` SDK로 텔레그램 채널에 전송

## 주요 의존성

| 패키지 | 용도 |
|--------|------|
| python-telegram-bot | 텔레그램 메시지 전송 |
| httpx | HTTP 클라이언트 (RapidAPI, CoinGecko, CantonScan) |
| beautifulsoup4 | HTML 파싱 (CantonScan) |
| playwright | 동적 페이지 스크래핑 (CantonScan 폴백) |
| APScheduler | cron 스케줄링 |
| python-dotenv | .env 환경변수 로드 |

## 환경 설정

`.env` 파일 필수. `.env.example` 참조.

- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHANNEL_ID`: 텔레그램 봇 인증
- `RAPIDAPI_KEY`: RapidAPI Twitter API45 인증
- `COINGECKO_API_KEY`: 레이트 리밋 완화용 (선택)

## 코딩 컨벤션

- 비동기 코드는 `async/await` 패턴 사용
- 데이터 모델은 `dataclass`로 정의 (TweetData, CantonScanData, PriceData)
- 로깅은 `logging` 모듈, 로거명은 `__name__` 사용
- HTML 파싱 모드로 텔레그램 메시지 포맷팅
- 수집기는 항상 예외를 내부에서 처리하고 빈 데이터 반환

## 실행 방법

```bash
python bot.py          # 스케줄러 모드 (매일 9시 자동)
python bot.py --now    # 즉시 1회 실행 (테스트)
```

## 주의사항

- `.env` 파일은 절대 커밋하지 않음
- CantonScan은 SPA일 수 있어 API → HTML → Playwright 순서로 폴백
- Twitter 수집은 user_tweets → search API 순서로 폴백
- CoinGecko는 markets → simple/price 순서로 폴백
