# AIways-On 요구사항 정의서

**작성일**: 2026-09-08 | **워크플로우**: AI-DLC v1.0.1 | **깊이**: Comprehensive
**상태**: INCEPTION / Requirements Analysis

---

## 1. Intent Analysis

| 항목 | 판정 | 근거 |
|------|------|------|
| **User Request** | "AIways-On 프로젝트를 개발하고싶어. 6명이 병렬로 개발 진행할거고(공용1개, 5개 병렬)" | 초기 요청 |
| **Request Type** | **New Project (Greenfield)** | 사용자 확인(2026-09-08). 타깃 코드 0줄 |
| **Clarity** | **Clear** | 명세 13,102줄 + 디자인 887줄. 이례적으로 완전 |
| **Scope** | **Cross-system** | Portal + n8n + Pod Runner + MCP + Slack Gateway + K8s (6개 배포 단위) |
| **Complexity** | **Complex** | 분산 상태머신 + CAS + 보상 트랜잭션 + AI 에이전트 오케스트레이션 |
| **Depth** | **Comprehensive** | 위 4개 항목 종합 |

### 1.1 요구사항의 성격 — 중요

본 프로젝트는 요구사항을 **새로 도출하는** 작업이 아니다. `requirements/` 14개 문서가
이미 API 시그니처·DB 컬럼·상태 전이표·환경변수 목록 수준까지 확정해 놓았다.
따라서 본 문서의 역할은 다음 세 가지로 한정한다.

1. **명세에 없던 미결정 사항 27건의 확정 기록** (§2)
2. **6인 병렬 개발을 위한 요구사항 재구조화** (§3)
3. **Extension 준수 요구사항의 명시** (§5)

> 기능 요구사항의 **단일 진실 공급원(SSOT)은 `requirements/` 원본 문서**다.
> 본 문서가 원본과 충돌하면 **원본이 우선**한다. 단 §2의 확정 사항은 예외로 본 문서가 우선한다.

---

## 2. 확정된 의사결정 (27건)

### 2.1 범위 및 일정

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-01 | v1 범위 | **전체** — `requirements/` 01~13 전 문서 | Q4=A |
| D-02 | 개발 기간 | **2일** (전체 프로젝트) | CQ1=A |
| D-03 | 범위·깊이 | **둘 다 유지** — 축소·간소화 없음 | CQ2=D |
| D-04 | 생산성 전제 | 개발자 6명 전원 **바이브코딩(AI 가속) 상태** | CQ1·CQ2 사용자 확인 |

> **⚠️ 기록된 가정 (재확인 완료)**
> 12 person-day(6명×2일)로 명세 13,102줄을 TDD로 완주하는 것은 통상적 공수 산정으로는
> 불가능하다는 우려를 제기했고, 사용자가 **두 차례** "바이브코딩으로 2일 내 가능"이라고
> 확인했다. **사용자 결정으로 수용**하여 전체 범위·전체 깊이로 진행한다.
> 본 가정이 어긋날 경우 가장 먼저 조정할 후보는 D-01(범위)이며, 그 시점의 판단은 사용자가 한다.

### 2.2 아키텍처 및 기술 스택

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-05 | **상태 머신 권위** | **`requirements/` 명세 우선.** 정상 경로 `1 → 2 → 3 → 4 → 9_COMPLETE`. Stage `5`~`8`은 enum 값 없는 미사용 예약 | Q5=A |
| D-06 | `claude-global.md` 지위 | **참고용.** "Stage 5/7" 기술은 구 체계이며 채택하지 않음 | Q5=A 사용자 부기 |
| D-07 | Framework | **Next.js 16** (App Router, Server Actions, API Routes) | Q10=A |
| D-08 | Node 런타임 | **Node 22** — Portal·Pod 이미지 전부 통일 | Q10=A |
| D-09 | ORM | **Drizzle ORM** (Prisma 아님) | `00-overview.md` §3 |
| D-10 | 저장소 구성 | **단일 repo + 디렉토리 분리** (`00-overview.md` §5 구조) | Q9=A |
| D-11 | 레지스트리 | 개발은 **공용 레지스트리**(npm/PyPI/conda 공식), 배포 시 사내 미러 전환 | Q12=B |
| D-12 | Pod Dockerfile | **전면 재작성.** 참고자산의 가치는 "설치 대상 패키지 목록"으로 한정 | CQ5-(나) |
| D-13 | 메시징 | **Slack** — 실제 워크스페이스·App 자격증명 확보 가능 | Q11=A |

### 2.3 6인 병렬 개발 구조

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-14 | 유닛 분할 | **6개** — 공용(기반) / 코어SDLC(관리) / 코어SDLC(진행) / 장애대응 / 자체개선 / 개발규정 | Q7=X |
| D-15 | 공용 유닛 범위 | 스캐폴딩 + Drizzle 스키마 + 공유 타입 + Auth.js + Helm/Skaffold/Conda/setup **+ K8s 매니페스트 + n8n 인프라** | Q8=C + CQ3=B |
| D-16 | Pod Runner 소속 | **코어SDLC(진행)** 유닛 | CQ3=B |
| D-17 | Slack Gateway 소속 | **코어SDLC(진행)** 유닛 | CQ3=B |
| D-18 | n8n 워크플로우 | 인프라(배포)는 공용, **워크플로우 JSON 작성은 n8n 배포 후** 수행 | CQ3=B + CQ5-(가) |
| D-19 | n8n 작성 방식 | 기존 JSON을 참고자료로 읽고 **명세 기준 신규 작성** (stage 번호 재매핑) | Q6=C + CQ5-(가) |

### 2.4 품질

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-20 | 테스트 전략 | **TDD 강제** — 테스트 선작성 + CI 커버리지 게이트 | Q13=A |
| D-21 | 보안 | **OWASP Top 10 전체.** SECURITY-01~15 전부 blocking | Q1=X → CQ4=E |
| D-22 | 복원력 | RESILIENCY-01~15 적용 (일부 사용자 승인 예외 — §5.2) | Q2=A |
| D-23 | PBT | **Partial** — 순수 함수 + 직렬화 왕복에만 적용 | Q3=B |

### 2.5 운영 및 복원력

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-24 | RTO / RPO | **RTO 4시간 / RPO 24시간.** 일일 DB 백업, 단일 리전 | R1=A |
| D-25 | 변경 관리 | **GitHub PR 리뷰 + merge 승인**이 곧 변경 관리 (도그푸딩) | R2=A |
| D-26 | CI/CD | 로컬 **Skaffold** + **GitHub Actions CI까지만** (CD 없음) | R3=D+ |
| D-27 | 롤백 / 배포 / 토폴로지 | 이전 이미지 태그 재배포(`rollout undo`) / **Rolling Update** / **단일 클러스터·단일 존** | R4=B, R5=A, R6=A |

### 2.6 디자인

| ID | 항목 | 결정 | 출처 |
|----|------|------|------|
| D-28 | 색상 모드 | **`prefers-color-scheme` 자동 전환.** 다크·라이트 토큰 모두 정의 | Q14=C |
| D-29 | 디자인 토큰 | Stitch "Midnight Obsidian" 토큰값 채택. `design/` 문서의 의미적 토큰명에 매핑 | `stitch-design-system.md` |
| D-30 | **요구사항 승인 게이트** | `2 → 3` 전이는 **admin의 명시적 승인 없이는 일어나지 않는다**(fail-closed, 무기한 대기). 설계 게이트는 **신설하지 않는다**. self-approval은 **허용**한다 | 승인게이트 Q1=X·Q2=B·Q3=A·Q4=X·Q5=A, 후속 Q1=A |

---

## 3. 기능 요구사항 (6유닛 배치)

> 각 FR의 상세 명세는 "출처" 열의 원본 문서를 따른다. 본 절은 **유닛 경계 정의**가 목적이다.

### U1. 공용 (기반) — 선행 유닛, 나머지 5개가 모두 의존

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U1-01 | Next.js 16 프로젝트 스캐폴딩 (App Router, TS strict, Tailwind v4 `@theme`, shadcn/ui) | `00-overview.md` §3 |
| FR-U1-02 | Drizzle 스키마 전체 — 인증 4테이블 + 코어·메시징·GitHub·Pod·Repo셋업·공통 테이블 | `04-db-schema.md` (723줄) |
| FR-U1-03 | 마이그레이션 파이프라인 (`drizzle/`) 및 시드 데이터 | `04-db-schema.md` |
| FR-U1-04 | Auth.js v5 GitHub OAuth + 세션 + 권한(user/admin) 미들웨어 | `01-auth-github.md` (330줄) |
| FR-U1-05 | 공유 TypeScript 타입 — `Stage` enum, `ChannelType` enum, `pipelineProfile`, DTO 전반 | `03-state-machine.md` §1 |
| FR-U1-06 | 디자인 토큰 정의 (다크·라이트 양쪽) + 글로벌 레이아웃(사이드바 12항목) | `design/` §2·§3, D-28 |
| FR-U1-07 | Helm 차트 + Skaffold + Conda `environment.yml` + `setup.sh`/`setup.ps1` | `10-k8s-infrastructure.md` |
| FR-U1-08 | K8s 매니페스트 — Secret `sdlc-secrets`, RBAC `portal-sdlc-pod-manager`, ConfigMap, CronJob 2종 | `10-k8s-infrastructure.md` §2·§3·§5 |
| FR-U1-09 | n8n 인프라 배포 (Deployment/Service/DB) — 워크플로우 JSON은 D-18에 따라 후행 | `10-k8s-infrastructure.md` |
| FR-U1-10 | 품질 기반 — lint/format/husky/commitlint + GitHub Actions CI + 커버리지 게이트 | D-20, D-26 |

### U2. 코어SDLC (관리) — SR 등록·조회·관리 UI 및 API

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U2-01 | SR 등록 UI (`/register`) | `08-sr-registration-ui.md` (686줄), `design/` §4.3 |
| FR-U2-02 | 대시보드 (`/`) — 진행 현황 카드 + SR 목록 | `design/` §4.2 |
| FR-U2-03 | SR 상세 (`/requests/[id]`) — 파이프라인 Flow 애니메이션 포함 | `design/` §4.4·§6.2·§6.3 |
| FR-U2-04 | `POST /api/v1/sdlc/intake` — SR 등록 + 즉시 프로비저닝(채널·Pod·webhook), dedupKey 멱등 | `03-state-machine.md` §1.2, `05-portal-api.md` |
| FR-U2-05 | 관리자 화면 6종 — Org / Repo / 장애템플릿 / 개선대상 / 규정시스템 / MCP토큰 | `design/` §4.13 |
| FR-U2-06 | GitHub 어댑터 — Org/Repo/Credential 관리, Issue 생성, PR 생성·merge | `05-portal-api.md` |
| FR-U2-07 | 감사 로그 API + 이미지 프록시 서빙 (`/api/v1/sdlc/images/{id}?token=`) | `05-portal-api.md` |
| FR-U2-08 | **요구사항 승인 게이트 (D-30)** — `POST /requests/{id}/confirm-requirements` 인증을 **`requireAdmin`으로 확정**(명세의 "세션(로그인 사용자)"에서 축소, IDOR 차단) + `/requests/[id]` 승인 버튼 + `audit_events` 승인 기록(승인자·시각) | `05-portal-api.md` §2.6, D-30 |

### U3. 코어SDLC (진행) — 파이프라인 실행 엔진

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U3-01 | 상태 머신 — `Stage` enum, `LEGAL_TRANSITIONS`, 역방향 전이 0개(단방향 DAG) | `03-state-machine.md` §1·§2 |
| FR-U3-02 | **CAS 전이** `advance()` — 원자적 Compare-And-Swap, 불일치 시 `StaleFromError`(409) | `03-state-machine.md` §3 |
| FR-U3-03 | 멱등성 — `idempotency_key = request_id + step_name`, `ensure-*` 패턴 | `03-state-machine.md` §3.2 |
| FR-U3-04 | 단계별 진입 작업(Entry Actions) 4종 + 채널 스냅샷 | `03-state-machine.md` §4·§5 |
| FR-U3-05 | **보상 트랜잭션** `compensateFailedSdlc` — 실패 채널 아카이브 금지, 운영자 개입 지점 유지 | `03-state-machine.md` §6 |
| FR-U3-06 | DevSubStage — `dev`→`qa`→`code_review`→`security_review` 4종 추적·갱신 API | `03-state-machine.md` §7 |
| FR-U3-07 | Pod lifecycle orchestrator — K8s API로 Pod/PVC/Service 생성·삭제·resume | `10-k8s-infrastructure.md` §6 |
| FR-U3-08 | **sdlc-pod-runner (FastAPI)** — 11개 엔드포인트, :58001 | `06-pod-runner-api.md` (962줄) |
| FR-U3-09 | Pod 컨테이너 이미지 재작성 (Node 22 + 공용 레지스트리) + 부속 파일 7종 | D-12 |
| FR-U3-10 | **MessageChannelAdapter** 추상화 + Slack 구현체 (송신) | `02-messaging-adapter.md` (683줄) |
| FR-U3-11 | **sdlc-slack-gateway** — Socket Mode 릴레이 Pod, replicas 1 | `02-messaging-adapter.md` §6.3 |
| FR-U3-12 | **n8n Workflow A/B/C** — 명세 기준 신규 작성, stage 번호 재매핑 | `07-n8n-workflows.md` (849줄), D-19 |
| FR-U3-13 | 목업 캡처 파이프라인 — 이미지 업로드 → S3 → 채널 게시 | `06-pod-runner-api.md` §2.4 |
| FR-U3-14 | **승인 게이트 강제 (D-30)** — `2 → 3` advance는 `metadata.requirementsConfirmedAt`이 없으면 **거부**(fail-closed). 승인 요청은 `requirements` 채널에 알림 + Portal 딥링크로 게시(`feedback-request` 재사용). Pod는 기존 `SDLC_POD_DEADLINE_SECONDS`(4h)로 자동 종료되고 승인 후 기존 resume 경로로 재개 | `03-state-machine.md` §4, D-30 |

### U4. 장애 대응 (Incident)

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U4-01 | 장애 트리거 수집 `POST /incidents/ingest` + `SDLC_INCIDENT_ENABLED` fail-closed | `11-incident-response-agent.md` (2,030줄) |
| FR-U4-02 | incident SR 자동 승격 — `pipelineProfile='incident'`, `dev` 채널 1개, 자동머지 금지 | `03-state-machine.md` §1.1 |
| FR-U4-03 | 원인분석·대응가이드·코드수정 Agent 실행 (`sdlc:incident-response` skill via `POST /run`) | `06-pod-runner-api.md` §2.4 |
| FR-U4-04 | 장애 목록/상세 UI — 5단계 상태 레일 Flow + 분석 산출물 | `design/` §4.5·§4.6·§6.4 |
| FR-U4-05 | Test 트리거 주입 (`/incidents/inject`, admin) + 장애 템플릿 CRUD | `design/` §4.7 |

### U5. 자체개선 (Improvement)

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U5-01 | `portal-sdlc-improve-scan` CronJob — repo 주기 스캔 | `10-k8s-infrastructure.md` §3.2 |
| FR-U5-02 | finding 발굴·추천 Agent (`sdlc:repo-improvement` skill) — 읽기 전용 실행 | `12-self-improvement-agent.md` (1,688줄) |
| FR-U5-03 | finding 검토 → SR 승격 또는 개발규정 승격 | `12-self-improvement-agent.md` §8 |
| FR-U5-04 | 스캔 목록/상세 UI — category 탭 + finding 검토·승격 + 5단계 Flow | `design/` §4.8·§4.9·§6.5 |
| FR-U5-05 | 개선 대상 관리 (`/admin/improvement-targets`) + 수동 스캔 트리거 | `design/` §4.13 |

### U6. 개발 규정 (Developer Memory)

| FR | 요구사항 | 출처 |
|----|---------|------|
| FR-U6-01 | 개발 규정 5종 CRUD + 개정 이력 | `13-developer-memory-agent.md` (2,394줄) |
| FR-U6-02 | **sdlc-memory-mcp** — Streamable HTTP :58002, Bearer `sdlcmem_*` | `13-developer-memory-agent.md` §5 |
| FR-U6-03 | MCP 접근 토큰 발급·폐기 (`SDLC_MEMORY_TOKEN_ISSUER_TOKEN`으로 발급 권한 분리) | `00-overview.md` §4.1 |
| FR-U6-04 | 규정 UI 3종 — 시스템 그리드 / 시스템 규정 / 규정 상세 + 전역 검색 | `design/` §4.10~4.12 |
| FR-U6-05 | Pod 내 Claude Code에 `mcp_servers` 주입 (Pod → MCP 연동) | `00-overview.md` §2 |

---

## 4. 비기능 요구사항

### 4.1 성능·확장성

| NFR | 요구사항 |
|-----|---------|
| NFR-01 | Portal은 **Stateless** — 세션 상태를 메모리에 보관 금지. 모든 상태는 PostgreSQL 또는 클라이언트 |
| NFR-02 | Portal `replicas: 2+` 수평 확장 가능. 장수명 연결(Slack Socket Mode)은 **replicas 1 전용 Pod로 분리** |
| NFR-03 | Pod는 SR 1건당 1개 생성. per-session conda env는 S3 캐시(`conda-pack`)로 기동 시간 단축 |
| NFR-04 | 실시간 진행 갱신 — 파이프라인 Flow 애니메이션 (`design/` §6.6) |

### 4.2 신뢰성 (D-24 기준)

| NFR | 요구사항 |
|-----|---------|
| NFR-05 | **RTO 4시간 / RPO 24시간.** 일일 DB 백업 |
| NFR-06 | 단일 클러스터·단일 존. Rolling Update 배포, `rollout undo` 롤백 |
| NFR-07 | 모든 외부 연동은 멱등(`ensure-*`). 재시도가 부작용을 만들지 않아야 함 |
| NFR-08 | 실패 시 즉시 전체 삭제 금지 — 단계별 보상 + 운영자 개입 지점 확보 |
| NFR-09 | Health check — Portal·Pod Runner·MCP·Gateway 전부 K8s liveness/readiness probe 제공 |

### 4.3 보안 (D-21 — OWASP Top 10 전체)

| NFR | 요구사항 | SECURITY 규칙 |
|-----|---------|--------------|
| NFR-10 | DB에 API Key/JWT/비밀번호 **평문 저장 금지**. `secret_refs` 암호화 참조만 | SECURITY-01, 12 |
| NFR-11 | 모든 API 엔드포인트에 스키마 검증(타입·길이·형식) + 파라미터화 쿼리 | SECURITY-05 |
| NFR-12 | 전 라우트 **deny-by-default** 인증. 리소스 ID 접근 시 소유권 검증(IDOR 방지). admin 라우트 서버측 역할 검증 | SECURITY-08 |
| NFR-13 | HTTP 보안 헤더 5종 (CSP·HSTS·X-Content-Type-Options·X-Frame-Options·Referrer-Policy) | SECURITY-04 |
| NFR-14 | 구조화 로깅 — timestamp·correlation ID·level·message. **secret/PII 로깅 금지** | SECURITY-03 |
| NFR-15 | 의존성 lock 파일 커밋 + 취약점 스캔 CI 단계. Dockerfile `latest` 태그 금지 | SECURITY-10 |
| NFR-16 | 전역 에러 핸들러 + **fail-closed**. 사용자 노출 에러는 일반 메시지만 | SECURITY-15 |
| NFR-17 | 공개 엔드포인트 rate limiting | SECURITY-11 |
| NFR-18 | 감사 로그 append-only. 애플리케이션이 자신의 감사 로그를 삭제·수정할 수 없어야 함 | SECURITY-14 |
| NFR-19 | K8s RBAC 최소 권한 — `portal-sdlc-pod-manager`에 와일드카드 금지 | SECURITY-06 |
| NFR-20 | Pod 이미지 RCE 방지 (`10-k8s-infrastructure.md` §6.6). 비루트 `runner` 사용자 | SECURITY-09 |

### 4.4 테스트 가능성 (D-20, D-23)

| NFR | 요구사항 |
|-----|---------|
| NFR-21 | **TDD** — 각 유닛에서 테스트 선작성. CI 커버리지 게이트 통과 필수 |
| NFR-22 | **PBT (Partial)** — 순수 함수 + 직렬화 왕복에 속성 기반 테스트 적용 (PBT-02 중심) |
| NFR-23 | PBT 대상 후보: 상태 전이 함수(`advance`), 멱등키 생성, DTO 직렬화/역직렬화, 채널명 생성 규칙 |
| NFR-24 | UI 테스트는 Playwright (headless Chromium) — 목업 캡처와 도구 공유 |

### 4.5 유지보수성

| NFR | 요구사항 |
|-----|---------|
| NFR-25 | **어댑터 추상화** — 메시징 송신은 `MessageChannelAdapter` 인터페이스, 수신은 릴레이 Pod → Portal HTTP webhook 단일 진입점 |
| NFR-26 | 보안 핵심 로직(인증·인가)은 전용 모듈에 격리 — 코드베이스 전반 산재 금지 (SECURITY-11) |
| NFR-27 | TypeScript strict mode. 6인 병렬 작업이므로 **공유 타입은 U1이 단독 소유**하고 나머지 유닛은 소비만 |

---

## 5. Extension 준수 계획

### 5.1 적용 현황

| Extension | 상태 | 적용 범위 |
|-----------|------|----------|
| **security-baseline** | **Enabled (full)** | SECURITY-01~15 전부 blocking. §4.3에 매핑 |
| **resiliency-baseline** | **Enabled** | RESILIENCY-01~15. §4.2 및 §5.2 참조 |
| **property-based-testing** | **Partial** | 순수 함수 + 직렬화 왕복만. PBT-02 중심 |

### 5.2 사용자 승인 예외 (Deviation) — 은폐 없이 명시

아래 2건은 사용자가 제시된 선택지에서 **명시적으로 선택**한 예외다.
Extension 규칙상 기본은 blocking이나, 사용자 결정으로 수용하며 **각 단계 준수 요약에
"사용자 승인 예외"로 계속 표시**한다.

| 규칙 | 기본 요구 | 사용자 결정 | 근거 |
|------|----------|------------|------|
| **RESILIENCY-14** (복원력 테스트) | 장애 주입/DR 테스트 방식을 정의해야 함 | **테스트 생략, 설계 원칙만 준수** | R7=D — 2일 일정 |
| **RESILIENCY-15** (장애 대응 프로세스) | 조직의 장애 대응 프로세스에 연계해야 함 | **v2로 연기** | R8=D |

> **참고**: R8=D는 *AIways-On 자체가 운영 중 장애났을 때의 대응 프로세스*를 v2로 미룬다는 뜻이며,
> **제품 기능인 장애대응 Agent(U4, `11-incident-response-agent.md`)는 D-01에 따라 v1 범위에 포함**된다.
> 두 가지는 별개다.

### 5.3 N/A 판정

| 규칙 | 판정 | 근거 |
|------|------|------|
| RESILIENCY-08 (다중 존·리전) | **N/A** | R6=A 단일 클러스터·단일 존 선택. D-24의 RTO 4시간과 정합 |
| RESILIENCY-09 (오토스케일링) | **부분 N/A** | Portal은 `replicas: 2+` 고정. Pod는 SR당 1개 동적 생성이라 HPA 대상 아님 |
| SECURITY-02 (네트워크 중간자 로깅) | **조건부** | Ingress 도입 시 적용. 로컬 K8s 개발 단계에서는 N/A |

---

## 6. 제약 및 가정

### 6.1 제약 (Constraints)

| ID | 제약 |
|----|------|
| C-01 | **개발 기간 2일** (D-02) |
| C-02 | **개발 인력 6명**, 공용 1 + 병렬 5 구조 고정 (D-14) |
| C-03 | 개발 환경에서 사내 미러 레지스트리 접근 불가 (D-11) |
| C-04 | 단일 repo. 6명이 동일 저장소에서 브랜치로 병렬 작업 (D-10) |
| C-05 | 시스템 책임 범위는 **Git Push·PR 생성까지**. 배포·배포검증은 시스템 외부 |

### 6.2 가정 (Assumptions)

| ID | 가정 | 어긋날 경우 영향 |
|----|------|----------------|
| A-01 | 개발자 6명 전원이 바이브코딩으로 가속된 상태 (D-04) | **치명적** — 2일 내 완주 불가. D-01 범위 재조정 필요 |
| A-02 | Slack 워크스페이스 및 App 자격증명을 즉시 확보 가능 (D-13) | U3의 FR-U3-10·11 지연. Mock 어댑터로 우회 가능 |
| A-03 | GitHub OAuth App 및 PAT를 즉시 발급 가능 | U1의 FR-U1-04 차단 |
| A-04 | 로컬 K8s(Docker Desktop 또는 k3d) 사용 가능 | U1의 FR-U1-07·08 차단 |
| A-05 | `requirements/` 명세 14문서에 상호 모순이 없음 | 발견 시 해당 유닛에서 즉시 에스컬레이션 |
| A-06 | Next.js 16이 릴리스되어 사용 가능 | D-07 재검토 (Next.js 15 대체) |

### 6.3 유닛 간 의존성 (Units Generation 입력)

```
        U1 공용(기반)
         |  |  |  |  |
    +----+  |  |  |  +----+
    |       |  |  |       |
   U2      U3  U4 U5     U6
  관리    진행 장애 개선   규정
           ^   ^   ^
           |   |   |
           +---+---+  U4·U5는 U3의 파이프라인 실행 기반에 의존
```

| 의존 | 유형 | 내용 |
|------|------|------|
| U2~U6 → U1 | **차단(blocking)** | 스키마·타입·인증·스캐폴딩이 없으면 착수 불가 |
| U4 → U3 | 부분 차단 | `pipelineProfile='incident'` 실행에 U3의 상태머신·Pod 실행 필요 |
| U5 → U3 | 부분 차단 | `pipelineProfile='improvement'` 동일 |
| U6 → U3 | 약함 | MCP 주입 지점만. 대부분 독립 개발 가능 |
| U2 ↔ U3 | 상호 | U2의 `/intake`가 U3의 프로비저닝을 호출 |

> **⚠️ Units Generation에서 해결할 과제**: U1이 완료되기 전까지 나머지 5명이 대기하는 구조는
> 2일 일정에서 치명적이다. **U1의 인터페이스(타입·스키마)를 최우선 산출물로 분리**해
> 나머지 유닛이 조기 착수할 수 있게 하는 방안을 Units Generation에서 설계한다.

---

## 7. 범위 밖 (Out of Scope)

`00-overview.md` §1.3 및 §4.2에 따라 다음은 제외한다.

| 제외 항목 | 사유 |
|-----------|------|
| Legacy/Eco 시스템 관리 (Langfuse, Qdrant, OpenWebUI 프로비저닝) | SDLC와 무관 |
| System 추상화 (`{LEGACY_SYSTEM_ID}` 기준축, 다중 시스템 관리) | 전역 규정 단일 집합으로 일치 |
| SWP 연동 | 흐름 제거 |
| OpenWebUI | Slack으로 대체 |
| OIDC SSO / AD·LDAP 연동 | GitHub OAuth로 단순화 |
| 대시보드 외 비SDLC 페이지 (공지사항, Eco Viewer) | 범위 밖 |
| Stage 5·6·7·8 (배포·배포검증) | 시스템 책임 범위 밖. 번호만 예약 |
| `mis-vibe-coding-plugin/sdl-migration-docs/` | 별개 SDL 프로젝트 유산. 참조 금지 |

---

## 8. 추적성 매트릭스

| 원본 문서 | 줄수 | 담당 유닛 | FR |
|-----------|------|----------|-----|
| `00-overview.md` | 269 | 전체 | 아키텍처 원칙 |
| `01-auth-github.md` | 330 | U1 | FR-U1-04 |
| `02-messaging-adapter.md` | 683 | U3 | FR-U3-10, 11 |
| `03-state-machine.md` | 571 | U3 | FR-U3-01~06 |
| `04-db-schema.md` | 723 | U1 | FR-U1-02, 03 |
| `05-portal-api.md` | 1,146 | U2 | FR-U2-04, 06, 07 |
| `06-pod-runner-api.md` | 962 | U3 | FR-U3-08, 13 |
| `07-n8n-workflows.md` | 849 | U3 | FR-U3-12 |
| `08-sr-registration-ui.md` | 686 | U2 | FR-U2-01 |
| `09-data-flow.md` | 742 | U2·U3 | 통합 시퀀스 |
| `10-k8s-infrastructure.md` | 1,073 | U1·U3 | FR-U1-07~09, FR-U3-07, 09 |
| `11-incident-response-agent.md` | 2,030 | U4 | FR-U4-01~05 |
| `12-self-improvement-agent.md` | 1,688 | U5 | FR-U5-01~05 |
| `13-developer-memory-agent.md` | 2,394 | U6 | FR-U6-01~05 |
| `design/웹화면-디자인-요구사항_v1.md` | 887 | U1(토큰·레이아웃) + 각 유닛(화면) | 18개 라우트 |
| **합계** | **15,033** | **6 유닛** | **47 FR + 27 NFR** (D-30으로 FR-U2-08·FR-U3-14 추가) |

### 8.1 유닛별 명세 규모 (불균형 확인)

| 유닛 | 담당 명세 줄수 | 비중 | 비고 |
|------|--------------|------|------|
| U1 공용 | 약 2,126 | 14% | 선행 유닛. 차단 요인 |
| U2 관리 | 약 2,574 | 17% | |
| U3 진행 | 약 4,000 | **27%** | ⚠️ 최대 |
| U4 장애 | 약 2,030 | 14% | |
| U5 개선 | 약 1,688 | 11% | |
| U6 규정 | 약 2,394 | 16% | |

> U3가 다른 유닛의 1.5~2.5배다. Units Generation에서 U3 내부를 세분하거나
> 일부 작업(예: n8n 워크플로우 D-18로 후행)을 재배치하는 방안을 검토한다.

---

## 9. 리스크

| ID | 리스크 | 영향 | 완화 |
|----|-------|------|------|
| R-01 | **2일 내 전체 범위 완주 실패** | 치명적 | A-01 가정. 실패 시 D-01 범위를 사용자 판단으로 축소 |
| R-02 | **U1 지연이 나머지 5명 전체를 차단** | 치명적 | 인터페이스 우선 산출 전략 (§6.3) |
| R-03 | U3 과부하 (명세 27%) | 높음 | Units Generation에서 재분배 검토 |
| R-04 | 참고자산의 구 stage 체계(5·7) 혼입 | 높음 | D-05·D-06으로 차단. 코드 리뷰 시 확인 항목화 |
| R-05 | 6명 동일 repo 병렬 작업 충돌 | 중간 | 유닛별 디렉토리 경계 명확화 + 공유 타입 U1 단독 소유(NFR-27) |
| R-06 | Next.js 16 미출시 또는 불안정 | 중간 | A-06. Next.js 15 폴백 |
| R-07 | OWASP 전체 준수가 2일 일정과 충돌 | 높음 | D-21은 사용자 확정 사항. 충돌 시 사용자 재판단 |
| R-08 | 복원력 테스트 생략(§5.2)으로 보상 트랜잭션 결함 미발견 | 중간 | 사용자 승인 예외. PBT로 상태 전이 로직 일부 보완 |
