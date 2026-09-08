# Unit of Work Plan — AIways-On

> **단계**: INCEPTION / Units Generation — Part 1 (Planning)
> **작성**: 2026-09-08
> **선행**: Application Design 승인 완료 (컴포넌트 31개 · 서비스 5개 · AD-1~AD-6)

---

## 0. 이 단계의 범위

유닛 **개수와 이름은 이미 확정**되어 있다 — `aidlc-state.md` Team & Parallelization Constraint
(6명 = 공용 1 + 병렬 5), Q7 답변, D-14. 따라서 이 단계는 "몇 개로 나눌까"를 다시 묻지 않는다.

이 단계가 실제로 결정하는 것은 **6명이 하나의 리포·하나의 Next.js 앱에서 동시에 일할 수 있게
만드는 경계 조건**이다:

| 다루는 것 | 다루지 않는 것 |
|-----------|---------------|
| 스토리 56건의 유닛 배정과 착수 순서 | 유닛 개수 재조정 (확정됨) |
| 유닛 간 의존의 해소 순서 (인터페이스 동결 시점) | 컴포넌트 경계 (Application Design에서 확정) |
| 코드 조직 전략 — 디렉토리·소유권·스키마 파일 | 비즈니스 규칙·DB 컬럼·매니페스트 (SATISFIED) |
| 배포 아티팩트 소유자 | 인프라 설계 자체 (`10-k8s-infrastructure.md`) |

## 1. 해결해야 할 문제 → 질문 매핑

Application Design과 User Stories가 남긴 미결 사항을 질문으로 옮긴다. 각 질문은 실제 결함에
대응하며, 임의로 만든 질문은 없다.

| # | 문제 | 출처 | 해소 질문 |
|---|------|------|----------|
| **P-1** | U3에 스토리 18건(32%)·명세 27% 집중. 1인 배정 시 병목 | stories.md 관찰2, R-03 | Q1 |
| **P-2** | Could 0건 — 일정 압박 시 버릴 후보가 Should 10건뿐이고 유닛에 흩어져 있음 | stories.md 관찰1, R-01 | Q2 |
| **P-3** | 5개 유닛이 U1을 기다림. "U1 인터페이스 선언 완료"가 실제 차단 해제 지점인데 그 시점이 정의되지 않음 | component-dependency.md §6, R-02 | Q3 |
| **P-4** | U4·U5는 `SdlcRequestFactory` **구현**이 없으면 테스트를 못 씀 (TDD 강제 D-20와 충돌) | 의존 매트릭스 I 표기 | Q4 |
| **P-5** | Portal(SVC-1) 한 서비스에 5개 유닛 23컴포넌트가 들어감. 소유권 침범을 막을 장치 없음 | services.md SVC-1, R-05 | Q5 |
| **P-6** | `SdlcRequestFactory`는 U3 소유인데 U2·U4·U5 셋이 호출 → 세 유닛이 U3 진행에 묶임 | AD-3, 의존 매트릭스 | Q6 |
| **P-7** | 배포 단위 5개 중 3개(SVC-2·4·5)를 U3가 겸함. Dockerfile·chart 소유자 미정 | services.md, C-1.5 | Q7 |
| **P-8** | Drizzle 스키마 단일 소유(C-1.3)인데 6명이 동시에 테이블을 필요로 함 → 머지 충돌 핫스팟 | C-1.3 규약 | Q8 |
| **P-9** | Greenfield 단일 리포에서 5유닛이 `src/`를 공유하는 구체적 디렉토리 규칙 없음 | Q9=A(단일 repo), 00-overview §5 | Q9 |

---

## 2. 질문 (9건)

각 질문의 **권장안**은 근거와 함께 표시했다. 권장안에 동의하면 해당 문자만 적으면 된다.

### Question 1
U3의 스토리 18건(전체의 32%) 집중을 어떻게 처리할까요? (팀 6명 · 유닛 6개는 확정)

A) **6유닛·1인 배정 유지 + U3를 3개 트랙으로 내부 분할** — 트랙①상태머신·SR생성(C-3.1~3.4), 트랙②Pod·Runner(C-3.5·3.8·US-U3-18), 트랙③Slack·n8n(C-3.6·3.7·3.9). 트랙별 착수 시점을 다르게 잡아 한 사람이 순차 처리 *(권장 — n8n 3건은 D-18로 이미 시간축 분리 가능하고, 유닛 수·팀 배정을 건드리지 않아 파급이 가장 작음)*

B) **U3 일부를 다른 유닛으로 이관** — n8n 워크플로우(US-U3-14·15·16)와 Pod 이미지(US-U3-18)를 U1(PlatformOps)로 옮김. U3 18건 → 14건, U1 10건 → 14건

C) **U3에 2명 배정** — 대신 U4·U5를 1명이 겸임. 유닛 6개는 유지하되 담당자 매핑이 1:1이 아니게 됨

D) **U3를 두 유닛으로 분할 (총 7유닛)** — 6명 제약과 충돌하므로 팀 확대 또는 겸임 전제

X) Other (please describe after [Answer]: tag below)

[Answer]: A - 1명이 진행

### Question 2
Should 등급 10건을 유닛 산출물에 어떻게 표시할까요? (Must 46 / Should 10 / Could 0)

A) **유닛별 2배치로 명시** — 각 유닛의 스토리를 `배치1(Must)` / `배치2(Should)`로 나눠 story-map에 기록. 일정 압박 시 배치2부터 잘라내는 것이 기계적으로 가능해짐 *(권장 — Could가 0건이라 사전 합의된 절삭 후보가 Should뿐인데, 지금 표시해두지 않으면 절삭 판단을 마감 직전에 하게 됨)*

B) **배치 구분 없이 한 덩어리** — 유닛 안에서 담당자가 순서를 판단

C) **Should 10건을 v1.1로 즉시 연기** — v1 범위를 Must 46건으로 축소 (D-01 전체 범위 결정의 부분 철회에 해당)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3
5개 유닛의 차단을 푸는 "U1 인터페이스 동결" 시점을 어떻게 정의할까요?

A) **인터페이스 전용 PR을 최우선 머지** — U1 담당자가 ①`SharedTypes`(Stage·ChannelType·DTO·GitHubPort·MessagingPort·PodPort) ②`AuthGuard` 함수 시그니처 ③Drizzle 스키마 ④스캐폴딩만 담은 PR을 먼저 머지하고, 나머지 5명은 그 커밋을 기준으로 착수. 구현은 그 뒤에 채움 *(권장 — component-dependency.md §6가 이미 이 순서를 전제로 하고, 차단 구간을 "U1 완료"에서 "선언 완료"로 줄이는 유일한 방법)*

B) **각 유닛이 필요한 타입을 각자 선언하고 나중에 통합** — 착수는 즉시 가능하나 통합 시 타입 충돌

C) **U1 전체 완료까지 대기** — 가장 안전하지만 5명이 대기

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4
U4·U5는 `SdlcRequestFactory`(U3), U3는 `GitHubAdapter`(U2)처럼 **아직 구현되지 않은 다른 유닛의 코드**에 의존합니다. TDD를 강제하는 상황(D-20)에서 어떻게 진행할까요?

A) **인터페이스 + 테스트 더블(stub/fake)로 개발, 통합 시 실제 구현으로 교체** — 각 유닛이 자기 경계 안에서 테스트를 완결. 통합 시점에 계약 테스트로 교체 검증 *(권장 — 병렬 착수와 TDD를 동시에 만족시키는 유일한 조합)*

B) **실제 구현 완료를 기다림** — U2·U3 완료 전까지 U4·U5 착수 불가

C) **각자 임시 구현을 만들고 통합 시 조정** — 중복 구현이 남을 위험

X) Other (please describe after [Answer]: tag below)

[Answer]: x - 가능한 일정 안에서 진행되도록 간소화

### Question 5
Portal(SVC-1) 하나에 5개 유닛의 컴포넌트 23개가 들어갑니다. 유닛 소유권을 어떻게 강제할까요?

A) **CODEOWNERS + 디렉토리 경계** — 유닛별 디렉토리에 소유자를 지정해 타 유닛 디렉토리 수정 시 소유자 리뷰가 GitHub에서 강제됨. B-1~B-7 경계 규약은 리뷰 체크리스트로 사용 *(권장 — R2=A로 "GitHub PR 리뷰+merge를 변경관리로 삼는다"고 이미 정했으므로 도구 추가 없이 그 결정을 실행하는 형태)*

B) **문서상 규약만** — component-dependency.md §3의 B-1~B-7에 의존, 기술적 강제 없음

C) **유닛별 별도 리포지토리** — Q9=A(단일 repo) 결정의 번복

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6
`SdlcRequestFactory`는 U3 소유인데 U2·U4·U5 **세 유닛이 모두 호출**합니다(AD-3). 이 시그니처가 늦게 확정되면 세 유닛이 동시에 막힙니다. 어떻게 할까요?

A) **현행 유지** — 구현·시그니처 모두 U3 소유. 세 유닛은 U3의 시그니처 확정을 기다림

B) **Factory 전체를 U1로 이관** — 3유닛 공통 소비이므로 공용 성격. 단 AD-3(정책 각인)의 소유가 U1로 옮겨감

C) **시그니처(타입)만 U1의 `SharedTypes`에, 구현은 U3에** — Port 3종에 이미 적용한 AD-1 패턴을 Factory에도 동일하게 적용. Q3의 인터페이스 전용 PR에 포함되어 세 유닛의 차단이 함께 풀림 *(권장 — AD-1과 같은 해법을 같은 문제에 일관되게 적용하는 것이고, AD-3의 "validator는 단 하나" 원칙은 구현이 U3 단독인 한 그대로 유지됨)*

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 7
독립 배포 단위 5개 중 3개(Pod Runner·Slack Gateway·n8n)를 U3가 겸합니다. Dockerfile·Helm chart 같은 **배포 아티팩트**의 소유자는?

A) **모든 배포 아티팩트를 U1(PlatformOps)이 소유** — 유닛은 애플리케이션 코드만. Helm/Skaffold 일관성과 Secret·RBAC 정책이 한 곳에 모임 *(권장 — C-1.5가 이미 Helm·Skaffold·Secret·RBAC·ConfigMap을 소유하고 있어 chart만 분산시키면 AD-5의 ConfigMap 단일 합의점이 깨짐)*

B) **각 유닛이 자기 서비스의 Dockerfile·chart를 소유** — U3가 3개 서비스 배포까지 담당

C) **혼합 — Dockerfile은 각 유닛, chart·values는 U1** — 이미지 내용은 코드 소유자가, 배포 형상은 인프라 소유자가

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 8
Drizzle 스키마는 U1(C-1.3) 단독 소유인데, 6명이 각자 필요한 테이블을 동시에 추가하게 됩니다. 파일 조직을 어떻게 할까요?

A) **단일 스키마 파일, U1이 모든 변경을 대행** — 다른 유닛은 요청만. 정합성은 최고, U1이 병목

B) **유닛별 스키마 파일 + U1의 배럴 export** — `schema/core.ts`(U1: users·sessions·audit_events), `schema/sdlc.ts`(U3), `schema/incident.ts`(U4), `schema/improvement.ts`(U5), `schema/memory.ts`(U6)로 나누고 `schema/index.ts`가 재수출. 공유 테이블(`sdlc_requests`)과 FK 규약은 U1이 소유 *(권장 — 소유권은 C-1.3 그대로 U1에 두면서 머지 충돌 면적만 줄임. 6명 동시 작업에서 단일 파일은 실질적 직렬화 지점이 됨)*

C) **각 유닛이 자유롭게 편집** — 충돌·중복 정의 위험

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 9
단일 리포(Q9=A) 안에서 5개 유닛이 Next.js `src/`를 공유합니다. 디렉토리 구조는?

A) **`src/features/{unit}/` + 라우트 그룹** — 비즈니스 로직은 `src/features/u2-core-mgmt/` 등 유닛별 디렉토리에, 화면은 `src/app/(u2)/...` 라우트 그룹에. CODEOWNERS를 두 경로에 걸어 소유권 강제 *(권장 — 유닛 경계가 파일 경로에 그대로 드러나 Q5의 CODEOWNERS가 기계적으로 동작함)*

B) **`src/app`은 도메인 폴더, 로직은 `src/lib/{unit}/`** — Next.js 관례에 가깝지만 라우트 소유권이 흐려짐

C) **pnpm workspace로 유닛별 패키지 완전 분리** — 경계가 가장 강하지만 Next.js 단일 앱 빌드 구성이 복잡해지고 2일 일정에 부담

X) Other (please describe after [Answer]: tag below)

[Answer]: C - api 규약과 공통 lib 같이 중복되는 내용만 공유

---

## 3. Part 2 실행 체크리스트

답변 수신·승인 후 아래 순서로 실행한다. 각 항목 완료 즉시 `[x]`로 표시한다.

### 3.1 유닛 정의 — `unit-of-work.md`
- [x] U1~U6 각각의 목적·책임·비책임(out of scope) 기술
- [x] 유닛별 컴포넌트 매핑 (components.md의 31개를 6유닛에 배정, 누락 0 검증)
- [x] 유닛별 배포 서비스 매핑 (services.md의 SVC-1~5)
- [x] 유닛별 완료 정의(DoD) — 코드·테스트·경계 계약 충족 기준
- [x] **Greenfield 코드 조직 전략** (Q9 답변 반영) — 디렉토리 구조, 소유권 강제 방식, 스키마 파일 조직(Q8), 배포 아티팩트 소유(Q7)
- [x] 유닛별 담당자 배정 모델 (Q1 답변 반영)

### 3.2 의존 매트릭스 — `unit-of-work-dependency.md`
- [x] 유닛 간 의존 매트릭스 (타입 의존 T / 구현 의존 I 구분)
- [x] 순환 의존 검증 — 위상 정렬로 기계 검증 (AD-1 적용 후 0건이어야 함)
- [x] 인터페이스 동결 목록 (Q3 답변 반영) — U1 인터페이스 전용 PR에 포함될 항목 열거
- [x] 테스트 더블 목록 (Q4 답변 반영) — 유닛별로 필요한 stub과 그 계약
- [x] 착수 순서 타임라인 — 차단 해제 시점 기준
- [x] Mermaid 다이어그램 + 텍스트 대안 (content-validation.md 준수, 작성 전 문법 검증)

### 3.3 스토리 매핑 — `unit-of-work-story-map.md`
- [x] 스토리 56건 전부를 유닛에 배정 (미배정 0 검증)
- [x] 배치 구분 표기 (Q2 답변 반영)
- [x] 경계 스토리 9건에 대해 "합의할 인터페이스 → 소유 유닛 → 동결 시점" 3열 표
- [x] 유닛별 스토리 수·Must/Should 집계, Q1 답변 반영 후 재집계
- [x] FR 역추적 유지 검증 — 45개 FR 커버리지가 유닛 배정 후에도 45/45인지 확인

### 3.4 검증
- [x] 컴포넌트 31/31 유닛 배정 확인
- [x] 스토리 56/56 유닛 배정 확인
- [x] FR 45/45 커버 확인
- [x] 순환 의존 0건 확인
- [x] 확장 규칙 준수 요약 작성 (§4)
- [x] `aidlc-state.md` Units Generation 완료 표시

---

## 4. 확장 규칙 적용 계획

`aidlc-state.md` Extension Configuration에 따라 security-baseline(full) · resiliency-baseline ·
property-based-testing(partial)이 활성 상태다. **이 단계(유닛 분해)에 실제로 적용되는 규칙만**
아래에 든다. 나머지는 유닛 분해가 산출하는 아티팩트의 성격상 해당 없음(N/A)이며, Code Generation
단계에서 평가된다.

| 규칙 | 이 단계에서의 적용 |
|------|------------------|
| **SECURITY-11** (Secure Design) | 인증을 U1 단독 소유로 유지(AD-2). 유닛 분해가 인증 로직을 여러 유닛에 흩뜨리지 않는지 확인 |
| **SECURITY-06 / 08** (최소권한·접근제어) | 권한 제약이 명시된 스토리 12건이 배정된 유닛에서 `AuthGuard` 의존이 끊기지 않는지 확인 |
| **SECURITY-10** (공급망) | 유닛별 의존성 추가 권한 — 단일 `package.json` 소유자를 코드 조직 전략에 명시 |
| **SECURITY-12 / 13** (자격증명·무결성) | 서버간 인증 4종과 MCP 토큰 발급 분리(C-6.3)가 유닛 경계에서 유지되는지 확인 |
| **RESILIENCY-01** (핵심 워크로드 식별) | 유닛 정의에 서비스별 중요도 표기 — SVC-1 Portal과 SVC-4 Gateway(replicas 1 고정)가 단일 장애점 |
| **RESILIENCY-03 / 04** (변경관리·배포·롤백) | Q5·Q7 답변이 이 규칙의 실행 형태 — CODEOWNERS 리뷰 게이트와 배포 아티팩트 소유자 |
| **PBT-01** (설계 시 속성 식별) | PBT 대상 3건(US-U3-02·03·12)이 모두 U3에 있음 → Q1 트랙 분할 시 같은 트랙에 묶이는지 확인 |

**N/A 판정 근거**: SECURITY-01~05·07·09·14·15, RESILIENCY-02·05~13, PBT-02~10은 암호화·헤더·
로깅·헬스체크·테스트 구현 등 **코드와 매니페스트 수준의 규칙**이다. 유닛 분해 산출물(유닛 정의·
의존 매트릭스·스토리 매핑)에는 구현이 없으므로 이 단계에서 위반/준수를 판정할 대상이 없다.
단, RESILIENCY-14(복원력 테스트)·15(장애대응 프로세스)는 R7=D·R8=D로 **사용자 승인 예외**가
이미 기록되어 있다.

---

## 5. 완료 기준

- [x] 질문 9건 전부 답변 (빈 `[Answer]:` 0개)
- [x] Step 7 모순·모호성 분석 완료, 발견 시 후속 질문으로 해소
- [x] 사용자의 계획 승인
- [x] §3 체크리스트 전 항목 `[x]`
- [x] 산출물 3종 생성 완료
- [x] §4 확장 규칙 준수 요약 첨부
