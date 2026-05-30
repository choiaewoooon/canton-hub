# Canton Hub UI/UX 개선 PRD

- **작성일**: 2026-05-30
- **대상 리포지토리**: `/Users/choejaewon/project/Ozzycanton/canton-hub`
- **이 문서의 독자**: **Claude Code (CLI/IDE)** — 실제 코드 변경을 수행할 에이전트
- **선행 필독 문서**:
  - `CLAUDE.md` (루트) — 백엔드 규칙 / 워크플로우 / Known Patterns
  - `web/CLAUDE.md` — 프론트엔드 규칙 (있다면)
  - `docs/ARCHITECTURE.md` — 라우트 맵, 캐시 키 맵
  - `docs/DEVELOPMENT_GUIDE.md` — 코딩 패턴

---

## 0. Claude Code 작업 진입 가이드

이 문서를 받은 Claude Code는 다음 순서로 작업을 시작한다:

1. **`Read` `CLAUDE.md`** — 프로젝트 규약·금지패턴 파악 (특히 Section 4 "Known Patterns & Anti-Patterns", Section 5 "Evidence-Based Completion")
2. **`TodoWrite`** — 이 PRD의 P0~P2 모든 항목을 TODO 리스트로 등록. 항목별로 `pending` 상태로 시작
3. **각 작업 진입 전** — 본 문서의 해당 섹션 + "Claude Code 작업 흐름" 블록 정독
4. **작업 단위는 P0-N / P1-N / P2-N 단위** — 한 항목 완료 후 검증 게이트 통과 시에만 다음 진행
5. **각 항목 완료 시** — `CLAUDE.md` Section 9 "Documentation Rules" 에 따라 관련 문서 함께 업데이트

> ⚠️ **추측 금지**: `CLAUDE.md` Section 6 "STOP Conditions"에 해당하는 상황이 발생하면 즉시 작업 중단하고 사용자에게 질문.

---

## 1. 배경

직접 https://canton-hub.vercel.app/ 에 들어가 대시보드 / 분석 / 피드 3개 페이지를 데스크탑 다크·라이트, 한·영·일·중 4개 언어 모드로 훑은 결과, 사이트의 정보 가치(특히 분석 페이지의 아비트라지 트래커, validator 집중도, 거래소 Canton 참여 현황)는 명확하나, 다음 표면적 결함이 베타 인상을 남기고 있음:

1. 비어 있는 시각화 위젯 (Burn Activity 카드의 placeholder 박스 7개)
2. 다국어 번역 누락 — 일/중/영 모드에서도 한국어 라벨이 잔존
3. 라벨 없는 플로팅 아이콘 (우측 가장자리)
4. 다크모드에서 색 대비 부족한 일부 요소
5. SEO/공유 메타 부재 (OG/Twitter 카드, hreflang)
6. 테스트 커버리지 0%에 가까운 핵심 로직 (`api/scheduler.py`)
7. 문서·운영 잔여물 (`docs/*.bak`, 루트 README 없음)

## 2. 목표 / 비목표

### 목표
- 첫 방문자가 "베타 같다"고 느끼는 시각적 결함 제거
- 다국어 모드 일관성 확보 (선언된 4개 언어 100% 번역)
- 텔레그램·트위터 공유 시 풍부한 OG 카드 노출
- 핵심 백엔드 로직의 회귀 방지 안전망 마련

### 비목표
- 디자인 시스템 전면 개편 / 신규 데이터 소스 / 모바일 앱 / Canton 공식 협업 표기

## 3. 성공 지표

| 지표 | 현재 | 목표 |
|---|---|---|
| 다크 + 일본어 첫 인상 "한국어 라벨 잔존" 발견 | 5+건 | 0건 |
| Burn Activity placeholder 렌더링 | 발생 | 제거 또는 실제 데이터 |
| 공유 시 OG 카드 노출 | 미설정 | 동적 OG |
| `api/scheduler.py` 라인 커버리지 | ~0% | ≥ 60% |
| 우측 플로팅 아이콘 `aria-label` 누락 | 다수 | 0 |

---

## 4. 우선순위별 개선안

### P0 — 베타 인상 즉시 제거 (1주차)

---

#### P0-1. Burn Activity 카드의 빈 박스 7개 처리

**문제**
- 대시보드의 `BurnActivityCard`가 일별 burn 막대그래프 의도로 보이는데, 7개 박스 전부 동일 높이 placeholder. 라벨·값·축·툴팁 부재. 다크모드에서 갈색 단색이 거슬리게 튐.

**Claude Code 작업 흐름**

```
1. Grep    : "Burn Activity" 또는 "burn-activity" 검색해 컴포넌트 위치 식별
2. Read    : 해당 컴포넌트 + 부모 page 파일 + props 추적
3. Grep    : api/routes/chart.py와 collectors/ 에서 burn 관련 데이터 셰이프 확인
4. Read    : api/scheduler.py 의 collect_charts 또는 daily_burn 관련 로직
5. Edit    : 컴포넌트에 실제 데이터 매핑 + Tailwind 다크모드 variant 적용
6. Bash    : 로컬 dev 서버 띄워서 데이터 흐름 검증 (`uvicorn api.main:app --reload --port 8000` + `cd web && npm run dev`)
7. Bash    : `curl http://localhost:8000/api/chart/burn` 응답 확인
```

**해결안 (택1)**
- **A (권장)**: 실제 일별 burn 수치(`/api/chart/burn` 또는 동급 엔드포인트)를 막대 높이로 정규화, hover 시 `YYYY-MM-DD: X.XM CC burned` 툴팁
- B: 데이터 7일 미만일 때만 스켈레톤, 충분 시 sparkline
- C: 카드 제거, 분석 페이지로 이동

**인수 기준**
- [ ] 7일치 burn 데이터를 막대 7개에 매핑, 최대값 기준 정규화
- [ ] hover 시 정확한 날짜·수치 툴팁
- [ ] 데이터 부재 시 카드 자체 미렌더링 (`null` return)
- [ ] 다크/라이트 양쪽에서 WCAG AA 통과
- [ ] `curl <api>/api/chart/burn`로 응답 shape 확인 → 컴포넌트와 일치

**영향 파일 (예상)**
- `web/components/**burn*` (컴포넌트 정확한 경로는 Grep으로 확인)
- `web/app/page.tsx`
- `web/lib/types.ts` (응답 타입 추가/수정 시)
- `api/routes/chart.py` (엔드포인트 없으면 신규)
- `docs/ARCHITECTURE.md` (Cache Key Map 갱신 필요 시)

**관련 도구·스킬**
- 기본: `Read`, `Edit`, `Grep`, `Bash`
- 검증: Playwright (이미 의존성) — 카드 스크린샷 비교
- 회귀 방지: `tests/api/test_chart.py`에 새 엔드포인트 테스트 추가

---

#### P0-2. 다국어 번역 누락 일괄 정비

**문제**
- "AI 번역" 배지: en/ja/zh 모드에서도 한글 노출
- 카드 제목 ("Network Status", "B/M Ratio Trend", "Today's Mint vs Burn", "Burn Activity"): ja/zh 모드에서 영어 고정
- 차트 축 라벨 / 거버넌스 카드 일부 라벨 미번역

**Claude Code 작업 흐름**

```
1. Read    : web/messages/{ko,en,ja,zh}.json 4개 파일 모두
2. Bash    : 4개 파일 key 차집합 확인
              jq -r 'keys[]' web/messages/ko.json | sort > /tmp/ko.keys
              jq -r 'keys[]' web/messages/en.json | sort > /tmp/en.keys
              (ja, zh도 동일)
              diff /tmp/ko.keys /tmp/en.keys
3. Grep    : 하드코딩된 영어/한국어 문자열 색출
              rg -t tsx -t ts '"[A-Z][a-zA-Z ]+"' web/components web/app
              rg -t tsx -t ts '"[가-힣]+"' web/components web/app
4. Edit    : 하드코딩 → t("...") 치환 + 4개 messages 파일에 키 추가
5. Write   : scripts/check-i18n.mjs 신규 작성 (key 차집합 검사)
6. Bash    : node scripts/check-i18n.mjs 실행, exit code 0 확인
7. Bash    : cd web && npm run build → 빌드 통과 확인
```

**해결안**
1. 모든 하드코딩 라벨을 `t()` 호출로 치환
2. `web/messages/{ko,en,ja,zh}.json` 키 셋 정렬 + 누락 0건 보장
3. 빌드 타임 i18n lint 스크립트 추가 (`scripts/check-i18n.mjs`)
4. CI 또는 `package.json` `prebuild`에 lint 훅 추가

**인수 기준**
- [ ] 4개 언어 × 3개 페이지 = 12개 조합 스크린샷에 외국어/한국어 혼재 0건
- [ ] `node scripts/check-i18n.mjs` exit 0
- [ ] i18n key 누락 시 빌드 실패하도록 `package.json` `prebuild` 훅 등록
- [ ] "AI 번역" 배지가 en 모드에서 "AI Translation", ja 모드에서 "AI 翻訳", zh 모드에서 "AI 翻译"

**영향 파일**
- `web/messages/{ko,en,ja,zh}.json` 전부
- `web/lib/i18n.ts`
- `web/components/**` 중 하드코딩 라벨 있는 모든 파일
- `web/app/layout.tsx` (`<html lang>` 동적화 포함 시)
- `scripts/check-i18n.mjs` (신규)
- `web/package.json` (prebuild 훅)

**관련 도구·스킬**
- 핵심: `Grep` (정규식으로 하드코딩 색출), `Edit` 일괄 치환
- 병렬화: 페이지별 독립적이므로 **`Task` 서브에이전트 3개 (대시보드/분석/피드)** 병렬 실행 가능 → 1번 메시지에서 동시 호출
- 검증: Playwright로 4개 언어 모드 스크린샷 자동 캡처 후 사람 검수

---

#### P0-3. 우측 플로팅 아이콘 라벨링

**문제**
- 우측 가장자리에 QR/번역 아이콘 2개가 떠 있고, hover 시 더 등장. `aria-label`·툴팁 부재.

**Claude Code 작업 흐름**

```
1. Grep    : "fixed right" OR "absolute right-0" OR "FloatingActions"로 컴포넌트 위치 찾기
2. Read    : 컴포넌트 + onClick 핸들러 추적해 각 버튼 의도 파악
3. AskUser : (의도 불명 시) 사용자에게 각 아이콘 용도 질의 → 답에 따라 라벨 또는 제거
4. Edit    : aria-label + title 부착, 또는 의도 불명이면 hidden 처리
```

**인수 기준**
- [ ] 모든 플로팅 버튼에 의미 있는 `aria-label`
- [ ] 키보드 포커스(Tab) 시 outline 표시
- [ ] hover 200ms 내 툴팁 노출
- [ ] axe-core 또는 Lighthouse Accessibility 95+

**영향 파일**
- `web/components/floating-actions.tsx` 또는 동급 (Grep으로 확정)
- `web/app/layout.tsx`

**관련 도구·스킬**
- 핵심: `Grep`, `Read`, `Edit`
- 검증: `Bash` + lighthouse CLI (`npx lighthouse <url> --only-categories=accessibility`)

---

#### P0-4. 다크모드 색 대비 보정

**문제**
- Private TX 진행 바의 "Public 8.8%" 슬리버가 다크 배경과 거의 동일 색
- (P0-1 해결 시 Burn Activity 박스 문제는 자연 해소)

**Claude Code 작업 흐름**

```
1. Grep    : "Private TX" 또는 "PrivateTx" 컴포넌트 위치 파악
2. Read    : Tailwind 클래스 확인 (특히 dark: variant 누락 여부)
3. Edit    : dark:bg-zinc-700 또는 border 추가
4. Bash    : axe-core CLI 또는 Lighthouse로 대비비 검증
```

**인수 기준**
- [ ] WCAG AA 대비비 (텍스트 4.5:1, 그래픽 3:1)
- [ ] 라이트/다크 양쪽에서 Public 슬라이스가 시각적으로 구분 가능

**영향 파일**
- `web/components/**private-tx*` (Grep 확정)

---

### P1 — 운영·신뢰 강화 (2주차)

---

#### P1-1. SEO / OG 메타 정비

**문제**
- `app/layout.tsx`의 metadata가 짧은 description 1줄. openGraph·twitter·alternates(hreflang) 비어 있음.

**Claude Code 작업 흐름**

```
1. Read    : web/app/layout.tsx
2. WebFetch: https://docs.claude.com 또는 Next.js 공식 (https://nextjs.org/docs/app/api-reference/functions/generate-metadata) 으로 metadata API 최신 시그니처 확인
3. Edit    : layout.tsx에 openGraph, twitter, alternates.languages 추가
4. Write   : web/app/opengraph-image.tsx (동적 1200×630 PNG) — 현재 가격 + sparkline + 로고
5. Edit    : web/app/analytics/page.tsx, web/app/feed/page.tsx 에 generateMetadata 추가
6. Bash    : cd web && npm run build → 빌드 통과
7. WebFetch: https://cards-dev.twitter.com/validator 또는 https://www.opengraph.xyz 로 OG 검증
```

**인수 기준**
- [ ] Twitter Card Validator / Facebook Sharing Debugger에서 풍부 카드 노출
- [ ] hreflang 4개 언어
- [ ] OG 이미지가 현재 CC 가격을 정확히 반영 (콜드스타트 후 60초 이내 갱신)

**영향 파일**
- `web/app/layout.tsx`
- `web/app/opengraph-image.tsx` (신규)
- `web/app/{analytics,feed}/page.tsx`
- `docs/ARCHITECTURE.md` (메타 전략 한 줄)

**관련 도구·스킬**
- 핵심: `Read`, `Edit`, `Write`, `Bash`
- 외부 검증: `WebFetch`로 Twitter Card Validator 등 호출
- 참고: Next.js의 `ImageResponse` API 사용 (Vercel Edge Function)

---

#### P1-2. 핵심 백엔드 로직 테스트

**문제**
- `api/scheduler.py` 874줄에 KST 윈도잉, AI 비용 게이팅(KST 00/12시), 11개 collector 루프. 0% 커버리지. 회귀 위험 큼.

**Claude Code 작업 흐름**

```
1. Read    : api/scheduler.py 전체 (또는 chunk 단위로 분할 읽기)
2. Grep    : "def _" 또는 "async def" 로 함수 시그니처 일괄 추출
3. Edit/Write: requirements-dev.txt 에 pytest-asyncio, freezegun 추가
4. Bash    : pip install -r requirements-dev.txt --break-system-packages
5. Write   : tests/scheduler/test_kst_window.py (시간 윈도잉)
6. Write   : tests/scheduler/test_ai_gating.py (KST 00/12시 외 호출 금지)
7. Write   : tests/scheduler/test_collect_*.py (각 collector 빈 응답 분기)
8. Bash    : pytest tests/scheduler/ --cov=api/scheduler --cov-report=term-missing
9. Verify  : 커버리지 ≥ 60% 확인
```

**인수 기준**
- [ ] `pytest --cov=api/scheduler` ≥ 60%
- [ ] freezegun으로 KST 23:59 / 00:01 / 12:01 시점 테스트 추가
- [ ] AI 호출이 게이팅 윈도우 외에는 트리거되지 않음 검증
- [ ] CI(있다면)에서 테스트 자동 실행

**영향 파일**
- `tests/scheduler/test_*.py` (신규)
- `requirements-dev.txt` (신규 또는 기존 추가)
- `pytest.ini` 또는 `pyproject.toml` (asyncio mode 설정)

**관련 도구·스킬**
- 핵심: `Read` (큰 파일이므로 chunk 단위), `Write`, `Bash`
- 병렬화: 각 collector 테스트는 독립적이므로 **`Task` 서브에이전트 여러 개** 병렬 작성 가능
- 슬래시 커맨드: 작업 완료 후 `/review` 로 self-review

---

#### P1-3. 모바일 그리드 검증 및 분기

**문제**
- 데스크탑만 검증됨. `app/page.tsx`의 `grid-cols-2`, `kpi-grid.tsx`의 `grid-cols-4`, 분석 페이지의 거래소 5열 카드 등이 모바일에서 깨질 가능성.

**Claude Code 작업 흐름**

```
1. Grep    : "grid-cols-" 패턴으로 분기 없는 그리드 색출
              rg "grid-cols-[2-9]" web/ -l
2. Write   : tests/e2e/responsive.spec.ts (Playwright)
              375×667 / 768×1024 / 1440×900 3개 viewport
              가로 스크롤 없음 확인
3. Bash    : npx playwright install chromium
4. Bash    : npx playwright test tests/e2e/responsive.spec.ts
5. Edit    : 깨지는 그리드에 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 분기 적용
6. Bash    : 재검증
```

**인수 기준**
- [ ] 3개 viewport에서 가로 스크롤 0
- [ ] KPI 카드 숫자가 셀에서 잘리지 않음
- [ ] Playwright 테스트가 CI에서 통과

**영향 파일**
- `web/app/{page,analytics,feed}.tsx`
- `web/components/**`
- `tests/e2e/responsive.spec.ts` (신규)
- `web/playwright.config.ts` (신규 또는 기존)

**관련 도구·스킬**
- 핵심: `Grep`, `Edit`
- 검증: **Playwright MCP** — 이미 백엔드에서 chromium 의존성 있으니 활용 권장
- 시각 확인: 스크린샷 비교 (Playwright의 `toHaveScreenshot`)

---

### P2 — 정리·문서화 (3주차)

---

#### P2-1. 데드코드 정리

**문제**
- `web/components/` 와 `web/components/ch/` 공존. `navbar/footer/network-status/theme-toggle` 양쪽 중복.

**Claude Code 작업 흐름**

```
1. Bash    : grep -r "components/ch" web/ --include="*.tsx" --include="*.ts"
2. 분석    : 어느 쪽이 실제 사용 중인지 확인
3. Edit    : 미사용 컴포넌트 디렉토리 삭제
4. Bash    : cd web && npm run build 및 npx tsc --noEmit → 빌드 통과 확인
5. Bash    : git status로 변경 파일 확인
```

**인수 기준**
- [ ] `grep -r "components/ch" web/` → 0건
- [ ] `npm run build` 통과
- [ ] `npx tsc --noEmit` 통과

**관련 도구·스킬**
- 핵심: `Bash` (grep + rm), `Edit`
- 안전망: `git diff` 확인 후 커밋

---

#### P2-2. 문서 잔여물 정리 + README 작성

**문제**
- `docs/ARCHITECTURE.md.bak` 등 `.bak` 5개 트래킹 중
- 루트 `README.md` 부재

**Claude Code 작업 흐름**

```
1. Bash    : find . -name "*.bak" -not -path "./.git/*" -not -path "./node_modules/*"
2. Bash    : git rm docs/*.bak README.md.bak (있다면)
3. Edit    : .gitignore 에 *.bak 추가
4. Write   : README.md (루트) — Quick Start, 디렉토리 트리, 데모 URL, 핵심 명령어
              → docx 스킬은 사용하지 말 것 (README는 마크다운)
5. Bash    : git ls-files | grep bak → 0건 확인
```

**인수 기준**
- [ ] `git ls-files | grep bak` 0건
- [ ] 루트 README.md 존재 + Quick Start 동작 (직접 따라해 본인 검증)
- [ ] `.gitignore`에 `*.bak` 등록

**관련 도구·스킬**
- 핵심: `Bash`, `Edit`, `Write`
- README 작성 시: 기존 `CLAUDE.md` 와 `docs/SYSTEM_OVERVIEW.md` 를 `Read`로 컨텍스트 흡수 후 작성

---

#### P2-3. 푸터 강화

**문제**
- 푸터에 데이터 소스 링크 4개만. 운영자 채널·피드백 동선 부재.

**Claude Code 작업 흐름**

```
1. Read    : web/components/footer.tsx (정확한 경로 Grep으로 확정)
2. AskUser : 노출할 채널(텔레그램 핸들, 깃허브 레포 URL 등) 사용자 확인
3. Edit    : 푸터에 채널 링크 + 데이터 신선도 표시 추가
4. Edit    : "마지막 캐시 업데이트 N초 전" 컴포넌트 (cache 응답 헤더 또는 별도 엔드포인트 활용)
```

**인수 기준**
- [ ] 운영자 도달 채널 최소 1개 노출
- [ ] 데이터 신선도 표시 (분 단위 정확도)

---

## 5. 일정 / 마일스톤

| 주차 | P0 | P1 | P2 |
|---|---|---|---|
| W1 (06/02~06/06) | P0-1, P0-2, P0-3, P0-4 | — | — |
| W2 (06/09~06/13) | — | P1-1, P1-3 | — |
| W3 (06/16~06/20) | — | P1-2 | P2-1, P2-2, P2-3 |

W1 종료 시점에 1차 배포 → 사용자 피드백 수집 → W3 마무리.

---

## 6. 변경 영향 / 리스크

| 변경 | 위험 | 완화책 |
|---|---|---|
| i18n 키 일괄 치환 | 컴포넌트 prop 전달 누락 | 빌드 타임 i18n lint + 4개 언어 스크린샷 회귀 |
| Burn Activity 데이터 연결 | API 응답 shape 변경 시 프론트 깨짐 | `web/lib/types.ts` 동시 업데이트 + `tsc --noEmit` |
| OG 동적 이미지 | Vercel function 콜드스타트 | 정적 OG로 1차 출시, 동적은 P1 후반 |
| `components/ch/` 삭제 | 어딘가 숨은 import 잔존 | 삭제 전 `grep -r "components/ch" web/` |
| 캐시 키 변경 | 워커 간 캐시 갈림 | `docs/ARCHITECTURE.md` Cache Key Map 동시 업데이트 |

---

## 7. 측정 / 검증 게이트

P0 완료 판단 기준:
1. **4개 언어 × 2개 테마 × 3개 페이지 = 24개 조합** 스크린샷에서 외국어/한국어 혼재 0건
2. axe-core 또는 Lighthouse Accessibility **95+** (라이트/다크 모두)
3. Twitter Card / 텔레그램 카드 실제 공유 테스트 통과 (Manual + WebFetch validator)
4. `pytest --cov=api/scheduler` ≥ **60%**
5. Playwright 모바일 viewport 3개에서 가로 스크롤 **0**
6. `npx tsc --noEmit` 및 `npm run build` 모두 통과

각 게이트는 Claude Code가 **실제 명령을 실행**하여 출력을 보고 확인할 것 (`CLAUDE.md` Section 5 "Evidence-Based Completion" 5단계 검증 게이트 준수).

---

## 8. Claude Code 도구·스킬 매핑 (종합 팁)

### 8.1 기본 도구 매핑

| 작업 유형 | 권장 도구 | 비고 |
|---|---|---|
| 코드 탐색 | `Grep` → `Read` | 항상 Grep으로 후보 좁힌 뒤 Read |
| 다파일 일괄 수정 | `Grep` → `Task` 서브에이전트 병렬 | 독립 영역이면 병렬화 |
| 단일 파일 수정 | `Edit` (단일 replace) 또는 `replace_all` | 변수 rename은 `replace_all` |
| 신규 파일 | `Write` (Read 선행 불필요) | 기존 덮어쓰기는 Read 필수 |
| 외부 API 검증 | `WebFetch` | Twitter Card Validator, OG.xyz 등 |
| 명령 실행 | `Bash` | uvicorn, pytest, npm 등 |
| 작업 추적 | `TodoWrite` | 이 PRD의 P0~P2를 그대로 등록 |

### 8.2 병렬화 권장 작업

다음 작업은 **`Task` 서브에이전트로 동시 실행**하면 시간 단축이 큼:

- P0-2 다국어 정비 — 페이지별(`/`, `/analytics`, `/feed`) 독립 → 3개 병렬
- P1-2 scheduler 테스트 작성 — collector별(11개) 독립 → 3~4개씩 병렬
- 코드 탐색 + 문서 탐색 동시 진행

> **병렬 호출 방법**: 단일 메시지 안에 여러 `Task` tool call을 한 번에 작성하면 동시 실행됨.

### 8.3 슬래시 커맨드 활용

| 시점 | 커맨드 | 효과 |
|---|---|---|
| 각 P0 항목 완료 후 | `/review` | 변경사항 self code review |
| W3 종료 시 | `/security-review` | 누락된 보안 이슈 점검 |
| 신규 컨벤션 발견 시 | (수동) `CLAUDE.md` Known Patterns 섹션 업데이트 |

### 8.4 관련 MCP / 외부 스킬

- **Playwright (워크스페이스에 chromium 의존성 이미 있음)** — P0-1, P0-2, P1-3 검증에 적극 활용
- **`WebFetch` 도구** — OG/Twitter 카드 검증 시 외부 validator URL fetch
- **`AskUserQuestion` 도구** — P0-3 (플로팅 아이콘 의도), P2-3 (푸터 채널) 등 사용자 결정 필요 시점에 사용

### 8.5 절대 하지 말 것

- ❌ 수집기(collector)에서 예외를 위로 throw — `CLAUDE.md` Section 4 Anti-pattern
- ❌ 하드코딩 URL — `config.py` 상수 사용
- ❌ `requests.` / `time.sleep` (블로킹) — `httpx` + `asyncio` 사용
- ❌ 코드 변경 후 launchctl kickstart 없이 "동작한다" 주장 — KeepAlive 프로세스는 구 코드를 메모리에 유지함 (`CLAUDE.md` Section 5 Evidence Table 참조)
- ❌ 영어 컬렉터에서 한국어 문자열 하드코딩 (또는 그 반대)
- ❌ 캐시 키 변경 시 `docs/ARCHITECTURE.md` Cache Key Map 미갱신

### 8.6 STOP 조건 (`CLAUDE.md` Section 6 보강)

다음 상황 발생 시 즉시 작업 중단 + `AskUserQuestion` 호출:

- Burn Activity 카드 본래 의도가 일별 막대인지, hourly heatmap인지 확신 안 설 때
- 우측 플로팅 아이콘의 실제 기능을 코드만으로 추정 불가할 때
- 다국어 4개 중 ja/zh 실제 트래픽 데이터 없이 셀렉트 유지 여부 결정해야 할 때
- 동일 collector가 3회 연속 실패 (`CLAUDE.md` Section 7)

---

## 9. 작업 완료 후 문서 업데이트 체크리스트

`CLAUDE.md` Section 9 "Documentation Rules" 에 따라 다음을 함께 업데이트:

- [ ] 새 라우트 추가 시 → `CLAUDE.md` Project Structure + `docs/ARCHITECTURE.md` API Contracts
- [ ] 새 컴포넌트 / 디렉토리 구조 변경 → `web/CLAUDE.md` (있다면) 또는 루트 `CLAUDE.md`
- [ ] 캐시 키 변경 → `docs/ARCHITECTURE.md` Cache Key Map
- [ ] `requirements.txt` / `package.json` 변경 → `CLAUDE.md` Tech Stack
- [ ] `.env.example` 변경 → `README.md` Env Vars + `DEPLOY.md`
- [ ] 새 버그 패턴 발견 → `CLAUDE.md` Known Patterns + `docs/DEVELOPMENT_GUIDE.md`
- [ ] 작업 완료 → `docs/SYSTEM_OVERVIEW.md` Phase History 추가
- [ ] 이 PRD 자체 → Change Log에 진행 상황 기록

---

## Change Log

| 날짜 | 변경 | 작성자 |
|---|---|---|
| 2026-05-30 | 초기 작성 (사이트 실사용 기반 피드백 정리) | Cowork 협업 세션 |
| 2026-05-30 | Claude Code 친화적으로 재구성 — 작업 흐름 / 도구 매핑 / 슬래시 커맨드 / 병렬화 팁 추가 | Cowork 협업 세션 |
