# 스토리 생성 계획 — AIways-On

**단계**: INCEPTION / User Stories — Part 1 (Planning)
**평가 결과**: 실행 (High Priority 지표 5개 해당) — `user-stories-assessment.md` 참조

> **⏱️ 2일 일정 배려**: 질문 7건 전부에 **(권장)** 을 표시했습니다.
> 이견 없으시면 `"전부 권장"` 한 마디로 끝내셔도 됩니다.
> 이 단계의 목적은 스토리 자체가 아니라 **Units Generation과 TDD에 바로 투입 가능한 산출물**을 만드는 것입니다.

---

## 섹션 1: 방법론 결정 질문

### Question 1 — 스토리 구조 (Breakdown Approach)
스토리를 무엇을 축으로 나눌까요?

A) **(권장) 유닛 정렬 (Domain-Based)** — 확정된 6개 유닛에 스토리를 1:1 매핑.
   각 개발자가 자기 스토리 묶음만 보면 착수 가능하고, Units Generation의 직접 입력이 됨

B) **사용자 여정 (User Journey-Based)** — SR 등록 → 요구사항 → 설계 → 개발 → 완료 흐름을 따라 배열.
   흐름 이해에 유리하나 스토리가 여러 유닛에 걸쳐 담당자가 불명확해짐

C) **페르소나 기반 (Persona-Based)** — 요청자/개발자/Admin별로 묶음.
   권한 검증에 유리하나 유닛 매핑이 흩어짐

D) **기능 기반 (Feature-Based)** — 시스템 기능 단위. 유닛 정렬과 유사하나 유닛 경계와 어긋날 수 있음

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — 페르소나 범위
어떤 페르소나를 정의할까요?

A) **(권장) 사람 4종 + 시스템 액터 3종** —
   사람: 요청자(현업) / 개발자 / 운영자(Admin) / 사내 개발자(MCP 소비자)
   시스템: n8n 오케스트레이터 / SDLC Pod / CronJob
   (시스템 액터를 포함해야 "n8n이 Pod에 `/run`을 보낸다" 같은 핵심 동작이 스토리로 표현됨)

B) **사람 4종만** — 시스템 간 상호작용은 스토리가 아닌 기술 명세로만 다룸

C) **사람 2종만** — `design/` 권한 매트릭스대로 user / admin 둘로 단순화

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — 스토리 크기 (Granularity)
스토리 하나의 크기를 어느 정도로 잡을까요?

A) **(권장) 화면·엔드포인트 단위** — "SR 상세 화면에서 파이프라인 진행 상태를 본다" 수준.
   45개 FR에 대해 스토리 약 50~70개 예상. 2일 일정에 적합하고 TDD 테스트 단위와 잘 맞음

B) **세부 동작 단위** — "SR 상세에서 단계 배지 색이 상태에 따라 바뀐다" 수준. 스토리 150개 이상

C) **에픽 단위** — "SR을 등록하고 완료까지 추적한다" 수준. 스토리 20개 내외. 인수 조건이 거칠어짐

X) Other (please describe after [Answer]: tag below)

[Answer]: A - 화면·엔드포인트 단위

### Question 4 — 인수 조건 형식
인수 조건(Acceptance Criteria)을 어떤 형식으로 쓸까요?

A) **(권장) Given-When-Then** — TDD 테스트로 기계적 전환이 쉬움. D-20(TDD 강제)과 정합

B) **체크리스트** — 읽기 쉬우나 테스트 전환 시 해석이 필요

C) **혼합** — UI 스토리는 체크리스트, API·상태머신 스토리는 Given-When-Then

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 5 — 시스템 간 흐름의 스토리화
n8n → Pod `/run`, Pod → Portal 콜백, CronJob 스캔 같은 **사람이 개입하지 않는 흐름**을 어떻게 다룰까요?

A) **(권장) 시스템 액터 스토리로 작성** — "n8n 오케스트레이터로서, 단계 완료 신호를 받으면
   다음 단계를 발화하고 싶다. 그래야 파이프라인이 사람 개입 없이 진행된다."
   시스템 동작의 인수 조건이 명시되어 U3의 TDD에 직접 쓰임

B) **기술 명세로만 다루고 스토리에서 제외** — `07-n8n-workflows.md`·`06-pod-runner-api.md`가 이미 상세하므로 중복

C) **요약 에픽 1~2개로만 표현**

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 — 추적성 (Traceability)
스토리를 요구사항에 어떻게 연결할까요?

A) **(권장) FR ID + 원본 문서 동시 참조** — 각 스토리에 `FR-U3-02` 및 `03-state-machine.md §3` 병기.
   개발자가 스토리에서 원본 명세로 한 번에 이동 가능

B) **FR ID만** — 간결하나 원본 문서를 다시 찾아야 함

C) **추적성 표를 별도 파일로 분리**

X) Other (please describe after [Answer]: tag below)

[Answer]: A - FR ID + 원본 문서 동시 참조

### Question 7 — 우선순위 표기
2일 일정에서 무엇을 먼저 할지 스토리에 표시할까요?

A) **(권장) MoSCoW 3단계** — Must(2일 내 반드시) / Should(가능하면) / Could(여유 시).
   범위 압박 시 무엇을 버릴지 미리 합의해 두는 효과. 리스크 R-01 완화에 직결

B) **U1 선행 표시만** — 차단 유닛 여부만 표기하고 나머지는 우선순위 없음

C) **우선순위 표기 없음** — 전체 범위가 Must이므로 구분 무의미 (D-01·D-03과 정합)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## 섹션 2: 실행 체크리스트 (Part 2에서 수행)

> 아래는 위 질문에 답변을 받은 뒤 실행할 단계입니다. 지금은 채우지 마세요.

### 준비
- [x] 승인된 답변을 로드하고 방법론 확정
- [x] `requirements.md`의 45개 FR과 27개 NFR 로드
- [x] `design/웹화면-디자인-요구사항_v1.md`의 18개 라우트 및 권한 매트릭스 로드
- [x] `03-state-machine.md`의 파이프라인 프로파일 3종 로드

### 페르소나 생성
- [x] `personas.md` 생성 — 페르소나별 역할·목표·불만·권한 범위 기술
- [x] 각 페르소나를 `design/` §8 권한 매트릭스와 교차 검증
- [x] 시스템 액터 페르소나의 책임 경계 명시 (Q2 답변에 따름)

### 스토리 생성 — 유닛별
- [x] U1 공용(기반) 스토리 작성 (10건)
- [x] U2 코어SDLC(관리) 스토리 작성 (8건)
- [x] U3 코어SDLC(진행) 스토리 작성 (17건)
- [x] U4 장애대응 스토리 작성 (7건)
- [x] U5 자체개선 스토리 작성 (6건)
- [x] U6 개발규정 스토리 작성 (7건)

### 품질 검증
- [x] 모든 스토리가 **INVEST** 충족 확인 — 6기준 전부 통과
- [x] 모든 스토리에 인수 조건 존재 확인 — 56/56
- [x] 페르소나 ↔ 스토리 매핑표 작성 — personas.md 하단
- [x] FR ↔ 스토리 역추적 — 45/45 커버. 누락 1건(FR-U3-09) 발견해 US-U3-18로 보완
- [x] 유닛 경계를 넘는 스토리 식별 — 10건 표시
- [x] 권한 요구 스토리에 페르소나 제약 명시 — 12건

### 산출물 확정
- [x] `aidlc-docs/inception/user-stories/personas.md` 저장
- [x] `aidlc-docs/inception/user-stories/stories.md` 저장
- [x] `aidlc-state.md` 갱신
- [x] `audit.md` 기록

---

## 섹션 3: 이 단계에서 다루지 않는 것

방법론 결정에 집중하며, 아래는 이 단계의 범위가 아닙니다.

| 제외 | 다루는 단계 |
|------|-----------|
| 스프린트 배분·일정 | Workflow Planning |
| 유닛별 담당자 지정 | Units Generation |
| 기술 구현 방식 | Construction / Functional Design |
| 스토리 포인트 추정 | 범위 밖 (2일 고정 일정) |
