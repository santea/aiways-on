# SDLC 데이터 흐름 — 엔드투엔드 시퀀스

> AIways On의 데이터 흐름은 **Slack 채널**을 기준으로 설계하며 Stage `5`·`6`·`7`·`8`은 미사용 예약 구간이다.
> Intake → 요구사항 → 설계 → 개발 → 완료 처리 전체 흐름과 보상 트랜잭션을 다룬다.

## 1. 엔드투엔드 워크플로우 개요

```mermaid
flowchart LR
    U[사용자] -->|SR 등록| P[Portal]
    P -->|intake webhook| N8N[n8n]
    N8N -->|/clone /run| POD[Pod Runner]
    POD -->|run.completed| N8N
    N8N -->|/advance /feedback| P
    P -->|Slack 채널| SLACK[Slack]
    SLACK -->|WebSocket| SG[Slack Gateway]
    SG -->|POST /slack/events| P
    P -->|n8n 재발화| N8N
    P -->|PR 생성·merge| GH[GitHub]
    POD -->|clone/push| GH
    P -->|Pod lifecycle| K8S[K8s]
```

## 2. Intake 단계 (요청 등록)

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자
    participant P as Portal
    participant DB as PostgreSQL
    participant S as Slack
    participant K8S as Kubernetes
    participant N8N as n8n WF-A
    participant GH as GitHub
    participant POD as SDLC Pod

    U->>P: SR 요청 제출 (폼)
    note over P: POST /api/v1/sdlc/intake<br/>세션 사용자 정보 주입

    P->>DB: sdlc_requests 삽입
    note over DB: dedupKey 기반 멱등성<br/>submitterId = session.user.id

    P->>S: Slack 채널 3개 생성
    note over S: sr-{no}-requirements<br/>sr-{no}-design<br/>sr-{no}-dev<br/>(private channel)

    P->>K8S: Pod 생성 (ensurePod)
    note over K8S: sdlc-{requestNo} 이름

    K8S-->>P: Pod endpoint

    P->>DB: sdlc_pod_sessions 저장
    P->>DB: sdlc_messaging_channels 저장

    P->>N8N: Webhook 발송 (intake)
    note over N8N: POST /webhook/sdlc-intake

    N8N->>POD: POST /clone (repo clone)
    note over POD: workspace 생성 +<br/>CLAUDE.md 생성

    POD-->>N8N: cloned_repos

    N8N->>P: POST /requests/{id}/issues
    note over P: GitHub issue 생성 위임<br/>repos: [{repo, branch}]<br/>work_branch DB 저장
    P->>GH: ensureIssueCreated (PAT)
    GH-->>P: issue numbers
    P-->>N8N: issues 배열

    N8N->>P: POST /audit (clone 완료)

    N8N->>P: POST /advance (1 → 2)
    note over P: CAS 전이<br/>요구사항 채널 멤버 초대

    P-->>U: 201 { status: "1_REGISTERED" }
    note over U: "파이프라인 시작"

    N8N->>POD: POST /run
    note over POD: requirement interview 시작
```

> SR 등록 → 채널 생성 → Pod 생성 → n8n webhook은 **단일 경로**다. 접수 시 별도 판정이나 대기 적재 없이 즉시 프로비저닝하므로 `POST /intake`는 `201 { requestNo, status: "1_REGISTERED" }`만 반환한다.
>
> 위 채널명은 **feature 프로파일 기준**이다. incident는 `inc-{no}-dev` 1개, improvement는 `imp-{no}-dev` 1개만 생성한다 ([02-messaging-adapter.md](./02-messaging-adapter.md) 참조).

## 3. 요구사항 정의 단계 (2_REQUIREMENTS_IN_PROGRESS)

```mermaid
sequenceDiagram
    autonumber
    participant POD as SDLC Pod
    participant N8N as n8n WF-B
    participant P as Portal
    participant S as Slack
    participant SG as Slack Gateway
    participant S3 as Object Storage
    participant GH as GitHub

    POD->>N8N: POST /sdlc-run-complete
    note over N8N: event: run.completed<br/>stage: 2_REQUIREMENTS_IN_PROGRESS

    N8N->>N8N: Switch by Stage
    note over N8N: requirement 분기

    N8N->>POD: POST /run
    note over POD: /sdlc:user-deep-interview<br/>requirement_interview.md 생성

    POD-->>N8N: run.completed (재귀)

    N8N->>N8N: requirement AI Agent
    note over N8N: end? 판정

    alt interview 계속
        N8N->>P: POST /feedback-request
        P->>S: 채널에 메시지 전송 (Slack)
        note over S: adapter.postMessage

        U->>S: 채널 메시지 입력 (피드백)
        S->>SG: WebSocket (Socket Mode)
        SG->>P: POST /slack/events (payload 원본)
        note over P: 인증 검증<br/>채널→SR 매핑<br/>feedback poll CAS (중복 차단)

        P->>N8N: feedback webhook 재발화
        N8N->>POD: POST /run (계속)
    else interview 완료 → UI 목업 서브루프
        loop 목업 확정까지 반복
            N8N->>POD: POST /run
            note over POD: sdlc:capture-mockup 실행<br/>is_ui repo dev server 대상<br/>before.png / after.png 캡처

            POD->>P: POST /channel-image (curl multipart)
            note over P: 이미지 x2

            P->>S3: 이미지 저장
            note over S3: object key 기록

            P->>DB: sdlc_request_images 저장
            note over P: objectKey + serving URL

            P->>S: 채널에 ![](proxyUrl) 게시
            note over S: 영구 프록시 URL<br/>GET /images/{id}?token=signed

            P->>DB: sdlc_request_channel_messages 스냅샷

            S->>U: Before/After 확인 요청 (Slack)
            U->>S: 채널 메시지 입력
            S->>SG: WebSocket (Socket Mode)
            SG->>P: POST /slack/events
            P->>N8N: feedback webhook 재발화

            N8N->>N8N: requirement AI Agent
            note over N8N: mockupConfirmed 판정

            alt mockupConfirmed = false ("다르게 그려줘")
                note over N8N,POD: 재캡처 루프
            else mockupConfirmed = true ("확정")
                note over N8N: 최종 요구사항정의서에<br/>UI 변경점 반영
            end
        end

        N8N->>POD: POST /run
        note over POD: rsccb-report 호출<br/>requirements.md 생성

        N8N->>POD: POST /run
        note over POD: .mvc/requirement/*.md 읽기<br/>Issue comment 작성

        POD->>GH: gh issue comment
        note over GH: 요구사항 명세서 댓글

        N8N->>POD: POST /notify-channel
        note over POD: Pod → Portal 중계
        POD->>P: POST /channel-notification
        note over P: route 내부에서<br/>Slack 메시지 + 메일 발송
        P->>S: 채널에 완료 알림 (Slack)
        P->>DB: sdlc_request_channel_messages 스냅샷

        N8N->>P: POST /advance (2 → 3)
        note over P: CAS 전이<br/>설계 채널 멤버 초대<br/>요구사항 채널 스냅샷

        N8N->>POD: POST /run
        note over POD: dev_design interview 시작
    end
```

## 4. 설계 단계 (3_DEV_DESIGN_IN_PROGRESS)

```mermaid
sequenceDiagram
    autonumber
    participant POD as SDLC Pod
    participant N8N as n8n WF-B
    participant P as Portal
    participant S as Slack
    participant GH as GitHub

    POD->>N8N: POST /sdlc-run-complete
    note over N8N: stage: 3_DEV_DESIGN_IN_PROGRESS

    N8N->>N8N: Switch by Stage (dev_design)

    N8N->>POD: POST /run
    note over POD: /oh-my-claudecode:deep-interview<br/>설계 인터뷰 수행

    POD-->>N8N: run.completed (재귀)

    N8N->>N8N: Dev Design AI Agent
    note over N8N: 설계 인터뷰 종료 판정

    alt interview 계속
        N8N->>POD: POST /run (계속)
        note over POD,N8N: Slack 피드백 루프<br/>(요구사항과 동일)
    else interview 완료
        N8N->>POD: POST /run
        note over POD: rsccb-report 호출<br/>design.md 생성

        N8N->>POD: POST /run
        note over POD: design.md 읽기<br/>Issue comment 작성

        POD->>GH: gh issue comment
        note over GH: 설계 보고서 댓글

        N8N->>POD: POST /notify-channel
        POD->>P: POST /channel-notification
        note over P: Slack 메시지 + 메일 발송
        P->>S: 채널에 완료 알림 + 이메일
        P->>DB: 설계 채널 스냅샷 저장

        N8N->>P: POST /advance (3 → 4)
        note over P: CAS 전이<br/>DEV 채널 멤버 초대<br/>설계 채널 스냅샷

        N8N->>POD: POST /run
        note over POD: /autopilot 개발 시작
    end
```

## 5. 개발 단계 (4_DEV_IN_PROGRESS)

```mermaid
sequenceDiagram
    autonumber
    participant POD as SDLC Pod
    participant N8N as n8n WF-B
    participant P as Portal
    participant GH as GitHub

    POD->>N8N: POST /sdlc-run-complete
    note over N8N: stage: 4_DEV_IN_PROGRESS

    N8N->>N8N: Switch by Stage (dev)

    note over N8N,POD: 개발은 autopilot이<br/>모든 작업 수행<br/>(구현·테스트·commit·push)

    POD-->>N8N: run.completed

    N8N->>POD: POST /run
    note over POD: Issue comment 작성<br/>(개발 완료 요약)

    POD->>GH: gh issue comment

    N8N->>P: POST /advance (4 → 9)
    note over P: CAS 전이<br/>PR 생성·merge + DEV 채널 스냅샷

    P->>DB: autoPrMerge 조회
    note over DB: sdlc_github_repos.autoPrMerge

    P-->>N8N: autoPrMerge 응답
```

> **n8n은 `autoPrMerge`를 분기 조건으로 쓰지 않는다.** `Auto Merge?` 분기가 Portal 진입 작업으로 흡수됐으므로([07-n8n-workflows.md](./07-n8n-workflows.md) 3.13절) 응답의 이 필드는 관측·디버깅 목적으로만 전달된다. 실제 머지 판단은 `9_COMPLETE` 진입 시 Portal이 단독 수행한다 ([03-state-machine.md](./03-state-machine.md) 4.4절 참조).

## 6. 완료 처리 단계 (4 → 9_COMPLETE)

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자
    participant POD as SDLC Pod
    participant N8N as n8n WF-B
    participant P as Portal
    participant DB as PostgreSQL
    participant S as Slack
    participant GH as GitHub
    participant K8S as Kubernetes

    N8N->>POD: POST /run
    note over POD: Final Report 생성<br/>(development.md + rsccb.md)

    POD->>GH: gh issue comment (개발 보고서)
    POD->>GH: gh issue comment (RSCCB 보고서)

    N8N->>P: POST /advance (4 → 9)
    note over P: 9_COMPLETE 진입 시<br/>runStageEntryActions →<br/>_ensurePullRequestForRequest

    loop 각 repo
        P->>GH: hasCommitsAhead (compare API)
        alt commit 없음
            P->>GH: issue close + branch 삭제
            note over GH: PR 생성 안 함<br/>결과: "변경 없음 — PR 미생성"
        else commit 있음
            P->>GH: git push → ensurePullRequest<br/>(head=workBranch, base=defaultBranch)
            alt autoPrMerge = true 그리고 profile ≠ incident
                P->>GH: squash merge + branch 삭제
                note over GH: 결과: "자동 머지 완료"
            else autoPrMerge = false
                note over GH: PR만 생성<br/>결과: "수동 머지 필요"
            else profile = incident
                note over GH: ❌ 자동 머지 금지<br/>결과: "수동 머지 필요(장애 대응 정책)"
            end
        end
    end

    P->>DB: 9_COMPLETE CAS 전이 + DEV 채널 스냅샷

    P->>S: dev 채널에 결과 요약 게시
    note over S: repo별 PR URL + 머지 상태 집계<br/>수동 머지 필요 1건 이상이면<br/>헤더에 담당자 액션 요구 문구

    P->>K8S: Pod terminate
    note over K8S: /admin/terminate 또는 Pod 직접 삭제 (K8s delete)
    P->>DB: feedback polls 비활성화

    P-->>U: 완료 알림
```

> Stage `5`·`6`·`7`·`8`은 미사용 예약 구간이므로 **`4 → 9_COMPLETE` 직접 전이**다. `9_COMPLETE`가 유일한 성공 terminal이며, 역방향 전이는 **0개**다. 진입 작업 정본은 [03-state-machine.md](./03-state-machine.md) 참조.
>
> 재개발이 필요한 경우 역전이 대신 **신규 SR 등록**으로 처리한다.

## 7. 보상 트랜잭션 (실패 처리)

```mermaid
sequenceDiagram
    autonumber
    participant ERR as 오류 감지
    participant P as Portal
    participant DB as PostgreSQL
    participant K8S as Kubernetes
    participant S as Slack
    participant GH as GitHub

    ERR->>P: 실패 감지
    note over P: compensateFailedSdlc 호출

    P->>DB: CAS → X_FAILED
    note over DB: idempotencyKey:<br/>compensate:{requestNo}

    P->>DB: sdlc_pod_sessions lookup

    alt Pod 존재
        P->>K8S: ensureDeletePod
        note over K8S: Pod 직접 삭제 (404 ok)
    end

    P->>P: 모든 채널 메시지 스냅샷
    note over P: adapter.listMessages<br/>최대 1000개 저장

    loop 각 채널
        P->>S: 실패 결과 메시지 게시
        note over S: adapter.postMessage<br/>실패 단계(currentStage)·실패 원인 요약<br/>삭제된 Pod 이름·Issue/PR 링크<br/>운영자 개입 안내
        note over S: dedup 마커<br/>&lt;!-- SDLC-FAILED:{requestNo} --&gt;<br/>Reconcile 재시도 시 중복 게시 방지
    end

    P->>DB: sdlc_github_issues lookup

    alt Issue 존재
        P->>GH: ensureIssueComment
        note over GH: FAILED 코멘트<br/>(close 하지 않음)
    end

    note over P: 보상 트랜잭션 완료<br/>운영자 개입 대기
```

> 각 보상 단계는 실패해도(non-fatal) 계속 진행한다. 보상 트랜잭션의 핵심 원칙.
>
> **채널은 아카이브하지 않고 살려 둔다** — 담당자가 실패 원인을 확인하고 후속 논의를 이어갈 창구가 필요하기 때문이다. 게시 내용 명세는 [03-state-machine.md](./03-state-machine.md) 참조.

## 8. DevSubStage 흐름 (4_DEV_IN_PROGRESS 내부)

`4_DEV_IN_PROGRESS` 단계는 4개 서브스테이지로 세분화되어 순차 실행된다.

```mermaid
sequenceDiagram
    autonumber
    participant N8N as n8n WF-B
    participant P as Portal
    participant POD as SDLC Pod
    participant GH as GitHub

    note over N8N: Switch by Stage1<br/>stage 4 분기

    N8N->>P: GET /requests/{id}/dev-substage
    note over P: metadata.devSubStage.current 조회

    N8N->>P: POST /requests/{id}/dev-substage<br/>{substage: "dev", action: "start"}
    N8N->>POD: POST /run (/autopilot)
    note over POD: 개발 (구현·테스트·commit·push)
    POD-->>N8N: run.completed
    N8N->>P: POST /dev-substage<br/>{substage: "dev", action: "complete"}

    N8N->>P: POST /dev-substage<br/>{substage: "qa", action: "start"}
    N8N->>POD: POST /run (qa-agent Task)
    note over POD: Playwright QA 검수<br/>(playwright_enabled repo만)
    POD-->>N8N: run.completed
    N8N->>P: POST /dev-substage<br/>{substage: "qa", action: "complete"}

    N8N->>P: POST /dev-substage<br/>{substage: "code_review", action: "start"}
    N8N->>POD: POST /run (코드 리뷰)
    POD-->>N8N: run.completed
    N8N->>P: POST /dev-substage<br/>{substage: "code_review", action: "complete"}

    N8N->>P: POST /dev-substage<br/>{substage: "security_review", action: "start"}
    N8N->>POD: POST /run (보안 리뷰)
    POD-->>N8N: run.completed
    N8N->>P: POST /dev-substage<br/>{substage: "security_review", action: "complete"}

    N8N->>POD: POST /run (Issue Comment Dev)
    POD->>GH: gh issue comment (개발 완료 요약)

    N8N->>P: POST /advance (4 → 9)
    note over P: CAS 전이<br/>PR 생성·merge + DEV 채널 스냅샷<br/>+ dev 채널 결과 요약 게시 (6절)
```

> **설계 결정**: resume 시퀀스는 미도입. 대신 devSubStage 4단계 순차 실행 흐름으로 구성.

---

### 8.1 Conda 환경 캐시 흐름 (Intake 시)

```mermaid
sequenceDiagram
    autonumber
    participant N8N as n8n WF-A
    participant POD as SDLC Pod
    participant P as Portal
    participant S3 as Object Storage

    note over N8N: clone 완료 후

    N8N->>POD: POST /conda/ensure-env
    note over POD: cache_key 계산<br/>(repo HEAD 기반)
    POD->>P: GET /requests/{id}/conda-cache?cacheKey=...
    P->>S3: 캐시 tarball 조회

    alt 캐시 hit
        S3-->>P: presigned GET URL
        P-->>POD: {found: true, download_url: ...}
        POD->>S3: tarball 다운로드
        note over POD: conda-pack 언팩<br/>integrity gate 검증
        note over POD: env_ready=true
    else 캐시 miss
        P-->>POD: {found: false}
        note over POD: env_ready=false
        N8N->>POD: POST /run (Setup Conda)
        note over POD: vibe-coding-setup 실행<br/>conda env 생성
        N8N->>POD: POST /conda/pack-and-upload
        note over POD: conda-pack tarball 생성
        POD->>P: POST /conda-cache/upload-url
        P-->>POD: presigned PUT URL
        POD->>S3: tarball 업로드
        POD->>P: POST /conda-cache/complete
        note over P: sdlc_conda_cache_versions 등록
    end
```

> Conda 캐시는 Pod 시작 시간 단축용 (선택). 캐시 miss여도 SR 실행에는 영향 없음.

## 9. 채널 스냅샷 타이밍

```mermaid
gantt
    title 채널 스냅샷 저장 타이밍 (Slack)
    dateFormat  YYYY-MM-DD
    axisFormat  %m/%d

    section Stage 진행
    1_REGISTERED           :done, reg, 2026-09-01, 1d
    2_REQUIREMENTS         :done, req, after reg, 2d
    3_DEV_DESIGN           :done, des, after req, 2d
    4_DEV                  :done, dev, after des, 3d
    9_COMPLETE             :done, cmp, after dev, 1d

    section 스냅샷 저장
    Snap requirements      :crit, after reg, 1d
    Snap design            :crit, after req, 1d
    Snap dev               :crit, after des, 1d

    note right of Snap requirements: 3_DEV_DESIGN 진입 시<br/>requirements 채널 스냅샷
    note right of Snap design: 4_DEV_IN_PROGRESS 진입 시<br/>design 채널 스냅샷
    note right of Snap dev: 9_COMPLETE 진입 시<br/>dev 채널 스냅샷
```

> 스냅샷은 `adapter.listMessages(channelId, 1000)`로 Slack `conversations.history`를 조회해 DB에 저장. 채널은 실패 시에도 아카이브되지 않으므로 스냅샷과 채널 이력이 함께 남는다.

## 10. 데이터 저장소 매핑

### Portal (PostgreSQL)

| 테이블 | 저장 데이터 |
|--------|------------|
| `sdlc_requests` | SDLC 요청 기본 정보 |
| `sdlc_stage_transitions` | 단계 전이 이력 |
| `sdlc_stage_resume_attempts` | Pod resume 예산 |
| `sdlc_messaging_channels` | Slack 채널 매핑 |
| `sdlc_request_channel_messages` | 채널 메시지 스냅샷 |
| `sdlc_request_images` | UI 목업 이미지 메타데이터 (S3 objectKey) |
| `sdlc_pod_sessions` | Pod 세션 정보 |
| `sdlc_github_issues` | GitHub Issue 정보 |
| `sdlc_github_pull_requests` | GitHub PR 정보 |
| `sdlc_github_orgs` | GitHub Org 설정 |
| `sdlc_github_repos` | GitHub Repo 설정 |
| `sdlc_github_credentials` | GitHub 인증 정보 (참조) |
| `sdlc_feedback_polls` | 사용자 피드백 poll |
| `sdlc_request_reports` | 단계별 보고서 markdown |
| `secret_refs` | 암호화된 토큰/비밀번호 |
| `audit_events` | 감사 로그 |
| `users` / `accounts` | 인증 (GitHub OAuth) |
| `sdlc_incidents` | 장애 레코드 (`dedupKey` 멱등, `requestId`·`memoryRuleId` 역참조) |
| `sdlc_incident_templates` | 장애 템플릿 (Test 트리거 주입용) |
| `sdlc_incident_analyses` | 장애 분석 산출물 (가설·가이드·패치) |
| `sdlc_improvement_scans` | 자체개선 스캔 회차 |
| `sdlc_improvement_findings` | 발굴 항목 (`fingerprint` 지문, `recurrenceCount`) |
| `sdlc_memory_rules` | 규정 본체 (category 5종, `contentMd`) |
| `sdlc_memory_rule_revisions` | 규정 개정 이력 (불변) |
| `sdlc_memory_access_tokens` | MCP 접근 토큰 (sha256 해시 저장) |

> 신규 9개 테이블은 모두 동일 Portal PostgreSQL 스키마에 추가된다. 상세 정의는 [11-incident-response-agent.md](./11-incident-response-agent.md) 8절, [12-self-improvement-agent.md](./12-self-improvement-agent.md) 7절, [13-developer-memory-agent.md](./13-developer-memory-agent.md) 3절 참조.

### Developer Memory MCP 서버

| 컴포넌트 | 저장소 접근 | 비고 |
|----------|------------|------|
| `portal-sdlc-memory-mcp` (K8s Deployment) | 동일 PostgreSQL — **전용 role `sdlc_memory_mcp`** | 읽기는 DB 직접 조회, 쓰기는 Portal 내부 API 경유 |

> MCP 서버는 Portal과 별개 프로세스이지만 새로운 데이터 저장소를 도입하지 않는다. 같은 PostgreSQL을 `SDLC_MEMORY_DATABASE_URL`(전용 role) 연결로 읽으며, 권한은 `sdlc_memory_*` 테이블 `SELECT`로 한정된다. 쓰기 경로는 `/api/internal/sdlc/memory/*`를 통해 Portal이 단독으로 수행하므로 감사 로그·revision 기록이 우회되지 않는다 ([13-developer-memory-agent.md](./13-developer-memory-agent.md) 6.3절 참조).

### n8n (메모리/워크플로우 상태)

| 데이터 | 용도 |
|--------|------|
| Workflow State | AI 에이전트 실행 컨텍스트 |
| Claude Session ID | Claude Code 세션 resume |

### SDLC Pod (인메모리 세션)

| 데이터 | 용도 |
|--------|------|
| `SessionState` | 현재 세션 상태 |
| `clone_fingerprint` | repo clone 멱등성 |
| `claude_session_id` | Claude Code 세션 ID (PVC 영속) |
| `sdlc_context` | SDLC 컨텍스트 (request_no, channel_ids 등) |

### 외부 스토리지

| 저장소 | 용도 |
|--------|------|
| Slack | 단계별 채널 (요구사항/설계/DEV) + 사용자 피드백 |
| Object Storage (S3) | UI 목업 이미지 (Ceph RGW 또는 AWS S3) |
| GitHub | Repo, Issue, PR |
| Kubernetes | Pod lifecycle |

## 11. 장애 대응 흐름 (트리거 → incident → SR → Pod)

`pipelineProfile=incident` SR의 축약 흐름이다. Stage enum은 불변이며 `1_REGISTERED → 4_DEV_IN_PROGRESS` 조건부 전이로 요구사항·설계 단계를 건너뛴다. 축약 경로는 **`1 → 4 → 9`**다.

```mermaid
sequenceDiagram
    autonumber
    participant MON as 모니터링
    participant P as Portal
    participant DB as PostgreSQL
    participant S as Slack
    participant K8S as Kubernetes
    participant N8N as n8n WF-B
    participant POD as SDLC Pod
    participant MEM as Memory MCP
    participant GH as GitHub

    MON->>P: POST /incidents/ingest
    note over P: Bearer SDLC_MASTER_KEY<br/>dedupKey 멱등 검사
    P->>DB: sdlc_incidents 삽입 (status=DETECTED)

    alt severity < AUTO_PROMOTE_MIN_SEVERITY
        P-->>MON: 201 { promoted: false }
        note over P: admin이 UI에서 수동 승격
    else auto-promote 대상
        P->>P: POST /intake (pipelineProfile=incident)
        P->>S: dev 채널 1개만 생성
        note over S: inc-{no}-dev<br/>requirements·design 미생성<br/>ChannelType 정의는 불변
        P->>K8S: Pod 생성 (sdlc-{requestNo})
        P->>DB: sdlc_incidents.requestId 저장 (status=SR_PROMOTED)
        P->>N8N: POST /webhook/sdlc-intake

        N8N->>POD: POST /clone
        N8N->>P: POST /advance (1_REGISTERED → 4_DEV_IN_PROGRESS)
        note over P: 조건부 전이<br/>pipelineProfile=incident 검증
        N8N->>POD: POST /run (sdlc:incident-response)

        POD->>MEM: memory_search_rules(incident_response)
        MEM-->>POD: 과거 장애·금지 규정
        POD->>P: POST /incidents/{id}/status (TRIAGING)
        loop 가설 배제 (3개 이상)
            POD->>P: POST /incidents/{id}/analysis (rejected_hypothesis)
        end
        POD->>P: POST /incidents/{id}/analysis (kind=guide)

        alt 코드 수정 있음
            POD->>GH: gh pr create
            note over GH: ❌ 자동 머지 금지
            POD->>P: status=PATCH_PROPOSED
        else 가이드 전용
            POD->>P: status=GUIDE_READY
        end

        N8N->>P: POST /advance (4 → 9_COMPLETE)
        note over P: 두 경로 공통 목적지<br/>PR 있으면 "수동 머지 필요(장애 대응 정책)"

        N8N->>P: POST /channel-notification (dev)
        P->>S: 대응 가이드 게시
        N8N->>GH: Issue Comment (근본 원인 + 배제 가설)
        P->>MEM: 종결 시 규정 등록 (incident_response)
    end
```

> 전체 상세 흐름(멱등 3중 게이트, 산출물 파일 경로)은 [11-incident-response-agent.md](./11-incident-response-agent.md) 참조.

## 12. 자체개선 스캔 흐름 (CronJob → SR → Pod → finding)

`pipelineProfile=improvement` SR의 축약 흐름이다. 축약 경로는 **`1 → 4 → 9`**다. 스케줄링은 K8s CronJob `portal-sdlc-improve-scan`(`17 3 * * *`)이 담당하며 n8n schedule trigger를 쓰지 않는다.

```mermaid
sequenceDiagram
    autonumber
    participant CRON as CronJob
    participant P as Portal
    participant DB as PostgreSQL
    participant S as Slack
    participant N8N as n8n WF-B
    participant POD as SDLC Pod
    participant MEM as Memory MCP
    participant GH as GitHub

    note over CRON: 매일 03:17 발화 (정각 회피)
    CRON->>P: POST /api/internal/sdlc/improvement-scan
    note over P: Bearer SDLC_MASTER_KEY
    P->>P: 대상 repo 선별 (interval + 진행 중 검사)
    P->>DB: sdlc_improvement_scans 삽입 (pending)
    P->>P: POST /intake (pipelineProfile=improvement)

    P->>S: dev 채널 1개 생성
    note over S: imp-{no}-dev
    P->>DB: sdlc_improvement_scans → promoting
    P->>N8N: n8n webhook (Workflow A)

    N8N->>P: POST /advance (1_REGISTERED → 4_DEV_IN_PROGRESS)
    N8N->>POD: POST /clone (target repo 1개)
    POD->>GH: git clone (PAT)
    N8N->>POD: POST /ensure-vibe-ready
    POD-->>N8N: { commitsSinceLastScan, daysSinceLastScan, docsGaps }
    N8N->>P: POST /improvements/{scanId}/status { running }
    N8N->>POD: POST /run (sdlc:repo-improvement, plan mode)

    POD->>MEM: memory_search_rules(behavior|prohibition)
    MEM-->>POD: 등록된 규정 목록
    loop 7개 category 스캔
        POD->>POD: fingerprint 산출 + filePaths 수집
    end
    POD->>N8N: run.completed { finding_count }

    N8N->>P: POST /improvements/{scanId}/findings
    P->>DB: fingerprint upsert
    note over DB: inserted / merged (recurrenceCount++)<br/>/ cooldownSkipped (반려 90일)
    N8N->>P: POST /improvements/{scanId}/status { completed }
    N8N->>P: POST /channel-notification (dev 요약)
    P->>S: dev 채널 요약 메시지
    N8N->>P: POST /advance (4_DEV_IN_PROGRESS → 9_COMPLETE)

    note over P: 이후 사용자가 UI에서 finding 검토<br/>→ SR 승격 또는 Memory 규정 승격 또는 반려
```

> 전체 상세 흐름(finding 승격 매트릭스, `recurrenceCount` 임계 도달 시 `failure_case` 자동 승격)은 [12-self-improvement-agent.md](./12-self-improvement-agent.md) 참조.

## 13. Developer Memory 조회·갱신 흐름 (로컬 Claude Code / Pod agent)

규정 조회는 MCP 서버가 PostgreSQL을 전용 role로 직접 읽고, 갱신은 반드시 Portal 내부 API를 경유한다. 소비자는 사내 개발자 로컬 Claude Code와 SDLC Pod agent 2종이다.

```mermaid
sequenceDiagram
    autonumber
    participant DEV as 로컬 Claude Code
    participant POD as SDLC Pod
    participant MCP as Memory MCP
    participant DB as PostgreSQL
    participant P as Portal
    participant U as 사용자 (UI)

    alt 로컬 개발자 조회
        DEV->>MCP: memory_search_rules (Streamable HTTP)
        note over MCP: Authorization: Bearer sdlcmem_*<br/>sha256 해시 → sdlc_memory_access_tokens
        MCP->>DB: SELECT sdlc_memory_rules (전용 role)
        DB-->>MCP: 규정 목록 (max SEARCH_MAX_RESULTS)
        MCP-->>DEV: 규정 본문 + 메타
        MCP->>DB: hitCount 증가
    else Pod agent 조회
        P->>P: POST /api/internal/sdlc/memory/tokens/issue-scoped
        note over P: per-SR scoped 토큰<br/>TTL = AGENT_TOKEN_TTL_MINUTES
        P->>POD: POST /run (mcp_servers.sdlc-memory 주입)
        POD->>MCP: memory_search_rules(category)
        MCP->>DB: SELECT (전용 role)
        MCP-->>POD: 규정 목록
    end

    alt 규정 갱신 (agent 경로)
        POD->>MCP: memory_append_failure_case
        MCP->>P: POST /api/internal/sdlc/memory/rules
        note over MCP: Bearer SDLC_MASTER_KEY<br/>세션 쿠키 없는 서버 간 호출
        P->>DB: sdlc_memory_rules upsert (expectedVersion CAS)
        P->>DB: sdlc_memory_rule_revisions 삽입 (불변)
        P->>DB: audit_events 기록
        P-->>MCP: { ok, version }
    else 규정 갱신 (UI 경로)
        U->>P: createMemoryRule / updateMemoryRule (서버 액션)
        note over P: 등록·수정은 user 가능<br/>archive는 admin 전용
        P->>DB: CAS upsert + revision + audit
    end
```

> **쓰기 단일 경로**: MCP 서버의 DB 전용 role은 `SELECT` 권한만 가진다. 모든 쓰기는 Portal이 수행하므로 `expectedVersion` CAS·revision 불변 이력·감사 로그가 경로에 관계없이 항상 기록된다. 전체 상세 흐름은 [13-developer-memory-agent.md](./13-developer-memory-agent.md) 11절 흐름도 참조.

## 14. 설계 결정 요약 (데이터 흐름)

| 흐름 | 설계 결정 | 비고 |
|------|----------|------|
| 채널 생성 | Slack `adapter.ensureChannel(opts)` | MessageChannelAdapter 추상화, `srPrefix`+`type`으로 이름 산출 |
| 채널 네이밍 | feature=`sr-{no}-{type}`, incident=`inc-{no}-dev`, improvement=`imp-{no}-dev` | `ChannelType` enum 불변 |
| 멤버 초대 | Slack `adapter.inviteMembers` | 이메일 → Slack user ID 변환 |
| 사용자 피드백 | Slack → Gateway Pod → Portal `/slack/events` | Gateway가 Socket Mode 전담(Bearer 릴레이). `events-api` 모드 전환 시 signing secret |
| 피드백 중복 차단 | `sdlc_feedback_polls.lastMessageId` CAS | Slack `ts` 단조 증가 이용, 별도 테이블 없음 |
| 메시지 스냅샷 | Slack `adapter.listMessages` (`conversations.history`) | 최대 1000개 DB 저장 |
| `4 → 9` 전이 | `4 → 9_COMPLETE` 직접 전이 | Stage `5`~`8` 미사용 예약, 역전이 0개 |
| 서버간 인증 | `SDLC_MASTER_KEY` 단일 키 | per-SR 콜백 토큰 발급 폐지 |
| 보상 트랜잭션 | Slack 채널에 실패 결과 게시 (아카이브 안 함) | 단계별 non-fatal 보상 |
| 인증 | GitHub OAuth `submitterId` FK | 세션 사용자 정보 자동 주입 |
| **Pod 사망 복구** | **미도입** (Pod 사망 시 reconcile → `X_FAILED` 보상만) | 자동 resume 없음 |
| **개발 서브스테이지** | **4단계 순차 실행** (dev→qa→cr→sr) | 진행 표시용 metadata |
| **Conda 캐시** | **HEAD 기반 캐시 키 + S3 tarball + integrity gate** | Pod 시작 시간 단축 |
