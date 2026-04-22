# Canton Hub — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Tremor + Recharts + SWR로 만든 Canton Network 실시간 대시보드. 상위 `canton-hub/` 백엔드의 REST/SSE API를 소비해서 가격·Burn-Mint Ratio·한국 기업 참여·거버넌스·피드를 렌더링한다. Vercel에 배포된다.

- Project Path: `/Users/choejaewon/project/Ozzycanton/canton-hub/web`
- Parent backend: [`../`](../CLAUDE.md) (별도 운영 규칙 적용)
- 관련 프로젝트: `../../canton-telegram-bot/` (독립 레포, 프론트와 상호작용 없음)

## Tech Stack

| 카테고리 | 기술 | 버전/비고 |
|---|---|---|
| 프레임워크 | Next.js | **16.2.3 (App Router, Turbopack)** — ⚠ 브레이킹 체인지 많음 |
| UI 런타임 | React | 19 |
| 언어 | TypeScript | strict |
| 스타일 | Tailwind CSS | **v4** (`@theme inline` in globals.css) |
| 컴포넌트 | Tremor React | 분석/KPI 카드 |
| 차트 | Recharts | 가격·B/M·reward split 등 |
| 데이터 fetch | SWR | 폴링 기반 (30s~5s 간격) |
| PostCSS | @tailwindcss/postcss | v4 플러그인 |

## Project Structure

```
web/
├── app/                    # App Router 라우트 (Next.js 16)
│   ├── layout.tsx          # 루트 레이아웃 + theme init script (pre-hydration)
│   ├── page.tsx            # / — 메인 대시보드
│   ├── globals.css         # Tailwind v4 @theme + 라이트/다크 CSS 변수
│   ├── analytics/page.tsx  # /analytics — 차트 섹션 집합
│   └── feed/page.tsx       # /feed — Canton 뉴스 + 거버넌스 + KR companies
├── components/
│   ├── analytics/          # reward-split, cumulative, amulet-price, exchanges, holders
│   ├── charts/             # bm-section, price-card 등
│   ├── feed/               # feed-card (대시보드용 AI 요약)
│   ├── feed-page/          # twitter-archive, korean-companies, governance-calendar, ecosystem-guide, participation-guide
│   ├── governance/         # cip 리스트
│   ├── hero/               # 상단 실시간 가격 hero
│   ├── kpi/                # kpi-grid (B/M, Active Addresses, Daily Burn, Private TX)
│   ├── nav/                # navbar (언어 + 테마 토글 + Telegram 링크)
│   ├── network/            # network status
│   └── footer.tsx
├── lib/
│   ├── api.ts              # SWR hooks: usePrice, useNetwork, useChart, useFeed, useGovernance, useKrCompanies, useRealtimePrices, ...
│   ├── types.ts            # 백엔드 응답 → TypeScript 타입 (PriceData, KrCompany, RealtimePrices, ...)
│   ├── format.ts           # fmtCc, fmtUsd, fmtPct, fmtLargeUsd
│   ├── use-lang.ts         # 다국어 state (ko/en/ja/zh) + localStorage
│   ├── use-theme.ts        # 라이트/다크 토글 + localStorage + .dark 클래스
│   └── sse.ts              # useRealtimePrice — SSE 구독
├── messages/               # i18n 텍스트 (ko/en/ja/zh JSON)
├── public/                 # 정적 자산
├── tailwind.config.ts      # darkMode: "class" + canton/zinc 색상을 var() 참조
├── next.config.ts          # 이미지 remotePatterns (google favicon, coingecko images)
├── vercel.json             # framework=nextjs, region=icn1, 보안 헤더
└── .env.production.example # NEXT_PUBLIC_API_URL 템플릿
```

---

## 0. Core Principles (핵심 원칙)

- **Next.js 16은 기존에 알던 Next.js와 다름** — API/컨벤션 브레이킹 체인지가 많음. 작성 전 [node_modules/next/dist/docs/](./node_modules/next/dist/docs/) 또는 상위 [`AGENTS.md`](./AGENTS.md) 확인
- 모든 페이지는 App Router (`app/`) — pages 디렉토리 쓰지 말 것
- 모든 상호작용 있는 컴포넌트는 `"use client"` 선언
- **테마는 CSS 변수 swap 방식** — `text-zinc-50`, `bg-canton-bg` 같은 기존 유틸리티 클래스를 그대로 써도 라이트/다크 자동 적응됨. 새 색상 하드코딩하지 말고 `--canton-*` / `--zinc-*` 변수 참조
- **API 호출은 반드시 `lib/api.ts`의 SWR 훅 경유** — `fetch` 직접 호출 금지. `NEXT_PUBLIC_API_URL` 환경변수로 백엔드 베이스 URL 결정
- 파일·라인 참조 시 markdown 링크 사용: `[filename.tsx:42](file.tsx#L42)`
- 이모지는 유저가 명시 요청하지 않는 한 사용 금지 (단, Canton 브랜드 상징 🇰🇷 🏢 🔥 등 데이터성 이모지는 OK)

## 1. Quick Reference

| 작업 | 명령어 |
|---|---|
| 설치 | `npm install` |
| 개발 서버 | `npm run dev` → `http://localhost:3000` |
| 빌드 | `npm run build` |
| 프로덕션 서버 | `npm start` |
| 린트 | `npm run lint` |
| 타입 체크 | `npx tsc --noEmit` |
| Vercel 배포 | `vercel --prod` |

**백엔드 연결**: 로컬에서는 `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev`. 프로덕션은 Cloudflare Quick Tunnel이 생성하는 `*.trycloudflare.com` URL이 `scripts/update-vercel-env.sh`에 의해 Vercel env에 자동 주입됨 (이전 `canton-api.fly.dev`는 2026-04 폐기).

## 2. Workflow Protocols

### 2.1 Plan First → Implement → Verify

```
1. 디자인 변경 시: Tremor 우선 → Recharts 보조 → 직접 구현은 최후
2. 새 백엔드 필드 필요 시: web/lib/types.ts + 백엔드 response shape 동시 수정 (../CLAUDE.md Cross-Cutting 참조)
3. 다국어 문자열은 컴포넌트 내 `lang === "ko" ? ... : ...` 또는 messages/ JSON
4. 빌드 검증: `npx tsc --noEmit` + `npm run build`
5. 브라우저에서 수동 smoke: 다크/라이트 토글, 4개 언어 전환, /feed 확장 UI
```

### 2.2 Side Impact Analysis

- [ ] 백엔드 응답 shape이 `lib/types.ts`와 일치하는가? (`npx tsc --noEmit`로 검증)
- [ ] 새 SWR 훅 추가 시 `refreshInterval` 설정 (30s~3600s)
- [ ] 하드코딩 색상 쓰고 있진 않은가? (`#[0-9a-f]{6}` grep — `var(--*)` 써야 함)
- [ ] Recharts 컴포넌트 stroke/fill이 `var(--canton-*)` 변수인가?
- [ ] `next/image` 로 외부 이미지 로드 시 `next.config.ts` remotePatterns에 도메인 추가됐는가?

### 2.3 Batch Size Limits

- 단일 PR: 5개 파일 이내 권장
- 369개 `text-zinc-*` 클래스 전수 변경 같은 크로스 컷 작업은 CSS 변수 swap 전략 활용 (한번에 처리)

### 2.4 Git Workflow

```
feat(feed): 한국 기업 검증 evidence 표시
fix(theme): B/M Ratio 카드 라이트 모드 그라데이션 수정
refactor(analytics): Recharts 하드코딩 색상 var() 이관
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `style`

## 3. Cross-Cutting Change Protocol

백엔드 응답 shape 변경 시:
1. `grep -r "KrCompany\|PriceData\|NetworkData" lib/` 로 사용처 확인
2. `lib/types.ts` 수정 + 백엔드 `api/routes/*.py` 동시 수정 (같은 PR)
3. `npx tsc --noEmit` 통과 확인
4. `npm run build` 통과 확인
5. 브라우저 수동 검증

CSS 변수 변경 시:
1. `app/globals.css` `:root` + `.dark` 둘 다 업데이트
2. Tailwind config의 canton color 토큰도 var() 참조 유지
3. 다크/라이트 양쪽 브라우저에서 확인

## 4. Known Patterns & Anti-Patterns

| 패턴 | 검색 쿼리 | 잘못된 예시 | 올바른 예시 |
|---|---|---|---|
| 하드코딩 색상 | `"#[0-9a-f]{3,6}"` | `stroke="#c8e64a"` | `stroke="var(--canton-lime)"` |
| fetch 직접 호출 | `fetch\(` | `await fetch(API+'/price')` | `const { data } = usePrice()` |
| `'use client'` 누락 | interactive 컴포넌트 | `export default function Btn(){ useState... }` | `"use client"; export default ...` |
| `any` 타입 | `: any` | `const data: any = ...` | `const data: PriceData = ...` |
| `next/image` 외부 도메인 미등록 | `src="https://..."` in Image | next.config.ts 없이 사용 | remotePatterns에 등록 후 사용 |

## 5. Evidence-Based Completion

| 주장 | 필요한 증거 | 불충분한 증거 |
|---|---|---|
| 타입 정합성 | `npx tsc --noEmit` exit 0 | 에디터에 빨간 줄 없음 |
| 프로덕션 빌드 | `npm run build` exit 0 + 출력에 각 페이지 ✓ | dev 서버에서 잘 보임 |
| 다크/라이트 정상 | 브라우저에서 토글 + 전 페이지 스크롤 | CSS 변수가 정의돼있음 |
| 백엔드 연결 | 네트워크 탭에서 `NEXT_PUBLIC_API_URL` 로 200 응답 | 로컬에서 잘 됨 |

## 6. STOP Conditions

- Next.js 16 브레이킹 체인지로 추정되는 API 호출 패턴 → AGENTS.md + node_modules/next/dist/docs/ 확인
- `npx tsc --noEmit` 에러가 백엔드 타입 불일치 → 백엔드도 같은 PR에서 수정 필요
- Recharts 컴포넌트가 빈 컨테이너 경고 → `minWidth/minHeight` 또는 `aspect` 설정
- 빌드 중 이미지 도메인 에러 → `next.config.ts` remotePatterns 확인

## 7. 3-Failure Escalation

- 동일 UI 변경이 3회 실패 → 아키텍처가 아니라 디자인 요구가 불명확할 가능성. 사용자에게 참고 이미지/레퍼런스 요청
- 동일 TypeScript 에러 3회 수정 실패 → 백엔드 쪽 타입 누락 의심. 백엔드 response shape 재확인

## 8. Document Map

| 문서 | 읽어야 할 때 | 업데이트 트리거 |
|---|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 컴포넌트 구조, SWR hook 맵 | 새 페이지/컴포넌트/API 연결 |
| [docs/PRD.md](./docs/PRD.md) | 기능 범위 확인 | 페이지/섹션 추가·삭제 |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | UI 작업 시 (색상/폰트/토큰) | CSS 변수 변경 |
| [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) | 코딩 패턴 확인 | 새 패턴/안티패턴 발견 |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | 과거 UI 결정 배경 | 매 작업 완료 시 |
| [AGENTS.md](./AGENTS.md) | Next.js 16 브레이킹 체인지 주의 | Next 버전 업그레이드 |

## 9. Documentation Rules

| 변경 감지 | 업데이트 대상 | 업데이트 내용 |
|---|---|---|
| `app/` 신규 라우트 | CLAUDE.md Structure + PRD.md Feature Inventory | 트리 + 기능 목록 |
| `components/` 신규 디렉토리 | CLAUDE.md Structure | 트리 |
| `lib/types.ts` 변경 | ARCHITECTURE.md Type Map + 백엔드 response spec | 타입 테이블 |
| `lib/api.ts` 새 SWR 훅 | ARCHITECTURE.md SWR Hook Map | refreshInterval + 캐시 키 |
| `app/globals.css` CSS 변수 | DESIGN_SYSTEM.md Color System | 토큰 테이블 |
| `tailwind.config.ts` | DESIGN_SYSTEM.md | 토큰 참조 |
| `package.json` deps | CLAUDE.md Tech Stack + README.md | 버전 |
| `next.config.ts` | CLAUDE.md Core Principles | 변경 사유 |
| 새 이미지 도메인 | next.config.ts remotePatterns + CLAUDE.md | 도메인 + 용도 |
| 새 버그 패턴 | DEVELOPMENT_GUIDE.md Bug Pattern | 패턴 + 검색 쿼리 |
| 작업 완료 | SYSTEM_OVERVIEW.md Phase History | 단계 추가 |

## Change Log

| 날짜 | 변경 | 이유 |
|---|---|---|
| 2026-04-15 | 초기 생성 | docs-init (canton-hub 분리 후 재작성) |
