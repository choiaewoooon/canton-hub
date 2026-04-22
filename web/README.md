# Canton Hub — Frontend

Next.js 16 기반 Canton Network ($CC) 실시간 대시보드. 상위 `canton-hub/` 백엔드의 REST/SSE API를 소비해서 가격, Burn-Mint Ratio, 한국 기업 참여, 거버넌스, 피드를 렌더링한다.

## Tech Stack

| 카테고리 | 기술 | 용도 |
|---|---|---|
| 프레임워크 | **Next.js 16.2.3** (App Router, Turbopack) | 라우팅 + 빌드 |
| UI | React 19 + TypeScript (strict) | 컴포넌트 |
| 스타일 | Tailwind CSS **v4** | 유틸리티 + `@theme` CSS 변수 |
| 컴포넌트 라이브러리 | Tremor React | KPI 카드, 분석 섹션 |
| 차트 | Recharts | 시계열, 분포, 비율 |
| 데이터 fetch | SWR | polling (30s~5s) + SSE 헬퍼 |
| 국제화 | 자체 구현 (`lib/use-lang.ts`) | ko/en/ja/zh |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- 동작 중인 Canton Hub 백엔드 (로컬: `http://localhost:8000`, 프로덕션: Cloudflare Quick Tunnel `*.trycloudflare.com` — `scripts/update-vercel-env.sh`가 Vercel env에 자동 주입)

### Installation

```bash
npm install
```

### Development

백엔드를 먼저 띄운 뒤:

```bash
# 상위 디렉토리(canton-hub/)에서:
# source venv/bin/activate && uvicorn api.main:app --reload --port 8000

# 그리고 web/ 에서:
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# → http://localhost:3000
```

### Build

```bash
npm run build   # Next.js 프로덕션 빌드
npm start       # 프로덕션 서버 로컬 기동
```

### Lint + Type Check

```bash
npm run lint
npx tsc --noEmit
```

### Deploy (Vercel)

상위 `canton-hub/DEPLOY.md` 참조. 요약:

```bash
vercel                                      # 초기화
vercel env add NEXT_PUBLIC_API_URL production   # 백엔드 URL 등록
vercel --prod                                # 프로덕션 배포
```

Vercel 프로젝트 설정에서 **Root Directory를 `canton-hub/web`**으로 지정해야 한다 (모노레포 구조).

## Environment Variables

`.env.production.example` 참조:

| 변수 | 설명 | 필수 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Canton Hub 백엔드 base URL (예: `https://<random>.trycloudflare.com`). 수동 설정 불필요 — `scripts/update-vercel-env.sh`가 터널 URL 변경 시 자동 갱신 | O |

> `NEXT_PUBLIC_` prefix가 있으므로 클라이언트 번들에 포함됨. 시크릿 값 넣지 말 것.

## Project Structure

```
web/
├── app/              # App Router — layout, page, /analytics, /feed
│   ├── layout.tsx    # 루트 레이아웃 + 선-하이드레이션 테마 스크립트
│   ├── page.tsx      # / 대시보드
│   ├── globals.css   # Tailwind v4 @theme + 라이트/다크 CSS 변수
│   ├── analytics/
│   └── feed/
├── components/       # 10+ 하위 도메인 (kpi/charts/feed-page/analytics/…)
├── lib/              # api.ts (SWR hooks), types.ts, format.ts, use-theme.ts
├── messages/         # i18n JSON (ko/en/ja/zh)
├── public/
├── tailwind.config.ts
├── next.config.ts
└── vercel.json
```

## Key Features

| 기능 | 설명 | 상태 |
|---|---|---|
| 실시간 가격 hero | $CC 가격 + 24h change + SSE 스트리밍 | 구현됨 |
| KPI 그리드 | B/M Ratio, Active Addresses 24h, Daily Burn, Private TX (institutional) | 구현됨 |
| B/M Ratio 차트 | 7d/1m/3m 시계열 + deflationary/inflationary 라벨 | 구현됨 |
| 실시간 거래소 가격 | 10개 거래소 5초 폴링 + arbitrage spread | 구현됨 |
| 거버넌스 CIP 리스트 | 활성/완료 제안, 카테고리별 통계 | 구현됨 |
| 한국 기업 섹션 | Upbit/Coinone/Bithumb/Marblex/Binance + 검증 근거 | 구현됨 |
| 다국어 | ko/en/ja/zh 4개 언어 | 구현됨 |
| 라이트/다크 테마 | 기본 다크, 네비바 토글, localStorage 저장 | 구현됨 |
| 분석 페이지 | reward split, cumulative, amulet price, exchanges, holders | 구현됨 |
| 피드 페이지 | 트위터 아카이브, 거버넌스 캘린더, 생태계 가이드, 참여 가이드, 한국 기업 | 구현됨 |

## Related Docs

| 문서 | 설명 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 프론트엔드 에이전트 운영 매뉴얼 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 컴포넌트/페이지 구조 + SWR hook 맵 |
| [docs/PRD.md](./docs/PRD.md) | 제품 요구사항 |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | 색상 토큰, 타이포, 컴포넌트 규칙 |
| [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) | 코딩 표준 |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | 결정 기록 |
| [../CLAUDE.md](../CLAUDE.md) | 백엔드 운영 매뉴얼 |
| [../DEPLOY.md](../DEPLOY.md) | launchd + Cloudflare Tunnel + Vercel 배포 가이드 |
| [AGENTS.md](./AGENTS.md) | Next.js 16 브레이킹 체인지 주의 |
