# 서비스 정의 — AIways-On

> **서비스(Service)** = 독립적으로 배포·기동되는 프로세스 단위.
> `components.md`의 컴포넌트가 이 서비스들에 배치된다.

## 서비스 목록 (5개)

| # | 서비스 | 런타임 | 포트 | replicas | 소유 유닛 |
|---|--------|--------|------|:--------:|----------|
| **SVC-1** | **Portal** | Next.js 16 / Node 22 | 3000 | 2+ | U1·U2·U4·U5·U6 (공동) |
| **SVC-2** | **Pod Runner** | FastAPI / Python | 58001 | SR당 1개 (동적) | U3 |
| **SVC-3** | **Memory MCP** | Node 22 + MCP SDK | 58002 | 1+ | U6 |
| **SVC-4** | **Slack Gateway** | Node 22 + Socket Mode | — | **1 고정** | U3 |
| **SVC-5** | **n8n** | n8n 공식 이미지 | 5678 | 1 | U3 (워크플로우) / U1 (배포) |

> 지원 인프라: PostgreSQL, 오브젝트 스토리지(S3/MinIO)

---

## SVC-1 · Portal

**책임**: 상태 관리, 외부 시스템 오케스트레이션, 감사 로그, 전 화면 서빙

**배치된 컴포넌트 (23개)**

| 유닛 | 컴포넌트 |
|------|---------|
| U1 | SharedTypes · AuthGuard · SchemaRegistry · DesignSystem |
| U2 | RequestIntake · RequestQuery · GitHubAdapter · AdminConsole · ImageProxy |
| U3 | SdlcRequestFactory · StateMachine · StageEntryActions · CompensationHandler · PodOrchestrator · SlackAdapter |
| U4 | IncidentIngest · IncidentPromotion · IncidentConsole · IncidentTemplateAdmin |
| U5 | ImprovementScanTrigger · FindingRegistry · FindingPromotion · ImprovementConsole |
| U6 | MemoryRegistry · MemoryTokenAdmin · MemoryConsole |

> **6명 중 5명이 같은 서비스에 코드를 넣는다.** 유닛별 디렉토리 경계가 중요한 이유다(R-05).

**제약**
- **Stateless** (NFR-01) — 세션 상태를 메모리에 두지 않는다
- `replicas: 2+` 수평 확장 (NFR-02)
- 장수명 연결(Socket Mode)은 **넣지 않는다** → SVC-4로 분리

---

## SVC-2 · Pod Runner

**책임**: 격리 환경에서 Claude Code 실행, Git 작업

**배치**: C-3.8 `PodRunner`
**설계 근거**: `06-pod-runner-api.md` (SATISFIED)

**생명주기**
```
SR 접수 -> PodOrchestrator.provision() -> Pod + PVC + Service 생성
        -> n8n이 /clone, /run 호출 (여러 회)
        -> SR terminal 도달 -> PodOrchestrator.terminate() -> 자원 회수
```

**경계 규약 (중요)**
- **stage를 해석하지 않는다.** `/stage`는 저장소일 뿐, 판정은 n8n이 `/run` 출력 텍스트로 수행
- 자의로 다음 단계를 시작하지 않는다
- **PR 생성·merge를 하지 않는다** — Portal(C-2.3) 담당
- 비루트 `runner` 실행 (NFR-20)

---

## SVC-3 · Memory MCP

**책임**: 사내 개발자의 로컬 Claude Code에 개발 규정 공급

**배치**: C-6.2 `MemoryMcpServer`
**전송**: Streamable HTTP (SSE 아님 — D-05 계열 참고자산 불일치 항목)
**인증**: `sdlcmem_*` Bearer (`AuthGuard.requireMemoryToken`)

**AD-5 — 3자 조율**
```
U1 (PlatformOps)  ConfigMap sdlc-endpoints.memoryMcpUrl 정의
                          = "sdlc-memory-mcp.{ns}.svc.cluster.local:58002"
                                    |
        +---------------------------+---------------------------+
        |                                                       |
U3 (PodOrchestrator)                                    U6 (MemoryMcpServer)
Pod spec에서 이 키를 참조해                                 이 Service DNS로 서빙
mcp_servers 로 주입
```
> 3자가 합의할 것은 **ConfigMap 키 이름 하나**. 값은 Service DNS가 흡수한다.

**소비자 2종**
| 소비자 | 경로 |
|--------|------|
| 사내 개발자 로컬 Claude Code (P4) | 외부 → Bearer 인증 |
| SDLC Pod 내 Claude Code (S2) | 클러스터 내부 → `mcp_servers` 주입 |

> MCP가 응답하지 않아도 Pod 실행 자체는 실패하지 않는다 (규정 참조는 보조 기능, US-U6-07)

---

## SVC-4 · Slack Gateway

**책임**: Slack Socket Mode 수신 → Portal HTTP 릴레이

**배치**: C-3.7 `SlackGateway`

**왜 별도 서비스인가**
> Portal은 `replicas: 2+`이므로 소켓을 내장하면 **replica 수만큼 중복 수신**된다.
> 장수명 연결이 불가피한 기능을 단일 replica 전용 Pod로 분리해 Stateless 원칙을 지킨다
> (`02-messaging-adapter.md` §6.3, NFR-02).

**제약**
- `replicas: 1` **고정**. 스케일 아웃 금지
- Portal과 **코드·타입을 공유하지 않는다** — 원본 `event_callback` 봉투를 가공 없이 전달하므로 공유 타입 불필요

**송신/수신 비대칭 (NFR-25)**
```
송신:  Portal -> MessagingPort(인터페이스) -> SlackAdapter -> Slack Web API
수신:  Slack -> Socket Mode -> SlackGateway -> POST /slack/events -> Portal
```
> 송신은 인터페이스로, 수신은 HTTP 단일 진입점으로 추상화 → 양방향 모두 플랫폼 교체 가능

---

## SVC-5 · n8n

**책임**: 단계별 실행 오케스트레이션

**배치**: C-3.9 `WorkflowOrchestration` (Workflow A·B·C)
**착수 시점**: **n8n 배포 이후** (D-18) — U3 부하를 시간축에서 분산

**권한 경계 (최우선 규약)**
> **단계 진행 권한은 n8n에만 있다.** Pod는 stage를 모르고, Portal은 CAS 전이를 수행할 뿐
> 다음 단계를 스스로 발화하지 않는다.

**판정 방식**
- n8n은 Pod의 `/run` 종료 출력 **텍스트만** 본다 (사용자 원문 미열람)
- 확정 신호는 정확한 마커 문자열: `===MOCKUP_CONFIRMED===`
- Stage 4는 `dev`→`qa`→`code_review`→`security_review` **4개 독립 `/run`**

**stage 번호 규약 (D-05, R-04)**
> 참고자산의 `Advance to 5`·`Stage 7`은 **구 체계**다. 신규 작성 시
> `1`·`2`·`3`·`4`·`9_COMPLETE`만 사용한다.

---

## 서비스 간 오케스트레이션

### 정상 흐름 (feature 프로파일)

```
[1] 요청자 -> Portal /register -> RequestIntake.intake()
                                        |
                                        +-> SdlcRequestFactory (정책 각인)
                                        +-> PodOrchestrator.provision()
                                        +-> n8n webhook (sdlc-intake)
[2] n8n WF-A -> Pod /clone -> Portal Issue 생성 -> Portal /advance (Stage 2)
                                                        |
                                    StageEntryActions.onEnterRequirements()
                                          -> MessagingPort.ensureChannel(requirements)
[3] n8n WF-A -> Pod /run (요구사항 인터뷰)
[4] Pod -> n8n WF-B (run.completed)
[5] Slack <-> 사용자 피드백 -> SlackGateway -> Portal /slack/events -> n8n 재발화
[6] 목업 확정(===MOCKUP_CONFIRMED===) -> Portal /advance (Stage 3) -> design 채널
[7] 설계 인터뷰 -> Stage 4 -> dev 채널
[8] Stage 4: dev -> qa -> code_review -> security_review (각각 독립 /run)
[9] Portal /advance (Stage 9) -> onEnterComplete()
       -> GitHubPort.ensurePullRequest()
       -> metadata.autoMergeAllowed 읽기 -> true면 merge
       -> dev 스냅샷 + 완료 요약 게시 + Pod 종료
```

### 프로파일별 차이

| 항목 | `feature` | `incident` | `improvement` |
|------|----------|-----------|--------------|
| 진입 | SR 등록 UI | `/incidents/ingest` 승격 | CronJob 스캔 |
| 채널 | 3개 | `dev` 1개 | `dev` 1개 |
| 요구사항·설계 단계 | 수행 | 건너뜀 | 건너뜀 |
| 자동 머지 | repo 설정 | **금지 (강제)** | repo 설정 |
| repo 쓰기 | 있음 | 있음 | **읽기 전용** |

> **차이는 전부 `SdlcRequestFactory`가 각인한 정책에서 나온다** (AD-3).
> 상태머신·채널 어댑터는 각인된 값을 읽을 뿐 프로파일을 재판정하지 않는다.

### 실패 흐름

```
임의 단계 실패 -> CompensationHandler.compensate()
                    +-> 단계별 보상 실행
                    +-> 채널에 실패 결과 게시 (아카이브 안 함)   <- NFR-08
                    +-> GitHub Issue에 실패 코멘트
                    +-> 운영자 개입 지점 기록
                    +-> X_FAILED 전환
```

### 배치 흐름 (CronJob)

```
portal-sdlc-reconcile      -> Portal /api/internal/sdlc/reconcile
                              -> K8s 실제 상태 vs DB 상태 대조 -> 정합성 회복
portal-sdlc-improve-scan   -> Portal /api/internal/sdlc/improvement-scan
                              -> ImprovementScanTrigger.startScan()
```
> 둘 다 `requireMasterKey` 통과 필요. CronJob 정의는 U1, 수신 로직은 U5 (경계)
