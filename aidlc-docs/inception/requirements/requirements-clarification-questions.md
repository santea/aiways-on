# 요구사항 명확화 질문 — AIways-On

14개 답변을 분석한 결과 **모순 2건 · 모호성 3건**이 발견되었습니다.
이걸 해소하지 않으면 6개 유닛이 서로 다른 전제로 개발됩니다.

---

## 🔴 모순 1: "2일" 예산 vs "전체 범위 + TDD 강제"

**답변하신 내용**

| 질문 | 답변 | 내용 |
|------|------|------|
| Q1 | X | "적절한 수준의 Security 규칙 적용 **(2일간 개발 가능한 선 내에)**" |
| Q2 | A | "적절한 수준의 복원력을 적용하지만 **2일간 개발 가능한 선에서** 적용" |
| Q4 | **A** | **전체** — 코어 SDLC(01~10) + 장애대응(11) + 자체개선(12) + 개발규정(13) 모두 v1 |
| Q13 | **A** | **TDD 강제** — 테스트 먼저 작성, CI 커버리지 게이트 적용 |

**왜 모순인가**

"2일"이 두 번 등장하므로 이것이 실질적 개발 예산으로 보입니다. 그런데:

- **전체 범위 규모**: 명세 13,102줄. Portal 화면 13종 + API 약 30개 + FastAPI Pod Runner 11개 엔드포인트
  + MCP 서버 + Slack Gateway + n8n 워크플로우 3종 + K8s 매니페스트 + AI 에이전트 3종
- **가용 공수**: 6명 × 2일 = **12 person-day**
- **TDD + 커버리지 게이트**: 통상 구현 공수를 1.5~2배로 늘립니다

12 person-day로 위 범위를 TDD로 완성하는 것은 **불가능**합니다.
셋 중 최소 하나는 조정되어야 합니다.

### Clarification Question 1
"2일"은 무엇의 기간인가요?

A) **전체 프로젝트 기간** — 6명이 2일 동안 진행하는 해커톤/스프린트. 이 안에 끝나야 함

B) **보안·복원력 규칙 적용에만 해당** — 전체 프로젝트 기간은 따로 있고, 확장 규칙 준수에 2일 이상 쓰지 말라는 뜻

C) **1차 스프린트 기간** — 2일은 첫 스프린트일 뿐이고 이후 스프린트가 이어짐

X) Other (please describe after [Answer]: tag below)

[Answer]: A - 하지만 모두 바이브코딩으로 생산성 향상된 상태

### Clarification Question 2
**(Q1에서 A를 선택하신 경우에만 답해주세요)**
2일 안에 6명이 끝내려면 "전체 범위"의 **깊이**를 조정해야 합니다. 어느 쪽인가요?

A) **동작하는 데모 깊이** — 전 영역을 훑되 happy path만 동작. 에러처리·엣지케이스·보상 트랜잭션은 생략.
   TDD는 핵심 로직(상태머신·CAS)에만 적용하고 커버리지 게이트는 해제

B) **범위 축소, 깊이 유지** — 코어 SDLC(01~10)만 제대로 완성. Agent 3종(11·12·13)은 v2로 연기.
   TDD 강제 + 커버리지 게이트 유지

C) **UI 우선 데모** — 화면 13종을 Stitch 디자인대로 완성하고 백엔드는 Mock.
   실제 Pod 실행·n8n 연동은 v2

D) **범위·깊이 모두 유지, 기간 연장** — 2일 제약을 포기하고 명세대로 완성 (실소요 재산정 필요)

X) Other (please describe after [Answer]: tag below)

[Answer]: D - 모두 바이브코딩으로 생산성 향상된 상태(2일 내 가능!)

---

## 🔴 모순 2: 6-유닛 분할에 비(非)Portal 서비스의 자리가 없음

**답변하신 분할** (Q7=X)

```
1. 공용(기반)              4. 장애대응
2. 코어SDLC(SDLC 관리)     5. 자체개선
3. 코어SDLC(SDLC 진행)     6. 개발규정
```

**왜 모순인가**

이 분할은 **기능(Portal 화면·API) 축**입니다. 그런데 시스템에는 Portal이 아닌 독립 서비스가 4개 더 있습니다:

| 서비스 | 명세 | 규모 | 이 분할에서의 소속 |
|--------|------|------|------------------|
| `sdlc-pod-runner` (FastAPI) | `06-pod-runner-api.md` | 962줄 / 11 엔드포인트 | **불명확** |
| `sdlc-memory-mcp` | `13-developer-memory-agent.md` | 2,394줄 일부 | 개발규정? |
| `sdlc-slack-gateway` | `02-messaging-adapter.md` §6.3 | 683줄 일부 | **불명확** |
| `n8n` 워크플로우 A/B/C | `07-n8n-workflows.md` | 849줄 / 79노드 | **불명확** |
| K8s 매니페스트·RBAC·CronJob | `10-k8s-infrastructure.md` | 1,073줄 | **불명확** |

### Clarification Question 3
비Portal 서비스 4종(Pod Runner / Slack Gateway / n8n / K8s 인프라)을 어떻게 배치할까요?

A) **"코어SDLC(SDLC 진행)" 유닛이 전부 소유** — 파이프라인 실행에 관련된 것은 모두 이 유닛
   (⚠️ 이 유닛만 4,000줄 이상 — 다른 유닛의 3~4배로 불균형)

B) **공용 유닛이 인프라를, 진행 유닛이 실행체를** — K8s·n8n은 공용(기반)으로,
   Pod Runner·Slack Gateway는 코어SDLC(진행)으로

C) **분할을 7개로 확장** — 위 6개 + "인프라·실행기반" 유닛 1개 추가 (7명 필요 또는 1명이 2개 담당)

D) **분할 재설계 제안 요청** — 명세 규모를 균등하게 나눈 6-유닛 안을 새로 제시해주세요

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## 🟡 모호성 1: "적절한 수준의 Security" 정의 필요

Q1 답변이 X(커스텀)이므로 **무엇을 강제하고 무엇을 생략할지** 구체적 기준이 필요합니다.
AI-DLC는 확장 규칙을 `Enabled: Yes/No`로 기록하므로, 커스텀 정책을 명문화해야 합니다.

### Clarification Question 4
강제할 보안 항목을 골라주세요 (복수 선택 가능 — 예: "A, B, D")

A) **Secret 관리** — DB 평문 저장 금지, `secret_refs` 암호화 참조, K8s Secret 사용 (명세 §6 핵심 원칙)

B) **인증·인가** — GitHub OAuth 검증, `SDLC_MASTER_KEY` 서버간 인증, 페이지 권한 매트릭스 준수

C) **입력 검증** — 모든 API 엔드포인트에 스키마 검증 (Zod 등), SQL 인젝션 방어

D) **의존성 취약점** — `pnpm audit` / `pip-audit` CI 게이트

E) **OWASP Top 10 전반** — 위 전부 + XSS·CSRF·SSRF 등 전체 점검

X) Other (please describe after [Answer]: tag below)

[Answer]: E (전부)

---

## 🟡 모호성 2 & 3: 확인만 필요한 사항 (모순 아님)

아래 두 가지는 답변 간 충돌은 아니지만 진행 전 확인이 필요합니다.

**(가) Q6=C의 실행 순서 문제**
"기존 n8n을 import해 동작 확인 후 신규 작성"을 선택하셨는데, 기존 워크플로우는
Portal API(`/api/v1/sdlc/advance` 등)와 Pod Runner(`:58001`)를 호출합니다.
**둘 다 아직 존재하지 않으므로 실제 동작 확인은 불가능**합니다.
→ 실질적으로는 "JSON을 읽고 노드 구성을 참고한 뒤 신규 작성"(=B)이 됩니다.

**(나) Q10=A + Q12=B의 Pod 이미지 영향**
Node 22 통일(Q10=A) + 사내 미러 미사용(Q12=B)을 선택하셨으므로,
`sdlc-pod/Dockerfile`은 **거의 전면 재작성**됩니다
(conda-forge nodejs=20 → 22, `repository.domain.net` 3곳 → 공식 레지스트리, `.condarc`/`npmrc`/`pip.conf` 재작성).
참고자산으로서의 가치는 "설치 대상 패키지 목록"으로 축소됩니다.

### Clarification Question 5
위 (가)·(나) 해석에 동의하시나요?

A) **둘 다 동의** — (가)는 실질적으로 B로 진행, (나)는 Dockerfile 재작성 수용

B) **(가)만 동의** — (나)는 다시 논의 필요 (Pod 이미지는 Node 20 유지 등)

C) **(나)만 동의** — (가)는 다시 논의 필요 (n8n을 먼저 띄워볼 방법이 있음)

D) **둘 다 재논의 필요**

X) Other (please describe after [Answer]: tag below)

[Answer]: (가) - n8n구축 후 셋팅 예정으로 기존 답변대로 수행, (나) - 동의 
