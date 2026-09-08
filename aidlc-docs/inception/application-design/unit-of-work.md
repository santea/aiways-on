# 유닛 정의 — AIways-On

> **단계**: INCEPTION / Units Generation — Part 2
> **작성**: 2026-09-08
> **입력**: `application-design/` (컴포넌트 31 · 서비스 5 · AD-1~AD-6), `user-stories/stories.md` (56건),
> `plans/unit-of-work-plan.md` (Q1~Q9), `plans/unit-of-work-clarification.md` (CQ1~CQ3)

---

## 0. 확정 결정 (UOW-1 ~ UOW-9)

| ID | 결정 | 출처 | 해소한 문제 |
|----|------|------|-----------|
| **UOW-1** | 6유닛 · **1인 1유닛** 유지. U3만 내부 3트랙으로 순차 진행 | Q1=A | P-1 U3 32% 집중 |
| **UOW-2** | 유닛마다 **배치1(Must) / 배치2(Should)** 로 스토리를 나눠 표기 | Q2=A | P-2 절삭 후보 부재 |
| **UOW-3** | **U1 인터페이스 전용 PR**을 최우선 머지. 이 PR 머지 = 5유닛 착수 신호 | Q3=A | P-3 차단 해제 시점 미정 |
| **UOW-4** | 각 유닛은 **최소 stub**(고정값 반환)으로 착수. 계약 테스트 스위트는 만들지 않고 통합 테스트로 교체 검증. **TDD·커버리지 게이트는 유지(D-20 무수정)** | CQ1=A | P-4 TDD와 병렬 착수 충돌 |
| **UOW-5** | **CODEOWNERS + 디렉토리 경계**로 소유권 강제. B-1~B-7은 리뷰 체크리스트 | Q5=A | P-5 소유권 침범 |
| **UOW-6** | `SdlcRequestFactory` **시그니처는 U1 공유 영역**, 구현은 U3 단독 | Q6=C | P-6 3유닛 동시 차단 |
| **UOW-7** | **Dockerfile은 코드 소유 유닛**, **chart·values·Secret·RBAC·ConfigMap은 U1** | Q7=C | P-7 배포 아티팩트 소유자 |
| **UOW-8** | Drizzle 스키마 **파일은 유닛별 분할**, **소유권은 U1**(배럴·공유 테이블·FK 규약) | Q8=B | P-8 머지 충돌 핫스팟 |
| **UOW-9** | **경량 워크스페이스** — 앱 1개 + `packages/contracts` + `packages/lib`. 유닛은 `features/` 디렉토리와 라우트 그룹으로 분리. 공유 영역에는 U1 소유물 전부(타입·인증·스키마·디자인 토큰) | CQ2=A, CQ3=B | P-9 디렉토리 규칙 부재 |

### UOW-4가 중요한 이유

D-20(TDD 강제 + CI 커버리지 게이트)은 **그대로 유지된다.** 덜어낸 것은 "각 경계마다 별도의
계약 테스트 스위트를 만드는 일"뿐이다. 각 유닛은 자기 코드에 대해 여전히 테스트 우선으로 쓰고,
경계 너머는 손으로 만든 최소 stub으로 대신한다. stub이 실제 구현과 어긋나는지는 **통합 시점의
타입 검사 + 통합 테스트**가 잡는다.

```
[유닛 개발 중]  U4.IncidentPromotion  ──> SdlcRequestFactoryStub (고정값 반환)
                     ^ 단위 테스트는 이 stub 기준으로 통과

[통합 시점]     U4.IncidentPromotion  ──> 실제 U3.SdlcRequestFactory
                     ^ 시그니처 불일치는 typecheck가, 동작 불일치는 통합 테스트가 잡음
```

---

## 1. 유닛 정의

### U1 — 공용 기반 (Shared Foundation)

| 항목 | 내용 |
|------|------|
| **목적** | 나머지 5유닛이 공유하는 계약·인증·데이터 정의·인프라를 단독 소유한다 |
| **컴포넌트** | C-1.1 `SharedTypes` · C-1.2 `AuthGuard` · C-1.3 `SchemaRegistry` · C-1.4 `DesignSystem` · C-1.5 `PlatformOps` (5개) |
| **배포 서비스** | 없음 (SVC-1 Portal에 포함) + 전 서비스의 chart·values·Secret·RBAC 소유 |
| **스토리** | 10건 (배치1 Must 9 · 배치2 Should 1) |
| **책임** | 워크스페이스 스캐폴딩, 공유 타입·Port 인터페이스·Factory 시그니처, 인증 전체(사용자 + 서버간), Drizzle 스키마 배럴·공유 테이블·FK 규약, 디자인 토큰, Helm·Skaffold·Conda·K8s Secret·RBAC·ConfigMap·CronJob 2종, GitHub Actions CI |
| **비책임** | 어떤 도메인 로직도 갖지 않는다. Port의 **구현체를 쓰지 않는다**(AD-1). CronJob이 호출하는 엔드포인트를 **정의하지 않는다**(B-5, 소유는 U5) |
| **차단 관계** | **이 유닛이 5유닛 전부를 막는다.** UOW-3의 인터페이스 전용 PR이 최우선 |

### U2 — 코어SDLC (관리)

| 항목 | 내용 |
|------|------|
| **목적** | SR의 접수·조회와 GitHub 연동. 사람이 보는 관리 화면 |
| **컴포넌트** | C-2.1 `RequestIntake` · C-2.2 `RequestQuery` · C-2.3 `GitHubAdapter` · C-2.4 `AdminConsole` · C-2.5 `ImageProxy` (5개) |
| **배포 서비스** | 없음 (SVC-1 Portal에 포함) |
| **스토리** | 8건 (배치1 Must 6 · 배치2 Should 2) |
| **책임** | `POST /intake` 멱등 접수, 대시보드·SR 상세·목록, `GitHubPort` **구현**(Org·Repo·Credential·Issue·PR), 관리 화면 셸, 목업 이미지 업로드·서명 서빙 |
| **비책임** | 상태 전이를 **직접 하지 않는다** — `StateMachine`은 U3 소유이며 U2는 읽기만(B-3). SR을 직접 INSERT 하지 않는다 — 반드시 Factory 경유(B-1) |
| **주의** | `GitHubPort` **인터페이스는 U1 소유**. U2는 구현만 소유하며 인터페이스를 임의로 바꿀 수 없다(AD-4) |

### U3 — 코어SDLC (진행)

| 항목 | 내용 |
|------|------|
| **목적** | SR이 `1→2→3→4→9`를 실제로 통과하게 만드는 엔진. 상태·Pod·메시징·워크플로우 |
| **컴포넌트** | C-3.1 `SdlcRequestFactory` · C-3.2 `StateMachine` · C-3.3 `StageEntryActions` · C-3.4 `CompensationHandler` · C-3.5 `PodOrchestrator` · C-3.6 `SlackAdapter` · C-3.7 `SlackGateway` · C-3.8 `PodRunner` · C-3.9 `WorkflowOrchestration` (9개) |
| **배포 서비스** | **SVC-2 Pod Runner · SVC-4 Slack Gateway · SVC-5 n8n** (3개) + SVC-1 내 컴포넌트 6개 |
| **스토리** | 18건 (배치1 Must 16 · 배치2 Should 2) — **3트랙으로 순차 진행** |
| **책임** | 프로파일 정책 각인(AD-3), 전이 규칙·CAS·멱등, 단계 진입 작업, 보상 트랜잭션, Pod lifecycle, `MessagingPort`·`PodPort` 구현, Socket Mode 릴레이, FastAPI Runner, n8n 워크플로우 A·B·C |
| **비책임** | PR 생성·merge를 **직접 하지 않는다** — `GitHubPort` 타입으로만 호출(B-2). `4→9`에서 프로파일을 **재판정하지 않는다** — `metadata.autoMergeAllowed`를 읽기만(AD-3). `PodRunner`는 **stage를 해석하지 않는다** |
| **주의** | Stage `5·6·7·8` 값은 존재하지 않는다(D-05, R-04). n8n 워크플로우도 이 체계만 사용 |

#### U3 내부 3트랙 (UOW-1)

| 트랙 | 컴포넌트 | 스토리 | 착수 조건 |
|------|---------|-------|----------|
| **T1 상태·SR생성** | C-3.1 · C-3.2 · C-3.3 · C-3.4 | US-U3-01·02·03·04·05·06 (6건) | UOW-3 PR 머지 직후 — **최우선** (U2·U4·U5가 Factory 구현을 기다림) |
| **T2 Pod·Runner** | C-3.5 · C-3.8 | US-U3-07·08·09·11·17·18 (6건) | T1과 병행 가능 (독립 리포지토리 경로) |
| **T3 Slack·n8n** | C-3.6 · C-3.7 · C-3.9 | US-U3-10·12·13·14·15·16 (6건) | **n8n 배포 이후**(D-18). 시간축에서 분리되므로 마지막 |

> 트랙 경계가 정확히 6/6/6으로 갈리고, T3가 D-18로 자연히 뒤로 밀리므로 한 사람이 순차
> 처리해도 앞 트랙이 뒤 트랙에 막히지 않는다. **T1을 먼저 끝내는 것이 전체 일정의 임계 경로다.**

### U4 — 장애 대응

| 항목 | 내용 |
|------|------|
| **목적** | 장애 트리거를 받아 incident SR로 승격하고 처리 현황을 보여준다 |
| **컴포넌트** | C-4.1 `IncidentIngest` · C-4.2 `IncidentPromotion` · C-4.3 `IncidentConsole` · C-4.4 `IncidentTemplateAdmin` (4개) |
| **배포 서비스** | 없음 (SVC-1 Portal에 포함) |
| **스토리** | 7건 (배치1 Must 5 · 배치2 Should 2) |
| **책임** | 트리거 수집 + fail-closed, incident SR 승격, `/incidents` 화면군과 5단계 상태 레일, 장애 템플릿 CRUD |
| **비책임** | **자동머지 금지·채널 1개 규칙을 구현하지 않는다** — Factory가 각인한다(AD-3). 이 유닛의 담당자는 그 규칙의 존재를 몰라도 된다 |

### U5 — 자체개선

| 항목 | 내용 |
|------|------|
| **목적** | repo를 주기 스캔해 finding을 만들고, 검토를 거쳐 SR 또는 개발규정으로 승격한다 |
| **컴포넌트** | C-5.1 `ImprovementScanTrigger` · C-5.2 `FindingRegistry` · C-5.3 `FindingPromotion` · C-5.4 `ImprovementConsole` (4개) |
| **배포 서비스** | 없음 (SVC-1 Portal에 포함) |
| **스토리** | 6건 (배치1 Must 5 · 배치2 Should 1) |
| **책임** | 스캔 트리거 엔드포인트 **정의**(B-5) + fail-closed, finding 저장·분류·검토, SR/규정 승격, `/improvements` 화면군 |
| **비책임** | 스캔은 **읽기 전용** — repo에 쓰지 않는다. CronJob 자체는 U1이 배포(B-5) |

### U6 — 개발 규정

| 항목 | 내용 |
|------|------|
| **목적** | 개발 규정을 관리하고 사내 개발자의 로컬 Claude Code에 MCP로 공급한다 |
| **컴포넌트** | C-6.1 `MemoryRegistry` · C-6.2 `MemoryMcpServer` · C-6.3 `MemoryTokenAdmin` · C-6.4 `MemoryConsole` (4개) |
| **배포 서비스** | **SVC-3 Memory MCP** (1개) + SVC-1 내 컴포넌트 3개 |
| **스토리** | 7건 (배치1 Must 5 · 배치2 Should 2) |
| **책임** | 규정 5종 CRUD + 개정 이력(actor·timestamp·before/after), Streamable HTTP MCP :58002, `sdlcmem_*` 토큰 발급·폐기, `/memory` 화면군 |
| **비책임** | Pod에 MCP를 **주입하지 않는다** — Pod spec은 U3, ConfigMap은 U1(B-7). Service DNS로 서빙만 한다 |
| **특성** | **가장 독립적인 유닛.** 다른 유닛으로부터 오는 유일한 실행 의존은 B-6(U5→U6)이고 그것도 가장 늦게 연결해도 된다 |

---

## 2. 코드 조직 전략 (Greenfield)

### 2.1 디렉토리 구조 — 확정

```
aiways-on/
├── apps/
│   ├── portal/                        # SVC-1 · Next.js 16 / Node 22 · U1~U6 공동
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/            # U1  로그인
│   │   │   │   ├── (dashboard)/       # U2  대시보드·SR 목록·상세·등록
│   │   │   │   ├── (incident)/        # U4  /incidents/*
│   │   │   │   ├── (improvement)/     # U5  /improvements/*
│   │   │   │   ├── (memory)/          # U6  /memory/*
│   │   │   │   ├── admin/             # 유닛별 하위 폴더 (orgs·repos=U2, incident-templates=U4, ...)
│   │   │   │   └── api/
│   │   │   │       ├── v1/sdlc/       # 유닛별 하위 폴더 — §2.3 라우트 소유 표
│   │   │   │       └── internal/sdlc/ # reconcile=U1·U3 / improvement-scan=U5
│   │   │   └── features/
│   │   │       ├── u2-core-mgmt/      # C-2.1 · C-2.2 · C-2.3 · C-2.4 · C-2.5
│   │   │       ├── u3-core-run/       # C-3.1 · C-3.2 · C-3.3 · C-3.4 · C-3.5 · C-3.6
│   │   │       ├── u4-incident/       # C-4.1 · C-4.2 · C-4.3 · C-4.4
│   │   │       ├── u5-improvement/    # C-5.1 · C-5.2 · C-5.3 · C-5.4
│   │   │       └── u6-memory/         # C-6.1 · C-6.3 · C-6.4
│   │   └── Dockerfile                 # ← U1 소유 (5유닛 코드를 담으므로)
│   ├── sdlc-pod-runner/               # SVC-2 · FastAPI · U3 (Dockerfile 포함)
│   ├── sdlc-memory-mcp/               # SVC-3 · Node 22 + MCP SDK · U6 (Dockerfile 포함)
│   └── sdlc-slack-gateway/            # SVC-4 · Socket Mode · U3 (Dockerfile 포함)
│                                      #   ⚠️ packages/* 의존 금지 — §2.5
├── packages/                          # ── 전부 U1 소유 ──
│   ├── contracts/                     # 런타임 코드 0. 타입·인터페이스만
│   │   ├── stage.ts                   #   Stage · ChannelType · PipelineProfile
│   │   ├── dto.ts                     #   요청·응답 DTO
│   │   ├── ports.ts                   #   GitHubPort · MessagingPort · PodPort   (AD-1)
│   │   └── factory.ts                 #   SdlcRequestFactory 시그니처            (UOW-6)
│   └── lib/
│       ├── auth/                      #   AuthGuard 7함수                        (AD-2)
│       ├── db/schema/                 #   core·sdlc·incident·improvement·memory + index (UOW-8)
│       └── ui/                        #   디자인 토큰 (다크·라이트)
├── drizzle/                           # 마이그레이션 산출물
├── charts/                            # U1 — Helm chart · values (5서비스 전부)   (UOW-7)
├── n8n/                               # U3 — 워크플로우 A·B·C JSON
├── docs/                              # 정적 설계 문서
├── skaffold.yaml · environment.yml · pnpm-workspace.yaml · CODEOWNERS   # U1
└── .github/workflows/                 # U1 — CI 품질 게이트
```

### 2.2 명세 §5 대비 변경 — 추적 가능하게 기록

`requirements/00-overview.md` §5는 **루트 `src/` 단일 앱**을 명시한다(SSOT). CQ2=A로 경량
워크스페이스를 채택했으므로 아래가 명세와의 차이다. **의도된 변경**이며 그 외에는 명세를 따른다.

| 명세 §5 | 확정 구조 | 근거 |
|---------|----------|------|
| `src/` (루트) | `apps/portal/src/` | CQ2=A — `packages/`와 나란히 두기 위해 |
| `src/lib/adapters/` | 인터페이스 → `packages/contracts/ports.ts` / 구현 → `features/u2·u3` | AD-1 (순환 해소) |
| `src/db/schema/` | `packages/lib/db/schema/{unit}.ts` | UOW-8 + CQ3=B |
| `src/auth.ts` | `packages/lib/auth/` | CQ3=B + AD-2 |
| `sdlc-pod-runner/` · `sdlc-memory-mcp/` · `sdlc-slack-gateway/` (루트) | `apps/` 아래로 이동 | 워크스페이스 일관성 |
| `n8n/` · `drizzle/` · `docs/` (루트) | **그대로** | 패키지가 아니므로 이동 이유 없음 |
| — | `charts/` **신규** | UOW-7 — chart·values를 U1이 한곳에서 소유 |

> **되돌릴 수 있는 결정이다.** 워크스페이스가 일정에 부담이 된다고 판단되면 `apps/portal/src/`를
> 루트 `src/`로 되돌리고 `packages/*`를 `src/lib/`로 접어 넣으면 명세 §5와 완전히 같아진다.
> 유닛 경계는 `features/` 디렉토리에 있으므로 이 되돌림으로 깨지지 않는다.

### 2.3 라우트 소유 (CODEOWNERS 적용 대상)

`05-portal-api.md`의 엔드포인트를 유닛에 배정한다. 경로 접두만으로 소유가 갈리게 배치했다.

| 경로 | 소유 | 대표 엔드포인트 |
|------|:----:|----------------|
| `api/v1/sdlc/intake` · `requests/*` · `orgs` · `repos` · `credentials` · `images/*` · `generate-request-no` · `dev-types` | **U2** | `POST /intake`, `GET /requests`, `POST /credentials` |
| `api/v1/sdlc/advance` · `channel-notification` · `slack/events` · `context/*` | **U3** | `POST /advance`, `POST /slack/events` |
| `api/v1/sdlc/incidents/*` · `incident-templates/*` | **U4** | `POST /incidents/ingest`, `POST /incidents/{id}/promote` |
| `api/v1/sdlc/improvements/*` · `findings/*` | **U5** | `POST /findings/{id}/to-sr` |
| `api/v1/sdlc/memory/*` | **U6** | `GET /memory/rules` |
| `api/internal/sdlc/reconcile` | **U3** | CronJob 수신 (Pod 정합성) |
| `api/internal/sdlc/improvement-scan` | **U5** | CronJob 수신 (B-5 — U1은 호출만) |

> `requests/{id}/dev-substage`는 U2 경로에 있으나 **계약 소유는 U3**(B-3). 라우트 파일은 U2가
> 두되 내부에서 U3의 `StateMachine.setSubStage()`를 호출한다. 리뷰 시 B-3 대조 대상.

### 2.4 소유권 강제 (UOW-5)

```
CODEOWNERS
  /packages/                          @u1-owner        # 전체 공유 영역
  /charts/  /skaffold.yaml            @u1-owner
  /.github/                           @u1-owner
  /apps/portal/Dockerfile             @u1-owner
  /apps/portal/src/features/u2-*/     @u2-owner
  /apps/portal/src/app/(dashboard)/   @u2-owner
  ... (유닛별 동일 패턴)
  /apps/sdlc-pod-runner/              @u3-owner
  /apps/sdlc-slack-gateway/           @u3-owner
  /apps/sdlc-memory-mcp/              @u6-owner
```

- 타 유닛 경로를 건드리는 PR은 GitHub이 소유자 리뷰를 **강제**한다 (R2=A 변경관리 결정의 실행형)
- `packages/` 변경 PR은 **전 유닛에 영향**이므로 U1 승인 필수. 리뷰 시 B-1~B-7 대조
- 타입으로 표현되지 않는 규약(호출 순서·멱등 책임·금지 사항)은 `component-dependency.md` §3이 체크리스트

### 2.5 워크스페이스가 새로 만든 위험 — SVC-4 타입 격리

`00-overview.md` §5 각주와 C-3.7은 **Slack Gateway가 Portal과 코드·타입을 공유하지 않는다**고
못 박는다(Slack 원본 봉투를 가공 없이 전달하므로 공유 타입이 불필요). 그런데 워크스페이스에서는
`packages/contracts`를 import 하는 것이 **한 줄이면 되는 일**이 되어 이 규약이 쉽게 깨진다.

**대응**: `apps/sdlc-slack-gateway/package.json`에 `packages/*` 의존을 **넣지 않고**, CI에서
해당 디렉토리의 워크스페이스 의존을 검사해 위반 시 실패시킨다. U1의 CI 품질 게이트(US-U1-10)에 포함.

### 2.6 스키마 파일 조직 (UOW-8)

| 파일 | 담는 테이블 | 편집 |
|------|-----------|------|
| `schema/core.ts` | `users` · `sessions` · `audit_events` · `secret_refs` | **U1만** |
| `schema/sdlc.ts` | `sdlc_requests` · 전이 이력 · 채널 · Pod 관련 | U3 (단, `sdlc_requests`는 공유 테이블 — **U1 승인 필요**) |
| `schema/incident.ts` | 장애·템플릿 | U4 |
| `schema/improvement.ts` | 스캔 회차·finding | U5 |
| `schema/memory.ts` | 규정·개정 이력·MCP 토큰 | U6 |
| `schema/index.ts` | 배럴 재수출 | **U1만** |

**FK 규약**: 타 유닛 테이블을 참조하는 FK는 U1 승인 대상. 마이그레이션 생성(`drizzle/`)은 U1이 일괄 수행해 순서 충돌을 막는다.

### 2.7 배포 아티팩트 소유 (UOW-7)

| 아티팩트 | 소유 | 비고 |
|---------|:----:|------|
| `apps/portal/Dockerfile` | **U1** | 5유닛 코드를 담으므로 단일 소유자 필요 |
| `apps/sdlc-pod-runner/Dockerfile` | U3 | |
| `apps/sdlc-slack-gateway/Dockerfile` | U3 | |
| `apps/sdlc-memory-mcp/Dockerfile` | U6 | |
| Pod 실행 이미지 Dockerfile | U3 | US-U3-18 — `sdlc-pod/Dockerfile` 전면 재작성(CQ5) |
| n8n | — | 공식 이미지, Dockerfile 없음 |
| `charts/` · `values.yaml` · Secret · RBAC · ConfigMap | **U1** | AD-5의 ConfigMap 단일 합의점 유지 |
| `skaffold.yaml` · `environment.yml` · CI | **U1** | |

---

## 3. 유닛 완료 정의 (DoD)

모든 유닛에 공통 적용한다. 유닛별 추가 조건은 표 아래에 둔다.

- [ ] 배치1(Must) 스토리의 인수 조건을 전부 만족
- [ ] **TDD 준수** — 테스트 우선 작성, CI 커버리지 게이트 통과 (D-20, UOW-4로 완화되지 않음)
- [ ] 경계 너머 의존은 최소 stub으로 대체하고, stub 목록을 `unit-of-work-dependency.md` §5와 일치시킴
- [ ] 자기 소유 인터페이스가 `packages/contracts` 선언과 typecheck 통과 (NFR-27)
- [ ] 해당하는 B-1~B-7 규약을 PR 설명에 명시하고 리뷰에서 대조
- [ ] 자기 라우트 전부가 `AuthGuard` 함수 중 하나를 통과 (public은 명시적 예외)
- [ ] 자기 소유 Dockerfile이 빌드되고 chart에서 기동 (U1 chart와 연결 확인)

| 유닛 | 추가 DoD |
|------|---------|
| U1 | 인터페이스 전용 PR이 **머지 완료**되어 5유닛이 착수 가능 상태 · CI 게이트 동작 · SVC-4 의존 금지 검사 포함(§2.5) |
| U2 | `GitHubAdapter`가 `GitHubPort`를 implements (typecheck) · `ensure*` 멱등 확인 · commit 이력 없을 때 `null` 반환 경로 검증 |
| U3 | 3트랙 전부 완료 · **PBT 3건**(US-U3-02·03·12) 통과(NFR-22·23) · Stage 5·6·7·8 부재 검증 · 역방향 전이 0건 |
| U4 | Factory를 `profile='incident'`로만 호출(직접 INSERT 없음) · fail-closed 동작 확인 |
| U5 | 스캔이 repo에 쓰지 않음을 검증 · fail-closed 동작 확인 |
| U6 | MCP 미응답 시에도 **Pod 실행이 실패하지 않음**을 확인(B-7) · 토큰 발급이 `SDLC_MASTER_KEY`로는 불가함을 검증 |

---

## 4. 담당자 배정 모델 (UOW-1)

| 담당 | 유닛 | 스토리 | 착수 시점 | 비고 |
|:----:|------|:-----:|----------|------|
| D1 | **U1** | 10 | **즉시 (단독 선행)** | 인터페이스 PR이 임계 경로의 시작 |
| D2 | U2 | 8 | U1 PR 머지 후 | |
| D3 | **U3** | 18 | U1 PR 머지 후 | **3트랙 순차** — T1을 최우선 (U2·U4·U5가 대기) |
| D4 | U4 | 7 | U1 PR 머지 후 | Factory stub으로 착수 |
| D5 | U5 | 6 | U1 PR 머지 후 | Factory·MemoryRegistry stub으로 착수 |
| D6 | U6 | 7 | U1 PR 머지 후 | stub 불필요 — 가장 독립적 |

**남는 위험(R-03)**: U3는 18건을 1인이 맡는다. 트랙 분할로 순서는 정리했지만 **총량은 그대로**다.
일정이 밀릴 경우 가장 먼저 압박을 받는 지점이며, 완화 수단은 두 가지다 — ① T3(n8n 3건 + US-U3-10)를
D-18에 따라 뒤로 미루고 배치2(US-U3-16·17)를 절삭, ② D6(U6가 가장 독립적이고 7건으로 가벼움)이
T3를 분담. 판단 시점은 T1 완료 시점이 적절하다.

---

## 5. 검증 결과

| 검증 | 방법 | 결과 |
|------|------|------|
| 컴포넌트 배정 | `components.md` 31개 ↔ §1 유닛별 목록 대조 | **31/31** ✅ |
| 스토리 배정 | `stories.md` 56건 ↔ `unit-of-work-story-map.md` | **56/56** ✅ |
| FR 커버리지 | 유닛 배정 후 재확인 | **45/45** ✅ |
| 순환 의존 | 컴파일 타임 그래프 위상 정렬 | **0건** (U1이 유일한 공통 선행) ✅ |
| 서비스 배정 | `services.md` SVC-1~5 ↔ 소유 유닛 | **5/5** ✅ |
| 팀 제약 | 6유닛 = 공용 1 + 병렬 5, 1인 1유닛 | ✅ |

---

## 6. 확장 규칙 준수 요약 (이 단계)

| 규칙 | 판정 | 근거 |
|------|:----:|------|
| SECURITY-06 · 08 (최소권한·접근제어) | ✅ 준수 | 라우트 소유 표(§2.3)의 전 경로가 DoD의 "`AuthGuard` 통과" 조건에 걸림. 권한 제약 12건이 흩어진 유닛에서도 `AuthGuard` 의존이 유지됨 |
| SECURITY-10 (공급망) | ✅ 준수 | 의존성 추가는 워크스페이스 루트 + 각 `apps/*` package.json. `packages/`와 루트는 U1 CODEOWNERS로 승인 필요 |
| SECURITY-11 (보안 설계) | ✅ 준수 | 인증이 `packages/lib/auth` 한 곳에 유지(AD-2). 유닛 분해가 인증을 분산시키지 않음 |
| SECURITY-12 · 13 (자격증명·무결성) | ✅ 준수 | MCP 토큰 발급 권한 분리(C-6.3)가 U6 DoD의 검증 항목. 규정 개정 이력 actor·timestamp 기록이 U6 책임에 명시 |
| RESILIENCY-01 (핵심 워크로드 식별) | ✅ 준수 | §1에 배포 서비스별 소유를 명시. **단일 장애점 2곳** — SVC-4 Gateway(`replicas: 1` 고정)와 SVC-1 Portal(전 화면·API) |
| RESILIENCY-03 (변경관리) | ✅ 준수 | UOW-5의 CODEOWNERS + PR 리뷰가 R2=A 결정의 실행 형태 |
| RESILIENCY-04 (배포·롤백) | ✅ 준수 | UOW-7로 chart·values 소유가 U1 단일. R4=B(이전 이미지 태그 재배포)의 실행 주체가 확정됨 |
| PBT-01 (설계 시 속성 식별) | ✅ 준수 | PBT 3건이 전부 U3 — US-U3-02·03은 T1, US-U3-12는 T3. **트랙이 갈리므로** 두 트랙 모두의 DoD에 PBT 통과를 명시(§3) |
| 그 외 SECURITY-01~05·07·09·14·15 / RESILIENCY-02·05~13 / PBT-02~10 | N/A | 암호화·헤더·로깅·헬스체크·테스트 구현 등 **코드·매니페스트 수준 규칙**. 유닛 분해 산출물에는 판정 대상 구현이 없음. Code Generation에서 평가 |
| RESILIENCY-14 · 15 | 예외 | R7=D · R8=D — **사용자 승인 예외** 기록됨 |
