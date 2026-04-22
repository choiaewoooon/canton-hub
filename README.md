# Canton Hub

Canton Network ($CC) 실시간 대시보드 백엔드. 외부 데이터 소스(CoinGecko / CantonScan / RapidAPI / GitHub)를 주기적으로 수집하고, REST + SSE 엔드포인트로 Next.js 프론트엔드에 공급한다.

이 레포는 **백엔드 (FastAPI)** + **프론트엔드 (`web/`, Next.js)** 두 개의 독립 배포 단위를 포함한다. 본 README는 백엔드 기준이며, 프론트엔드 안내는 [web/README.md](./web/README.md)를 참조.

## Tech Stack

| 카테고리 | 기술 | 용도 |
|---|---|---|
| 웹 프레임워크 | FastAPI 0.115+ | REST API + lifespan + DI |
| ASGI 서버 | uvicorn[standard] 0.30+ | 프로덕션 서버 |
| 스케줄러 | APScheduler 3.10+ | 주기 수집 (in-process asyncio) |
| HTTP | httpx 0.25+ | 비동기 외부 API 호출 |
| HTML 파싱 | beautifulsoup4 4.12+ | CantonScan HTML 폴백 |
| 동적 스크래핑 | Playwright 1.40+ | CantonScan/CoinGecko SPA 폴백 |
| 실시간 | sse-starlette 2.0+ | `/api/sse/price` |
| 설정 | python-dotenv 1.0+ | `.env` 로드 |

## Getting Started

### Prerequisites

- Python 3.12 이상
- pip
- Chromium 시스템 의존성 (macOS: 자동, Linux Docker: `Dockerfile` 참조)

### Installation

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### Development

```bash
uvicorn api.main:app --reload --port 8000
# → http://localhost:8000/docs  (Swagger UI)
# → http://localhost:8000/api/health
```

### Build (Docker)

```bash
docker build -t canton-hub-api .
docker run --rm -p 8000:8000 --env-file .env canton-hub-api
```

### Test

```bash
pytest tests/
```

### Deploy (Mac local + Cloudflare Tunnel)

`DEPLOY.md` 참조. 현재 구조: uvicorn을 `launchd`로 상시 구동, `cloudflared` Quick Tunnel이 public URL을 만들어 Vercel의 `NEXT_PUBLIC_API_URL`을 자동 갱신.

```bash
# 백엔드 재기동 (코드 변경 반영)
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-backend

# 터널 재기동 (새 URL + Vercel 재배포)
launchctl kickstart -k gui/$(id -u)/com.cobling.canton-hub-tunnel

# 프론트 수동 재배포
cd web && vercel --prod --yes
```

> 이전 Fly.io 배포(`canton-api.fly.dev`)는 2026-04 트라이얼 만료로 destroy됨.

## Environment Variables

`.env.example` 참조 후 `.env`에 복사:

| 변수 | 설명 | 필수 |
|---|---|---|
| `COINGECKO_API_KEY` | CoinGecko Demo API Key (429 방지) | 권장 |
| `RAPIDAPI_KEY` | Twttr API 키 (`twitter241.p.rapidapi.com`, `/api/feed`) | O |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4.6 (`/api/feed` AI 요약) | O |
| `GITHUB_TOKEN` | GitHub PAT, `public_repo` 읽기 (`/api/governance`) | O |
| `ALLOWED_ORIGINS` | 프로덕션 CORS 허용 도메인 (쉼표 구분) | 프로덕션만 |
| `TIMEZONE` | 로그 타임스탬프 TZ | 선택 (기본 `Asia/Seoul`) |

> 프로덕션에서는 반드시 `ALLOWED_ORIGINS`를 실제 Vercel URL로 좁힐 것. 비워두면 `*` 폴백.

## Project Structure

```
canton-hub/
├── api/              # FastAPI 앱 + 스케줄러 + 라우트
│   ├── main.py       # 엔트리포인트
│   ├── scheduler.py  # APScheduler + collect_* 함수
│   ├── cache.py      # TTLCache
│   └── routes/       # /api/price, /api/network, /api/feed, ...
├── collectors/       # 외부 수집기 (Canton Network 전용)
├── web/              # Next.js 프론트엔드 (독립 배포, 별도 README)
├── data/             # 파일 캐시 폴백
├── tests/api/        # pytest
├── config.py         # 환경변수 + 상수
├── scripts/          # run-tunnel.sh, update-vercel-env.sh (Cloudflare 터널)
└── requirements.txt
```

## Key Features

| 기능 | 설명 | 상태 |
|---|---|---|
| `/api/price` | CoinGecko $CC 가격 (30s 캐시) | 구현됨 |
| `/api/network` | B/M Ratio, daily mint/burn, active addresses | 구현됨 |
| `/api/chart/{type}` | 가격/burn/ratio 차트 데이터 | 구현됨 |
| `/api/feed?lang=ko` | Canton 트윗 + AI 번역/요약 | 구현됨 |
| `/api/governance` | CIP 거버넌스 투표 이력 | 구현됨 |
| `/api/analytics/realtime-prices` | 10개 거래소 5초 polling | 구현됨 |
| `/api/analytics/kr-companies` | 한국 거래소 Canton 참여 현황 | 구현됨 |
| `/api/analytics/exchanges` | 현물/파생 거래소 리스팅 | 구현됨 |
| `/api/analytics/holders` | 주요 홀더 리스트 | 구현됨 |
| `/api/sse/price` | 실시간 가격 SSE 스트림 | 구현됨 |

## Related Docs

| 문서 | 설명 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 에이전트 운영 매뉴얼 |
| [DEPLOY.md](./DEPLOY.md) | launchd / Cloudflare Tunnel / Vercel 배포 가이드 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 시스템 아키텍처 + 라우트 맵 |
| [docs/DATA_GUIDE.md](./docs/DATA_GUIDE.md) | 외부 데이터 소스 + ETL |
| [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) | 코딩 표준 |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | 결정 기록 + 교훈 |
| [web/README.md](./web/README.md) | 프론트엔드 별도 README |
