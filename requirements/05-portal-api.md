# Portal API 명세 — `/api/v1/sdlc/*`

> AIways On의 SDLC API는 Slack 채널 연동과 GitHub 인증을 기반으로 설계한다.
> Stage `5`·`6`·`7`·`8`은 향후 배포/검증 단계 재도입용으로 번호만 예약하며 미사용이다. 성공 terminal 단계는 `9_COMPLETE`뿐이다.

## 1. 개요

### 기본 정보

- **Base URL**: `https://aiways-on.example.com/api/v1/sdlc`
- **인증**: 엔드포인트별 상이 (Bearer token / 세션)
- **Content-Type**: `application/json`

### HTTP 동사 규약

본 API에는 `PUT`/`PATCH`/`DELETE`가 존재하지 않는다. 모든 쓰기는 `POST` 기반 RPC 스타일 경로로 표현한다.

| 의도 | 경로 형태 | 비고 |
|------|-----------|------|
| 생성 | `POST /{resource}` | |
| 갱신 | `POST /{resource}/{id}/update` | `PUT`/`PATCH` 대체 |
| 논리 삭제 | `POST /{resource}/{id}/archive` | `status`를 `archived`로 전환. 물리 삭제는 **제공하지 않는다** |

API는 `POST /requests/{id}/confirm-requirements`처럼 동사를 경로 말미에 붙이는 형태를 기본 관례로 사용하며 이를 확장한다. 이 규약을 명시적으로 처음 적용하는 엔드포인트는 다음 3개다.

- `POST /repos/{repoId}/update` — repo 스캔 설정 갱신 ([12-self-improvement-agent.md](./12-self-improvement-agent.md) 8.3절)
- `POST /memory/rules/{ruleId}/update` — 규정 본문 갱신 ([13-developer-memory-agent.md](./13-developer-memory-agent.md) 5.3절)
- `POST /incident-templates/{templateId}/archive` — 장애 템플릿 논리 삭제 ([11-incident-response-agent.md](./11-incident-response-agent.md) 9.3절)

### 인증 토큰 종류

| 토큰 | 용도 | 저장 위치 |
|------|------|----------|
| `SDLC_MASTER_KEY` | 서버 간 호출 공통 인증 — `/intake`, `/advance`, `/audit` 등 콜백 전체(n8n/Pod), `/incidents/ingest`(외부 모니터링), `/api/internal/sdlc/improvement-scan`(CronJob), `/api/internal/sdlc/memory/rules`(MCP 서버 → Portal) | 환경 변수 (Secret `sdlc-secrets` 키 `master-key`) |
| `SDLC_CALLBACK_BEARER` | `/channel-notification` 인증 | 환경 변수 |
| 세션 쿠키 | UI 버튼 액션 (요구사항 확정 등) | Auth.js JWT |
| 이미지 signed token | `/images/{imageId}` 서빙 (HMAC-SHA256) | 요청 시 서명 발급 |
| `SDLC_IMAGE_SIGNING_SECRET` | 이미지 signed token 서명 | 환경 변수 |
| `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` | `/api/internal/sdlc/memory/tokens/issue-scoped` **전용** 인증 (Portal orchestrator → Portal). MCP 서버 Deployment에는 주입하지 않는다 | 환경 변수 (`sdlc-secrets` 키 `memory-token-issuer-token`) |
| `sdlcmem_*` MCP 접근 토큰 | MCP 서버 인증 (사내 개발자·Pod agent). **Portal API가 아니라 MCP 서버(:58002)에 제시** | `sdlc_memory_access_tokens.tokenHash` + `secret_refs` |

## 2. API 엔드포인트

### 2.1 Intake (요청 등록)

**`POST /intake`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n Workflow A에서 SR 등록. 등록 직후 채널·Pod 프로비저닝까지 단일 경로로 수행한다.

**요청 본문**:

```json
{
  "requestNo": "SR-20260901-001",
  "submitter": "홍길동",
  "submitterEmail": "hong@example.com",
  "submitterGithubLogin": "hong-gildong",
  "requestSite": "aiways-on.example.com",
  "devType": "feature",
  "requestSystem": "AIways On",
  "module": "대시보드 > 분석",
  "dedupKey": "SR-20260901-001-unique-key",
  "metadata": {
    "requestDate": "2026-09-01",
    "dueDate": "2026-09-15",
    "submitterDepartment": "개발팀",
    "piManager": "김피오",
    "problemDescription": "현재 대시보드에서...",
    "expectedEffect": "사용자 편의성 향상...",
    "testScenario": "1. 대시보드 접속\n2. 분석 버튼 클릭...",
    "members": ["user1@example.com", "user2@example.com"]
  }
}
```

**응답 (성공)**:

```json
{ "requestNo": "SR-20260901-001", "status": "1_REGISTERED" }
```
HTTP 201 Created

**응답 (오류)**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 필수 필드 누락 |
| 401 | `UNAUTHORIZED` | Bearer token 불일치 |
| 500 | `INTERNAL_ERROR` | Intake 실패 |

**수행 작업**:

1. `sdlc_requests` 등록 (`dedupKey` 멱등성, `ON CONFLICT DO NOTHING`)
2. Slack 채널 생성 (프로파일별 개수·네이밍은 [02-messaging-adapter.md](./02-messaging-adapter.md) 5.2절 참조)
3. K8s Pod 생성 + Pod health check
4. n8n webhook 발화

---

### 2.2 Advance (단계 전이)

**`POST /advance`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n Workflow B에서 CAS 기반 단계 전이. 합법 전이는 `1→2`(feature), `1→4`(incident·improvement 조건부), `2→3`, `3→4`, `4→9`(전 프로파일 공통), `* → X_STOPPED`/`X_FAILED`이며 역방향 전이는 존재하지 않는다.

**요청 본문**:

```json
{
  "requestNo": "SR-20260901-001",
  "from": "4_DEV_IN_PROGRESS",
  "to": "9_COMPLETE",
  "actor": "n8n-agent-fb",
  "idempotencyKey": "SR-20260901-001->9_COMPLETE"
}
```

**응답 (성공)**:

```json
{
  "requestId": "...",
  "requestNo": "SR-20260901-001",
  "from": "4_DEV_IN_PROGRESS",
  "to": "9_COMPLETE",
  "idempotent": false,
  "autoPrMerge": true
}
```

**응답 (멱등 - 이미 목표 상태)**:

```json
{ "requestId": "...", "requestNo": "SR-20260901-001",
  "from": "4_DEV_IN_PROGRESS", "to": "9_COMPLETE", "idempotent": true }
```

**응답 (오류)**:

| HTTP | code | 설명 |
|------|------|------|
| 409 | `STALE_FROM` | CAS 실패 — 현재 상태가 예상과 다름 |
| 422 | `INVALID_TRANSITION` | LEGAL_TRANSITIONS에 없는 전이 |
| 404 | `NOT_FOUND` | 요청 미존재 |

**수행 작업**:

1. CAS 상태 업데이트 (`from` 일치 시만 `to`로 변경)
2. `sdlc_stage_transitions` 기록 (`idempotencyKey` 멱등성)
3. `audit_events` 감사 로그 기록
4. 단계 진입 작업 실행 (`runStageEntryActions` — 채널 초대, 스냅샷 등)

> `4 → 9_COMPLETE` 진입 작업에서는 Portal이 repo별로 git push → PR 생성을 수행하고, `autoPrMerge=true`이면 squash merge + branch 삭제까지 진행한 뒤 dev 채널에 repo별 PR URL·머지 상태 요약을 게시한다. 상세 정본은 [03-state-machine.md](./03-state-machine.md) 4.4절.

---

### 2.3 Audit (감사 로그)

**`POST /requests/{requestId}/audit`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n Workflow C에서 Pod 이벤트 감사 로그 기록.

**요청 본문**:

```json
{
  "action": "clone",
  "metadata": {
    "sessionId": "...",
    "repos": [
      { "url": "https://github.com/org/portal", "branch": "dev",
        "destDir": "/workspaces/session/portal", "commitSha": "abc123" }
    ],
    "issues": [{ "org": "org", "repo": "portal", "number": 123 }],
    "ts": "2026-09-01T10:00:00.000Z"
  }
}
```

**응답**: HTTP 200 OK

**액션 타입**: `clone`, `pod.clone`, `pod.run`, `pod.git-push`, `pod.session-close`

---

### 2.4 GitHub Issues 생성 (n8n 위임)

**`POST /requests/{requestId}/issues`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n이 GitHub Issue 생성을 Portal에 위임. Portal이 GitHub PAT으로 `ensureIssueCreated`(idempotent) 호출 후 `sdlc_github_issues`에 저장. **repo별 work branch(head)** 를 함께 전달해 `work_branch` 컬럼에 저장 — `4 → 9_COMPLETE` PR 생성 시 재계산 위험 제거.

**요청 본문**:

```json
{
  "repos": [
    { "repo": "org/portal", "branch": "sdlc/SR-20260901-001-test-feature" }
  ],
  "title": "[SDLC] SR-20260901-001 테스트 기능 추가",
  "body": "SR-20260901-001 SDLC 작업"
}
```

> `repos` 원소가 문자열이면 branch 없이 종전 동작. 객체형 `{ repo, branch }`만 `work_branch`에 저장.

**응답 (성공)**:

```json
{
  "ok": true, "requestId": "...", "requestNo": "SR-20260901-001",
  "issues": [
    { "repo": "org/portal", "number": 123,
      "html_url": "https://github.com/org/portal/issues/123",
      "branch": "sdlc/SR-20260901-001-test-feature" }
  ]
}
```

**응답 (오류)**: HTTP 500 — GitHub API 실패 시 즉시 중단

```json
{ "error": "GITHUB_ISSUE_CREATION_FAILED", "repo": "org/portal", "details": "..." }
```

---

### 2.5 DevSubStage (개발 서브스테이지 갱신)

**`POST /requests/{requestId}/dev-substage`** — 인증: `Bearer {SDLC_MASTER_KEY}`

`4_DEV_IN_PROGRESS` 단계에서 n8n이 각 서브스테이지(`dev` → `qa` → `code_review` → `security_review`) 시작/완료 시 호출. `metadata.devSubStage.current` 갱신 + audit 로그.

**요청 본문**:

```json
{ "substage": "qa", "action": "start" }
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `substage` | ✅ | `dev` \| `qa` \| `code_review` \| `security_review` |
| `action` | ✅ | `start` \| `complete` |

**응답 (200)**:

```json
{ "ok": true, "requestId": "...", "current": "qa" }
```

**수행 작업**:

1. `SDLC_MASTER_KEY` 상수 시간 비교 검증
2. `metadata.devSubStage.current` 갱신
3. `action=complete` 시 `metadata.devSubStage.history` 배열에 완료 시각 기록
4. `audit_events` 기록 (`action: sdlc.dev_substage`)

**거부 케이스**: 401 (token 불일치), 404 (request 없음), 422 (잘못된 substage/action)

---

### 2.6 Confirm Requirements (요구사항 확정)

**`POST /requests/{requestId}/confirm-requirements`** — 인증: 세션 (로그인 사용자)

`2_REQUIREMENTS_IN_PROGRESS` 단계에서 UI "요구사항 확정" 버튼 클릭 시 호출. 요구사항 정의 확정 후 다음 단계 전이 트리거.

**요청 본문**: 없음

**응답 (200)**:

```json
{ "ok": true, "requestId": "...", "confirmed": true }
```

**수행 작업**:

1. `sdlc_requests.status === 2_REQUIREMENTS_IN_PROGRESS` 검증
2. n8n feedback webhook 재발화 (요구사항 확정 → n8n이 `end` 판정 후 `advance 2→3` 수행)

---

### 2.7 Feedback Request (피드백 재발화)

**`POST /requests/{requestId}/feedback-request`** — 인증: `Bearer {SDLC_MASTER_KEY}`

사용자에게 피드백 요청 (n8n이 재귀 호출). Slack 채널에 메시지 게시 + feedback poll 등록.

**요청 본문**:

```json
{
  "channelType": "requirements",
  "message": "요구사항 인터뷰를 계속합니다...",
  "callbackUrl": "https://n8n.example.com/webhook/portal-feedback"
}
```

**응답**: HTTP 200 OK

**수행 작업**:

1. `sdlc_messaging_channels`에서 channelId 조회
2. `adapter.postMessage(channelId, {content: message})` — Slack 게시
3. `sdlc_feedback_polls` 등록 (active: true)

---

### 2.8 Stage Done Mail (단계 완료 알림)

**`POST /requests/{requestId}/stage-done-mail`** — 인증: `Bearer {SDLC_MASTER_KEY}`

단계 완료 시 이메일 알림.

**요청 본문** (개발 단계):

```json
{
  "stage": "4_DEV_IN_PROGRESS",
  "summary": {
    "bullet1": "기능 A 구현 완료",
    "bullet2": "기능 B 구현 완료",
    "bullet3": "단위 테스트 작성 완료"
  }
}
```

**응답**: HTTP 200 OK

> Slack 채널 게시와 별도로 메일 발송 (Portal이 직접 SMTP/메일 서비스 호출).

---

### 2.9 채널 알림

**`POST /channel-notification`** — 인증: `Bearer {SDLC_CALLBACK_BEARER}`

Pod/n8n으로부터 채널 알림 수신. 실제 Slack 메시지 전송·메일 발송은 Portal route 내부에서 처리.

**요청 본문**:

```json
{
  "channelType": "requirements",
  "message": "## ✅ 요구사항 분석 완료\n\n핵심 요구사항 요약:\n- ...",
  "callbackUrl": "https://n8n.example.com/webhook/portal-feedback",
  "filePaths": ["/workspaces/session/.mvc/requirement/requirements.md"],
  "sendMail": true
}
```

**응답 (성공)**:

```json
{ "success": true, "message": "Channel notification processed" }
```

**수행 작업**:

1. `sdlc_messaging_channels`에서 channelId 조회
2. `adapter.postMessage(channelId, {content, filePaths, sendMail})`
3. `sdlc_request_channel_messages` 스냅샷 저장
4. `sendMail` true 시 메일 발송
5. 보고서 마크다운 전문 → `sdlc_request_reports` 저장

---

### 2.10 채널 이미지 업로드

**`POST /requests/{requestId}/channel-image`** — 인증: `Bearer {SDLC_MASTER_KEY}`

**Content-Type**: `multipart/form-data`

Pod(Claude)가 UI 목업(Before/After/Verify/Merged) PNG를 S3에 저장하고, 서명된 프록시 서빙 URL을 마크다운 이미지로 Slack 채널에 게시.

**요청 필드** (multipart/form-data):

| 필드 | 필수 | 설명 |
|------|------|------|
| `file` | ✅ | 이미지 파일 (PNG) |
| `kind` | ✅ | `before` \| `after` \| `verify` \| `merged` |
| `screenName` | | 화면 이름 |
| `channelType` | | Stage enum 또는 채널명. 기본값 `requirements` |
| `caption` | | 마크다운 이미지 캡션 |
| `callbackUrl` | | 콜백 URL |
| `sendMail` | | 메일 발송 여부 |

**응답 (성공)**:

```json
{
  "ok": true, "imageId": "...",
  "servingUrl": "https://aiways-on.example.com/api/v1/sdlc/images/{imageId}?token=...",
  "channelId": "...", "messageId": "..."
}
```

**응답 (오류)**:

| HTTP | error | 설명 |
|------|-------|------|
| 401 | `Unauthorized` | `SDLC_MASTER_KEY` 불일치 |
| 400 | `file is required` | file 누락 / kind 오류 |
| 404 | `Channel not found` | 요청 또는 채널 미존재 |
| 500 | `Failed to store image` | S3 업로드 또는 메시지 게시 실패 |

**수행 작업**:

1. Bearer `SDLC_MASTER_KEY` 상수 시간 비교 검증
2. 이미지를 S3에 업로드, `sdlc_request_images`에 `objectKey` 저장
3. 영구 프록시 서빙 URL 생성 (`/api/v1/sdlc/images/{imageId}?token=...`)
4. Slack 채널에 `![caption](url)` 마크다운 이미지 게시 (`adapter.postMessage`)
5. `sdlc_request_channel_messages` 메시지 스냅샷 저장

---

### 2.11 이미지 서빙 (프록시)

**`GET /images/{imageId}?token={signed}`** — 인증: 쿼리파라미터 signed token (HMAC-SHA256)

S3에 저장된 SDLC 이미지를 Portal 프록시로 스트림 서빙. presigned URL 노출 없이 내부 S3 GetObject로 프록시.

> Slack 도메인이 Portal과 달라 쿠키 인증이 불가능하므로 쿼리파라미터 signed token으로 보호. 미들웨어 인증 예외 대상.

**쿼리 파라미터**: `token` — `${exp}.${signature}` 형식 (필수)

**응답 (성공)**:

```
HTTP 200 OK
Content-Type: image/png
Cache-Control: private, max-age=31536000, immutable
(이미지 바이너리 스트림)
```

**응답 (오류)**:

| HTTP | error | 설명 |
|------|-------|------|
| 401 | `Unauthorized` | token 누락/서명 불일치/만료 |
| 404 | `Not found` | 이미지 미존재 또는 S3 조회 실패 |

**수행 작업**:

1. signed token 검증 (`SDLC_IMAGE_SIGNING_SECRET` 또는 `AUTH_SECRET` 기반 HMAC-SHA256, 만료 확인)
2. `sdlc_request_images`에서 `objectKey`/`mimeType` 조회
3. S3 GetObject 스트림을 그대로 프록시 반환

---

### 2.12 Slack Events 수신

**`POST /slack/events`** — 인증: `SLACK_INBOUND_MODE`에 따라 분기 (아래 표)

Slack 채널의 사용자 메시지를 n8n으로 재전달. **Portal은 어느 모드에서도 HTTP webhook만 받으며 WebSocket을 직접 열지 않는다.** Socket Mode 연결은 별도 Pod `portal-sdlc-slack-gateway`가 전담하고, 이 Pod가 Slack 원본 봉투를 가공 없이 이 엔드포인트로 릴레이한다.

| `SLACK_INBOUND_MODE` | 인증 | 호출자 |
|---------------------|------|--------|
| `gateway` (기본) | `Authorization: Bearer {SDLC_MASTER_KEY}` (상수 시간 비교) | Slack Gateway Pod (클러스터 내부) |
| `events-api` | `X-Slack-Signature` + `X-Slack-Request-Timestamp` (signing secret) | Slack (퍼블릭 엔드포인트 필요) |

> **fail-closed**: 설정된 모드의 인증기만 활성화한다. 두 검증기를 동시에 열어두면 Bearer 경로가 퍼블릭 엔드포인트에 노출된다.

**요청 본문** (Slack Events API 표준 — 두 모드 동일):

```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "channel": "C12345",
    "text": "피드백 내용",
    "user": "U12345",
    "ts": "1693567800.000123",
    "bot_id": null
  }
}
```

**응답**:

- URL verification: `{ "challenge": "..." }` (`events-api` 모드에서만 도달)
- 일반: `{ "ok": true }`

**수행 작업**:

1. 모드별 인증 검증 (Bearer 또는 signing secret)
2. `sdlc_messaging_channels`에서 채널 → SR 매핑 (`channelId` UK로 O(1))
3. `sdlc_feedback_polls` **CAS UPDATE** — active poll 확인과 dedup 커서(`lastMessageId`) 전진을 한 번에 수행. 이미 처리한 Slack `ts` 이하면 0 rows → 중복이므로 드롭
4. n8n feedback webhook 재발화 (callbackUrl)

> **중복 차단**: Slack Events API 재시도(`X-Slack-Retry-Num`)와 Socket Mode 재연결 리플레이로 같은 메시지가 두 번 도착할 수 있다. Slack `ts`가 채널 내 단조 증가한다는 성질을 이용해 별도 테이블 없이 CAS로 차단한다.

> 자세한 흐름은 [02-messaging-adapter.md](./02-messaging-adapter.md) 6절, Gateway Pod 매니페스트는 [10-k8s-infrastructure.md](./10-k8s-infrastructure.md) 4절 참조.

---

### 2.13 SR 목록 조회 (UI)

**`GET /requests`** — 인증: 세션 (로그인 사용자)

SR 목록 조회 (본인 SR 또는 admin 전체). 페이지네이션·필터 지원.

**쿼리 파라미터**:

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `status` | 상태 필터 | 전체 |
| `search` | requestNo/submitter 검색 | |
| `page` | 페이지 | 1 |
| `limit` | 페이지 크기 | 20 |

**응답**:

```json
{
  "items": [
    {
      "requestNo": "SR-20260901-001",
      "submitter": "홍길동",
      "requestSystem": "AIways On",
      "status": "4_DEV_IN_PROGRESS",
      "createdAt": "2026-09-01T10:00:00Z",
      "updatedAt": "2026-09-01T12:00:00Z"
    }
  ],
  "total": 35,
  "page": 1,
  "limit": 20
}
```

---

### 2.14 SR 상세 조회 (UI)

**`GET /requests/{requestId}`** — 인증: 세션 (로그인 사용자)

SR 상세 정보 + 현재 단계 + 채널 + Pod 상태 + GitHub Issue/PR 링크.

**응답**:

```json
{
  "requestNo": "SR-20260901-001",
  "submitter": "홍길동",
  "submitterGithubLogin": "hong-gildong",
  "status": "9_COMPLETE",
  "requestSystem": "AIways On",
  "module": "대시보드 > 분석",
  "devType": "feature",
  "metadata": { "dueDate": "2026-09-15", "members": ["user1@example.com"] },
  "channels": [
    { "type": "requirements", "channelId": "C001", "archived": false },
    { "type": "design", "channelId": "C002", "archived": false },
    { "type": "dev", "channelId": "C003", "archived": false }
  ],
  "pod": { "podName": "sdlc-SR-20260901-001", "status": "RUNNING", "endpoint": "..." },
  "github": {
    "issues": [{ "repo": "org/portal", "number": 123, "htmlUrl": "...", "state": "open" }],
    "pullRequests": [{ "repo": "org/portal", "prNumber": 45, "state": "merged", "htmlUrl": "..." }]
  },
  "stageHistory": [
    { "from": "1_REGISTERED", "to": "2_REQUIREMENTS_IN_PROGRESS", "createdAt": "..." },
    { "from": "2_REQUIREMENTS_IN_PROGRESS", "to": "3_DEV_DESIGN_IN_PROGRESS", "createdAt": "..." },
    { "from": "3_DEV_DESIGN_IN_PROGRESS", "to": "4_DEV_IN_PROGRESS", "createdAt": "..." },
    { "from": "4_DEV_IN_PROGRESS", "to": "9_COMPLETE", "createdAt": "..." }
  ],
  "createdAt": "2026-09-01T10:00:00Z"
}
```

---

## 3. 관리자 전용 엔드포인트

### 3.1 Orgs 목록

**`GET /orgs`** — 인증: 세션 (admin)

사용 가능한 GitHub Org 목록 조회.

**응답**:

```json
[
  { "id": "...", "orgUrl": "https://github.com/org", "orgName": "org", "credentialId": "..." }
]
```

### 3.2 Repos 목록

**`GET /repos?orgId={orgId}`** — 인증: 세션 (admin)

사용 가능한 GitHub Repo 목록 조회.

**응답**:

```json
[
  {
    "id": "...", "orgId": "...",
    "repoUrl": "https://github.com/org/portal",
    "repoName": "portal",
    "defaultBranch": "main",
    "autoPrMerge": true,
    "isUi": false,
    "runnable": true,
    "playwrightEnabled": false,
    "description": "AIways On repo"
  }
]
```

### 3.3 Credentials 생성

**`POST /credentials`** — 인증: 세션 (admin)

GitHub 연동용 Credential 생성. PAT는 `secret_refs`에 암호화 저장.

**요청 본문**:

```json
{
  "pat": "ghp_...",
  "gitUserName": "sdlc-runner",
  "gitUserEmail": "sdlc-runner@example.com"
}
```

**응답**:

```json
{
  "id": "...",
  "gitUserName": "sdlc-runner",
  "gitUserEmail": "sdlc-runner@example.com"
}
```

> `pat`는 응답에 포함되지 않음. `secret_refs`에 암호화 저장 후 참조 ID만 반환.

### 3.4 Org 등록

**`POST /orgs`** — 인증: 세션 (admin)

GitHub Org 등록 + Credential 연결.

**요청 본문**:

```json
{ "orgUrl": "https://github.com/org", "orgName": "org", "credentialId": "..." }
```

### 3.5 Repo 등록

**`POST /repos`** — 인증: 세션 (admin)

GitHub Repo 등록. `sdlc_repo_setup_jobs` 자동 실행 (초기 셋업).

**요청 본문**:

```json
{
  "orgId": "...",
  "repoUrl": "https://github.com/org/portal",
  "repoName": "portal",
  "defaultBranch": "main",
  "autoPrMerge": true,
  "isUi": false,
  "runnable": true,
  "description": "AIways On repo",
  "files": [{ "relativePath": ".env.local", "content": "..." }],
  "envVars": [{ "key": "DATABASE_URL", "value": "..." }]
}
```

> `files`/`envVars` 내용은 `secret_refs`에 암호화 저장.

---

## 4. 추가 엔드포인트

> **미도입 — `POST /feedback-poll`**: Slack `conversations.history`를 10초마다 폴링하던 `portal-sdlc-feedback-poll` Worker와 해당 엔드포인트는 제거했다. 사용자 메시지 수신은 Slack Gateway Pod → `POST /slack/events` 단일 경로로 일원화한다(2.12절). 폴링과 이벤트 수신이 공존하면 같은 메시지로 n8n이 두 번 발화하므로, 경로를 하나로 줄이고 CAS dedup으로 중복을 차단하는 편이 안전하다. `sdlc_feedback_polls` 테이블 자체는 "피드백 대기 레코드"로 계속 쓰이며 `lastMessageId`는 폴링 커서에서 **dedup 커서**로 의미가 바뀌었다.

### 4.1 채널 메시지 조회

**`GET /requests/{requestId}/channel-messages`** — 인증: 세션 (로그인 사용자)

SR 상세에서 채널별 스냅샷 메시지 조회.

**쿼리 파라미터**:

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `channelType` | `requirements` \| `design` \| `dev` | 전체 |
| `limit` | 페이지 크기 | 100 |

**응답**:

```json
{
  "messages": [
    {
      "channelType": "requirements",
      "messageId": "...",
      "sender": "홍길동",
      "senderId": "hong@example.com",
      "content": "피드백 내용...",
      "sentAt": "2026-09-01T10:00:00Z"
    }
  ],
  "total": 45
}
```

---

### 4.2 GitHub 링크 조회

**`GET /requests/{requestId}/github-links`** — 인증: 세션 (로그인 사용자)

SR에 연결된 GitHub Issue/PR 링크 조회.

**응답**:

```json
{
  "issues": [{ "repo": "org/portal", "number": 123, "htmlUrl": "...", "state": "open" }],
  "pullRequests": [{ "repo": "org/portal", "prNumber": 45, "state": "open", "head": "...", "base": "main", "htmlUrl": "..." }]
}
```

---

### 4.3 채널 ID 조회

**`GET /requests/{requestId}/channel-ids`** — 인증: `Bearer {SDLC_MASTER_KEY}`

Pod/n8n이 SR의 채널 ID 맵핑 조회.

**응답**:

```json
{
  "requirements": "C001",
  "design": "C002",
  "dev": "C003"
}
```

---

### 4.4 PVC 상태 조회

**`GET /requests/{requestId}/pvc`** — 인증: 세션 (로그인 사용자)

SR Pod의 PVC 상태 조회 (K8s PersistentVolumeClaim).

**응답**:

```json
{
  "pvcName": "sdlc-SR-20260901-001",
  "status": "Bound",
  "capacity": "20Gi",
  "storageClass": "netapp-nfs",
  "retentionDays": 7
}
```

---

### 4.5 Conda 캐시 조회

**`GET /requests/{requestId}/conda-cache?cacheKey={key}`** — 인증: `Bearer {SDLC_MASTER_KEY}`

Pod Runner(`POST /conda/ensure-env`)가 cache_key로 conda-pack tarball 존재 여부 조회. 있으면 S3 presigned GET URL 발급. Portal 서버는 대용량 바이너리를 프록시하지 않고 Pod Runner가 S3에서 직접 다운로드.

**쿼리 파라미터**: `cacheKey` (필수)

**응답 (200, 캐시 hit)**:

```json
{
  "found": true,
  "download_url": "https://s3.../sdlc/conda-cache/abc123.tar.gz?X-Amz-...",
  "size_bytes": 524288000
}
```

**응답 (200, 캐시 miss)**:

```json
{ "found": false }
```

---

### 4.6 Conda 캐시 업로드 URL 발급

**`POST /requests/{requestId}/conda-cache/upload-url`** — 인증: `Bearer {SDLC_MASTER_KEY}`

Pod Runner(`POST /conda/pack-and-upload`)가 빌드한 conda 환경 tarball 업로드용 S3 presigned PUT URL 요청.

**요청 본문**:

```json
{ "cache_key": "abc123", "env_hash": "def456" }
```

**응답 (200)**:

```json
{
  "upload_url": "https://s3.../sdlc/conda-cache/abc123-def456.tar.gz?X-Amz-...",
  "object_key": "sdlc/conda-cache/abc123-def456.tar.gz"
}
```

---

### 4.7 Conda 캐시 업로드 완료

**`POST /requests/{requestId}/conda-cache/complete`** — 인증: `Bearer {SDLC_MASTER_KEY}`

S3 업로드 완료 후 `sdlc_conda_cache_versions` 테이블에 캐시 메타데이터 등록.

**요청 본문**:

```json
{
  "cache_key": "abc123",
  "env_hash": "def456",
  "object_key": "sdlc/conda-cache/abc123-def456.tar.gz",
  "size_bytes": 524288000
}
```

**응답 (200)**:

```json
{ "ok": true, "registered": true }
```

---

### 4.8 요청 번호 생성

**`GET /generate-request-no`** — 인증: 세션 (로그인 사용자)

SR 등록 폼에서 요청 번호 사전 생성 (`SR-YYYYMMDD-NNN`).

**응답**:

```json
{ "requestNo": "SR-20260903-001" }
```

---

### 4.9 개발 유형 목록

**`GET /dev-types`** — 인증: 세션 (로그인 사용자)

SR 등록 폼의 개발 유형 select 옵션.

**응답**:

```json
{ "devTypes": ["feature", "bugfix", "refactor", "hotfix"] }
```

---

### 4.10 Repo 셋업 잡 완료

**`POST /repo-setup-jobs/{jobId}/complete`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n Repo Setup 워크플로우가 `vibe-coding-setup` 파이프라인 완료 후 호출. `sdlc_repo_setup_jobs.status`를 `completed`로 갱신.

**요청 본문**:

```json
{ "status": "completed", "result": { "files_created": ["CLAUDE.md", "README.md"] } }
```

**실패 시**:

```json
{ "status": "failed", "error_message": "..." }
```

---

### 4.11 채널 컨텍스트 조회

**`GET /context/{channelId}`** — 인증: 세션 (로그인 사용자)

Slack 채널 ID로 SR 컨텍스트 조회 (Slack Events 수신 시 채널→SR 매핑용과 별개).

---

### 4.12 보고서 메일 발송

**`POST /requests/{requestId}/report-mail`** — 인증: `Bearer {SDLC_MASTER_KEY}`

n8n이 최종 보고서 생성 후 메일 발송 요청.

**요청 본문**:

```json
{
  "reportType": "development",
  "summary": "개발 완료 요약...",
  "reportContent": "..."
}
```

---

## 5. Terminal API (웹 터미널)

SR 상세에서 Pod 내 Claude Code CLI에 직접 접근하는 웹 터미널. Server-Sent Events(SSE)로 실시간 출력 스트리밍.

> `SDLC_CLAUDE_TERMINAL_READONLY` 환경 변수로 키보드 입력 차단 가능 (기본 false).

### 5.1 터미널 스트림

**`GET /requests/{requestId}/terminal/stream`** — 인증: 세션 (로그인 사용자)

Pod 내 Claude Code 세션의 stdout/stderr을 SSE로 스트리밍. `exec` API(K8s pods/exec)를 통해 WebSocket으로 Pod에 연결.

**응답**: `text/event-stream` (SSE)

```
event: stdout
data: {"data": "Claude Code output..."}

event: stderr
data: {"data": "Warning..."}

event: status
data: {"status": "running", "claudeSessionId": "abc-123"}
```

---

### 5.2 터미널 입력

**`POST /requests/{requestId}/terminal/stdin`** — 인증: 세션 (로그인 사용자)

터미널에 키보드 입력 전송 (`SDLC_CLAUDE_TERMINAL_READONLY=true` 시 403).

**요청 본문**:

```json
{ "data": "ls -la\n" }
```

**응답**: HTTP 200 OK

---

### 5.3 터미널 크기 조정

**`POST /requests/{requestId}/terminal/resize`** — 인증: 세션 (로그인 사용자)

터미널 TTY 크기 조정.

**요청 본문**:

```json
{ "cols": 120, "rows": 40 }
```

**응답**: HTTP 200 OK

---

### 5.4 터미널 종료

**`POST /requests/{requestId}/terminal/close`** — 인증: 세션 (로그인 사용자)

터미널 세션 종료 (WebSocket 연결 해제, Pod 프로세스는 계속 실행).

**응답**: HTTP 200 OK

---

### 5.5 터미널 상태

**`GET /requests/{requestId}/terminal/status`** — 인증: 세션 (로그인 사용자)

터미널 세션 상태 조회.

**응답**:

```json
{
  "active": true,
  "claudeSessionId": "abc-123",
  "podName": "sdlc-SR-20260901-001",
  "deploymentPhase": "Running"
}
```

---

## 6. 내부 엔드포인트

### 6.1 Reconcile (CronJob)

**`POST /api/internal/sdlc/reconcile`** — 인증: `Bearer {SDLC_RECONCILE_TOKEN}`

5분 CronJob이 호출. liveness sweep, stale scan, orphan scan, compensate, PVC TTL 순서 실행 (resume sweep 제거).

> reconcile 로직은 resume sweep을 미도입. 상세는 [03-state-machine.md](./03-state-machine.md) 참조.

---

## 7. 에러 응답 포맷 (공통)

모든 에러는 표준 포맷을 따른다.

```json
{
  "code": "ERROR_CODE",
  "message": "사람이 읽을 수 있는 메시지"
}
```

### 에러 코드 정리

| code | HTTP | 설명 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 인증 실패 |
| `FORBIDDEN` | 403 | 권한 부족 (admin 전용 API에 user 접근) |
| `VALIDATION_ERROR` | 400 | 필수 필드 누락 / 형식 오류 |
| `NOT_FOUND` | 404 | 리소스 미존재 |
| `STALE_FROM` | 409 | CAS 실패 (상태 불일치) |
| `INVALID_TRANSITION` | 422 | 불법 상태 전이 |
| `GITHUB_ISSUE_CREATION_FAILED` | 500 | GitHub API 실패 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |
| `INCIDENT_DUPLICATE` | 409 | dedup 윈도 내 동일 `dedupKey` / `templateKey` 중복 |
| `INCIDENT_NOT_PROMOTABLE` | 422 | incident가 이미 승격됨 또는 종결됨 |
| `INCIDENT_ALREADY_RESOLVED` | 422 | incident가 `RESOLVED`/`ARCHIVED` 상태 |
| `TEMPLATE_DISABLED` | 422 | 장애 템플릿 `enabled=false` |
| `SCAN_IN_PROGRESS` | 409 | 동일 repo에 `pending`/`promoting`/`running` 스캔이 이미 존재 |
| `SCAN_NOT_ELIGIBLE` | 422 | `improvementScanEnabled=false` 또는 스캔 주기 미도달 |
| `FINDING_NOT_PROMOTABLE` | 422 | 이미 승격 또는 반려된 finding에 승격·채택 시도 |
| `RULE_DUPLICATE` | 409 | `(category, slug)` 중복 |
| `RULE_IMMUTABLE` | 422 | `failure_case`/`incident_response` 규정 물리 삭제 시도 |
| `MEMORY_SCOPE_DENIED` | 403 | `scope=read` 토큰으로 write 도구 호출 |
| `MEMORY_TOKEN_REVOKED` | 401 | MCP 토큰 폐기(`revokedAt` non-null) 또는 만료(`expiresAt` 경과) |

> 신규 코드는 모두 HTTP 매핑 관례(중복=409, 상태 위반=422, 권한=403, 인증=401)를 따른다. 상세 정의는 [11-incident-response-agent.md](./11-incident-response-agent.md) 9.4절, [12-self-improvement-agent.md](./12-self-improvement-agent.md) 8.4절, [13-developer-memory-agent.md](./13-developer-memory-agent.md) 5.6절 참조.

## 8. 엔드포인트 인증 매트릭스

| 엔드포인트 | 인증 방식 | 호출자 |
|-----------|----------|-------|
| `POST /intake` | Bearer `SDLC_MASTER_KEY` | n8n WF-A |
| `POST /advance` | Bearer `SDLC_MASTER_KEY` | n8n WF-B |
| `POST /requests/{id}/audit` | Bearer `SDLC_MASTER_KEY` | n8n WF-C |
| `POST /requests/{id}/issues` | Bearer `SDLC_MASTER_KEY` | n8n WF-A |
| `POST /requests/{id}/dev-substage` | Bearer `SDLC_MASTER_KEY` | n8n WF-B |
| `POST /requests/{id}/confirm-requirements` | 세션 (user) | UI 버튼 |
| `POST /requests/{id}/feedback-request` | Bearer `SDLC_MASTER_KEY` | n8n WF-B |
| `POST /requests/{id}/stage-done-mail` | Bearer `SDLC_MASTER_KEY` | n8n WF-B |
| `POST /requests/{id}/report-mail` | Bearer `SDLC_MASTER_KEY` | n8n WF-B |
| `POST /channel-notification` | Bearer `SDLC_CALLBACK_BEARER` | Pod/n8n |
| `POST /requests/{id}/channel-image` | Bearer `SDLC_MASTER_KEY` | Pod |
| `POST /slack/events` (`SLACK_INBOUND_MODE=gateway`) | Bearer `SDLC_MASTER_KEY` | Slack Gateway Pod |
| `POST /slack/events` (`SLACK_INBOUND_MODE=events-api`) | Slack signing secret | Slack |
| `GET /images/{imageId}` | Query signed token | 브라우저/Slack |
| `GET /requests/{id}/channel-messages` | 세션 (user) | UI |
| `GET /requests/{id}/channel-ids` | Bearer `SDLC_MASTER_KEY` | Pod/n8n |
| `GET /requests/{id}/github-links` | 세션 (user) | UI |
| `GET /requests/{id}/pvc` | 세션 (user) | UI |
| `GET /requests/{id}/conda-cache` | Bearer `SDLC_MASTER_KEY` | Pod Runner |
| `POST /requests/{id}/conda-cache/upload-url` | Bearer `SDLC_MASTER_KEY` | Pod Runner |
| `POST /requests/{id}/conda-cache/complete` | Bearer `SDLC_MASTER_KEY` | Pod Runner |
| `GET /generate-request-no` | 세션 (user) | UI 등록 폼 |
| `GET /dev-types` | 세션 (user) | UI 등록 폼 |
| `POST /repo-setup-jobs/{jobId}/complete` | Bearer `SDLC_MASTER_KEY` | n8n Repo Setup |
| `GET /context/{channelId}` | 세션 (user) | UI 채널 컨텍스트 |
| `GET /requests/{id}/terminal/stream` | 세션 (user) | UI 터미널 (SSE) |
| `POST /requests/{id}/terminal/stdin` | 세션 (user) | UI 터미널 입력 |
| `POST /requests/{id}/terminal/resize` | 세션 (user) | UI 터미널 크기 |
| `POST /requests/{id}/terminal/close` | 세션 (user) | UI 터미널 종료 |
| `GET /requests/{id}/terminal/status` | 세션 (user) | UI 터미널 상태 |
| `GET /requests` | 세션 (user) | UI |
| `GET /requests/{id}` | 세션 (user) | UI |
| `GET /orgs` | 세션 (admin) | UI 관리 |
| `GET /repos` | 세션 (admin) | UI 관리 |
| `POST /credentials` | 세션 (admin) | UI 관리 |
| `POST /orgs` | 세션 (admin) | UI 관리 |
| `POST /repos` | 세션 (admin) | UI 관리 |
| `POST /api/internal/sdlc/reconcile` | Bearer `SDLC_RECONCILE_TOKEN` | CronJob |
| `POST /incidents/ingest` | Bearer `SDLC_MASTER_KEY` | 외부 모니터링 |
| `POST /incidents/inject` | 세션 (admin) | UI `/incidents/inject` |
| `GET /incidents` | 세션 (user) | UI 목록 |
| `GET /incidents/{id}` | 세션 (user) | UI 상세 |
| `POST /incidents/{id}/promote` | 세션 (admin) | UI 버튼 |
| `POST /incidents/{id}/analysis` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /incidents/{id}/status` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /incidents/{id}/resolve` | 세션 (admin) | UI 버튼 |
| `POST /incidents/{id}/archive` | 세션 (admin) | UI 버튼 |
| `GET /incident-templates` | 세션 (admin) | UI 관리 |
| `POST /incident-templates` | 세션 (admin) | UI 관리 |
| `POST /incident-templates/{templateId}/update` | 세션 (admin) | UI 관리 |
| `POST /incident-templates/{templateId}/archive` | 세션 (admin) | UI 관리 |
| `POST /improvements/scan` | 세션 (admin) | UI 관리 버튼 |
| `GET /improvements` | 세션 (user) | UI 목록 |
| `GET /improvements/{scanId}` | 세션 (user) | UI 상세 |
| `POST /improvements/{scanId}/findings` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /improvements/{scanId}/status` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /findings/{findingId}/accept` | 세션 (user) | UI 버튼 |
| `POST /findings/{findingId}/reject` | 세션 (user) | UI 버튼 |
| `POST /findings/{findingId}/to-sr` | 세션 (admin) | UI 버튼 |
| `POST /findings/{findingId}/to-memory` | 세션 (admin) | UI 버튼 |
| `POST /repos/{repoId}/update` | 세션 (admin) | UI 관리 (스캔 설정) |
| `POST /api/internal/sdlc/improvement-scan` | Bearer `SDLC_MASTER_KEY` | CronJob `portal-sdlc-improve-scan` |
| `GET /memory/rules` | 세션 (user) | UI `/memory` |
| `GET /memory/rules/{ruleId}` | 세션 (user) | UI 규정 상세 |
| `POST /memory/rules` | 세션 (user) | UI 규정 등록 Dialog |
| `POST /memory/rules/{ruleId}/update` | 세션 (user) | UI 규정 편집 |
| `POST /memory/rules/{ruleId}/archive` | 세션 (admin) | UI 규정 상세 |
| `GET /memory/rules/{ruleId}/revisions` | 세션 (user) | UI 개정 이력 Accordion |
| `GET /memory/tokens` | 세션 (admin) | UI `/admin/memory-tokens` |
| `POST /memory/tokens` | 세션 (admin) | UI 토큰 발급 Dialog |
| `POST /memory/tokens/{tokenId}/revoke` | 세션 (admin) | UI 토큰 폐기 AlertDialog |
| `POST /api/internal/sdlc/memory/rules` | Bearer `SDLC_MASTER_KEY` | MCP 서버 (write 도구) |
| `POST /api/internal/sdlc/memory/tokens/issue-scoped` | Bearer `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` | Portal orchestrator **전용** (MCP 서버에는 이 토큰이 없다) |

> **내부 엔드포인트 정리**: 6절의 `POST /api/internal/sdlc/reconcile`과 함께 `POST /api/internal/sdlc/improvement-scan`, `POST /api/internal/sdlc/memory/rules`, `POST /api/internal/sdlc/memory/tokens/issue-scoped` 3개가 추가된다. 모두 세션 쿠키가 아닌 서버 간 Bearer 인증이며 `middleware.ts`의 public prefix 목록에는 포함되지 않는다(보호 경로).

> **단일 Master Key 채택 근거**: 서버 간 인증 토큰 5종(`/intake` 접수, per-SR 콜백, incident ingest, improvement scan, memory internal)은 모두 동일한 운영 주체가 관리하므로 분리해도 실질적인 권한 경계가 생기지 않았고 관리 비용만 컸다. per-SR 토큰 발급·`secret_refs` 암호화 저장·FK 체인까지 딸려 있었다. 이를 `SDLC_MASTER_KEY` 하나로 통합하고, 검증은 라우트 핸들러 내 상수 시간 비교로 수행한다.
>
> **잔존 위험**: 키 1개가 유출되면 서버 간 전 경로가 동시에 노출된다. 또한 키 회전 시 Portal·n8n·Pod·MCP 서버·CronJob 전 컴포넌트를 동시에 갱신해야 하므로 무중단 회전이 어렵다. 운영 시 Secret `sdlc-secrets` 키 `master-key`의 접근 감사와 회전 절차를 별도로 관리한다.
>
> **발급 권한만은 분리 유지**: `/memory/rules`(쓰기)와 `/memory/tokens/issue-scoped`(토큰 발급)는 여전히 **서로 다른 토큰**을 요구한다. 하나로 통합하면 MCP 서버가 침해될 때 임의 규정에 대한 `read_write` agent 토큰을 발급해 전체 규정을 위조할 수 있다. 따라서 `SDLC_MEMORY_TOKEN_ISSUER_TOKEN`은 Master Key 통합 대상에서 제외하며, Portal orchestrator만 보유하고 MCP 서버 Deployment에 주입하지 않는다. [13-developer-memory-agent.md](./13-developer-memory-agent.md) 6절 참조.
>
> **MCP 접근 토큰은 이 매트릭스에 없다**: `sdlcmem_*` 토큰은 Portal API가 아니라 MCP 서버(`portal-sdlc-memory-mcp` :58002)에 제시된다. MCP 도구 6종과 인증 흐름은 [13-developer-memory-agent.md](./13-developer-memory-agent.md) 6절 참조.

> 미도입 엔드포인트: Stage `5`~`8` 예약 구간(배포/검증) 관련, SWP 연동, **resume-claim/resume-design (resume 기능 전체 미도입)**.
