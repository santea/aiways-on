# 컴포넌트 정의 — AIways-On

> **범위**: 컴포넌트 경계와 책임만 다룬다. 비즈니스 규칙·DB 컬럼·매니페스트는
> `requirements/`에 이미 있으며 SATISFIED로 확정됨(execution-plan §2.2).

## 설계 결정 (AD-1 ~ AD-6)

| ID | 결정 | 해소한 문제 |
|----|------|-----------|
| **AD-1** | 어댑터 **인터페이스**(`GitHubPort`·`MessagingPort`·`PodPort`)를 U1이 정의하고, **구현**은 각 소유 유닛에 둔다 | S-1 순환 의존 |
| **AD-2** | **인증 전체를 U1이 단독 소유**. 사용자 인증 + 서버간 인증 4종. 나머지 유닛은 소비만 | S-2 인증 소유자 부재 |
| **AD-3** | SR 생성 함수는 유닛별로 두되, **단일 공통 validator**가 입력 검증 + **프로파일 정책을 SR에 각인**한다 | S-3 SR 생성 3분기 |
| **AD-4** | 인터페이스별 **소유자 1명**. 타입 선언은 U1 공유 패키지에, 수정 권한은 소유자만 | S-4 중복 계약 |
| **AD-5** | MCP 연결 정보는 **ConfigMap 키 1개**로 합의. 값은 K8s Service DNS | S-5 3자 조율 |
| **AD-6** | 코드 리뷰 규약 + `component-dependency.md`에 경계별 규약 명문화. 타입 검사는 Q4·NFR-27·US-U1-10으로 이미 강제됨 | 계약 위반 방지 |

### AD-3의 작동 원리 — 왜 이것이 안전 장치인가

```
[생성 시점]  createSdlcRequest(input, profile)
                    |
                    v
             validateAndStampPolicy(input, profile)   <- U1 소유, 단 하나만 존재
                    |
                    +-- 입력 검증 (스키마·필수값·dedupKey)
                    +-- 프로파일 정책 결정 후 SR에 각인:
                          channelTypes    : feature -> [requirements, design, dev]
                                            incident/improvement -> [dev]
                          autoMergeAllowed: incident -> false (repo 설정 무시)
                                            그 외 -> repo 설정 따름
                    v
             sdlc_requests.metadata 에 정책 저장

[4 -> 9 전이]  U3 상태머신
                    |
                    +-- metadata.autoMergeAllowed 를 **읽기만** 한다
                        (프로파일을 다시 판정하지 않는다)
```

**효과**: `03-state-machine.md` §4.4의 incident 자동머지 금지 규칙이 U3 코드의 조건문이 아니라
**SR 데이터에 각인된 값**이 된다. U4 담당자가 그 조항의 존재를 몰라도 규칙이 지켜진다.

---

## 컴포넌트 목록

### U1 — 공용 기반

#### C-1.1 `SharedTypes` (공유 타입)
- **책임**: `Stage` enum, `ChannelType` enum, `PipelineProfile`, DTO, 어댑터 Port 인터페이스 선언
- **인터페이스**: 타입 전용. 런타임 코드 없음
- **소유**: U1 단독. 다른 유닛은 import만 (NFR-27)
- **불변 규약**: `Stage`에 `5`·`6`·`7`·`8` 값을 추가하지 않는다 (D-05, R-04)

#### C-1.2 `AuthGuard` (인증·인가) — AD-2
> **2026-09-08 갱신 (F-1)**: 7함수 → **10함수**. U1 Code Generation Part 1에서 명세의 활성
> 서버간 스킴을 세어 보니 "4종" 전제가 실제와 달랐다. 누락된 3종을 방치하면 각 스킴이
> 그것을 필요로 하는 유닛(U3·U3·U6)의 라우트에서 개별 구현되어 **AD-2가 막으려던 분산이
> 그대로 발생**하고 SECURITY-11에 위배된다.
> 상세: `aidlc-docs/construction/u1-shared-foundation/code/auth-scheme-inventory.md`

- **책임**: 사용자 인증(GitHub OAuth) + **서버간 인증 6종**의 **단일 검증 지점**
- **인터페이스**
  - `requireUser()` — 세션 검증, 없으면 401
  - `requireAdmin()` — admin 역할 서버측 검증, 아니면 403
  - `requireOwnership(resourceId, userId)` — IDOR 방지 (NFR-12)
  - `requireMasterKey()` — `SDLC_MASTER_KEY` 검증 (내부 API)
  - `requirePodToken()` — `POD_AUTH_TOKEN` 검증
  - `requireMemoryToken()` — `sdlcmem_*` Bearer 검증
  - **`requireReconcileToken()`** — `SDLC_RECONCILE_TOKEN` 검증 (CronJob 정합성 복구) ⬅ F-1
  - **`requireCallbackBearer()`** — `SDLC_CALLBACK_BEARER` 검증. 미설정 시 master key로 검증 ⬅ F-1
  - **`requireTokenIssuer()`** — `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` 검증. **master key로 대체 불가** ⬅ F-1
  - `signImageUrl()` / `verifyImageToken()` — 이미지 서빙 서명

- **만들지 않은 것**: `SLACK_SIGNING_SECRET` 검증 — `events-api` 모드 전용이며 이 시스템은
  gateway 모드를 쓴다. 쓰지 않을 검증 코드를 미리 만들지 않는다
- **보안 근거**: SECURITY-08(deny-by-default·IDOR·서버측 역할 검증), SECURITY-11(보안 로직 격리)
- **규약**: 모든 라우트는 위 함수 중 하나를 반드시 통과한다. 예외는 `public` 명시 필요

#### C-1.3 `SchemaRegistry` (DB 스키마)
- **책임**: Drizzle 스키마 전체 + 마이그레이션
- **설계 근거**: `04-db-schema.md` (SATISFIED)
- **규약**: `secret_refs`는 암호화 참조만(NFR-10). `audit_events`는 append-only(NFR-18)

#### C-1.4 `DesignSystem` (디자인 토큰·레이아웃)
- **책임**: 색·타이포·간격 토큰(다크·라이트), 사이드바 12항목, No-Line 규칙
- **설계 근거**: `design/` §2·§3 + `reference-assets/stitch-design-system.md`

#### C-1.5 `PlatformOps` (인프라)
- **책임**: Helm·Skaffold·Conda·K8s Secret·RBAC·ConfigMap·CronJob 2종·GitHub Actions CI
- **설계 근거**: `10-k8s-infrastructure.md` (SATISFIED)
- **AD-5 소유**: MCP 엔드포인트 ConfigMap 키를 여기서 정의

---

### U2 — 코어SDLC (관리)

#### C-2.1 `RequestIntake` (SR 접수)
- **책임**: `POST /intake` — 등록 + 즉시 프로비저닝 발화
- **의존**: C-3.1 `SdlcRequestFactory`(생성), C-3.5 `PodOrchestrator`(프로비저닝)
- **규약**: dedupKey 멱등. 실패 시 대기 아닌 보상 트랜잭션(`03-state-machine.md` §1.2)

#### C-2.2 `RequestQuery` (SR 조회)
- **책임**: 대시보드·SR 상세·목록 조회 API 및 화면
- **의존**: C-3.2 `StateMachine`(상태·substage 조회)
- **권한**: `user`는 본인 SR만, `admin`은 전체 (C-1.2 `requireOwnership`)

#### C-2.3 `GitHubAdapter` — AD-1 구현체
- **책임**: `GitHubPort` 인터페이스의 구현. Org·Repo·Credential 관리, Issue·PR 생성·merge
- **인터페이스 소유**: U1 (C-1.1) / **구현 소유**: U2
- **중요**: U3의 `4→9` 진입작업이 이 구현을 **`GitHubPort` 타입으로만** 호출한다 → 순환 없음
- **규약**: `ensure-*` 멱등. commit 이력 없으면 PR 생성하지 않고 Issue close + branch 삭제

#### C-2.4 `AdminConsole` (관리 화면)
- **책임**: `/admin/orgs`·`/admin/repos` 및 나머지 관리 화면의 셸
- **권한**: 전 라우트 `requireAdmin()`

#### C-2.5 `ImageProxy` (목업 이미지)
- **책임**: 업로드 수신 → 오브젝트 스토리지 저장 → 서명 URL 서빙
- **의존**: C-1.2 (`requireMasterKey`, `signImageUrl`)

---

### U3 — 코어SDLC (진행)

#### C-3.1 `SdlcRequestFactory` (SR 생성) — AD-3 핵심
- **책임**: `validateAndStampPolicy()` — **단일 공통 validator**. 입력 검증 + 프로파일 정책 각인
- **호출자**: C-2.1(feature) · C-4.2(incident) · C-5.3(improvement)
- **각인 항목**: `channelTypes`, `autoMergeAllowed`
- **규약**: 이 함수를 우회한 SR 생성 금지. 우회 시 프로파일 정책이 비게 되어 하위 단계가 실패해야 함

#### C-3.2 `StateMachine` (상태 머신)
- **책임**: `Stage` 전이 규칙, `advance()` CAS, 전이 이력 기록
- **설계 근거**: `03-state-machine.md` §1~§3 (SATISFIED)
- **PBT 대상**: `advance()` 순수 판정 로직 (NFR-23)
- **규약**: Stage 5·6·7·8로의 전이는 불법. 역방향 전이 0개

#### C-3.3 `StageEntryActions` (단계 진입 작업)
- **책임**: `1→2`·`2→3`·`3→4`·`4→9` 각 진입 작업 + 채널 스냅샷
- **의존**: `GitHubPort`(C-2.3 구현), `MessagingPort`(C-3.6 구현), C-3.5
- **AD-3 적용**: `4→9`에서 `metadata.autoMergeAllowed`를 **읽기만** 한다

#### C-3.4 `CompensationHandler` (보상 트랜잭션)
- **책임**: `X_FAILED` 전환 시 단계별 보상 + 운영자 개입 지점 기록
- **규약**: 실패 채널을 **아카이브하지 않고** 실패 결과를 게시한다 (NFR-08)

#### C-3.5 `PodOrchestrator` (Pod lifecycle)
- **책임**: K8s API로 Pod·PVC·Service 생성·삭제. `PodPort` 구현
- **의존**: C-1.2(`requirePodToken`), C-1.5(RBAC)
- **규약**: 비루트 `runner` 실행(NFR-20). 최소 권한 RBAC(NFR-19)

#### C-3.6 `SlackAdapter` — AD-1 구현체
- **책임**: `MessagingPort` 구현. 채널 생성·게시·초대·history 스냅샷
- **인터페이스 소유**: U1 / **구현 소유**: U3
- **PBT 대상**: 채널명 생성 규칙 (`sr-`/`inc-`/`imp-` prefix)

#### C-3.7 `SlackGateway` (수신 릴레이) — 독립 배포 단위
- **책임**: Socket Mode 수신 → Portal `POST /slack/events` 릴레이
- **제약**: `replicas: 1` 고정. Portal과 코드·타입 공유 없음 (원본 봉투 그대로 전달)
- **근거**: NFR-02 — Portal이 `replicas: 2+`이므로 소켓 내장 시 중복 수신

#### C-3.8 `PodRunner` (FastAPI) — 독립 배포 단위
- **책임**: `/clone`·`/run`·`/git/commit-push`·`/session`·`/context`·`/stage`·`/notify-channel`·`/health`
- **설계 근거**: `06-pod-runner-api.md` (SATISFIED)
- **경계 규약**: **stage를 모른다.** 지시받은 작업만 수행하고 마커 문자열만 출력

#### C-3.9 `WorkflowOrchestration` (n8n) — 후행 (D-18)
- **책임**: Workflow A(intake)·B(callback)·C(logging)
- **착수 시점**: n8n 배포 이후
- **규약**: stage 번호는 명세 체계(1·2·3·4·9)만 사용. 구 체계(5·7) 금지 (D-05, R-04)

---

### U4 — 장애 대응

#### C-4.1 `IncidentIngest` (트리거 수집)
- **책임**: `POST /incidents/ingest` + `SDLC_INCIDENT_ENABLED` fail-closed
- **의존**: C-1.2(`requireMasterKey`)

#### C-4.2 `IncidentPromotion` (SR 승격)
- **책임**: 장애 → incident SR 승격
- **의존**: **C-3.1 `SdlcRequestFactory`를 `profile='incident'`로 호출** (AD-3)
- **중요**: 자동머지 금지·채널 1개 규칙은 여기서 신경 쓰지 않는다. Factory가 각인한다

#### C-4.3 `IncidentConsole` (UI)
- **책임**: `/incidents`·`/incidents/[id]`·`/incidents/inject` + 5단계 상태 레일
- **권한**: `user` 읽기, `admin` 승격·종결·주입

#### C-4.4 `IncidentTemplateAdmin`
- **책임**: `/admin/incident-templates` CRUD

---

### U5 — 자체개선

#### C-5.1 `ImprovementScanTrigger`
- **책임**: `/api/internal/sdlc/improvement-scan` 수신 + `SDLC_IMPROVEMENT_ENABLED` fail-closed
- **호출자**: C-1.5의 CronJob (경계: U1↔U5)

#### C-5.2 `FindingRegistry`
- **책임**: finding 저장·분류·검토 상태 관리
- **규약**: 스캔은 **읽기 전용**. repo에 쓰지 않는다

#### C-5.3 `FindingPromotion`
- **책임**: finding → SR 승격 또는 → 개발규정 승격
- **의존**: C-3.1(`profile='improvement'`), C-6.1(규정 생성)
- **권한**: 승격은 `admin`만

#### C-5.4 `ImprovementConsole` (UI)
- **책임**: `/improvements`·`/improvements/[id]`·`/admin/improvement-targets`

---

### U6 — 개발 규정

#### C-6.1 `MemoryRegistry` (규정 저장소)
- **책임**: 규정 5종 CRUD + 개정 이력
- **규약**: 개정 이력은 actor·timestamp·before/after 기록 (SECURITY-13)

#### C-6.2 `MemoryMcpServer` — 독립 배포 단위
- **책임**: Streamable HTTP :58002, `sdlcmem_*` Bearer 인증
- **의존**: C-1.2(`requireMemoryToken`), C-6.1
- **AD-5**: 자신의 주소를 C-1.5가 정의한 ConfigMap 키로 노출

#### C-6.3 `MemoryTokenAdmin`
- **책임**: MCP 토큰 발급·폐기
- **규약**: 발급 권한은 `SDLC_MEMORY_TOKEN_ISSUER_TOKEN`으로 분리. `SDLC_MASTER_KEY`로는 발급 불가

#### C-6.4 `MemoryConsole` (UI)
- **책임**: `/memory`·`/memory/[systemKey]`·`/memory/[systemKey]/[category]/[slug]` + 전역 검색

---

## 컴포넌트 총계

| 유닛 | 컴포넌트 수 | 독립 배포 단위 |
|------|:---------:|--------------|
| U1 | 5 | — (Portal에 포함) |
| U2 | 5 | — (Portal에 포함) |
| U3 | 9 | SlackGateway, PodRunner, n8n |
| U4 | 4 | — |
| U5 | 4 | — |
| U6 | 4 | MemoryMcpServer |
| **합계** | **31** | **4 + Portal = 5** |
