# PRD — Canton Hub Frontend

> **업데이트 트리거**: 기능 추가/제거, 페르소나 변경, 라우트 변경, 성공 지표 재정의, 로드맵 단계 전환 시 본 문서를 갱신한다.
> **AI Native**: 기계가 읽기 쉬운 테이블/결정론적 규칙 우선. 산문체 최소화.

---

## 1. Product Vision

Canton Hub는 한국 리테일 크립토 투자자와 Canton Network 파워 유저를 위한 **한 눈에 보는 실시간 대시보드**다.
자매 프로젝트인 텔레그램 채널(`canton-telegram-bot`)과 연계되며, 웹은 시각화·심층 분석·아카이브 역할을 담당한다.

| 항목 | 내용 |
|------|------|
| Product | Canton Hub — Canton Network 한국향 대시보드 |
| Companion | `canton-telegram-bot` (동일 저자, 실시간 알림 채널) |
| Core Identity | Canton의 **기관용(Institutional)** 정체성 강조 — Burn-Mint Ratio, Private TX |
| Korean Edge | 한국 거래소 상장 현황, 트윗 AI 번역/요약, 한국어 UX |
| Differentiation | B/M Ratio를 전면 배치해 기관 유저 활동 강조, Private TX를 핵심 KPI로 노출 |
| Access Model | 공개 읽기 전용 (인증 없음) |

---

## 2. User Personas

| Persona | 목적 | 주요 니즈 | 진입 경로 |
|---------|------|-----------|-----------|
| 🇰🇷 한국 리테일 투자자 | 가격·차익 거래 기회 확인 | $CC 실시간 가격, 거래소별 가격 비교, 한국어 설명, 쉬운 네트워크 이해 | `/` Dashboard → `/analytics` exchanges |
| 🔬 Canton 파워 유저/리서처 | 네트워크 건전성·거버넌스 분석 | B/M Ratio, Burn Analytics, Reward Split, Holders 분포, CIP 거버넌스 일정 | `/analytics` → `/feed` governance |
| 🏢 한국 거래소 애널리스트 | KR 기관 지갑 및 거래소 동향 추적 | KR 기업 지갑 검증, Binance/Upbit/Coinone/Bithumb/Marblex 상장 정보, 실시간 크로스 거래소 가격 | `/feed` korean companies → `/analytics` exchanges |

---

## 3. Feature Inventory

모든 기능은 Phase 1에서 **구현됨**. Acceptance Criteria는 QA·리팩터 판정 기준이다.

### 3.1 Global Navigation

| ID | 기능 | 위치 | 상태 | Acceptance Criteria |
|----|------|------|------|---------------------|
| NAV-1 | 언어 토글 (ko/en/ja/zh) | 모든 페이지 헤더 | 구현됨 | 4개 언어 전환 시 모든 UI 텍스트가 prop 패턴으로 교체되고 URL/상태 유지 |
| NAV-2 | 테마 토글 (dark/light, dark 기본) | 모든 페이지 헤더 | 구현됨 | 토글 시 `data-theme` 속성 변경, `localStorage` 저장, ARIA label 제공 |

### 3.2 `/` Dashboard

| ID | 섹션 | 상태 | Acceptance Criteria |
|----|------|------|---------------------|
| DASH-1 | Hero — $CC 실시간 가격 | 구현됨 | SSE 스트림으로 가격 갱신, 연결 끊김 시 재연결, 마지막 업데이트 타임스탬프 노출 |
| DASH-2 | KPI Grid — Burn-Mint Ratio | 구현됨 | `usePrice` 또는 전용 훅 기반, 30s 갱신, 수치 + 전일 대비 delta 색상 표시 |
| DASH-3 | KPI Grid — Active Users | 구현됨 | 동일 카드 컴포넌트 재사용, 데이터 로딩 스켈레톤 제공 |
| DASH-4 | KPI Grid — Burn (누적/24h) | 구현됨 | 단위·포맷(locale별) 자동 변환, null 시 `—` 표시 |
| DASH-5 | KPI Grid — Private TX | 구현됨 | 기관 유저 활동 강조 문구 툴팁, 숫자 포맷 로케일 대응 |
| DASH-6 | Chart Tabs — price / burn / ratio | 구현됨 | 탭 전환 시 URL state 유지, 24h/7d/1m/3m 기간 버튼 동작, 키보드 조작 가능 |
| DASH-7 | Holder Preview | 구현됨 | 상위 N개 preview 후 "See all" → `/analytics` holders로 라우팅 |
| DASH-8 | Governance Preview | 구현됨 | 최근 CIP N건 표시, 클릭 시 `/feed` governance 앵커로 이동 |
| DASH-9 | Feed Preview Card | 구현됨 | 최신 트윗 N건, AI 번역 텍스트 노출, `/feed`로 이동 |

### 3.3 `/analytics`

| ID | 섹션 | 상태 | Acceptance Criteria |
|----|------|------|---------------------|
| ANA-1 | Reward Split Chart | 구현됨 | 카테고리별 비율 파이/스택, 범례 토글 가능 |
| ANA-2 | Cumulative Mint/Burn Chart | 구현됨 | 누적 라인 차트, 기간 셀렉터, zero line 기준 강조 |
| ANA-3 | Amulet Price Chart | 구현됨 | 시계열 라인 차트, hover tooltip, 로케일 통화 포맷 |
| ANA-4 | Exchanges Table (Spot + Derivatives) | 구현됨 | 각 거래소 로고·가격·거래량·직접 거래 URL, 실시간 5s 갱신 (`useRealtimePrices`) |
| ANA-5 | Holders Leaderboard | 구현됨 | 상위 홀더 정렬·검색, 주소 복사, Canton 익스플로러 링크 |

### 3.4 `/feed`

| ID | 섹션 | 상태 | Acceptance Criteria |
|----|------|------|---------------------|
| FEED-1 | Twitter Archive (Canton 트윗 AI 번역) | 구현됨 | 원문/번역 토글, 날짜 역순, 무한 스크롤 또는 페이지네이션 |
| FEED-2 | Governance Calendar (CIPs) | 구현됨 | CIP 목록·상태·마감일, 클릭 시 상세 또는 외부 링크 |
| FEED-3 | Ecosystem Guide | 구현됨 | Canton 생태계 프로젝트 소개, 카테고리별 그룹화 |
| FEED-4 | Participation Guide | 구현됨 | 한국어 온보딩 가이드, 단계별 설명, 외부 링크 |
| FEED-5 | Korean Companies Section 🏢 | 구현됨 | Binance, Upbit, Coinone, Bithumb, Marblex — 각 항목에 verification evidence(지갑 주소/트윗/공시) 링크 제공 |

---

## 4. Success Metrics

| Metric | 목표 | 측정 방법 | 상태 |
|--------|------|-----------|------|
| DAU | TODO | TODO: Vercel Analytics 또는 Plausible | TODO |
| Bounce Rate | TODO | TODO | TODO |
| Page Load Time (p75) | < 200ms (Vercel Edge) | TODO: Web Vitals / Lighthouse CI | 목표 설정, 자동 측정 TODO |
| Feed Engagement (트윗 클릭률) | TODO | TODO | TODO |
| Language Distribution | TODO | TODO: 토글 이벤트 로깅 | TODO |

> **TODO**: Phase 1 안정화 후 지표 베이스라인 수립.

---

## 5. Non-Functional Requirements

| 영역 | 요구사항 |
|------|---------|
| Performance | Vercel Edge 기준 초기 페이지 로드 p75 < 200ms, SSE 연결 유지, 클라이언트 번들 코드 스플리팅 |
| Refresh Intervals | 백엔드 rate limit 준수: `usePrice` 30s, `useRealtimePrices` 5s, 기타 훅은 ARCHITECTURE.md 참조 |
| i18n | 4언어(ko/en/ja/zh) prop 패턴, 기본값 ko, 전환 시 리렌더 없이 텍스트 교체 |
| Accessibility | WCAG 2.1 AA 준수 — 키보드 네비게이션 가능, ARIA label(테마 토글 필수), 색 대비 AA, 포커스 링 명확 |
| Audio/Motion | 오디오 없음. `prefers-reduced-motion` 대응 TODO |
| Security Headers | TODO: CSP, X-Frame-Options, Referrer-Policy — `next.config.js` headers 설정 확인 |
| Client Rate Limits | 동일 엔드포인트 중복 호출 방지 (SWR 캐시 키 일관성), 탭 비활성 시 refresh 중단 |
| Auth | 없음 — 공개 읽기 전용. 향후에도 최소 권한 원칙 |

---

## 6. Roadmap

| Phase | 상태 | 범위 |
|-------|------|------|
| **Phase 1 — Initial Deploy** | 🟢 진행 중 | Vercel 초기 배포, 3개 페이지(`/`, `/analytics`, `/feed`) 전 기능, 4언어, 다크/라이트, SSE 가격 스트림, 한국 거래소 섹션 |
| Phase 2 — TODO | ⚪ 예정 | TODO: 지갑 추적 알림, 개인화 대시보드, 포트폴리오 연동, KPI 확장, 텔레그램 봇 양방향 연동 |
| Phase 3 — TODO | ⚪ 예정 | TODO |

> **전환 조건**: Phase 1 → Phase 2는 성공 지표 베이스라인 수립 + 안정성 2주 연속 확인 후.

---

## 7. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성 (Phase 1 기능 인벤토리 확정) |
