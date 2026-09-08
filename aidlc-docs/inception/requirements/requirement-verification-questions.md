# 요구사항 확인 질문 — AIways-On

`requirements/` 14개 문서(13,102줄)와 `design/`(887줄)를 분석했습니다.
**요구사항 자체는 매우 완전합니다.** 아래는 명세에 명시되지 않았거나, 참고자산과 충돌하거나,
6인 병렬 개발 계획에 필요한 **미결정 사항 14건**입니다.

> **답변 방법**: 각 질문의 `[Answer]:` 뒤에 선택지 문자(A/B/C…)를 적어주세요.
> 해당하는 선택지가 없으면 마지막 "Other"를 고르고 뒤에 설명을 적어주세요.
> 전부 작성하신 뒤 "완료"라고 알려주시면 됩니다.

---

## A. 워크플로우 확장 (Extension) 적용 여부

### Question 1
보안 확장 규칙(Security Baseline)을 이 프로젝트에 강제 적용할까요?

A) 예 — 모든 SECURITY 규칙을 차단성 제약(blocking constraint)으로 강제 (production 등급 애플리케이션 권장)

B) 아니오 — SECURITY 규칙 전체 건너뛰기 (PoC·프로토타입·실험 프로젝트에 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: X - 적절한 수준의 Security 규칙 적용(2일간 개발 가능한 선 내에)

### Question 2
복원력 기준(Resiliency Baseline)을 이 프로젝트에 적용할까요?

**이 확장의 성격.** 활성화하면 **AWS Well-Architected Framework(신뢰성 축)** 에서 도출된
**설계 시점의 방향성 있는 모범사례** 묶음이 적용됩니다. 요구사항·설계·코드를 내결함성, 고가용성,
관측가능성, 복구가능성 쪽으로 유도하며 15개 실천 영역을 다룹니다.

**이 확장이 아닌 것.** 활성화한다고 워크로드가 production-ready가 되거나, 특정 가용성·RTO·RPO
목표가 보증되지는 않습니다. 좋은 복원력 결정을 초기에 세우는 **출발점**일 뿐, 구축된 시스템에 대한
공식 Well-Architected Review를 대체하지 않습니다.

A) 예 — 복원력 기준을 설계 시점 방향성 지침으로 적용 (비즈니스 크리티컬 워크로드 권장)

B) 아니오 — 복원력 기준 건너뛰기 (PoC·프로토타입 등 빠른 반복이 더 중요한 경우)

X) Other (please describe after [Answer]: tag below)

[Answer]: A - 적절한 수준의 복원력을 적용하지만 2일간 개발 가능한 선에서 적용

### Question 3
속성 기반 테스트(Property-Based Testing, PBT) 규칙을 강제할까요?

A) 예 — 모든 PBT 규칙을 차단성 제약으로 강제 (비즈니스 로직·데이터 변환·직렬화·상태 컴포넌트가 있는 프로젝트 권장)

B) 부분 — 순수 함수와 직렬화 왕복(round-trip)에만 PBT 적용 (알고리즘 복잡도가 제한적인 경우)

C) 아니오 — PBT 규칙 전체 건너뛰기 (단순 CRUD·UI 전용·얇은 통합 계층)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## B. 범위 및 우선순위

### Question 4
`requirements/`의 13개 기능 문서 중 **v1 개발 범위**를 어디까지 잡을까요?
(참고: 11·12·13번 Agent 문서 3종만 합쳐 6,112줄로, 전체의 47%를 차지합니다)

A) **전체** — 코어 SDLC(01~10) + 장애대응(11) + 자체개선(12) + 개발규정(13) 모두 v1에 포함

B) **코어 + 1개 Agent** — 코어 SDLC(01~10) 완성 후 Agent 3종 중 1개만 v1에 포함, 나머지는 v2

C) **코어만** — 코어 SDLC(01~10)까지만 v1. Agent 3종(11·12·13)은 전부 v2로 연기

D) **코어 + 골격** — 코어 SDLC(01~10) 완성 + Agent 3종은 DB 스키마·API 스텁만 만들고 로직은 v2

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5
**⚠️ 중요** — 참고자산(`n8n/` 워크플로우, `sdlc-pod/claude-global.md`)은 `Advance to 5`,
"보고서 작성 (Stage 7)" 등 **구 stage 번호 체계**를 사용합니다.
반면 `requirements/00-overview.md`는 Stage `5`~`8`을 **미사용 예약**으로 두고
정상 경로를 `1 → 2 → 3 → 4 → 9_COMPLETE`로 규정합니다. 어느 쪽을 따를까요?

A) **명세 우선** — `requirements/` 정의(`1→2→3→4→9`)를 따르고, n8n 워크플로우는 stage 번호를 재매핑해 신규 작성

B) **참고자산 우선** — 기존 n8n 워크플로우의 stage 체계(5·7 사용)에 맞춰 `requirements/` 문서를 수정

C) **혼합** — 로직 흐름은 n8n에서 그대로 가져오되 번호만 명세에 맞춰 기계적으로 치환

X) Other (please describe after [Answer]: tag below)

[Answer]: A - claude-global.md는 참고용임

### Question 6
기존 `n8n/` 워크플로우 JSON 3종(총 79노드)을 어떻게 다룰까요?

A) **가져와서 수정** — 기존 JSON을 n8n에 import한 뒤 명세에 맞게 수정 (가장 빠름, 구 체계 잔재 위험)

B) **참고하며 신규 작성** — 로직·노드 구성을 참고하되 명세 기준으로 처음부터 새로 작성 (깨끗함, 시간 소요)

C) **A 후 B** — 우선 import해 동작을 확인하고, 이해한 뒤 신규 작성

X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## C. 6인 병렬 개발 구조

### Question 7
6인(공용 1 + 병렬 5) 분할 방식에 대해 이미 생각하신 구조가 있나요?

A) **없음 — 제안해주세요** — 명세 기반으로 6개 유닛 분할안을 만들어 제시 (Units Generation 단계에서 수행)

B) **서비스 단위 분할** — 공용(DB스키마+타입+인증) / Portal-API / Portal-UI / Pod-Runner / n8n+Gateway / MCP+Agent

C) **기능 단위 분할** — 공용(기반) / 코어SDLC / 장애대응 / 자체개선 / 개발규정 / 인프라·배포

D) **레이어 단위 분할** — 공용(스키마) / 백엔드API / 프론트엔드 / 인프라 / AI에이전트 / 통합·테스트

X) Other (please describe after [Answer]: tag below)

[Answer]: X - 공용(기반) / 코어SDLC(SDLC 관리) / 코어SDLC(SDLC 진행) / 장애대응 / 자체개선 / 개발규정

### Question 8
"공용 1개" 유닛에는 무엇을 포함할까요? (병렬 5개 유닛이 모두 의존하는 선행 유닛)

A) **DB 스키마 + 공유 타입 + 인증** — Drizzle 스키마, TypeScript 타입 정의, Auth.js 설정

B) **A + 프로젝트 스캐폴딩** — 위 + Next.js 초기 구성, Tailwind/shadcn 셋업, lint/format/husky

C) **B + 로컬 개발환경** — 위 + Helm 차트, Skaffold, Conda, setup 스크립트까지

D) **B + 공통 어댑터 인터페이스** — B + MessageChannelAdapter·GitHub·Pod 클라이언트의 **인터페이스만** (구현은 각 유닛)

X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 9
저장소(repository) 구성은 어떻게 할까요?

A) **단일 repo + 디렉토리 분리** — `00-overview.md` §5 구조 그대로. 6명이 한 repo에서 브랜치로 병렬 작업

B) **단일 repo + pnpm workspace 모노레포** — 패키지 경계를 workspace로 명시해 의존성 충돌 방지

C) **서비스별 멀티 repo** — Portal / pod-runner / memory-mcp / slack-gateway 각각 별도 repo

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## D. 기술 스택 미결정 사항

### Question 10
`requirements/00-overview.md`는 Next.js **16**을 명시하지만, 참고 스캐폴드는 15입니다.
또한 Node 버전이 참고자산 간 불일치합니다(스캐폴드 22 / Pod 이미지 20). 어떻게 확정할까요?

A) **명세 그대로** — Next.js 16 + Node 22. Pod 이미지도 Node 22로 통일

B) **명세 그대로 + Pod 예외** — Portal은 Next.js 16 + Node 22, Pod 이미지는 검증된 Node 20 유지

C) **보수적 선택** — Next.js 15(스캐폴드 검증됨) + Node 22. 16은 안정화 후 업그레이드

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 11
개발·테스트 단계의 **Slack 연동** 환경은 어떻게 확보되나요?
(명세는 Slack Web API 게시 + Socket Mode 수신 Gateway Pod를 요구합니다)

A) **실제 Slack 워크스페이스 사용 가능** — 개발용 Slack App 자격증명을 확보할 수 있음

B) **아직 없음 — Mock 우선** — `MessageChannelAdapter` 인터페이스에 Mock 구현체를 먼저 만들고 Slack은 나중에

C) **Slack 대신 다른 플랫폼** — Discord 또는 Knox Teams로 우선 개발

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 12
`sdlc-pod/Dockerfile`은 사내 미러 레지스트리(`repository.domain.net`, `artifactory.domain.net`,
`github.domain.net`)를 전제로 작성되어 있습니다. 개발 환경에서 이 미러에 접근 가능한가요?

A) **접근 가능** — 사내망 미러를 그대로 사용

B) **접근 불가 — 공용 레지스트리로** — npm/PyPI/conda 공식 레지스트리로 치환해 개발, 배포 시 미러로 전환

C) **일부만 가능** — 어떤 것이 가능한지는 Other에 기재

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## E. 품질 및 디자인

### Question 13
테스트 전략을 어떻게 가져갈까요? (현재 참고자산에는 테스트 파일이 **0개**입니다)

A) **TDD 강제** — 각 유닛에서 테스트를 먼저 작성. CI에서 커버리지 게이트 적용

B) **테스트 동반 작성** — 구현과 함께 단위 테스트 작성. 커버리지 목표만 설정하고 게이트는 없음

C) **핵심 경로 우선** — 상태머신·CAS 전이·멱등성 등 핵심 로직만 우선 테스트, UI는 후순위

D) **E2E 중심** — Playwright 기반 E2E를 주력으로, 단위 테스트는 최소한만

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 14
Stitch 디자인 시스템("Midnight Obsidian")은 **다크 모드 전용**(`colorMode: DARK`)입니다.
`design/` 문서는 색상 모드를 명시하지 않았습니다. 라이트 모드를 지원할까요?

A) **다크 전용** — Stitch 테마 그대로. 라이트 모드 미지원

B) **다크 우선 + 라이트 지원** — 다크를 기본으로 하되 라이트 모드 토큰도 정의

C) **시스템 설정 따름** — `prefers-color-scheme` 기반 자동 전환, 양쪽 토큰 모두 정의

X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## 참고 — 답변이 불필요한 확인 사항

아래는 명세가 이미 명확해 질문하지 않았으나, 인지하고 계셔야 할 사항입니다.

| 항목 | 명세 근거 |
|------|----------|
| 인증 = GitHub OAuth (Auth.js v5) | `01-auth-github.md` |
| ORM = Drizzle (Prisma 아님) | `00-overview.md` §3 |
| Pod Runner = FastAPI(Python), :58001 | `06-pod-runner-api.md` |
| MCP 전송 = Streamable HTTP, :58002 | `13-developer-memory-agent.md` |
| 역방향 상태 전이 = 0개 (단방향 DAG) | `00-overview.md` §4.1 |
| 서버간 인증 = `SDLC_MASTER_KEY` 단일 키 | `00-overview.md` §4.1 |
| Slack Gateway = 별도 Pod, replicas 1 | `02-messaging-adapter.md` §6.3 |
| 화면 13종 + 권한 매트릭스 | `design/` §1, §8 |
| `sdl-migration-docs/`는 무관한 별개 프로젝트 유산 | 참고자산 분석 |
