# DATA_GUIDE.md - Canton Telegram Bot

> **Update Trigger**: 데이터 소스 추가/변경, 수집기 로직 수정, 포맷터 함수 변경 시 이 문서를 업데이트할 것.

---

## 1. 데이터 소스 개요

| # | 소스 | 수집기 클래스 | 라이브러리 | 대상 URL / API | 수집 주기 |
|---|------|---------------|-----------|----------------|-----------|
| 1 | Twitter/X | `TwitterCollector` | `twscrape` | @CantonNetwork, @CantonFdn 타임라인 | 매일 09:00 KST, 24h lookback |
| 2 | CantonScan | `CantonScanCollector` | `httpx`, `bs4`, `playwright` | `https://www.cantonscan.com/stats` | 매일 09:00 KST |
| 3 | CoinGecko API | `PriceCollector` | `httpx` | `https://api.coingecko.com/api/v3` | 매일 09:00 KST |

**실행 방식**: `bot.py`에서 3개 수집기를 `asyncio.gather`로 **병렬 실행** 후 `formatter.py`로 텔레그램 메시지 생성.

---

## 2. 데이터 모델

### 2.1 TweetData

> 파일: `collectors/twitter_collector.py`

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `username` | `str` | (필수) | 트윗 작성자 (@CantonNetwork 또는 @CantonFdn) |
| `text` | `str` | (필수) | 트윗 원문 (rawContent) |
| `created_at` | `datetime` | (필수) | 트윗 작성 시각 (UTC) |
| `url` | `str` | (필수) | 트윗 URL |
| `likes` | `int` | `0` | 좋아요 수 |
| `retweets` | `int` | `0` | 리트윗 수 |
| `replies` | `int` | `0` | 답글 수 |
| `media_urls` | `list` | `[]` | 첨부 이미지 URL 목록 (photos만 수집) |

### 2.2 CantonScanData

> 파일: `collectors/cantonscan_collector.py`

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `daily_burn` | `Optional[float]` | `None` | 일일 CC 소각량 |
| `daily_mint` | `Optional[float]` | `None` | 일일 CC 발행량 |
| `burn_mint_ratio` | `Optional[float]` | `None` | Burn/Mint 비율 |
| `total_burned` | `Optional[float]` | `None` | 총 소각량 |
| `total_supply` | `Optional[float]` | `None` | 총 공급량 |
| `daily_transactions` | `Optional[int]` | `None` | 일일 트랜잭션 수 |
| `daily_active_addresses` | `Optional[int]` | `None` | 일일 활성 주소 수 |
| `raw_data` | `dict` | `{}` | 파싱된 원본 데이터 (디버깅용) |
| `fetched` | `bool` | `False` | 데이터 수집 성공 여부 플래그 |

### 2.3 PriceData

> 파일: `collectors/price_collector.py`

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `current_price_usd` | `Optional[float]` | `None` | 현재 USD 가격 |
| `price_change_24h` | `Optional[float]` | `None` | 24시간 가격 변동 (USD) |
| `price_change_percentage_24h` | `Optional[float]` | `None` | 24시간 변동률 (%) |
| `high_24h` | `Optional[float]` | `None` | 24시간 최고가 |
| `low_24h` | `Optional[float]` | `None` | 24시간 최저가 |
| `market_cap` | `Optional[float]` | `None` | 시가총액 |
| `total_volume_24h` | `Optional[float]` | `None` | 24시간 거래량 |
| `circulating_supply` | `Optional[float]` | `None` | 유통량 |
| `fetched` | `bool` | `False` | 데이터 수집 성공 여부 플래그 |

---

## 3. 수집 방식 및 폴백 전략

### 3.1 TwitterCollector

```
수집 흐름:
  1. twscrape 계정 풀 초기화 (쿠키 우선, 계정/패스워드 폴백)
  2. WHEN user_id 조회 성공 → user_tweets API로 타임라인 수집
  3. WHEN user_id 조회 실패 → search API ("from:{username}") 로 폴백
  4. WHEN user_tweets 예외 발생 → search API 로 폴백
  5. 계정 간 2초 딜레이 (rate limit 방지)
```

| 단계 | 메서드 | 조건 |
|------|--------|------|
| Primary | `api.user_tweets(user_id, limit=10)` | `get_user_id()` 성공 시 |
| Fallback | `api.search("from:{username}", limit=10)` | user_id 실패 또는 user_tweets 예외 시 |

**필터 조건**: `tw.date >= (now_utc - 24h)` -- `TWEET_HOURS_LOOKBACK` 설정값 기준.

### 3.2 CantonScanCollector

```
수집 흐름 (3단계 폴백):
  1단계: API 엔드포인트 순차 시도 (JSON 응답 확인)
  2단계: WHEN API 실패 → HTML 직접 파싱 (BeautifulSoup)
  3단계: WHEN HTML 파싱 실패 → Playwright 헤드리스 브라우저
```

| 단계 | 메서드 | 방식 |
|------|--------|------|
| 1. API | `_try_api_endpoints()` | 6개 추정 엔드포인트 순차 GET, JSON content-type 확인 |
| 2. HTML | `_fetch_html()` + `_parse_html()` | stats 페이지 HTML에서 stat-card 패턴 추출, `__NEXT_DATA__` 등 임베디드 JSON 검색 |
| 3. Playwright | `_fetch_with_playwright()` | 브라우저 렌더링, 네트워크 요청 가로채기(API 자동 발견), 실패 시 렌더링된 HTML 파싱 |

**API 엔드포인트 후보** (순차 시도):

```
/api/stats
/api/v1/stats
/api/network-stats
/api/v1/network/stats
/api/chain/stats
/api/dashboard
```

**API 응답 키 매핑**: camelCase/snake_case 양쪽 패턴 자동 검색. 중첩 딕셔너리 1단계까지 탐색.

### 3.3 PriceCollector

```
수집 흐름:
  1. WHEN /coins/markets 호출 성공 → 상세 데이터 반환 (8개 필드 모두)
  2. WHEN /coins/markets 실패 → /simple/price 폴백 (4개 필드만)
```

| 단계 | 엔드포인트 | 반환 필드 |
|------|-----------|----------|
| Primary | `GET /coins/markets?ids=canton&vs_currency=usd` | 전체 8개 필드 |
| Fallback | `GET /simple/price?ids=canton&vs_currencies=usd` | `current_price_usd`, `price_change_percentage_24h`, `market_cap`, `total_volume_24h` |

---

## 4. API 엔드포인트 및 인증

### 4.1 Twitter/X (twscrape)

| 항목 | 값 |
|------|-----|
| 라이브러리 | `twscrape` (비공식 스크래핑) |
| 인증 방식 1 (권장) | 쿠키 기반: `TWITTER_COOKIES` 환경변수 |
| 인증 방식 2 | 계정/패스워드: `TWITTER_USERNAME` + `TWITTER_PASSWORD` + `TWITTER_EMAIL` |
| 대상 계정 | `config.TWITTER_ACCOUNTS` = `["CantonNetwork", "CantonFdn"]` |
| Rate limit 대응 | 계정 간 `asyncio.sleep(2)` |

**환경변수**:

| 변수 | 필수 | 설명 |
|------|------|------|
| `TWITTER_USERNAME` | Yes | twscrape 인증 계정명 |
| `TWITTER_PASSWORD` | Yes | 계정 비밀번호 |
| `TWITTER_EMAIL` | Yes | 계정 이메일 |
| `TWITTER_EMAIL_PASSWORD` | No | IMAP 인증용 이메일 비밀번호 |
| `TWITTER_COOKIES` | No (권장) | 쿠키 문자열 (설정 시 쿠키 인증 우선) |

### 4.2 CantonScan

| 항목 | 값 |
|------|-----|
| Base URL | `https://www.cantonscan.com` |
| Stats URL | `https://www.cantonscan.com/stats` |
| 인증 | 불필요 (public) |
| HTTP Timeout | 30초 |
| User-Agent | Chrome 120 모방 |

### 4.3 CoinGecko

| 항목 | 값 |
|------|-----|
| Base URL | `https://api.coingecko.com/api/v3` |
| Coin ID | `canton` (`COINGECKO_COIN_ID`) |
| 인증 헤더 | `x-cg-demo-api-key` (Demo API Key, 선택) |
| HTTP Timeout | 15초 |

**엔드포인트 상세**:

| 엔드포인트 | 메서드 | 파라미터 |
|-----------|--------|---------|
| `/coins/markets` | GET | `ids=canton`, `vs_currency=usd`, `per_page=1`, `sparkline=false`, `price_change_percentage=24h` |
| `/simple/price` | GET | `ids=canton`, `vs_currencies=usd`, `include_market_cap=true`, `include_24hr_vol=true`, `include_24hr_change=true` |

**환경변수**:

| 변수 | 필수 | 설명 |
|------|------|------|
| `COINGECKO_API_KEY` | No | Demo API Key (rate limit 완화) |

---

## 5. 데이터 포맷팅 규칙

> 파일: `formatter.py`

### 포맷 함수

| 함수 | 입력 | 출력 규칙 | 예시 |
|------|------|----------|------|
| `format_number(n, decimals=2)` | `float \| int \| None` | `None` -> `"N/A"`, 정수 또는 `abs > 100`인 정수형 float -> 콤마 정수, 그 외 -> 소수점 `decimals`자리 콤마 | `1234` -> `"1,234"`, `0.05` -> `"0.05"` |
| `format_usd(n, decimals=4)` | `float \| None` | `None` -> `"N/A"`, `n >= 1` -> `$X.XX` (2자리), `n < 1` -> `$X.XXXX` (decimals자리) | `1.5` -> `"$1.50"`, `0.0034` -> `"$0.0034"` |
| `format_percentage(n)` | `float \| None` | `None` -> `"N/A"`, `n >= 0` -> 초록 원 + `+X.XX%`, `n < 0` -> 빨강 원 + `-X.XX%` | `5.3` -> `"(green) +5.30%"` |
| `format_large_number(n)` | `float \| None` | `None` -> `"N/A"`, `>= 1B` -> `$X.XXB`, `>= 1M` -> `$X.XXM`, `>= 1K` -> `$X.XK`, 그 외 -> `$X.XX` | `2500000` -> `"$2.50M"` |

### 메시지 구조 (build_daily_report)

```
WHEN build_daily_report(tweets, scan_data, price_data) 호출 →
  1. 헤더: 날짜 (KST, "YYYY-MM-DD (요일)")
  2. $CC Price 섹션: WHEN price_data.fetched → 가격/변동률/범위/볼륨/시총
  3. Network Stats 섹션: WHEN scan_data.fetched → burn/mint/ratio/txns/addresses + raw_data 추가항목
  4. Twitter Updates 섹션: 계정별 최신 5개 트윗 (시간순 내림차순, 200자 truncate)
  5. 푸터: CantonScan / CoinGecko / Twitter 링크
```

**텔레그램 파싱 모드**: HTML (`ParseMode.HTML`). 특수문자 `<`, `>` 이스케이프 처리 적용.

---

## 6. 트러블슈팅 가이드

### 6.1 Twitter 수집 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `트위터 인증 정보가 없습니다` | 환경변수 미설정 | `.env`에 `TWITTER_USERNAME`, `TWITTER_PASSWORD`, `TWITTER_EMAIL` 설정 |
| `유저 ID 조회 실패` | 계정 suspended/변경 또는 인증 만료 | 쿠키 갱신 (`TWITTER_COOKIES`), 또는 계정 재로그인 |
| `search 폴백도 실패` | twscrape rate limit 또는 IP 차단 | 계정 쿠키 갱신, IP 변경 검토, twscrape DB(`accounts.db`) 삭제 후 재인증 |
| 수집 트윗 0개 | 24시간 내 트윗 없음 또는 cutoff 로직 문제 | `TWEET_HOURS_LOOKBACK` 값 확인, 대상 계정 트윗 여부 확인 |

**쿠키 갱신 절차**:
```
1. 브라우저에서 twitter.com 로그인
2. DevTools > Application > Cookies 에서 쿠키 값 복사
3. .env의 TWITTER_COOKIES 업데이트
4. twscrape DB 초기화가 필요하면 accounts.db 삭제
```

### 6.2 CantonScan 수집 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `API/HTML 실패, Playwright로 시도` | API 엔드포인트 미발견 + HTML 구조 매칭 실패 | 정상 동작 (Playwright 폴백 진행) |
| `사이트 구조가 변경되었을 수 있습니다` | 3단계 모두 실패 | cantonscan.com/stats 수동 확인, `_parse_html()` CSS 셀렉터 업데이트, API 엔드포인트 목록 갱신 |
| `Playwright가 설치되지 않았습니다` | playwright 미설치 | `pip install playwright && playwright install chromium` |
| Playwright timeout | 사이트 응답 지연 | `_fetch_with_playwright()`의 `timeout=30000` 값 조정 |

**사이트 구조 변경 대응 절차**:
```
1. 브라우저에서 https://www.cantonscan.com/stats 접속
2. DevTools > Network 탭에서 XHR/Fetch 요청 확인 → 새 API 엔드포인트 발견 시 API_ENDPOINTS에 추가
3. Elements 탭에서 stat-card 클래스명 확인 → _parse_html()의 regex 패턴 업데이트
4. 변경 후 `python bot.py --now`로 테스트
```

### 6.3 CoinGecko 가격 수집 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `markets API 실패` + `simple price API도 실패` | rate limit (무료: 10-30 req/min) | `COINGECKO_API_KEY` 설정 (Demo key 발급: coingecko.com/en/api) |
| `토큰을 찾을 수 없습니다` | Coin ID 불일치 | CoinGecko에서 정확한 coin ID 확인, `COINGECKO_COIN_ID` 수정 |
| HTTP 429 | rate limit 초과 | 요청 간격 늘리기 또는 Pro API key 사용 |
| HTTP 5xx | CoinGecko 서버 장애 | 일시적, 재시도 시 복구됨. 지속 시 status.coingecko.com 확인 |

### 6.4 텔레그램 전송 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN 미설정` | 환경변수 누락 | `.env`에 `TELEGRAM_BOT_TOKEN` 설정. 미설정 시 콘솔 미리보기 모드로 동작 |
| `TELEGRAM_CHANNEL_ID 미설정` | 환경변수 누락 | `.env`에 채널 ID 설정 (`@채널명` 또는 `-100xxxx` 형식) |
| 메시지 전송 실패 | 봇이 채널에 추가되지 않음 | 채널 설정에서 봇을 관리자로 추가 |

---

## 7. 설정 상수 참조

> 파일: `config.py`

| 상수 | 값 | 설명 |
|------|-----|------|
| `TWITTER_ACCOUNTS` | `["CantonNetwork", "CantonFdn"]` | 모니터링 대상 계정 |
| `MAX_TWEETS_PER_ACCOUNT` | `10` | 계정당 최대 수집 트윗 수 |
| `TWEET_HOURS_LOOKBACK` | `24` | 수집 범위 (시간) |
| `COINGECKO_COIN_ID` | `"canton"` | CoinGecko 토큰 ID |
| `COINGECKO_API_URL` | `https://api.coingecko.com/api/v3` | CoinGecko API base URL |
| `CANTONSCAN_BASE_URL` | `https://www.cantonscan.com` | CantonScan base URL |
| `CANTONSCAN_STATS_URL` | `https://www.cantonscan.com/stats` | CantonScan 통계 페이지 |
| `SCHEDULE_HOUR` | `9` | 실행 시각 (시, KST) |
| `SCHEDULE_MINUTE` | `0` | 실행 시각 (분) |
| `TIMEZONE` | `Asia/Seoul` | 타임존 |

---

## Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-03-31 | 초기 생성 | docs-init으로 자동 생성 |
