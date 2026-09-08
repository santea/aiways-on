# 컴포넌트 메서드 시그니처 — AIways-On

> **범위**: 메서드 시그니처와 입출력 타입만. **상세 비즈니스 규칙은 `requirements/`에 있다**
> (execution-plan §2.2, SATISFIED). 여기서는 유닛 간 호출 계약을 확정하는 것이 목적이다.
> 타입은 예시 표기이며, 실제 정의는 U1의 공유 타입 패키지가 소유한다(AD-4).

---

## U1 — 공용 기반

### C-1.1 `SharedTypes` — 타입 선언 (런타임 코드 없음)

```typescript
// 상태 — Stage 5·6·7·8 값 없음 (D-05)
enum Stage { REGISTERED='1_REGISTERED', REQUIREMENTS_IN_PROGRESS='2_REQUIREMENTS_IN_PROGRESS',
             DEV_DESIGN_IN_PROGRESS='3_DEV_DESIGN_IN_PROGRESS', DEV_IN_PROGRESS='4_DEV_IN_PROGRESS',
             COMPLETE='9_COMPLETE', STOPPED='X_STOPPED', FAILED='X_FAILED' }
enum ChannelType { REQUIREMENTS='requirements', DESIGN='design', DEV='dev' }
type PipelineProfile = 'feature' | 'incident' | 'improvement'
enum DevSubStage { DEV='dev', QA='qa', CODE_REVIEW='code_review', SECURITY_REVIEW='security_review' }

// AD-3 — Factory가 각인하는 정책
interface StampedPolicy {
  channelTypes: ChannelType[]        // feature=[3개], incident/improvement=[dev]
  autoMergeAllowed: boolean          // incident=false 강제
}

// AD-1 — 어댑터 Port. 인터페이스는 U1 소유, 구현은 각 유닛
interface GitHubPort { /* 아래 C-2.3 참조 */ }
interface MessagingPort { /* 아래 C-3.6 참조 */ }
interface PodPort { /* 아래 C-3.5 참조 */ }
```

### C-1.2 `AuthGuard` — AD-2, 인증 단일 지점

| 메서드 | 입력 | 출력 | 목적 |
|--------|------|------|------|
| `requireUser(req)` | Request | `Session` \| throw 401 | 세션 검증 |
| `requireAdmin(req)` | Request | `Session` \| throw 403 | admin 역할 **서버측** 검증 |
| `requireOwnership(req, resourceId)` | Request, string | `Session` \| throw 403 | IDOR 방지 (NFR-12) |
| `requireMasterKey(req)` | Request | void \| throw 401 | `SDLC_MASTER_KEY` |
| `requirePodToken(req)` | Request | void \| throw 401 | `POD_AUTH_TOKEN` |
| `requireMemoryToken(req)` | Request | `TokenInfo` \| throw 401 | `sdlcmem_*` Bearer |
| `requireTokenIssuer(req)` | Request | void \| throw 403 | `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` — 발급 전용 |
| `signImageUrl(imageId, ttl)` | string, number | string | 서명 URL 생성 |
| `verifyImageToken(imageId, token)` | string, string | boolean | 서명 검증 |

> **규약**: 모든 라우트는 위 중 하나를 통과한다. 미적용 라우트는 `public` 명시 필요 (SECURITY-08)

### C-1.4 `DesignSystem`
> **교차 유닛 메서드 계약 없음.** 토큰(CSS 변수)과 레이아웃 컴포넌트를 제공하는 자산 컴포넌트다.
> 다른 유닛은 CSS 토큰명과 레이아웃 컴포넌트를 import해 사용할 뿐 함수를 호출하지 않으므로
> 의존 매트릭스에 나타나지 않는다. 규약은 `design/` §2·§3과 `stitch-design-system.md`를 따른다.

### C-1.3 `SchemaRegistry`
| 메서드 | 목적 |
|--------|------|
| `migrate()` | 마이그레이션 적용 (멱등) |
| `getDb()` | Drizzle 클라이언트 (싱글턴) |

### C-1.5 `PlatformOps`
| 산출물 | 목적 |
|--------|------|
| ConfigMap `sdlc-endpoints` | **AD-5** — `memoryMcpUrl` 키 보유. 값은 K8s Service DNS |
| Secret `sdlc-secrets` | 자격증명. 키 목록은 `10-k8s-infrastructure.md` §5.2 |
| Role `portal-sdlc-pod-manager` | 최소 권한 (NFR-19) |

---

## U2 — 코어SDLC (관리)

### C-2.1 `RequestIntake`
| 메서드 | 입력 | 출력 | 비고 |
|--------|------|------|------|
| `intake(input)` | `IntakeInput` | `{ requestNo, status }` 201 | dedupKey 멱등 |

**호출 흐름**: `intake()` → `C-3.1.createSdlcRequest(input,'feature')` → `C-3.5.provision()`

### C-2.2 `RequestQuery`
| 메서드 | 입력 | 출력 |
|--------|------|------|
| `listRequests(session, filter)` | Session, Filter | `RequestSummary[]` |
| `getRequest(session, id)` | Session, string | `RequestDetail` |
| `getTransitions(id)` | string | `StageTransition[]` |

> 권한: `listRequests`·`getRequest`는 `requireOwnership` 경유 (admin은 전체)

### C-2.3 `GitHubAdapter` — **`GitHubPort` 구현** (AD-1)

```typescript
interface GitHubPort {
  ensureIssue(requestId: string, spec: IssueSpec): Promise<IssueRef>
  ensurePullRequest(requestId: string, spec: PrSpec): Promise<PrRef | null>  // null = commit 이력 없음
  mergePullRequest(prRef: PrRef, strategy: 'squash'): Promise<void>
  closeIssueAndDeleteBranch(issueRef: IssueRef, branch: string): Promise<void>
  pushWorkBranch(repo: RepoRef, branch: string): Promise<void>
}
```

> **인터페이스 소유**: U1 / **구현 소유**: U2
> **핵심**: C-3.3(U3)이 이 **인터페이스 타입으로만** 호출 → S-1 순환 끊김
> `ensure-*` 접두는 멱등 계약을 의미 (NFR-07)

### C-2.4 `AdminConsole`
> **교차 유닛 메서드 계약 없음.** 관리 화면의 셸(라우팅·레이아웃)일 뿐 도메인 로직이 없다.
> 실제 데이터는 각 유닛의 Admin 컴포넌트(C-4.4·C-5.4·C-6.3)가 제공한다.
> 전 라우트에 `AuthGuard.requireAdmin()` 적용이 유일한 규약이다.

### C-2.5 `ImageProxy`
| 메서드 | 인증 | 목적 |
|--------|------|------|
| `upload(requestId, file)` | `requireMasterKey` | 저장 후 서명 URL 반환 |
| `serve(imageId, token)` | `verifyImageToken` | 이미지 스트리밍 |

---

## U3 — 코어SDLC (진행)

### C-3.1 `SdlcRequestFactory` — **AD-3 핵심**

```typescript
// 유닛별 생성 함수는 각자 두되, 아래 validator는 단 하나만 존재한다
function validateAndStampPolicy(
  input: SdlcRequestInput,
  profile: PipelineProfile
): ValidatedRequest   // { ...input, metadata: { pipelineProfile, ...StampedPolicy } }
```

| 단계 | 동작 |
|------|------|
| 1. 입력 검증 | 스키마·필수값·dedupKey 형식 (NFR-11) |
| 2. **정책 각인** | `channelTypes`: feature→3개 / incident·improvement→`[dev]`<br>`autoMergeAllowed`: **incident→`false` (repo 설정 무시)** / 그 외→repo 설정 |
| 3. 반환 | 각인된 metadata를 포함한 `ValidatedRequest` |

| 호출자 | profile |
|--------|---------|
| C-2.1 `RequestIntake` | `'feature'` |
| C-4.2 `IncidentPromotion` | `'incident'` |
| C-5.3 `FindingPromotion` | `'improvement'` |

> **왜 안전한가**: `03-state-machine.md` §4.4의 자동머지 금지 규칙이 U3 조건문이 아니라
> **SR 데이터에 각인된 값**이 된다. C-3.3은 이 값을 읽기만 하므로,
> U4 담당자가 조항을 몰라도 규칙이 지켜진다.

### C-3.2 `StateMachine`

```typescript
function advance(requestId: string, from: Stage, to: Stage): Promise<AdvanceResult>
// 성공: { ok: true, stage: to }
// 상태 불일치: throw StaleFromError (409)
// 불법 전이: throw IllegalTransitionError (400)
```

| 메서드 | 목적 |
|--------|------|
| `advance(requestId, from, to)` | **CAS 원자 전이**. PBT 대상 (NFR-23) |
| `isLegalTransition(from, to)` | 순수 함수. Stage 5~8 전이는 항상 false |
| `getSubStage(requestId)` | 현재 `DevSubStage` |
| `setSubStage(requestId, sub)` | 순서 강제: dev→qa→code_review→security_review |
| `buildIdempotencyKey(requestId, step)` | `requestId + step`. PBT 대상 |

### C-3.3 `StageEntryActions`

| 메서드 | 수행 작업 | 의존 Port |
|--------|----------|----------|
| `onEnterRequirements(id)` | `requirements` 채널 생성 | `MessagingPort` |
| `onEnterDesign(id)` | `design` 채널 생성 + `requirements` 스냅샷 | `MessagingPort` |
| `onEnterDev(id)` | `dev` 채널 생성 + `design` 스냅샷 | `MessagingPort` |
| `onEnterComplete(id)` | **repo 확정 루프** + `dev` 스냅샷 + 완료 요약 게시 + Pod 종료 | `GitHubPort`, `MessagingPort`, `PodPort` |

```typescript
// onEnterComplete 내부 — AD-3 적용 지점
const policy = request.metadata.autoMergeAllowed   // 읽기만. 프로파일 재판정 없음
const pr = await githubPort.ensurePullRequest(id, spec)
if (pr && policy) await githubPort.mergePullRequest(pr, 'squash')
```

> **채널 생성은 각인된 `channelTypes`를 따른다** — incident/improvement면 `dev` 1개만 생성

### C-3.4 `CompensationHandler`
| 메서드 | 목적 |
|--------|------|
| `compensate(requestId, reason)` | 단계별 보상 후 `X_FAILED` 전환 |
| `postFailureToChannel(requestId, reason)` | **채널 아카이브 금지**, 실패 결과 게시 (NFR-08) |
| `recordOperatorIntervention(requestId, point)` | 개입 지점 기록 |

### C-3.5 `PodOrchestrator` — **`PodPort` 구현**

```typescript
interface PodPort {
  provision(requestId: string, spec: PodSpec): Promise<PodRef>   // 멱등
  terminate(requestId: string): Promise<void>
  getStatus(requestId: string): Promise<PodStatus>
  resume(requestId: string, budget: ResumeBudget): Promise<ResumeResult>
}
```

> Pod spec에 **AD-5**의 ConfigMap `sdlc-endpoints.memoryMcpUrl`을 `mcp_servers`로 주입

### C-3.6 `SlackAdapter` — **`MessagingPort` 구현**

```typescript
interface MessagingPort {
  ensureChannel(requestId: string, type: ChannelType): Promise<ChannelRef>
  postMessage(channel: ChannelRef, msg: Message): Promise<void>
  inviteMembers(channel: ChannelRef, emails: string[]): Promise<void>
  snapshotHistory(channel: ChannelRef): Promise<MessageSnapshot[]>
  buildChannelName(profile: PipelineProfile, no: string, type: ChannelType): string
}
```

| `buildChannelName` 규칙 | 결과 | PBT 대상 |
|------------------------|------|:--------:|
| `feature` | `sr-{no}-{type}` | ✅ |
| `incident` | `inc-{no}-dev` | ✅ |
| `improvement` | `imp-{no}-dev` | ✅ |

### C-3.7 `SlackGateway` (독립 배포)
| 엔드포인트 | 목적 |
|-----------|------|
| Socket Mode 연결 | Slack 이벤트 수신 |
| `POST {portal}/slack/events` | **원본 봉투 그대로** 릴레이 (가공 없음) |
| `GET /health` | K8s probe |

> `replicas: 1` 고정 (NFR-02)

### C-3.8 `PodRunner` (FastAPI, 독립 배포)

| 엔드포인트 | 인증 | 비고 |
|-----------|------|------|
| `GET /health` | 없음 | probe |
| `POST /clone` | `POD_AUTH_TOKEN` | 멱등 |
| `GET /status` | `POD_AUTH_TOKEN` | |
| `POST /run` | `POD_AUTH_TOKEN` | 동기/비동기/resume |
| `POST /git/commit-push` | `POD_AUTH_TOKEN` | PR 생성·merge는 하지 않음 |
| `DELETE /session` | `POD_AUTH_TOKEN` | |
| `POST/GET /context` | `POD_AUTH_TOKEN` | |
| `POST/GET /stage` | `POD_AUTH_TOKEN` | substage 저장소 |
| `POST /notify-channel` | `SDLC_MASTER_KEY` | Portal 중계 (2-hop) |

> **경계 규약**: Pod는 stage를 해석하지 않는다. `/stage`는 단순 저장소일 뿐이며,
> 판정은 n8n이 `/run` 출력 텍스트로만 수행한다

### C-3.9 `WorkflowOrchestration` (n8n, 후행)
| 워크플로우 | webhook | 책임 |
|-----------|---------|------|
| A Intake | `sdlc-intake` | repo 선택 → clone → Issue → Stage 2 전이 |
| B Callback | `sdlc-run-complete`, `sdlc-stage-resume` | stage/substage 분기, 마커 판정, resume |
| C Logging | `sdlc-pod-event` | 감사 로그 적재 |

---

## U4 — 장애 대응

| 컴포넌트 | 메서드 | 비고 |
|---------|--------|------|
| C-4.1 `IncidentIngest` | `ingest(payload)` | fail-closed 플래그 확인 |
| C-4.2 `IncidentPromotion` | `promote(incidentId)` | **`C-3.1.validateAndStampPolicy(input,'incident')` 호출** |
| C-4.3 `IncidentConsole` | `list()` / `detail(id)` / `inject(template)` | inject는 `requireAdmin` |
| C-4.4 `IncidentTemplateAdmin` | CRUD | `requireAdmin` |

> **C-4.2 규약**: 자동머지 금지·채널 1개 규칙을 **여기서 구현하지 않는다.** Factory가 각인한다 (AD-3)

---

## U5 — 자체개선

| 컴포넌트 | 메서드 | 비고 |
|---------|--------|------|
| C-5.1 `ImprovementScanTrigger` | `startScan()` | `requireMasterKey` + fail-closed |
| C-5.2 `FindingRegistry` | `saveFindings()` / `listByCategory()` / `review()` | 스캔은 읽기 전용 |
| C-5.3 `FindingPromotion` | `promoteToSr(findingId)` | `C-3.1(...,'improvement')` |
| | `promoteToMemory(findingId)` | `C-6.1.createRule()` — 경계 U5↔U6 |
| C-5.4 `ImprovementConsole` | `list()` / `detail(id)` / `manualTrigger()` | 승격은 `requireAdmin` |

---

## U6 — 개발 규정

| 컴포넌트 | 메서드 | 비고 |
|---------|--------|------|
| C-6.1 `MemoryRegistry` | `createRule()` / `updateRule()` / `getRule()` / `search(q)` | 개정 이력 자동 기록 (SECURITY-13) |
| | `listRevisions(ruleId)` | actor·timestamp·before/after |
| C-6.2 `MemoryMcpServer` | Streamable HTTP :58002 | `requireMemoryToken` |
| C-6.3 `MemoryTokenAdmin` | `issueToken()` | **`requireTokenIssuer`** — MASTER_KEY로는 불가 |
| | `revokeToken(id)` / `listTokens()` | 목록은 평문 미노출 (NFR-10) |
| C-6.4 `MemoryConsole` | 화면 3종 + 전역 검색 | 폐기는 `requireAdmin` |
