# Development Guide - Canton Telegram Bot

> **Update Trigger**: 이 문서는 다음 변경 시 업데이트 필요
> - `requirements.txt` 변경
> - `.env.example` 환경변수 추가/삭제
> - `collectors/` 하위 모듈 추가/삭제
> - `formatter.py` 메시지 구조 변경
> - 배포 구성(systemd/launchd) 변경

---

## 1. 개발 환경 설정

### 필수 요구사항

| 항목 | 버전 | 비고 |
|------|------|------|
| Python | 3.11+ | `zoneinfo`, 최신 type hints 사용 |
| pip | 최신 | `python -m pip install --upgrade pip` |
| Chromium (Playwright) | 최신 | CantonScan SPA 렌더링용 |

### 초기 설정 절차

```bash
# 1. 저장소 클론
git clone <REPO_URL>
cd canton-telegram-bot

# 2. 가상환경 생성 및 활성화
python3.11 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

# 3. 의존성 설치
pip install -r requirements.txt

# 4. Playwright 브라우저 설치 (Chromium)
playwright install chromium

# 5. 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 값 입력 (아래 '환경변수 설정 가이드' 참조)
```

### 검증 명령

```bash
# Python 버전 확인 (3.11 이상)
python --version

# 의존성 설치 확인
python -c "import telegram; import twscrape; import httpx; import apscheduler; print('OK')"

# Playwright 브라우저 확인
python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"
```

---

## 2. 환경변수 설정 가이드

`.env.example`을 `.env`로 복사한 후 아래 테이블을 참고하여 값을 설정합니다.

### 환경변수 목록

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| `TELEGRAM_BOT_TOKEN` | Yes | `""` | BotFather에서 발급받은 봇 토큰 |
| `TELEGRAM_CHANNEL_ID` | Yes | `""` | 대상 채널 ID (`@channel_name` 또는 `-100xxxx`) |
| `TWITTER_USERNAME` | Yes | `""` | twscrape 인증용 Twitter 계정명 |
| `TWITTER_PASSWORD` | Yes | `""` | Twitter 계정 비밀번호 |
| `TWITTER_EMAIL` | Yes | `""` | Twitter 계정에 연결된 이메일 |
| `TWITTER_EMAIL_PASSWORD` | Yes | `""` | 이메일 비밀번호 (IMAP 인증) |
| `TWITTER_COOKIES` | No | `""` | 쿠키 기반 인증 (계정/패스워드보다 안정적) |
| `COINGECKO_API_KEY` | No | `""` | CoinGecko Demo API Key (레이트 리밋 완화) |
| `SCHEDULE_HOUR` | No | `9` | 스케줄 실행 시각 (시, 0-23) |
| `SCHEDULE_MINUTE` | No | `0` | 스케줄 실행 시각 (분, 0-59) |
| `TIMEZONE` | No | `Asia/Seoul` | 스케줄 기준 타임존 |

### Twitter 인증 방법 선택

```
WHEN TWITTER_COOKIES가 설정됨 -> 쿠키 기반 인증 사용 (권장)
WHEN TWITTER_USERNAME + TWITTER_PASSWORD만 설정됨 -> 계정/패스워드 로그인
WHEN 인증 정보 없음 -> 트윗 수집 건너뜀, 가격/네트워크 데이터만 포스팅
```

### 미설정 시 동작

| 조건 | 동작 |
|------|------|
| `TELEGRAM_BOT_TOKEN` 없음 | 미리보기 모드 (콘솔에 메시지 출력, 전송 안 함) |
| `TELEGRAM_CHANNEL_ID` 없음 | 수집은 하지만 전송 실패 |
| Twitter 인증 없음 | 트윗 섹션 비어있음 ("No new tweets in the last 24h") |
| `COINGECKO_API_KEY` 없음 | 정상 동작 (레이트 리밋에 더 빨리 도달할 수 있음) |

---

## 3. 로컬 실행 및 테스트

### 실행 모드

| 명령 | 모드 | 설명 |
|------|------|------|
| `python bot.py --now` | 즉시 실행 | 1회 수집 + 포스팅 후 종료. **테스트에 사용** |
| `python bot.py` | 스케줄러 | 매일 `SCHEDULE_HOUR:SCHEDULE_MINUTE` (KST)에 자동 실행 |

### 테스트 시나리오

#### 시나리오 1: 미리보기 모드 (토큰 없이 동작 확인)

```bash
# .env에서 TELEGRAM_BOT_TOKEN을 비워두면 콘솔에 메시지 출력
TELEGRAM_BOT_TOKEN="" python bot.py --now
```

#### 시나리오 2: 전체 파이프라인 테스트

```bash
# .env에 모든 값을 설정한 후
python bot.py --now
```

#### 시나리오 3: 개별 수집기 테스트

```python
# Python REPL 또는 스크립트에서
import asyncio
from collectors import PriceCollector

async def test():
    collector = PriceCollector()
    data = await collector.collect()
    print(f"Price: {data.current_price_usd}, Fetched: {data.fetched}")
    await collector.close()

asyncio.run(test())
```

### 로그 출력

실행 시 로그는 두 곳에 동시 출력됩니다:

| 출력 대상 | 위치 |
|-----------|------|
| 표준 출력 | 터미널 (stdout) |
| 파일 | `bot.log` (프로젝트 루트) |

로그 포맷: `YYYY-MM-DD HH:MM:SS [LEVEL] logger_name: message`

---

## 4. 새 수집기 추가 방법

프로젝트는 **Collector 패턴**을 사용합니다. 모든 수집기는 `collectors/` 디렉토리에 독립 모듈로 존재합니다.

### 수집기 구조

```
collectors/
  __init__.py                 # 모든 수집기와 데이터 모델을 re-export
  twitter_collector.py        # TwitterCollector + TweetData
  cantonscan_collector.py     # CantonScanCollector + CantonScanData
  price_collector.py          # PriceCollector + PriceData
  your_new_collector.py       # 새 수집기 추가 위치
```

### 추가 절차

#### Step 1: 데이터 모델 정의 (`dataclass`)

```python
# collectors/your_new_collector.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class YourNewData:
    """수집 데이터 설명"""
    some_metric: Optional[float] = None
    fetched: bool = False                   # 수집 성공 여부 플래그 (필수)
```

#### Step 2: 수집기 클래스 작성

```python
import logging
import httpx

logger = logging.getLogger(__name__)

class YourNewCollector:
    """새 데이터 수집기"""

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=15)

    async def collect(self) -> YourNewData:
        """데이터 수집 메인 메서드 (필수)"""
        data = YourNewData()
        try:
            # 수집 로직
            data.fetched = True
        except Exception as e:
            logger.error(f"수집 실패: {e}")
        return data

    async def close(self):
        """리소스 정리 (httpx 클라이언트 등)"""
        await self.client.aclose()
```

**규칙:**
- `collect()` 메서드는 `async`이며, 데이터 모델 인스턴스를 반환
- 실패 시 예외를 던지지 않고, `fetched=False`인 기본 인스턴스를 반환
- HTTP 클라이언트 사용 시 `close()` 메서드에서 정리

#### Step 3: `collectors/__init__.py`에 등록

```python
from .your_new_collector import YourNewCollector, YourNewData

__all__ = [
    # 기존 항목...
    "YourNewCollector", "YourNewData",
]
```

#### Step 4: `bot.py`에 통합

```python
# bot.py > collect_and_post() 함수 내

# 수집기 초기화 부분에 추가
your_new = YourNewCollector()

# asyncio.gather에 태스크 추가
your_new_task = asyncio.create_task(your_new.collect())

tweets, scan_data, price_data, your_new_data = await asyncio.gather(
    tweets_task, scan_task, price_task, your_new_task,
    return_exceptions=True,
)

# 예외 처리 추가
if isinstance(your_new_data, Exception):
    logger.error(f"새 수집기 오류: {your_new_data}")
    your_new_data = YourNewData()

# formatter에 전달
message = build_daily_report(tweets, scan_data, price_data, your_new_data)

# finally 블록에 close 추가
await your_new.close()
```

#### Step 5: `formatter.py`에 메시지 섹션 추가

`build_daily_report()` 함수의 시그니처와 본문에 새 데이터를 추가합니다 (아래 섹션 5 참조).

### 체크리스트

```
[ ] dataclass에 fetched: bool = False 필드 포함
[ ] collect() 메서드가 async이며 예외 시 기본 인스턴스 반환
[ ] close() 메서드에서 httpx client 등 리소스 정리
[ ] collectors/__init__.py에 export 추가
[ ] bot.py의 asyncio.gather에 태스크 추가
[ ] bot.py의 예외 처리 및 finally 블록 업데이트
[ ] formatter.py에 메시지 섹션 추가
[ ] python bot.py --now 로 동작 확인
```

---

## 5. 메시지 포맷 수정 가이드

### 메시지 구조 (`formatter.py`)

`build_daily_report()` 함수가 HTML 형식의 텔레그램 메시지를 생성합니다.

현재 메시지 섹션 순서:

| 순서 | 섹션 | 데이터 소스 |
|------|------|------------|
| 1 | 헤더 (날짜) | `datetime` |
| 2 | $CC Price | `PriceData` |
| 3 | Network Stats | `CantonScanData` |
| 4 | Twitter Updates | `dict[str, list[TweetData]]` |
| 5 | 푸터 (링크) | 고정 |

### 수정 규칙

```
WHEN 기존 섹션의 표시 형식 변경 -> formatter.py의 해당 섹션 블록만 수정
WHEN 새 데이터 섹션 추가 -> build_daily_report() 시그니처에 파라미터 추가 + 섹션 블록 추가
WHEN 유틸 함수 필요 -> formatter.py 상단에 헬퍼 함수 추가
```

### 텔레그램 HTML 파싱 모드 제약

| 허용 태그 | 용도 |
|-----------|------|
| `<b>` | 굵은 글씨 |
| `<i>` | 기울임 |
| `<a href="...">` | 링크 |
| `<code>` | 인라인 코드 |
| `<pre>` | 코드 블록 |

**주의사항:**
- 사용자 입력 텍스트의 `<`, `>` 문자는 `&lt;`, `&gt;`로 이스케이프 필요 (트윗 텍스트 처리 참고)
- `disable_web_page_preview=True`로 전송하므로 링크 미리보기 없음

### 유틸리티 함수

| 함수 | 입력 | 출력 예시 |
|------|------|----------|
| `format_number(n, decimals)` | `1234567.89` | `1,234,567.89` |
| `format_usd(n, decimals)` | `0.0045` | `$0.0045` |
| `format_percentage(n)` | `-2.5` | (red circle) `-2.50%` |
| `format_large_number(n)` | `1500000000` | `$1.50B` |

---

## 6. 배포 가이드

### 사전 조건

```
WHEN 배포 대상이 Linux -> systemd 사용
WHEN 배포 대상이 macOS -> launchd 사용
```

서버에 Python 3.11+, pip, Playwright Chromium이 설치되어 있어야 합니다.

### 6-1. systemd (Linux)

#### 서비스 파일 생성

```bash
sudo nano /etc/systemd/system/canton-bot.service
```

```ini
[Unit]
Description=Canton Telegram Bot
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/canton-telegram-bot
ExecStart=/path/to/canton-telegram-bot/.venv/bin/python bot.py
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal

# 환경변수 파일 지정
EnvironmentFile=/path/to/canton-telegram-bot/.env

[Install]
WantedBy=multi-user.target
```

#### 서비스 등록 및 실행

```bash
sudo systemctl daemon-reload
sudo systemctl enable canton-bot
sudo systemctl start canton-bot

# 상태 확인
sudo systemctl status canton-bot

# 로그 확인
journalctl -u canton-bot -f
```

### 6-2. launchd (macOS)

#### plist 파일 생성

```bash
nano ~/Library/LaunchAgents/com.canton.telegram-bot.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.canton.telegram-bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/canton-telegram-bot/.venv/bin/python</string>
        <string>/path/to/canton-telegram-bot/bot.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/canton-telegram-bot</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/path/to/canton-telegram-bot/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/canton-telegram-bot/launchd-stderr.log</string>
</dict>
</plist>
```

#### 서비스 등록 및 실행

```bash
launchctl load ~/Library/LaunchAgents/com.canton.telegram-bot.plist

# 상태 확인
launchctl list | grep canton

# 중지
launchctl unload ~/Library/LaunchAgents/com.canton.telegram-bot.plist
```

---

## 7. 디버깅 팁

### 로그 확인

```bash
# 실시간 로그 모니터링
tail -f bot.log

# 특정 수집기 로그만 필터
grep "twitter_collector" bot.log
grep "cantonscan_collector" bot.log
grep "price_collector" bot.log

# 에러만 필터
grep "\[ERROR\]" bot.log
```

### --now 모드 활용

```bash
# 전체 파이프라인 1회 테스트
python bot.py --now

# 토큰 없이 메시지 미리보기 (HTML 태그 제거된 텍스트 출력)
TELEGRAM_BOT_TOKEN="" python bot.py --now
```

### 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError: No module named 'zoneinfo'` | Python 3.8 이하 사용 | Python 3.11+ 설치 |
| `playwright._impl._errors.Error: Executable doesn't exist` | Chromium 미설치 | `playwright install chromium` 실행 |
| `트위터 인증 정보가 없습니다` | `.env`에 Twitter 변수 미설정 | `.env` 파일 확인 |
| `TELEGRAM_BOT_TOKEN이 설정되지 않았습니다` | 봇 토큰 누락 | BotFather에서 토큰 발급 후 `.env` 설정 |
| `CoinGecko 429 Too Many Requests` | 레이트 리밋 초과 | `COINGECKO_API_KEY` 설정 (무료 Demo Key) |
| `CantonScan 데이터 수집 실패` | 사이트 구조 변경 | `cantonscan_collector.py`의 파싱 로직 업데이트 |
| `twscrape` 로그인 반복 실패 | Twitter 보안 정책 변경 | `TWITTER_COOKIES` 쿠키 기반 인증으로 전환 |

### 개별 수집기 디버깅

```python
import asyncio
import logging

# 디버그 레벨 로깅 활성화
logging.basicConfig(level=logging.DEBUG)

from collectors import CantonScanCollector

async def debug():
    c = CantonScanCollector()
    data = await c.collect()
    print(f"fetched: {data.fetched}")
    print(f"raw_data: {data.raw_data}")
    await c.close()

asyncio.run(debug())
```

### 비동기 코드 디버깅 참고

- 모든 수집기는 `async/await` 패턴 사용
- `bot.py`에서 `asyncio.gather(return_exceptions=True)`로 병렬 실행하므로, 한 수집기 실패가 전체를 멈추지 않음
- 개별 수집기의 예외는 `isinstance(result, Exception)` 체크로 처리됨

---

## Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-03-31 | 초기 생성 | docs-init으로 자동 생성 |
