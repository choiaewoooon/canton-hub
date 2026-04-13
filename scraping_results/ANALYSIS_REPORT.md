# Reference Sites Analysis Report

## 1. CantonScan (cantonscan.com)

### 네비게이션 구조
| 메뉴 | URL | 설명 |
|------|-----|------|
| Home | `/` | 네트워크 Overview + 최신 활동 |
| Blockchain > Updates | `/updates` | 온체인 트랜잭션(Update) 목록 |
| Blockchain > Transfers | `/transfers` | CC 토큰 전송 목록 |
| Network > Mining Rounds | `/mining-rounds` | 마이닝 라운드별 Mint/Burn 데이터 |
| Network > Traffic Purchases | `/traffic-purchases` | 트래픽 구매 내역 |
| Network > Super Validators | `/supervalidators` | 슈퍼 밸리데이터 목록 |
| Network > Validators | `/validators` | 밸리데이터 목록 |
| Statistics | `/stats` | 전체 네트워크 통계 차트 |
| Featured Apps | `/featured-apps` | Canton 생태계 앱 목록 |
| Governance | `/governance` | 거버넌스 관련 |

### 홈페이지 핵심 기능 및 의미
1. **Network Overview 대시보드**
   - **Activity History 차트** (24H/7D/1M 필터): Private Updates vs Public Updates 추이 → 네트워크 사용량/활성도 지표
   - **CC Price 차트** (24H/7D/1M 필터): $CC 토큰 가격 추이
   - **Active Addresses (24hr)**: 82,156 — 24시간 내 활동한 고유 주소 수 → 네트워크 참여도
   - **Burn Volume (24hr)**: $2,626,654.58 — 24시간 소각된 CC의 USD 환산 → 네트워크 수수료 활동 규모
   - **CC Price**: $0.1543 — 현재 토큰 가격
   - **Total Circulation**: 38,281,781,747 CC — 유통 공급량
   - **Private Updates (24h)**: 689,472 (35.9%) — 프라이빗 트랜잭션 비율 → Canton의 프라이버시 특성 지표
   - **Total Transfers (24hr)**: 1,981,576 — CC 전송 건수

2. **Latest Updates 테이블**: 실시간 온체인 트랜잭션 목록 (Update ID, Events, Age, Migration ID)
3. **Latest Transfers 테이블**: 실시간 전송 목록 (From, To, Amount, Time)
4. **Connect Wallet**: 지갑 연결 기능
5. **Search**: Update ID 또는 Party ID 검색

### Stats 페이지 차트 (스크린샷 기반)
| 차트 | 의미 |
|------|------|
| Daily Burn/Mint Ratio | B/M 비율 추이 (>1 = 디플레이션) → 토큰 경제 건전성의 핵심 지표 |
| Daily Mint Activity | App Rewards + SV Rewards + Validator Rewards 분해 → 보상 분배 구조 |
| Daily Burn Activity | Fees + Traffic Purchases 분해 → 수수료 발생 구조 |
| Cumulative Mint Activity | 누적 민트량 → 전체 토큰 발행 추세 |
| Cumulative Burn Activity | 누적 소각량 → 전체 디플레이션 추세 |
| CC Supply | 전체 공급량 추이 |
| CC Market Cap | 시가총액 추이 |

### 디자인 특성
- **라이트 테마** 기본 (다크 모드 전환 가능)
- **카드 기반 레이아웃**: 핵심 지표를 카드로 배치
- **시간 필터**: 24H / 7D / 1M 토글
- **테이블 + 차트 혼합**: 실시간 데이터는 테이블, 추세는 차트
- **SVG 기반 차트**: 58개의 SVG 요소 (Recharts 등 사용 추정)

---

## 2. Canton Data Analytics by The Tie (canton.thetie.io)

### 네비게이션
- 단일 페이지 "Network Overview" (SPA, 하위 라우트 없음)

### 핵심 기능 및 의미
1. **상단 KPI 카드** (6개)
   - **Canton Coin Supply**: 38.28B — 전체 코인 공급량
   - **Total Super Validators**: 45 — 슈퍼 밸리데이터 수 → 네트워크 분산화 지표
   - **Total Validator Nodes**: 866 — 밸리데이터 노드 수 → 네트워크 보안/분산화
   - **Implied Market Cap**: $5.85B — 추정 시가총액
   - **On-Chain Conversion Rate**: $0.153 — 온체인 환산율 (Amulet 가격)
   - **Daily Fees**: $2.56M — 일일 수수료 → 네트워크 경제활동 규모

2. **Cumulative Validator Rewards Breakdown** (도넛 차트)
   - 밸리데이터별 누적 보상 비율 → 보상 집중도/분산도 분석

3. **30 Day Canton Coin Validator Leaderboard** (테이블)
   - 30일간 밸리데이터별 보상 랭킹 → 어떤 밸리데이터가 가장 활발한지

4. **Canton Coin Reward Split By Role Over Time** (스택 차트)
   - Validator / App / Super Validator 보상 비율 시계열 → 보상 구조 변화 추적

5. **Top 25 Apps by Total Rewards** (스택 바 차트)
   - 앱별 누적 보상 → Canton 생태계 내 앱 활성도

6. **Cumulative Metrics Over Time** (라인 차트)
   - Minted / Total Allowed / Total Balance 추이 → 토큰 발행 vs 소각 밸런스

7. **Burn Over Time** (라인 + 바 차트)
   - 누적 소각 + 일일 소각 → 디플레이션 추세

8. **Cumulative Unique Parties** (라인 차트)
   - 누적 고유 참여자 수 → 네트워크 성장

9. **Daily Active Users** (에리어 차트)
   - 일일 활성 유저 + 7일 평균 → 사용자 활동 추세

10. **Daily Transactions** (에리어 차트)
    - 일일 트랜잭션 + 7일 평균 → 네트워크 처리량

11. **Cumulative Participant Reward Leaderboard** (테이블)
    - 전체 참여자 누적 보상 (Validator/App/SV 분해) → 생태계 주요 플레이어

12. **Major Holders Leaderboard** (테이블)
    - 최대 CC 보유자 목록 → 토큰 분배 집중도

13. **30 Day Top Applications** (테이블)
    - 30일 앱 보상 랭킹 → 최근 활성 앱

### 디자인 특성
- **다크 테마** (블랙 배경 + 네온 강조색)
- **단일 롱 스크롤 페이지**: 모든 데이터를 한 페이지에 배치
- **차트 다양성**: 도넛, 라인, 바, 에리어, 스택 차트 혼합
- **Nuxt.js 기반 SPA**
- **테이블 + 차트 인터리브**: 리더보드(테이블)와 추세(차트) 교차 배치

---

## 3. StockHub (stockhub.kr)

### 네비게이션 구조
| 메뉴 | URL | 설명 |
|------|-----|------|
| 뉴스 | `/` | 메인 뉴스 피드 |
| 인사이트 | `/insights` | 분석/인사이트 |
| 일정 | `/events` | 경제 일정 |
| 시장 | `/markets` | 시장 데이터 |
| 차트 | `/charts` | 차트 도구 |
| 리서치 | `/research` | 리서치 리포트 |
| 스마트머니 | `/smart-money` | 스마트 머니 추적 |
| 커뮤니티 | `/community` | 커뮤니티 |

### 서브 메뉴 (일정)
- 경제 캘린더
- 실적 캘린더
- FOMC 일정

### 홈페이지 핵심 기능 및 의미
1. **뉴스 피드 (메인 콘텐츠)**
   - 실시간 미국주식 뉴스를 카드/리스트 형태로 배치
   - 뉴스 분류/필터링 가능
   - 속보와 일반 뉴스 구분

2. **실시간 알림**: 텔레그램 채널 연동 (`t.me/stockhubkr`)

3. **검색 기능**: 뉴스/종목 검색

4. **다양한 콘텐츠 유형**:
   - 뉴스 (실시간 속보)
   - 인사이트 (분석)
   - 캘린더 (경제/실적/FOMC 일정)
   - 시장 데이터
   - 차트
   - 리서치
   - 스마트머니 (기관 투자 동향)
   - 커뮤니티

### 디자인 특성
- **뉴스 중심 레이아웃**: 투 컬럼 카드 그리드
- **상단 고정 네비게이션 바**: 주요 메뉴 + 서브메뉴 드롭다운
- **빨간색 액센트 컬러**: 속보/중요 뉴스 강조
- **SVG 79개**: 아이콘 및 차트 요소
- **반응형 디자인**: 모바일 대응

---

## 공통 패턴 및 시사점

### 데이터 레이어
| 기능 | CantonScan | TheTie | StockHub |
|------|-----------|--------|----------|
| 가격 데이터 | O | O | O |
| 네트워크 지표 | O | O | - |
| 밸리데이터/노드 | O | O | - |
| 뉴스/소식 | - | - | O |
| 리더보드 | - | O | - |
| 실시간 테이블 | O | O | - |
| 차트/추세 | O | O | O |
| 검색 | O | - | O |
| 캘린더/일정 | - | - | O |

### UI/UX 패턴
1. **KPI 카드 상단 배치**: 핵심 수치를 한눈에 (CantonScan, TheTie)
2. **시간 필터 (24H/7D/1M)**: 기간별 데이터 전환
3. **차트 + 테이블 혼합**: 추세는 차트, 상세는 테이블
4. **다크/라이트 테마**: 금융 데이터는 다크 테마 선호
5. **단일 페이지 vs 멀티 페이지**: TheTie는 롱스크롤, CantonScan은 멀티페이지
