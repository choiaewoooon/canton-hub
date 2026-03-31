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
- **Twitter/X 계정**: twscrape 인증용 (트윗 수집에 필요)

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

# Twitter (트윗 수집에 필요)
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your@email.com
TWITTER_EMAIL_PASSWORD=email_password
```

### 4. 텔레그램 봇 설정

1. 텔레그램에서 [@BotFather](https://t.me/BotFather)에게 `/newbot` 명령
2. 봇 이름과 username 설정
3. 발급받은 토큰을 `.env`의 `TELEGRAM_BOT_TOKEN`에 입력
4. 공지 채널에서 봇을 **관리자**로 추가 (메시지 발송 권한)
5. 채널 ID: `@채널username` 또는 비공개 채널은 `-100` + 숫자 ID

### 5. Twitter 쿠키 설정 (선택, 더 안정적)

계정/패스워드 대신 쿠키로 인증하면 더 안정적입니다:

1. 브라우저에서 twitter.com 로그인
2. 개발자 도구(F12) > Application > Cookies
3. `auth_token`, `ct0` 값을 복사
4. `.env`에 `TWITTER_COOKIES='auth_token=xxx; ct0=yyy'` 형태로 입력

### 6. 실행

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
│   ├── twitter_collector.py        # Twitter/X 데이터 수집 (twscrape)
│   ├── cantonscan_collector.py     # CantonScan 네트워크 지표 수집
│   └── price_collector.py          # CoinGecko $CC 가격 수집
├── requirements.txt
├── .env.example
└── README.md
```

## 서비스로 등록 (백그라운드 실행)

### systemd (Linux)

```bash
sudo tee /etc/systemd/system/canton-bot.service << 'EOF'
[Unit]
Description=Canton Telegram Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/canton-telegram-bot
ExecStart=/path/to/canton-telegram-bot/venv/bin/python bot.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable canton-bot
sudo systemctl start canton-bot
```

### macOS (launchd)

```bash
cat > ~/Library/LaunchAgents/com.canton.bot.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.canton.bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/canton-telegram-bot/venv/bin/python</string>
        <string>/path/to/canton-telegram-bot/bot.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/path/to/canton-telegram-bot</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.canton.bot.plist
```

## 트러블슈팅

| 문제 | 해결 방법 |
|------|-----------|
| twscrape 인증 실패 | 쿠키 기반 인증으로 전환. Twitter 계정이 잠겨있지 않은지 확인 |
| CantonScan 데이터 없음 | 사이트 구조가 변경되었을 수 있음. `cantonscan_collector.py`의 파싱 로직 업데이트 필요 |
| CoinGecko 429 에러 | Rate limit 초과. 무료 Demo API Key 등록 권장 |
| 텔레그램 전송 실패 | 봇이 채널 관리자인지, 메시지 발송 권한이 있는지 확인 |

## 메시지 예시

```
📢 Canton Daily Update
2026-03-31 (Mon)

💰 $CC Price
  Price: $0.4523
  24h Change: 🟢 +3.45%
  24h Range: $0.4312 ~ $0.4601
  24h Volume: $12.5M
  Market Cap: $6.02B

📊 Network Stats (CantonScan)
  Daily Burn: 1,234,567 CC
  Daily Mint: 987,654 CC
  Burn/Mint Ratio: 1.25x

🐦 Twitter Updates

  @CantonNetwork (2 tweets)
  [09:15] New partnership announcement with...
  💬 12 | 🔄 45 | ❤️ 189
  View Tweet

────────────────────────────
CantonScan | CoinGecko | Twitter
```
