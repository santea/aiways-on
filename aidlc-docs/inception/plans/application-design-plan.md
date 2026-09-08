# Application Design 계획 — AIways-On

**단계**: INCEPTION / Application Design
**목적**: 명세가 유일하게 비워 둔 영역 — **컴포넌트 경계와 의존성** 확정

> **이 단계에서 다루지 않는 것**: 메서드의 상세 비즈니스 규칙, DB 컬럼, K8s 매니페스트.
> 전부 `requirements/`에 이미 있고 SATISFIED로 확정되었다(execution-plan §2.2).
> 여기서는 **"어느 컴포넌트가 무엇을 소유하고, 누가 누구를 호출하는가"** 만 정한다.

> **⏱️ 질문 6건 전부에 (권장) 표시.** 이견 없으면 `"전부 권장"` 으로 끝내셔도 됩니다.

---

## 섹션 1: 해결해야 할 구조 문제 (설계 입력)

Workflow Planning §1.3에서 식별된 S-1~S-5다. 각 질문이 어느 문제를 푸는지 표시했다.

| # | 문제 | 해당 질문 |
|---|------|----------|
| S-1 | U2↔U3 순환 의존 — `/intake`(U2)→프로비저닝(U3), `4→9` 진입작업(U3)→PR 생성(U2) | Q1 |
| S-2 | 서버간 인증 4종의 소유자 부재 | Q2 |
| S-3 | SR 생성 경로 3분기 + incident 자동머지 금지 예외의 소유 위치 | Q3 |
| S-4 | 중복 계약 2쌍 — 경계 9건의 실체는 7개 인터페이스 | Q4 |
| S-5 | U6↔U3가 실제로는 U1까지 포함한 3자 | Q5 |
| — | 유닛 간 계약을 어떻게 강제할 것인가 | Q6 |

---

## 섹션 2: 설계 결정 질문

### Question 1 — U2↔U3 순환 의존 해소 (S-1)

`03-state-machine.md` §4.4를 보면 `4 → 9_COMPLETE` 진입 작업이
`_finalizeRepositoriesForRequest()` → push → PR 생성 → autoPrMerge 분기를 수행한다.
즉 **상태머신(U3)이 GitHub 어댑터(U2)를 호출**한다. 반대로 `/intake`(U2)는 프로비저닝(U3)을 호출한다.

병렬 개발에서 양방향 의존은 교착이 된다. 어떻게 끊을까요?

A) **(권장) 어댑터 인터페이스를 U1로 승격** — `GitHubPort`·`MessagingPort`·`PodPort` 인터페이스를
   U1(공용)이 정의하고, 구현은 각 유닛이 소유. U3는 인터페이스에만 의존하므로 순환이 끊긴다.
   U2·U3 담당자가 서로를 기다리지 않고 즉시 착수 가능

B) **GitHub 어댑터 전체를 U3로 이동** — 순환은 끊기지만 U3가 더 무거워짐(이미 27%)

C) **PR 생성을 U3가 직접 구현** — 코드 중복 발생

D) **이벤트 기반 분리** — U3가 이벤트만 발행하고 U2가 구독. 결합도는 낮으나 2일 내 구현 부담

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — 서버간 인증의 소유자 (S-2)

인증 방식이 4종이고 경계마다 다르게 등장한다:
`SDLC_MASTER_KEY`(내부 API) · `POD_AUTH_TOKEN`(Pod Runner) · 이미지 서빙 서명 토큰 · `sdlcmem_*`(MCP).
D-21로 OWASP 전체를 강제하는데, 6명이 각자 인증 체크를 구현하면 유닛마다 강도가 달라진다.

A) **(권장) 인증 전체를 U1이 단독 소유** — 사용자 인증(GitHub OAuth) + 서버간 인증 4종의
   미들웨어·검증 함수를 U1이 모두 제공하고 나머지 유닛은 **소비만** 한다.
   SECURITY-08(deny-by-default) 준수 여부를 한 곳에서 검증 가능

B) **사용자 인증만 U1, 서버간 인증은 각 유닛** — 현재 스토리 구성 그대로. 강도 편차 위험

C) **인증 전용 유닛을 신설** — 7번째 유닛. 인원 초과

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — SR 생성 경로 통합 (S-3)

`pipelineProfile`이 `feature`(U2) · `incident`(U4) · `improvement`(U5) 세 갈래인데 생성 주체가 각각이다.
특히 `03-state-machine.md` §4.4의 **incident 자동머지 금지 예외**("`autoPrMerge=true`여도 자동 머지하지 않는다")는
U3 상태머신 코드 안에 있지만 그 필요성은 U4에서 온다. U4 담당자가 이 조항을 모르면
장애 패치가 사람 확인 없이 머지된다.

A) **(권장) SR 생성을 단일 함수로 강제** — `createSdlcRequest(input, profile)` 하나만 존재하고
   U2·U4·U5는 `profile` 인자만 다르게 호출. 프로파일별 분기(채널 수, 자동머지 정책)는
   **U3 내부 한 곳**에 모아 U4·U5 담당자가 몰라도 규칙이 지켜진다

B) **유닛별 생성 함수 + 공통 검증** — 각자 만들되 공통 validator를 통과시킴

C) **현행 유지 + 문서로 규약** — 코드 강제 없이 문서로만 합의. 가장 빠르나 유실 위험

X) Other (please describe after [Answer]: tag below)

[Answer]: B - 공통 validator는 단일로 강제

### Question 4 — 인터페이스 소유자 지정 (S-4)

경계 9건의 실체는 7개 인터페이스다 (2쌍이 양쪽에서 중복 기술됨).
두 사람이 각자 "내가 정의할 차례"라고 생각하면 서로 다른 계약이 만들어진다.

A) **(권장) 인터페이스별 소유자 1명 + 공용 타입 파일에 선언** — 각 계약의 타입 정의를
   U1의 공유 타입 패키지에 두고, 소유자만 수정 권한을 갖는다.
   소비자는 타입을 import하고 구현은 각자

B) **호출당하는 쪽(제공자)이 항상 소유** — 규칙은 단순하나 U3에 소유권이 몰림

C) **호출하는 쪽(소비자)이 소유** — 소비자 요구가 반영되나 제공자가 여러 계약을 맞춰야 함

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — MCP 3자 조율 (S-5)

US-U6-07(Pod에 MCP 주입)은 U6↔U3로 표시했으나 실제로는 3자다:
MCP 서버 구현(U6) + Pod spec 주입·이미지에 클라이언트 포함(U3) + Helm 배포(U1).

A) **(권장) 연결 정보를 ConfigMap 한 곳으로** — U1이 ConfigMap에 MCP 엔드포인트를 정의하고,
   U3는 Pod spec에서 그것을 참조, U6는 그 주소로 서빙. 3자가 ConfigMap 키 이름 하나만 합의하면 됨

B) **환경변수 직접 주입** — U3가 Pod spec에 하드코딩. 변경 시 재배포 필요

C) **서비스 디스커버리** — K8s Service DNS로 해결. 추가 합의 불필요하나 네임스페이스 규약 필요

X) Other (please describe after [Answer]: tag below)

[Answer]: A로 하고 K8s Service DNS로 해결

### Question 6 — 계약 위반 방지 수단

6명이 병렬로 작업할 때 유닛 경계 계약이 깨지는 것을 어떻게 막을까요?

A) **(권장) 타입 시스템 + CI** — 공유 타입을 U1이 소유하고 TypeScript strict로 컴파일 강제.
   CI에서 typecheck 실패 시 병합 차단(US-U1-10과 정합). 추가 도구 없이 즉시 적용 가능

B) **계약 테스트(Contract Test) 추가** — 경계마다 계약 테스트 작성. 견고하나 2일 일정에 부담

C) **코드 리뷰 규약** — 경계 파일 변경 시 양쪽 승인 필수. 도구 없이 가능하나 강제력 약함

D) **A + C** — 타입 강제 + 경계 파일에 CODEOWNERS 지정

X) Other (please describe after [Answer]: tag below)

[Answer]: C + 설계문서에 반영

---

## 섹션 3: 실행 체크리스트 (답변 후 수행)

### 준비
- [x] 답변 로드 및 설계 원칙 확정 (AD-1~AD-6)
- [x] `requirements.md`(FR 45 / NFR 27) 및 `stories.md`(56건) 로드
- [x] `00-overview.md` §5 디렉토리 구조 및 §6 설계 원칙 로드

### 산출물 생성
- [x] `components.md` — 컴포넌트 31개 정의 (232줄)
- [x] `component-methods.md` — 메서드 시그니처 (285줄)
- [x] `services.md` — 배포 서비스 5개 (201줄)
- [x] `component-dependency.md` — 의존 매트릭스 + 경계 규약 7건 (255줄)
- [x] `application-design.md` — 통합본 (188줄)

### 검증
- [x] S-1~S-5 해소 확인 — 5/5, AD-1~AD-5로 대응
- [x] 순환 의존 없음 확인 — U2↔U3는 타입 의존으로 분리
- [x] 스토리 56/56 컴포넌트 귀속 확인
- [x] 인터페이스 7개 소유자 지정 완료 (B-1~B-7)
- [x] SECURITY-08·11 준수 — AuthGuard 단일 모듈 격리

### 마무리
- [x] `aidlc-state.md` 갱신
- [x] `audit.md` 기록
