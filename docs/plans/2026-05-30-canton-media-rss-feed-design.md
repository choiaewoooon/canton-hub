# Canton 미디어 RSS 피드 + 유형 태깅 — 설계 (Spec 1)

- 작성일: 2026-05-30
- 상태: 설계 승인 대기
- 범위: **Spec 1** (RSS 미디어 수집 + 통합 타임라인 + 뉴스 유형 자동 태깅)
- 후속: **Spec 2** (유형별 가격영향 점수화 / 이벤트 스터디) — 본 문서 말미 부록에 결정사항만 기록, 별도 스펙으로 진행

---

## 1. 배경 / 목적

Canton Hub의 기존 피드는 트위터 전용(@CantonNetwork, @CantonFdn)이다. Canton 관련 **미디어/뉴스 업데이트**를 RSS로 수집해 같은 화면에 노출하고, 각 뉴스를 **유형별로 자동 분류**해 배지로 보여준다. 이를 통해 사용자가 Canton 생태계 소식을 한 곳에서 보고, 소식의 성격(파트너십/밸리데이터/ETF/토크노믹스 등)을 한눈에 파악하게 한다.

기존 인프라 재사용:
- 콜렉터 패턴 (`collect_X(cache)` + `_loop` 등록, 예외 내부처리)
- DeepL 번역 (`api/translator.py::translate_ko`)
- Anthropic 요약 (`tweet_summarizer.py` 패턴 — 본 건은 Haiku 사용)
- 피드 표시 컴포넌트 (`feed/feed-card.tsx`, `feed-page/twitter-archive.tsx`) + `useFeed` SWR 훅
- 파일 캐시 폴백 패턴 (`data/*.json` 링버퍼, `kpi_history` 참고)

## 2. 결정사항 (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 소스 | Google News `"Canton Network"` + `canton.network/blog/rss.xml` + `blog.digitalasset.com/blog/rss.xml` |
| 화면 통합 | **트위터 + 미디어 통합 타임라인** (시간순 단일 스트림, 소스/유형 배지로 구분) |
| 병합 위치 | **라우트에서 병합** (`/api/feed`가 트윗 캐시 + 미디어 캐시를 요청 시 병합) |
| 아이템 가공 | 제목 4개국어 번역(DeepL) + **Haiku 한줄 요약** + **유형 태깅**(요약과 동일 호출) |
| 갱신 주기 | **1시간** 폴링. 신규 아이템만 LLM 처리 (비용은 폴링 횟수 아닌 신규 기사 수에 비례) |
| 요약 모델 | **Claude Haiku** (뉴스 한 줄엔 충분, Sonnet 대비 ~10배 저렴) |
| 비용 | 폴링·feedparser·DeepL 무료티어 = 0원, Haiku 요약 월 ~수백 원 |

## 3. 데이터 흐름

```
[1시간마다] collect_media(cache)            ← 신규 콜렉터
  1. feedparser로 3개 피드 GET (config.MEDIA_FEEDS)
  2. 각 엔트리 → {url, guid, publisher, title, published_at(ts), description}
  3. dedup: data/media_items.json 링버퍼(최근 MEDIA_MAX=60건)의 url/guid와 대조
  4. 신규 아이템만:
       a. news_summarizer.summarize_and_classify(title, description)
          → Haiku 1회 호출 → {summary_ko, category_key}   (JSON 강제)
       b. translate_ko로 title·summary를 en/ja/zh 번역 (실패 시 ko/원문 폴백)
       c. 레코드 저장:
          {url, ts, publisher, category_key,
           title:{ko,en,ja,zh}, summary:{ko,en,ja,zh}}
  5. 링버퍼에 머지 후 ts 내림차순 정렬 → data/media_items.json 저장
  6. cache.set("media:items", records, ttl=7200)   # 2h, 폴링 주기의 2배

[요청 시] GET /api/feed?lang=ko
  1. tweets = cache.get(f"feed:{lang}")  (기존)
  2. media  = cache.get("media:items")   (lang 필드 선택해 FeedItem으로 매핑)
  3. 병합 → ts 내림차순 정렬 → time_ago 재계산(_relative_time)
  4. return {lang, items:[...merged], ai_summary}   # ai_summary는 트윗 다이제스트 유지
```

핵심 설계 의도:
- 트윗(2회/일)과 뉴스(1시간)의 **상이한 주기를 독립**시키기 위해 캐시를 분리하고 라우트에서만 병합.
- `ai_summary`(트윗 요약 블록)는 그대로 유지. 뉴스는 요약 블록에 섞지 않고 **타임라인 아이템**으로만 노출.
- 정렬을 위해 트윗 아이템에도 ISO `ts`를 추가(현재는 `time_ago` 문자열만 있음).

## 4. 뉴스 유형 분류 체계 (2026 데이터 기반 도출)

코드 키(영문 snake_case) / 라벨(ko·en) / 색상은 거버넌스 CIP 카테고리 패턴을 따른다.

| key | ko | en | 2026 사례 |
|---|---|---|---|
| `partnership` | 파트너십·생태계 | Partnership | LayerZero, Chainlink, Zebec, EDENA, Kresus |
| `validator` | 밸리데이터·SV | Validator | Global Settlement Network, Visa(SV), SV 45+ |
| `etf_product` | ETF·ETP 상장 | ETF / ETP | 21Shares TCAN, Bitwise BWCC |
| `institutional` | 기관 파일럿·채택 | Institutional | HSBC, DTCC 국채, Franklin Templeton |
| `dat_vehicle` | DAT·상장사 | Treasury Vehicle | Canton Strategic Holdings(CNTN) |
| `tokenomics` | 토크노믹스·거버넌스 | Tokenomics | Dev Fund(CIP-0082/0100), CIP-0105, liveness 보상 종료 |
| `funding` | 펀딩·기업가치 | Funding | Digital Asset a16z $2B 라운드 |
| `network_metric` | 네트워크 지표 | Network Metric | 프로토콜 수수료, 트랜잭션 수 |
| `other` | 기타·분석 | Other | Messari 리포트, 분석 기사 |

분류는 Haiku 프롬프트에 위 키 목록과 1줄 정의를 주고 **하나의 key를 선택**하게 한다. 불확실하면 `other`.

## 5. 데이터 모델

### 백엔드 캐시 키
- 신규: `media:items` → lang-무관 레코드 배열(모든 언어 필드 포함). TTL 7200s.
- 기존: `feed:{lang}` 유지(트윗). 라우트에서 병합.

### 프론트 타입 (`web/lib/types.ts`, 기존 `FeedItem` 확장 — 하위호환)
```ts
export interface FeedItem {
  kind: "tweet" | "news";   // NEW — 렌더 분기 (기본값 처리: 미존재 시 tweet 취급)
  source: string;           // "@CantonNetwork" | "CoinDesk" | "Canton Blog"
  time_ago: string;
  ts: string;               // NEW — ISO 타임스탬프 (정렬/표시)
  text: string;             // tweet=본문 / news=번역된 한줄 요약
  url: string;
  title?: string;           // NEW — news 헤드라인(번역본). tweet은 없음
  category?: string;        // NEW — news 유형 key (위 표). tweet은 없음
}
```
`FeedData`는 변경 없음(`{lang, items, ai_summary}`).

## 6. UI (통합 타임라인)

### `/feed` — `twitter-archive.tsx` → 통합 피드로 확장
- 제목: "Canton 트위터 아카이브" → "Canton 피드" / "Canton Feed" / etc.
- `item.kind`로 렌더 분기:
  - **news**: 유형 배지(색상) + 제목(굵게) + 한줄 요약(text) + 출처 칩 + 시간
  - **tweet**: 기존 모양(@핸들 + 본문)
- 유형 메타 맵(key→{ko,en,color})은 컴포넌트 상수로(거버넌스 CIP 카테고리 패턴 참고). 색상은 `var(--canton-*)`/zinc 변수만 사용(하드코딩 금지).
- `ai_summary` 블록(트윗 다이제스트) 유지.

### 대시보드 — `feed/feed-card.tsx`
- 상위 3~5건 동일 `kind` 분기 렌더(뉴스는 제목+유형배지, 트윗은 기존).
- "모든 소식 보기 →" 링크를 `/feed`로 연결(현재 `#`).
- 현재 `feed-card.tsx`는 일부 문자열("AI 번역" 등)이 ko/en 하드코딩이다. **본 작업에서는 대시보드 카드 문자열을 ko/en 유지**(기존 동작 보존), 4개국어 확장은 별도 폴리시로 미룸. 단 뉴스 아이템의 `title`/`text`/유형 라벨은 `lang`에 따라 번역본 표시.

### 제약 (web/CLAUDE.md 준수)
- Next.js 16 App Router, `"use client"`, Tailwind v4 CSS 변수, Tremor 우선.
- API 호출은 `useFeed` 훅 경유, `fetch` 직접 금지.
- `next/image`로 favicon 등 외부 이미지 쓸 경우 `next.config.ts` remotePatterns 등록.

## 7. 설정 / 의존성

### `config.py` 추가
```python
# 미디어 RSS 피드 (무료, 키 불필요)
MEDIA_FEEDS = [
    {"name": "Google News", "url": "https://news.google.com/rss/search?q=%22Canton+Network%22&hl=en-US&gl=US&ceid=US:en"},
    {"name": "Canton Blog", "url": "https://www.canton.network/blog/rss.xml"},
    {"name": "Digital Asset", "url": "https://blog.digitalasset.com/blog/rss.xml"},
]
MEDIA_MAX = 60                       # 링버퍼 보관 건수
ANTHROPIC_NEWS_MODEL = "claude-haiku-4-5-20251001"
```
- 신규 시크릿 **없음** (`ANTHROPIC_API_KEY`는 `tweet_summarizer.py`에서 `os.getenv`로 직접 읽음, `DEEPL_API_KEY`는 config 기존).
- `requirements.txt`에 `feedparser` 추가.
- 참고: 기존 `tweet_summarizer.py`는 `MODEL = "claude-sonnet-4-6"`을 모듈 상수로 하드코딩한다. `news_summarizer.py`는 이와 달리 **모델을 `config.ANTHROPIC_NEWS_MODEL`에서 읽는다**(설정 일원화). 구현 시 Haiku 모델 ID가 유효한지 확인할 것.

## 8. 엣지 케이스 / 폴백

| 상황 | 처리 |
|---|---|
| 피드 1개 다운/타임아웃 | 해당 피드만 skip, 나머지 진행 (콜렉터 예외 내부처리 원칙) |
| Haiku 요약 실패 | summary 없이 제목만, category=`other` 폴백 |
| DeepL 실패/쿼터 초과 | 해당 언어를 ko(또는 원문 en)로 폴백 (translate_ko가 None 반환) |
| Google News 중복 기사 | url 정규화 + guid 기준 dedup |
| 백엔드 재시작 | `media_items.json`에서 복원, 기존 아이템 **재요약 안 함**(비용 0) |
| Google News redirect url | guid를 dedup 키 우선 사용 |
| 배치 중간 실패 | 각 신규 아이템의 LLM 요약+번역을 **완료한 뒤 링버퍼에 머지·저장** — 반쯤 처리된 레코드가 파일에 남지 않도록 (아이템 단위 try/except, 실패분은 다음 폴링에서 신규로 재시도) |

## 9. 변경 파일 (논리 단위)

**신규**
- `collectors/media_collector.py` — RSS fetch + 파싱 + dedup + 링버퍼
- `news_summarizer.py` — Haiku 요약+분류 (tweet_summarizer 패턴)

**수정**
- `api/scheduler.py` — `collect_media` 추가, `_loop(collect_media, cache, 3600, "media")` 등록, `_deferred_initial`에 추가, 트윗 아이템에 `ts` 부여
- `api/routes/feed.py` — 트윗+미디어 병합·정렬·time_ago 재계산
- `config.py` — `MEDIA_FEEDS`, `MEDIA_MAX`, `ANTHROPIC_NEWS_MODEL`
- `requirements.txt` — `feedparser`
- `web/lib/types.ts` — `FeedItem` 확장
- `web/components/feed-page/twitter-archive.tsx` — 통합 타임라인 렌더
- `web/components/feed/feed-card.tsx` — 뉴스 아이템 렌더

**문서**
- `docs/ARCHITECTURE.md` — Cache Key Map(`media:items`), 콜렉터/라우트
- `docs/DATA_GUIDE.md` — 신규 데이터 소스(RSS 3종)

## 10. 검증 (Evidence-Based Completion)

| 주장 | 증거 |
|---|---|
| 콜렉터 동작 | uvicorn 기동 후 로그에 `Media cached: N items` 출현 |
| RSS 파싱 정상 | `curl localhost:8000/api/feed?lang=ko` → items에 `kind:"news"` 포함 |
| 유형 태깅 정상 | 응답 items의 news 항목에 유효한 `category` key |
| 4개국어 | `?lang=ja` 등에서 title/text가 번역되어 옴 |
| 타입 정합성 | `cd web && npx tsc --noEmit` exit 0 |
| 프론트 빌드 | `npm run build` exit 0 |
| 통합 타임라인 | 브라우저에서 트윗·뉴스 시간순 혼합 + 유형 배지 확인 |

## 11. 비범위 (Out of Scope, Spec 1)

- 가격영향 점수화 / 이벤트 스터디 (→ Spec 2)
- 2026 과거 이벤트 백필 (→ Spec 2)
- 유형별 필터 UI, 무한스크롤 (추후)
- 본문 전체 fetch (RSS description으로 충분)

---

## 부록 A. Spec 2 — 유형별 가격영향 점수화 (결정사항 보존용)

> 별도 스펙으로 진행. 여기서는 브레인스토밍에서 합의한 방향과 방법론만 기록한다.

**목표**: 각 뉴스 유형이 $CC 가격에 긍정/부정/무영향이었는지 과거 추세를 점수화하여, "토크노믹스 개편 같은 이벤트의 과거 경향"을 참고 지표로 제공.

**합의된 방법론**
- 측정: **절대수익 + BTC 대비 초과수익 둘 다 표시** (시장 베타 제거로 Canton 고유 효과 분리, 사용자가 양쪽 판단).
- 이벤트 윈도우: T-1일 → T+1일(24h) 기준. 옛 이벤트는 CoinGecko 일봉 해상도.
- 라벨: 초과수익 임계치로 긍정/부정/무영향 분류.
- 집계: 유형별 평균 초과수익 + 적중률(% 긍정) + **표본 수 동시 표시**.

**반드시 지킬 원칙 (신뢰도)**
- 표본이 작다(일부 유형 n=1~3). **"예측"이 아니라 "과거 경향(참고용)"**으로 프레이밍. 표본 수 항상 노출.
- 같은 날 복수 이벤트 → 귀속 모호성 존재. 한계 명시.
- 과거 데이터: RSS는 최근 ~1개월만 → 2026 전체 이벤트셋은 큐레이션 시드 데이터로 별도 구축.

**데이터 소스**
- 가격: CoinGecko `canton-network` market_chart/range (일봉 과거치) + BTC.
- 이벤트: Spec 1의 `media_items` 누적분 + 큐레이션된 2026 시드.
