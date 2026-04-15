# Canton Hub — Backend

Canton Network 실시간 대시보드의 FastAPI 백엔드. CoinGecko / CantonScan / RapidAPI 수집기를 `APScheduler`로 주기 실행하고 결과를 인메모리 TTL 캐시에 적재한 뒤 REST 엔드포인트로 서빙한다. 프론트엔드(`web/`)는 별도로 Vercel에 배포되고, 이 백엔드는 Fly.io에 배포된다.

- Project Path: `/Users/choejaewon/project/Ozzycanton/canton-hub`
- Branch 전략: main + feature branch
- 관련 프로젝트:
  - `canton-hub/web/` — Next.js 프론트엔드 (같은 레포 안의 독립 배포 단위)
  - `../canton-telegram-bot/` — 텔레그램 봇 (별도 레포, 수집기 독립 복사본 보유)
  - `../canton-bot/` — **레거시**, 분리 전 원본 폴더, 수정 금지

## Tech Stack

| 카테고리 | 기술 | 버전/비고 |
|---|---|---|
| 런타임 | Python | 3.12+ |
| 웹 프레임워크 | FastAPI | 0.115+ |
| ASGI 서버 | uvicorn[standard] | 0.30+ |
| 스케줄러 | APScheduler | 3.10+ (in-process, asyncio) |
| HTTP 클라이언트 | httpx | 0.25+ (async) |
| HTML 파싱 | beautifulsoup4 | 4.12+ |
| 동적 스크래핑 | Playwright + Chromium | 1.40+ |
| SSE 스트리밍 | sse-starlette | 2.0+ |
| 설정 | python-dotenv | 1.0+ |
| 컨테이너 | Docker | Dockerfile + fly.toml |
| 배포 | Fly.io | region=nrt, shared-1x 512MB |

## Project Structure

```
canton-hub/
├── api/                     # FastAPI 앱 + 스케줄러 + 라우트
│   ├── main.py              # lifespan, CORS, 라우터 등록, /api/health
│   ├── scheduler.py         # APScheduler + 각 collect_* 함수 + asyncio loop
│   ├── cache.py             # 스레드 안전 TTLCache
│   ├── dependencies.py      # get_cache DI
│   └── routes/              # price, network, chart, feed, governance, analytics
├── collectors/              # 외부 데이터 수집기 (web 백엔드 전용)
│   ├── price_collector.py           # CoinGecko $CC 가격
│   ├── cantonscan_collector.py      # CantonScan 네트워크 지표
│   ├── cantonscan_scraper.py        # Playwright 폴백
│   ├── twitter_collector.py         # RapidAPI Twitter API45 (피드)
│   ├── governance_collector.py      # GitHub CIP fetch
│   ├── holders_collector.py         # CantonScan 홀더
│   ├── kr_companies_collector.py    # 한국 기업 지갑 (하드코딩 + 검증)
│   ├── dex_oi_collector.py          # DEX OI
│   ├── realtime_prices.py           # 10개 거래소 5초 polling
│   └── coingecko_scraper.py         # CoinGecko 파생상품 페이지 Playwright
├── web/                     # Next.js 프론트엔드 (별도 Vercel 배포 단위)
├── data/                    # 파일 캐시 (재시작 시 재수집용 폴백)
├── tests/api/               # pytest
├── config.py                # .env 로드 + 상수
├── run_api.py               # 로컬 개발 편의 스크립트
├── requirements.txt         # backend-only deps (텔레그램/이미지 생성 없음)
├── Dockerfile               # python:3.12-slim + Playwright Chromium
├── fly.toml                 # region=nrt, vol=canton_data, health=/api/health
└── .dockerignore
```

---

## 0. Core Principles (핵심 원칙)

- 언어: 한국어 문서·주석, 영어 코드
- 프로젝트 경로: `/Users/choejaewon/project/Ozzycanton/canton-hub` — 다른 경로에서 작업 금지
- **`web/` 하위에서는 이 문서가 아니라 [web/CLAUDE.md](./web/CLAUDE.md)를 따를 것** — 프론트엔드 규칙은 별도
- 보안: 하드코딩 시크릿 금지, `.env`는 `.gitignore`에 등록됨
- 수집기는 언제나 예외를 내부에서 처리하고 빈 데이터클래스를 반환 — 절대 상위로 throw 하지 않음
- 캐시 키는 `price`, `network`, `feed:{lang}`, `chart:{type}:{period}` 등 문자열 규약 — 새 키 추가 시 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) Cache Key Map 갱신

## 1. Quick Reference (빠른 참조)

| 작업 | 명령어 |
|---|---|
| 로컬 venv 설치 | `python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && playwright install chromium` |
| 개발 서버 | `uvicorn api.main:app --reload --port 8000` |
| 헬스체크 | `curl http://localhost:8000/api/health` |
| 단일 엔드포인트 smoke | `curl http://localhost:8000/api/price` |
| 테스트 | `pytest tests/` |
| 로컬 Docker 빌드 | `docker build -t canton-hub-api .` |
| Fly 배포 | `fly deploy` (fly.toml 참조) |
| Fly 로그 | `fly logs` |
| Fly 시크릿 설정 | `fly secrets set KEY=value` |

## 2. Workflow Protocols (워크플로우)

### 2.1 Plan First → Implement → Verify

```
1. 요구사항 명확화 → 영향 파일 목록 확인 (grep)
2. 새 collector 추가 시: collectors/ 추가 + scheduler.py에 loop 등록 + route 추가
3. 새 route 추가 시: api/routes/ 모듈 추가 + api/main.py에서 include_router
4. 로컬에서 uvicorn --reload로 즉시 검증
5. curl로 응답 smoke
```

### 2.2 Side Impact Analysis

변경 전 체크리스트:
- [ ] 캐시 키 이름이 다른 곳에서도 쓰이는지 `grep "cache.get(\"KEY\")"`로 확인
- [ ] collector 시그니처 변경 시 scheduler.py의 호출부 함께 수정
- [ ] route 응답 shape 변경 시 `web/lib/types.ts`의 TypeScript 타입도 함께 수정 (프론트 빌드 깨짐 방지)
- [ ] 새 환경변수 추가 시 `.env.example` + `config.py` + `DEPLOY.md` 3곳 모두 업데이트

### 2.3 Batch Size Limits

- 단일 PR/커밋: 파일 5개 이내 권장
- 수집기 + 라우트 + 스케줄러 동시 수정이면 1 PR 허용 (논리적 단위)

### 2.4 Git Workflow

```
feat: 새 /api/analytics/holders 엔드포인트 추가
fix: CoinGecko 429 시 파일 캐시 폴백
refactor: price_collector를 Pydantic으로 이관
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## 3. Cross-Cutting Change Protocol

백엔드 응답 shape이 바뀌면 프론트도 함께 깨집니다:

1. `grep -r "cache.get(\"<old_key>\")" api/` 로 모든 사용처 확인
2. `web/lib/types.ts`에서 대응 TypeScript 타입 찾아 동시 수정
3. `cd web && npx tsc --noEmit` 로 타입 검증
4. 양쪽 반드시 같은 PR에 포함

## 4. Known Patterns & Anti-Patterns

| 패턴 | 검색 쿼리 | 잘못된 예시 | 올바른 예시 |
|---|---|---|---|
| Collector 예외 버블링 | `raise ` in `collectors/` | `raise httpx.TimeoutException(...)` | `logger.warning(...); return EmptyData()` |
| 하드코딩 URL | `http` in `collectors/` | `"https://api.coingecko.com/..."` 인라인 | `config.COINGECKO_API_URL` 사용 |
| Sync 블로킹 | `requests.` or `time.sleep` | `requests.get(...)` | `await client.get(...)` + `asyncio.sleep` |
| 캐시 미스 404 | 라우트가 500 반환 | `raise HTTPException(500)` | `cache.get(...) or _EMPTY_*` 폴백 |

## 5. Evidence-Based Completion

5단계 검증 게이트:
1. **IDENTIFY**: 이 주장을 증명하는 명령어는?
2. **RUN**: 전체 명령어 실행 (신선하게, 완전히)
3. **READ**: 전체 출력 확인, exit code 확인
4. **VERIFY**: 출력이 주장을 확인하는가?
5. **ONLY THEN**: 완료 보고

| 주장 | 필요한 증거 | 불충분한 증거 |
|---|---|---|
| 엔드포인트 동작 | `curl <url>` → 2xx + 예상 shape | 코드 읽어봤음, "동작할 것" |
| 스케줄러 루프 동작 | 로그에 `cached:` 라인 출현 | 함수 호출 추적 |
| Playwright 설치 성공 | `playwright install chromium` exit 0 | `pip install` 성공 |
| Fly 배포 성공 | `curl https://canton-api.fly.dev/api/health` → 200 | `fly deploy` exit 0 (앱이 crash loop일 수 있음) |

## 6. STOP Conditions

다음 상황에서 즉시 중단하고 질문:
- CoinGecko 429가 연속 발생 → Demo API key 없는지 확인
- CantonScan 응답 shape이 바뀐 것으로 보임 → 웹 페이지 수동 검사 요청
- Playwright 빌드 OOM → fly.toml memory_mb 상향 권한 요청
- 캐시 키 충돌 의심 → scheduler + route 양쪽 grep

→ **추측하지 말고 질문하세요.**

## 7. 3-Failure Escalation

동일 수집기가 3회 연속 실패 시:
1. 에러 로그 전체 캡처
2. 외부 API 자체 문제인지 vs 코드 문제인지 격리
3. 임시 폴백 (파일 캐시 로드) 유지 + 사용자에게 에스컬레이션

## 8. Document Map

| 문서 | 읽어야 할 때 | 업데이트 트리거 |
|---|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 시스템 구조, 라우트 맵 필요 시 | route/collector/cache key 변경 |
| [docs/PRD.md](./docs/PRD.md) | 기능 범위 확인 | 새 API/기능 추가 |
| [docs/DATA_GUIDE.md](./docs/DATA_GUIDE.md) | 데이터 소스·수집 흐름 파악 | 새 collector/외부 API 추가 |
| [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) | 코딩 패턴 확인 | 새 패턴/안티패턴 발견 |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | 과거 결정 배경 파악 | 매 작업 완료 시 |
| [DEPLOY.md](./DEPLOY.md) | 배포 작업 | fly/vercel 설정 변경 |

## 9. Documentation Rules (문서 최신화 규칙)

| 변경 감지 | 업데이트 대상 | 업데이트 내용 |
|---|---|---|
| `api/routes/` 신규 추가 | CLAUDE.md Structure + ARCHITECTURE.md API Contracts | 트리 + 엔드포인트 테이블 |
| `collectors/` 신규 추가 | ARCHITECTURE.md + DATA_GUIDE.md | 모듈 + Data Sources 테이블 |
| 캐시 키 신설/삭제 | ARCHITECTURE.md Cache Key Map | 키 + TTL + 소비처 |
| `requirements.txt` 변경 | CLAUDE.md Tech Stack + README.md | 버전 업데이트 |
| `.env.example` 변경 | README.md Env Vars + DEPLOY.md Secrets | 변수 + 필수여부 |
| `fly.toml` / `Dockerfile` 변경 | DEPLOY.md + README.md | 리소스/명령어 |
| 새 버그 패턴 발견 | CLAUDE.md Known Patterns + DEVELOPMENT_GUIDE.md | 패턴 + 검색 쿼리 |
| 아키텍처 결정 | ARCHITECTURE.md + SYSTEM_OVERVIEW.md ADR | 설계 + 결정 기록 |
| 작업 완료 | SYSTEM_OVERVIEW.md Phase History | 단계 추가 |

규칙:
- 코드와 문서는 같은 PR에서 함께 업데이트
- 문서는 사실만 기록 — 추측 금지
- 더 이상 유효하지 않은 내용은 즉시 삭제

## Change Log

| 날짜 | 변경 | 이유 |
|---|---|---|
| 2026-04-15 | 초기 생성 | docs-init (canton-bot 분리 직후 재작성) |
