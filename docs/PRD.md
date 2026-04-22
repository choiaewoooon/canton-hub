# Canton Hub — Product Requirements Document

> **Update triggers**: 신규 엔드포인트 추가 / 페르소나 변경 / 성공 지표 확정 / 로드맵 단계 전환 시 즉시 갱신
> **Owner**: Canton Hub Backend
> **Related docs**: `ARCHITECTURE.md`, `SYSTEM_OVERVIEW.md`, `DATA_GUIDE.md`

---

## 1. Product Vision

Canton Hub는 Canton Network($CC)의 온체인 상태, 가격, 거래소 분포, 거버넌스, 한국 기업 참여 현황을 **한 화면에서 실시간**으로 확인할 수 있는 웹 대시보드이다. 기존 텔레그램 채널 구독자와 한국 개인 투자자를 주 타깃으로 하되, Canton의 **기관 중심 정체성(Private TX, Super Validator, B/M Ratio)** 을 손상시키지 않는 데이터 표현을 지향한다. 목표는 "Canton을 이해하기 위해 여러 탭을 열 필요가 없게 만드는 것"이다.

---

## 2. User Personas

| # | 페르소나 | 주요 니즈 | 핵심 기능 | 언어 |
|---|---------|----------|----------|------|
| P1 | 한국 개인 투자자 (primary) | 가격, 거래소간 차익, 한국어 요약 | `/api/price`, `/api/analytics/realtime-prices`, `/api/feed?lang=ko` | ko |
| P2 | Canton 파워유저 / 리서처 | B/M Ratio, burn 분석, 거버넌스 투표, 홀더 집중도 | `/api/network`, `/api/analytics/burn-breakdown`, `/api/governance`, `/api/analytics/holders` | en |
| P3 | 한국 거래소 / 기관 분석가 | KR 기업 지갑 추적, 10개 거래소 실시간 가격 | `/api/analytics/kr-companies`, `/api/analytics/realtime-prices`, `/api/analytics/exchanges` | ko/en |

---

## 3. Feature Inventory

범례: **P0** = 필수(launch blocker) / **P1** = 중요 / **P2** = 보조
상태: **구현됨** / **개선필요** / **계획**

| Endpoint | 설명 | Persona | Priority | Status | Acceptance Criteria |
|----------|------|---------|----------|--------|---------------------|
| `GET /api/price` | $CC 현재가, 24h 변동률, 고저, 시총 | P1, P2, P3 | P0 | 구현됨 | 30s 이내 최신가 반영 / CoinGecko 실패 시 fallback 또는 last-known 반환 / `price`, `change_24h`, `high_24h`, `low_24h`, `market_cap` 필드 보장 |
| `GET /api/network` | Burn-Mint Ratio, 일일 mint/burn, 24h active addresses, daily burn USD, Private TX ratio/count | P2, P3 | P0 | 구현됨 | `bm_ratio` 수치 + `deflationary`/`inflationary` 플래그 / Private TX ratio는 기관성 지표로 강조 / 24h 기준 통일 |
| `GET /api/chart/{type}?period=` | price/burn/ratio 타임시리즈 (24h/7d/1m/3m) | P1, P2 | P0 | 구현됨 | 4개 period × 3개 type = 12 조합 모두 동작 / 빈 데이터 시 `[]` 반환 / 타임스탬프 ISO8601 UTC |
| `GET /api/feed?lang={ko,en,ja,zh}` | Canton 공식/파트너 트윗 + AI 번역 + AI 요약 | P1 | P0 | 구현됨 | 4개 언어 지원 / 번역 캐시로 중복 호출 차단 / 원문 및 요약 분리 필드 |
| `GET /api/governance` | CIP proposals, active/final counts, category stats | P2 | P1 | 구현됨 | 현재 active CIP 개수 정확 / 카테고리별 집계 제공 / 종료된 투표 결과 포함 |
| `GET /api/analytics/realtime-prices` | 10개 거래소 5초 폴링, lowest/highest, arbitrage spread | P1, P3 | P0 | 구현됨 | 5초 갱신 주기 유지 / Hyperliquid, Extended, Aster, Lighter, Bybit, OKX, Kraken, Binance Futures + DEX 포함 / spread = (max-min)/min·100 |
| `GET /api/analytics/realtime-prices` (SSE) | 위 동일 데이터의 Server-Sent Events 스트림 | P1, P3 | P0 | 구현됨 | keep-alive 유지 / 연결 끊김 시 클라이언트 재연결 지원 / 5s 이하 지연 |
| `GET /api/analytics/exchanges` | spot + derivatives 상장 목록, 거래 URL | P1, P3 | P0 | 구현됨 | 각 거래소 직행 URL 제공 / spot vs perp 구분 / 신규 상장 수동 등록 가능 |
| `GET /api/analytics/reward-split` | app/validator/super-validator 보상 분배 | P2 | P1 | 구현됨 | 3개 카테고리 합계 100% / 히스토리컬 또는 최신 스냅샷 명시 |
| `GET /api/analytics/amulet-price` | 히스토리컬 amulet 가격 | P2 | P1 | 구현됨 | 시계열 반환 / $CC와 환산 관계 주석 |
| `GET /api/analytics/cumulative` | 누적 mint/burn supply | P2 | P1 | 구현됨 | 누적값 단조성(monotonic) 보장 / 일 단위 포인트 |
| `GET /api/analytics/burn-breakdown` | burn: fees vs traffic 분리 | P2 | P1 | 구현됨 | fees/traffic 합 = total burn / 두 소스 모두 0 이상 |
| `GET /api/analytics/holders` | top holders + organization + category (SV/validator/app) | P2, P3 | P0 | 구현됨 | category 필드 enum (`super_validator`/`validator`/`app`/`unknown`) / 상위 N개 설정 가능 |
| `GET /api/analytics/kr-companies` | 한국 거래소 참여 현황 (Binance Global, Upbit, Coinone, Bithumb, Marblex) + verification_status | P1, P3 | P0 | 구현됨 | `verification_status` + `confidence` (high/medium/low) + `evidence` 필드 필수 / **Canton은 공식 KYC 없음 → 온체인 증거만 사용** |

---

## 4. Success Metrics

> 실제 목표치는 런칭 후 베이스라인 측정 후 확정한다.

| Metric | 정의 | 목표 | 측정 방법 |
|--------|------|------|----------|
| DAU | 일일 대시보드 방문자 | TODO | Vercel Analytics |
| Telegram → Web 전환율 | 텔레그램 링크에서 유입된 사용자 비율 | TODO | UTM 파라미터 |
| P50 API latency (`/api/price`) | 중앙값 응답시간 | < 300ms | uvicorn 액세스 로그 |
| P95 API latency (realtime-prices) | 상위 95% 응답시간 | < 800ms | uvicorn 액세스 로그 |
| SSE 연결 유지 시간 | 평균 연결 지속 | TODO | 서버 로그 |
| Feed 언어별 사용 비율 | ko/en/ja/zh 호출 비율 | TODO (ko ≥ 60% 가설) | API 로그 |
| KR company data confidence 분포 | high/medium/low 비율 | high ≥ 70% | `/api/analytics/kr-companies` 집계 |
| Rate-limit 위반 횟수 | CoinGecko/RapidAPI 초과 건수 | 0 | 에러 로그 |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| 항목 | 요구사항 |
|------|---------|
| 가격 갱신 주기 | 일반 price 30s, realtime-prices 5s |
| SSE 지연 | 서버 push → 클라이언트 수신 < 1s |
| API cold start | launchd가 상시 구동 (`KeepAlive=true`) — cold start 없음. 터널 재연결 시 지연 < 30s |

### 5.2 Internationalization

- 지원 언어: `ko`, `en`, `ja`, `zh` (feed API 기준)
- UI 레벨 i18n은 프런트엔드(Vercel) 책임, 백엔드는 언어 쿼리 파라미터를 받음
- AI 번역 결과는 캐시하여 동일 원문 재요청 시 LLM 호출 금지

### 5.3 Accessibility & Theming

- Dark / Light 테마 토글 (프런트엔드)
- WCAG 기준: TODO (런칭 전 감사 필요)

### 5.4 Security

- 모든 외부 API 키는 환경변수로만 보관
- 공개 엔드포인트는 읽기 전용, mutation 없음
- CORS: Vercel 프런트엔드 도메인만 허용
- Rate limit: 클라이언트당 IP 기준 TODO

### 5.5 External Rate Limits

| 소스 | 제한 | 대응 |
|------|------|------|
| CoinGecko | 무료 티어 limit 준수 | 30s 서버 캐시 |
| RapidAPI (거래소) | 플랜별 상이 | 5s polling + 공유 캐시 |
| DEX RPC | 자체 한도 | 장애 시 fallback 값 유지 |

### 5.6 Data Integrity

- **KYC 부재 원칙**: Canton Network는 공식 KYC가 없으므로 거래소/기업 식별은 **온체인 증거 + confidence rating** 으로만 수행
- `verification_status`, `confidence`, `evidence` 3필드 없이는 `kr-companies` 레코드 생성 금지

---

## 6. Roadmap

**Current Phase**: Post-split deployment (Backend → Mac local + Cloudflare Tunnel, Frontend → Vercel)

| Phase | 상태 | 주요 작업 |
|-------|------|----------|
| Phase 0 — Monolith | 완료 | 단일 FastAPI 앱에 모든 엔드포인트 구현 |
| Phase 1 — Split & Deploy | 완료 | Backend/Frontend 분리, Vercel 프론트 + Mac launchd 백엔드 + Cloudflare Quick Tunnel로 안정화 (2026-04 Fly.io 트라이얼 만료로 전환) |
| Phase 2 — Observability | 계획 | uvicorn 액세스 로그 분석 + Sentry + 구조화 로그, Success Metrics 베이스라인 측정 |
| Phase 3 — Data depth | 계획 | KR company 탐지 자동화, holder category 분류 정확도 개선, 거버넌스 투표 히스토리 확장 |
| Phase 4 — Community features | 계획 (TODO 검토) | 알림/워치리스트, 텔레그램 봇 연동 강화 |

---

## 7. Change Log

| 날짜 | 변경 | 이유 |
|------|------|------|
| 2026-04-14 | 초기 생성 | docs-init으로 자동 생성, backend 엔드포인트 인벤토리 전체 기술 |
