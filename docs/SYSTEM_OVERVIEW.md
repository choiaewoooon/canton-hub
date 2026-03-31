# System Overview - Canton Telegram Bot

> **Update Trigger**: 외부 서비스 추가/제거, 수집기 신규 구현, 배포 방식 변경 시 이 문서를 갱신할 것.

## 1. 시스템 목적

| 항목 | 설명 |
|------|------|
| 프로젝트명 | Canton Telegram Bot |
| 핵심 기능 | Canton Network 생태계 일일 리포트 자동 생성 및 텔레그램 채널 포스팅 |
| 실행 주기 | 매일 09:00 KST (APScheduler cron) |
| 대상 사용자 | Canton Network 커뮤니티 텔레그램 채널 구독자 |
| 수집 데이터 | Twitter 트윗, CantonScan 네트워크 지표, CoinGecko $CC 가격 |

### 비즈니스 컨텍스트

Canton Network 생태계의 주요 지표(토큰 소각/발행, 트랜잭션, 가격 변동)와 공식 트위터 소식을 하나의 텔레그램 메시지로 집약하여, 커뮤니티 구성원이 매일 아침 한눈에 현황을 파악할 수 있도록 한다.

## 2. 기술 스택

| 카테고리 | 기술 | 버전 | 용도 |
|----------|------|------|------|
| Runtime | Python | 3.11+ | 메인 실행 환경 |
| Telegram SDK | python-telegram-bot | >=21.0 | 텔레그램 메시지 전송 |
| Twitter 스크래핑 | twscrape | >=0.12 | @CantonNetwork, @CantonFdn 트윗 수집 |
| HTTP 클라이언트 | httpx | >=0.25 | CoinGecko API, CantonScan HTTP 요청 |
| HTML 파싱 | beautifulsoup4 | >=4.12 | CantonScan HTML 파싱 |
| 브라우저 자동화 | playwright | >=1.40 | CantonScan SPA 렌더링 폴백 |
| 스케줄러 | APScheduler | >=3.10 | cron 기반 일일 실행 |
| 환경변수 | python-dotenv | >=1.0 | .env 파일 로드 |

## 3. 아키텍처

### 프로세스 흐름

```
[APScheduler cron 09:00 KST]
        |
        v
  collect_and_post()
        |
        +---> asyncio.gather (병렬 수집)
        |       |
        |       +---> TwitterCollector.collect_all()
        |       |       - twscrape user_tweets API
        |       |       - 실패 시 search API 폴백
        |       |
        |       +---> CantonScanCollector.collect()
        |       |       - 1단계: API 엔드포인트 시도
        |       |       - 2단계: HTML 직접 파싱
        |       |       - 3단계: Playwright 렌더링
        |       |
        |       +---> PriceCollector.collect()
        |               - 1순위: /coins/markets (상세)
        |               - 2순위: /simple/price (폴백)
        |
        v
  build_daily_report()   # HTML 포맷 메시지 생성
        |
        v
  Bot.send_message()     # 텔레그램 채널 전송
```

### 디렉토리 구조

```
canton-telegram-bot/
  bot.py                        # 메인 엔트리포인트 (스케줄러 + collect_and_post)
  config.py                     # 환경변수 로드 및 상수 정의
  formatter.py                  # 텔레그램 메시지 HTML 포매터
  requirements.txt              # Python 의존성
  .env.example                  # 환경변수 템플릿
  collectors/
    __init__.py                 # 수집기 모듈 export
    twitter_collector.py        # Twitter/X 트윗 수집
    cantonscan_collector.py     # CantonScan 네트워크 지표 수집
    price_collector.py          # CoinGecko $CC 가격 수집
  docs/
    SYSTEM_OVERVIEW.md          # 이 문서
```

### 런타임 특성

| 항목 | 값 |
|------|-----|
| 프로세스 모델 | 단일 프로세스, asyncio 이벤트 루프 |
| 상태 관리 | Stateless (외부 DB 없음, 매 실행마다 독립적 수집) |
| 실행 모드 | `python bot.py` (스케줄러) / `python bot.py --now` (즉시 1회) |
| misfire_grace_time | 3600초 (스케줄 1시간 지연까지 허용) |

## 4. 외부 서비스 의존성

| 서비스 | URL/엔드포인트 | 용도 | 인증 방식 | 실패 시 동작 |
|--------|---------------|------|----------|-------------|
| Telegram Bot API | Bot API (python-telegram-bot SDK) | 메시지 전송 | `TELEGRAM_BOT_TOKEN` | 전송 실패, 로그 에러 |
| Twitter/X | twscrape 라이브러리 경유 | @CantonNetwork, @CantonFdn 트윗 | 계정/비밀번호 또는 쿠키 | 빈 트윗 목록(`{}`)으로 대체 |
| CantonScan | `https://www.cantonscan.com/stats` | burn/mint/transactions 지표 | 없음 (공개 페이지) | 빈 CantonScanData로 대체 |
| CoinGecko API | `https://api.coingecko.com/api/v3` | $CC 가격/시가총액/거래량 | API Key (선택, 레이트리밋 완화) | 빈 PriceData로 대체 |

### 수집 대상 트위터 계정

```python
TWITTER_ACCOUNTS = ["CantonNetwork", "CantonFdn"]
```

### CoinGecko 엔드포인트

| 우선순위 | 엔드포인트 | 데이터 |
|----------|-----------|--------|
| 1 | `/coins/markets?ids=canton&vs_currency=usd` | 가격, 24h 변동, 고가/저가, 시총, 거래량 |
| 2 | `/simple/price?ids=canton&vs_currencies=usd` | 가격, 24h 변동 (폴백) |

## 5. 운영 특성

### 스케줄링

| 설정 | 기본값 | 환경변수 |
|------|--------|----------|
| 실행 시각 | 09:00 | `SCHEDULE_HOUR`, `SCHEDULE_MINUTE` |
| 타임존 | Asia/Seoul | `TIMEZONE` |
| misfire 허용 | 1시간 | 코드 하드코딩 (3600초) |

### 에러 처리 전략

```
WHEN 개별 수집기(Twitter/CantonScan/Price)가 예외 발생
  -> DO 해당 수집기 결과를 빈 기본값으로 대체
  -> DO 나머지 수집기 데이터로 리포트 생성 계속

WHEN CantonScan API 엔드포인트 실패
  -> DO HTML 직접 파싱 시도
  -> WHEN HTML 파싱도 실패 -> DO Playwright 헤드리스 브라우저 폴백

WHEN Twitter user_tweets API 실패
  -> DO search API로 폴백

WHEN CoinGecko /coins/markets 실패
  -> DO /simple/price 폴백

WHEN TELEGRAM_BOT_TOKEN 미설정
  -> DO stdout에 미리보기 출력 (HTML 태그 제거)

WHEN TELEGRAM_CHANNEL_ID 미설정
  -> DO 전송 건너뛰기, 에러 로그
```

### 로깅

| 출력 대상 | 형식 |
|----------|------|
| stdout | `%(asctime)s [%(levelname)s] %(name)s: %(message)s` |
| bot.log 파일 | 동일 (UTF-8 인코딩) |

로그 레벨: `INFO` (기본)

주요 로그 포인트:
- 리포트 시작/완료 마커: `=== 일일 리포트 시작/완료 ===`
- 각 수집기 성공/실패
- 메시지 길이 (chars)
- 텔레그램 전송 결과

## 6. 보안 고려사항

### 인증 정보 관리

| 시크릿 | 환경변수 | 필수 여부 |
|--------|----------|----------|
| Telegram Bot Token | `TELEGRAM_BOT_TOKEN` | 필수 (없으면 미리보기 모드) |
| Telegram Channel ID | `TELEGRAM_CHANNEL_ID` | 필수 (없으면 전송 불가) |
| Twitter 계정 | `TWITTER_USERNAME`, `TWITTER_PASSWORD` | 트윗 수집에 필수 |
| Twitter 이메일 | `TWITTER_EMAIL`, `TWITTER_EMAIL_PASSWORD` | twscrape IMAP 인증용 |
| Twitter 쿠키 | `TWITTER_COOKIES` | 선택 (계정/비번 대신 사용 가능) |
| CoinGecko API Key | `COINGECKO_API_KEY` | 선택 (레이트리밋 완화) |

### 보안 규칙

```
WHEN .env 파일 작성 -> DO .gitignore에 반드시 포함 확인
WHEN Twitter 인증 -> DO 쿠키 기반 인증 우선 사용 (계정 잠금 리스크 감소)
WHEN 로그 출력 -> DO 토큰/비밀번호 값 직접 출력 금지
```

### 주의사항

- `.env.example`은 플레이스홀더만 포함, 실제 값 없음
- twscrape는 Twitter 계정 풀을 로컬 SQLite DB(`accounts.db`)에 저장 -- 이 파일도 `.gitignore` 대상
- Playwright는 Chromium 바이너리를 로컬에 설치하므로 배포 환경에서 `playwright install chromium` 필요

## 7. 확장 가능성

### 새 수집기 추가

```
WHEN 새 데이터 소스 추가 필요
  -> DO collectors/ 디렉토리에 새 모듈 생성
  -> DO dataclass 정의 (fetched: bool 필드 포함)
  -> DO collectors/__init__.py에 export 추가
  -> DO bot.py의 collect_and_post()에 asyncio.gather 태스크 추가
  -> DO formatter.py의 build_daily_report()에 섹션 추가
```

### 확장 후보

| 확장 | 변경 범위 | 난이도 |
|------|----------|--------|
| 새 수집기 (예: Discord, Medium) | collectors/ 신규 모듈 + formatter 섹션 | 낮음 |
| 다중 채널 포스팅 | bot.py에 채널 ID 목록 반복 전송 | 낮음 |
| 알림 빈도 변경 (12시간마다 등) | config.py 스케줄 설정 + scheduler.add_job 추가 | 낮음 |
| 특정 이벤트 즉시 알림 (가격 급변 등) | 별도 모니터링 루프 필요 | 중간 |
| 다국어 리포트 | formatter.py 분기 또는 템플릿 시스템 | 중간 |
| 데이터 히스토리 저장 | DB(SQLite/PostgreSQL) 도입, 추세 분석 | 높음 |
| 웹 대시보드 | 별도 FastAPI/Flask 서비스 추가 | 높음 |

## 8. 데이터 모델

### 수집기 출력 데이터 구조

```python
# Twitter
@dataclass
class TweetData:
    username: str
    text: str
    created_at: datetime
    url: str
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    media_urls: list = field(default_factory=list)

# CantonScan
@dataclass
class CantonScanData:
    daily_burn: Optional[float] = None
    daily_mint: Optional[float] = None
    burn_mint_ratio: Optional[float] = None
    total_burned: Optional[float] = None
    total_supply: Optional[float] = None
    daily_transactions: Optional[int] = None
    daily_active_addresses: Optional[int] = None
    raw_data: dict = field(default_factory=dict)
    fetched: bool = False

# Price
@dataclass
class PriceData:
    current_price_usd: Optional[float] = None
    price_change_24h: Optional[float] = None
    price_change_percentage_24h: Optional[float] = None
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    market_cap: Optional[float] = None
    total_volume_24h: Optional[float] = None
    circulating_supply: Optional[float] = None
    fetched: bool = False
```

## 9. 검증 게이트

| 검증 항목 | 명령어 | 기대 결과 |
|----------|--------|----------|
| 의존성 설치 확인 | `pip install -r requirements.txt` | 에러 없이 완료 |
| 설정 검증 | `python -c "import config; print(config.TELEGRAM_BOT_TOKEN[:5] if config.TELEGRAM_BOT_TOKEN else 'NOT SET')"` | 토큰 앞 5자 또는 NOT SET |
| 즉시 실행 테스트 | `python bot.py --now` | 리포트 생성 (토큰 없으면 미리보기) |
| Playwright 설치 확인 | `python -c "from playwright.sync_api import sync_playwright; print('OK')"` | OK |

## Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-03-31 | 초기 생성 | docs-init으로 자동 생성 |
