# Canton Telegram Bot

매일 아침 9시(KST)에 Canton Network 일일 리포트를 텔레그램 채널에 자동 포스팅하는 봇입니다.

## 수집 데이터

| 소스 | 데이터 |
|------|--------|
| Twitter/X | @CantonNetwork, @CantonFdn 최근 24시간 트윗 |
| CantonScan | Daily Burn/Mint Ratio, 일일 소각량, 네트워크 지표 |
| CoinGecko | $CC 가격, 24h 변동률, 거래량, 시가총액 |

## 빠른 시작

### 1. 사전 준비

- **Python 3.11+** 필요
- **텔레그램 봇 토큰**: [@BotFather](https://t.me/BotFather)에서 봇 생성 후 토큰 발급
- **텔레그램 채널**: 봇을 채널 관리자로 추가 (메시지 발송 권한 필요)
- **RapidAPI 키**: [Twitter API45](https://rapidapi.com/DataFanatic/api/twitter-api45)에서 발급 (트윗 수집에 필요)

### 2. 설치

```bash
cd canton-telegram-bot

# 가상환경 생성 (권장)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# Playwright 브라우저 설치 (CantonScan 스크래핑용)
playwright install chromium
```

### 3. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 편집하여 다음 값을 입력합니다:

```env
# 필수
TELEGRAM_BOT_TOKEN=7123456789:AAH...     # BotFather에서 발급
TELEGRAM_CHANNEL_ID=@my_canton_channel    # 채널 username 또는 chat_id
RAPIDAPI_KEY=your_rapidapi_key            # RapidAPI Twitter API45 키

# 선택
COINGECKO_API_KEY=                        # 레이트 리밋 완화용
```

### 4. 텔레그램 봇 설정

1. 텔레그램에서 [@BotFather](https://t.me/BotFather)에게 `/newbot` 명령
2. 봇 이름과 username 설정
3. 발급받은 토큰을 `.env`의 `TELEGRAM_BOT_TOKEN`에 입력
4. 공지 채널에서 봇을 **관리자**로 추가 (메시지 발송 권한)
5. 채널 ID: `@채널username` 또는 비공개 채널은 `-100` + 숫자 ID

### 5. 실행

```bash
# 테스트 (즉시 1회 실행)
python bot.py --now

# 스케줄러 모드 (매일 9시 자동 실행)
python bot.py
```

## 프로젝트 구조

```
canton-telegram-bot/
├── bot.py                          # 메인 실행 파일 (스케줄러 + 엔트리포인트)
├── config.py                       # 설정 (환경변수 로드)
├── formatter.py                    # 텔레그램 메시지 포매터
├── collectors/
│   ├── __init__.py
│   ├── twitter_collector.py        # Twitter/X 데이터 수집 (RapidAPI)
│   ├── cantonscan_collector.py     # CantonScan 네트워크 지표 수집
│   └── price_collector.py          # CoinGecko $CC 가격 수집
├── requirements.txt
├── .env.example
└── README.md
```

## 백그라운드 실행 (macOS launchd)

현재 `~/Library/LaunchAgents/com.cobling.canton-bot.plist`로 등록되어 있음.

### 상태 확인

```bash
launchctl list | grep cobling
```

- `PID 숫자 0 com.cobling.canton-bot` → 정상 실행 중
- `- 1 com.cobling.canton-bot` → 꺼진 상태 (에러)

### 시작

```bash
launchctl load ~/Library/LaunchAgents/com.cobling.canton-bot.plist
```

### 중지

```bash
launchctl unload ~/Library/LaunchAgents/com.cobling.canton-bot.plist
```

### 재시작

```bash
launchctl unload ~/Library/LaunchAgents/com.cobling.canton-bot.plist
launchctl load ~/Library/LaunchAgents/com.cobling.canton-bot.plist
```

### 로그 확인

```bash
# 실시간 로그
tail -f "/Users/choejaewon/project/Canton telebot(coblin)/launchd_stdout.log"

# 에러 로그
tail -f "/Users/choejaewon/project/Canton telebot(coblin)/launchd_stderr.log"

# bot.py 자체 로그
tail -f "/Users/choejaewon/project/Canton telebot(coblin)/bot.log"
```

### 완전 삭제

```bash
launchctl unload ~/Library/LaunchAgents/com.cobling.canton-bot.plist
rm ~/Library/LaunchAgents/com.cobling.canton-bot.plist
```

### 참고

- 맥 재부팅해도 자동 시작됨 (`RunAtLoad` + `KeepAlive`)
- 크래시 시 자동 재시작됨
- 스케줄 변경은 `.env`의 `SCHEDULE_HOUR` / `SCHEDULE_MINUTE` 수정 후 재시작

## 트러블슈팅

| 문제 | 해결 방법 |
|------|-----------|
| RapidAPI 인증 실패 | RAPIDAPI_KEY가 올바른지, Twitter API45 구독이 활성화되어 있는지 확인 |
| CantonScan 데이터 없음 | 사이트 구조가 변경되었을 수 있음. `cantonscan_collector.py`의 파싱 로직 업데이트 필요 |
| CoinGecko 429 에러 | Rate limit 초과. 무료 Demo API Key 등록 권장 |
| 텔레그램 전송 실패 | 봇이 채널 관리자인지, 메시지 발송 권한이 있는지 확인 |
| launchd 시작 안됨 | `launchd_stderr.log` 확인. venv 경로나 Python 버전 문제일 수 있음 |
