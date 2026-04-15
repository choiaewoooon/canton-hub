# SYSTEM_OVERVIEW.md

> **업데이트 트리거**: 주요 기능 추가, ADR 신설, 폴더 구조 변경, Phase 전환, Known Issue 해소/신규 발견 시 즉시 갱신.
> **읽는 대상**: 신규 온보딩 개발자 / AI 에이전트 / 코드 리뷰어
> **연관 문서**: `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `DEVELOPMENT_GUIDE.md`

---

## 1. Project Overview

| 항목 | 값 |
|------|-----|
| 프로젝트명 | Canton Hub Web |
| 저장소 경로 | `canton-hub/web/` |
| 목적 | Canton Network 데이터 대시보드 — 가격/리워드/생태계/거버넌스 정보 시각화 |
| 기술 스택 | Next.js 16 (App Router), Tailwind CSS v4, Tremor, Recharts, SWR, TypeScript |
| 런타임 | Vercel (project root = `canton-hub/web/`) |
| 상위 프로젝트 | `canton-hub/` 백엔드의 프론트엔드 sibling (과거 `canton-bot/web/`에서 분리) |
| 테스트 게이트 | `tsc --noEmit` + `next build` + 수동 브라우저 스모크 |

### 주요 페이지

| 경로 | 역할 |
|------|------|
| `/` (Dashboard) | Hero price + KPI grid + B/M 섹션 |
| `/analytics` | Reward split, cumulative, amulet price, exchanges, holders |
| `/feed` | Twitter archive + governance + ecosystem + participation guides |

---

## 2. Phase History

| 날짜 | Phase | 내용 |
|------|-------|------|
| 2026-04-XX | P0 | 초기 스캐폴딩 — Next.js + Tailwind + Tremor 셋업 |
| 2026-04-XX | P1 | Dashboard 페이지 — Hero price + KPI grid + B/M 섹션 |
| 2026-04-XX | P2 | Analytics 페이지 — reward split, cumulative, amulet price, exchanges, holders |
| 2026-04-XX | P3 | Feed 페이지 — Twitter archive + governance + ecosystem + participation guides |
| 2026-04-13 | P4 | Korean companies 섹션 추가 (Upbit, Coinone, Marblex — 3개사) |
| 2026-04-14 | P4.1 | Bithumb 복원 (4개사) — `verification_status`/`confidence`/`evidence` 필드 도입 |
| 2026-04-14 | P4.2 | Binance Global 추가 (5개사) — 40+ 지갑 온체인 검증 완료 |
| 2026-04-14 | P5 | Dark/Light 테마 토글 — CSS 변수 swap (zinc/canton 토큰 전역 오버라이드, 컴포넌트 무수정) |
| 2026-04-14 | P5.1 | B/M Ratio KPI 카드 라이트 모드 그라디언트 수정 (`#151a0a` → `canton-accent-bg` var) |
| 2026-04-14 | P5.2 | FeedCard — AI summary를 tweet list 위로 이동 (user feedback) |
| 2026-04-15 | P6 | **폴더 분할** — `canton-bot/web/` → `canton-hub/web/`; Vercel deploy target 변경 |
| 2026-04-15 | P6.1 | `docs-init` 실행 — 본 문서 세트 생성 |

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: CSS 변수 swap으로 테마 구현 (컴포넌트 마이그레이션 X)

| 항목 | 내용 |
|------|------|
| 결정 | Tailwind `zinc-*` / `canton-*` 토큰을 CSS 변수로 오버라이드. `:root`(light) vs `.dark`에서 값만 교체 |
| Before | ~369개 하드코딩 `text-zinc-*` / `bg-canton-*` 참조 — 전수 마이그레이션 불가 |
| After | `app/globals.css`가 두 팔레트를 CSS 변수로 정의; `tailwind.config.ts`의 canton 토큰은 `var()` 참조 |
| 이유 | 수동 find-and-replace는 위험. 테마 swap은 런타임 관심사이지 컴파일타임 관심사가 아님 |
| 규칙 | **NEVER** hex 하드코딩. `canton-*` 유틸 클래스 또는 인라인 스타일 시 `var(--canton-*)` 사용 (Recharts 케이스) |
| 영향 | Recharts 인라인 hex는 케이스별로 `var()` 참조 이관 필요 |

### ADR-002: Pre-hydration 테마 스크립트 in `layout.tsx`

| 항목 | 내용 |
|------|------|
| 결정 | `<head>` 최상단에 blocking `<script>` 주입 — React hydrate 이전에 localStorage 읽어 클래스 설정 |
| 이유 | FOUC (Flash of Unstyled/wrong theme) 방지 — 기본 클래스로 로드 후 JS가 `.dark` 추가 시 깜빡임 발생 |
| 규칙 | 스크립트는 **반드시** `<head>` 첫 요소, **반드시** 동기 실행 |
| 영향 | `<html>`에 `suppressHydrationWarning` 추가로 mismatch 경고 무음 처리 |

### ADR-003: 기본 테마 = Dark (Light 아님)

| 항목 | 내용 |
|------|------|
| 결정 | 신규 방문자는 dark mode로 시작. localStorage 값이 있으면 그것을 우선 |
| Before | 초기 실험은 light mode 기본값 |
| After | B/M 그라디언트 라이트 모드에서 시각적 이슈 (이후 수정됨) → dark 기본으로 전환 |
| 규칙 | 신규 컴포넌트는 **양쪽 모드 모두** 테스트 필수 |

### ADR-004: 프론트엔드 테스트 스위트 없음 (현 시점)

| 항목 | 내용 |
|------|------|
| 결정 | `tsc --noEmit` + `next build` + 수동 브라우저 스모크만으로 검증 게이트 구성 |
| 이유 | 현 단계 소규모 팀에서 테스트 인프라 오버헤드 대비 효용 낮음 |
| 규칙 | 주요 리팩터 이전에 Playwright e2e **반드시** 도입 |
| 영향 | 모든 버그는 배포 후 수동 관찰로 포착 |

### ADR-005: `canton-bot/`에서 폴더 분할 (2026-04-15)

| 항목 | 내용 |
|------|------|
| 결정 | `canton-bot/web/` → `canton-hub/web/`로 이동. web/bot 분리의 일환 |
| 이유 | 배포 경계 명확화, 독립적 릴리스 주기 |
| 규칙 | 프론트엔드는 Telegram bot에 대한 **지식 없음** — import/참조 금지 |
| 영향 | Vercel project root = `canton-hub/web/` (not `canton-bot/web/`) |

---

## 4. Known Issues

| ID | 이슈 | 영향 범위 | 우선순위 |
|----|------|-----------|----------|
| KI-01 | `analytics/` 일부 Recharts 컴포넌트에 hex 하드코딩 — 라이트 모드 렌더 오류 | Analytics 페이지 | High |
| KI-02 | Tremor 컴포넌트가 canton 팔레트를 항상 상속하지는 않음 — 시각 불일치 가능 | 전역 | Medium |
| KI-03 | Playwright e2e 커버리지 0% | 전역 | Medium |
| KI-04 | SWR `revalidateOnFocus` 탭 전환 시 double-fetch 유발 | 데이터 훅 전반 | Low |
| KI-05 | Korean companies 섹션 "모든 소식 보기 →" 링크 broken (`href="#"`) | Dashboard | Low |

---

## 5. Lessons Learned

| # | 교훈 | 적용 방법 |
|---|------|-----------|
| L1 | User feedback이 수동 브라우저 테스트보다 빠름 | 현 단계에서는 comprehensive test보다 visible UX 우선 |
| L2 | CSS 변수 swap이 수동 클래스 마이그레이션을 이김 | 크로스커팅 테마 작업은 런타임 layer에서 해결 |
| L3 | `suppressHydrationWarning`은 code smell이 아님 | Pre-hydration 스크립트 패턴에서 정당한 도구 |
| L4 | Canton 상의 Binance vs "binance-us"는 동일 키 (iBTC/cBTC 케이스) | Trusted label 렌더 전 **항상** 온체인 identity 검증 |
| L5 | Next.js 16 + Tailwind v4는 LLM 학습 데이터에서 최신이 아닐 수 있음 | 작업 전 **항상** `AGENTS.md` 먼저 확인 |

---

## 6. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | `docs-init`으로 자동 생성 |
