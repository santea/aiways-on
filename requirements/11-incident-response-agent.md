# 장애 대응 Agent — 트리거 주입·incident SR 승격·원인분석·대응가이드

> 운영 중 발생한 장애를 수집해 SR로 자동 승격하고, 기존 SDLC Pod 안에서 Claude Code skill이 원인분석·대응가이드·코드 수정을 산출하는 파이프라인을 정의한다.
> 기존 SR 파이프라인을 그대로 재사용하며, 델타는 경량 `sdlc_incidents` 레코드 3종과 `metadata.pipelineProfile` 분기, 조건부 전이 1개(`1 → 4`)뿐이다.

## 1. 개요

### 1.1 아키텍처 컴포넌트

```mermaid
flowchart TB
    subgraph EXT["외부 트리거"]
        MON["모니터링 시스템<br/>POST /incidents/ingest"]
        UI["Portal UI<br/>/incidents/inject (admin)"]
    end

    subgraph PORTAL["Portal (Next.js)"]
        ING["Incident Ingest<br/>dedupKey 멱등"]
        TPL["Incident Templates<br/>sdlc_incident_templates"]
        PROMO["Promoter<br/>incident → SR intake"]
        ANA["Analysis Registry<br/>sdlc_incident_analyses"]
        MEMR["Memory Rule 생성<br/>category=incident_response"]
    end

    subgraph N8N["n8n"]
        WFA["Workflow A<br/>/webhook/sdlc-intake"]
        WFB["Workflow B<br/>/webhook/sdlc-run-complete"]
        SWP["Switch by Pipeline Profile<br/>(신규 노드군)"]
    end

    subgraph POD["SDLC Pod (sdlc-{requestNo})"]
        RUN["POST /run<br/>(기존 엔드포인트)"]
        SKILL["skill: sdlc:incident-response"]
        MCP["Memory MCP<br/>sdlc-memory"]
        REPORTS["/workspaces/session/.sdlc-reports/<br/>incident-*.md"]
    end

    MON --> ING
    UI --> ING
    TPL --> ING
    ING --> PROMO
    PROMO --> WFA
    WFA --> RUN
    RUN --> SKILL
    SKILL --- MCP
    SKILL --> REPORTS
    SKILL --> ANA
    RUN -->|run.completed| WFB
    WFB --> SWP
    SWP --> ANA
    ANA --> MEMR
```

> **무엇을 미러링했는가**: 위 컴포넌트 배치는 [10-k8s-infrastructure.md](./10-k8s-infrastructure.md) 1절의 `namespace: bia-systems` 단일 subgraph 구성을 계층별 subgraph로 확장한 형태이며, 신규 K8s 오브젝트는 없다.

### 1.2 장애 대응 파이프라인 5단계

| 단계 | 이름 | 주체 | 산출 | 상태 |
|------|------|------|------|------|
| 1 | 수집 (ingest) | 모니터링 / admin UI | `sdlc_incidents` 레코드 | `DETECTED` |
| 2 | 승격 (promote) | Portal | `sdlc_requests` (`pipelineProfile=incident`) | `SR_PROMOTED` |
| 3 | 분석 (analyze) | Pod agent (`sdlc:incident-response`) | RCA·가설 배제 기록 | `TRIAGING` |
| 4 | 산출 (report) | Pod agent | 대응 가이드 / 코드 수정 PR | `GUIDE_READY` \| `PATCH_PROPOSED` |
| 5 | 종결 (resolve) | 사람 (admin) | 예방 규정 (Memory rule) | `RESOLVED` |

> **무엇을 미러링했는가**: 5단계 표는 [09-data-flow.md](./09-data-flow.md) 1절의 엔드투엔드 단계 서술 방식을 incident 축으로 옮긴 것이다.

### 1.3 설계 원칙

| 원칙 | 내용 |
|------|------|
| Pod 무변경 | Pod Runner 코드·Dockerfile·엔드포인트 변경은 **0**. 신규 agent는 이미 설치된 `sdlc@mvc` 플러그인의 Claude Code skill이며 기존 `POST /run`만으로 실행된다 |
| Stage 불변 | Stage enum은 추가·삭제 없이 그대로 사용한다. incident 프로파일은 정본 enum(`1`~`4`, `9_COMPLETE`, `X_STOPPED`, `X_FAILED`) 중 일부를 **건너뛸 뿐** 새 상태를 만들지 않는다. `5`~`8`은 정본과 동일하게 미사용 예약이다 ([03-state-machine.md](./03-state-machine.md) 1절) |
| 기존 SR 파이프라인 재사용 | incident 전용 Pod 타입·전용 워크플로우를 만들지 않는다. `sdlc-{requestNo}` Pod 1개, Workflow A/B/C 3개를 그대로 쓴다 |
| ChannelType 불변 | `requirements\|design\|dev` 그대로. incident 프로파일은 **`dev` 채널만** 생성하며 채널명은 `inc-{no}-dev`다. prefix만 프로파일별로 달라지고 enum 값은 그대로다 ([02-messaging-adapter.md](./02-messaging-adapter.md) 5.2절) |
| POST-only RPC | update/archive는 `POST /{resource}/{id}/update` / `POST /{resource}/{id}/archive`. [05-portal-api.md](./05-portal-api.md) 1절에서 정의한 관례를 따른다 |

> **Pod 무변경 근거**: [06-pod-runner-api.md](./06-pod-runner-api.md) 2.4절이 `sdlc:capture-mockup`에 대해 "Pod 코드/엔드포인트 변경은 없다. 기존 `POST /run`만으로 처리된다"고 명시한 선례를 그대로 따른다. `sdlc:incident-response`도 동일하게 skill 레벨 추가에 그친다.

> **설계 결정**: `sdlc_requests.metadata.pipelineProfile ∈ {feature, incident, improvement}` 필드 1개가 파이프라인 성격을 구분하는 유일한 스위치다. `metadata`는 이미 `jsonb('metadata').$type<Record<string, unknown>>()`이므로 스키마 마이그레이션이 필요 없다.

---

## 2. 장애 수집 (ingest)

### 2.1 외부 모니터링 수집 API

외부 모니터링(APM·로그 알람·헬스체크)이 장애를 감지하면 Portal에 단일 엔드포인트로 밀어 넣는다. Portal은 `dedupKey`로 멱등 처리하고, 임계 severity 이상이면 즉시 SR 승격을 시도한다.

**`POST /incidents/ingest`** — 인증: `Bearer {SDLC_MASTER_KEY}`

외부 모니터링 시스템이 감지한 장애를 등록한다.

**요청 본문**:

```json
{
  "title": "SR 상세 페이지 500 에러 급증",
  "severity": "high",
  "symptomMd": "## 증상\n- 14:02부터 `/requests/{id}` 응답 500\n- 에러율 42%\n\n## 관측\n- `getRequestDetail` 쿼리 타임아웃",
  "dedupKey": "requests-detail-500:20260903",
  "rawPayload": {
    "alertId": "AL-99213",
    "metric": "http_5xx_rate",
    "value": 0.42,
    "threshold": 0.05,
    "window": "5m"
  }
}
```

**응답** (201 Created — 신규 등록):

```json
{
  "incidentId": "3f1c...",
  "incidentNo": "INC-20260903-001",
  "status": "DETECTED",
  "promoted": false
}
```

**응답** (200 OK — dedup 히트, 멱등):

```json
{
  "incidentId": "3f1c...",
  "incidentNo": "INC-20260903-001",
  "duplicate": true
}
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `title`/`severity` 누락 또는 severity 허용값 외 |
| 401 | `UNAUTHORIZED` | `SDLC_MASTER_KEY` 불일치 |
| 409 | `INCIDENT_DUPLICATE` | dedup 윈도 내 동일 `dedupKey` — `SDLC_INCIDENT_DEDUP_WINDOW_MINUTES` 초과 시에만 신규 발급 |
| 500 | `INTERNAL_ERROR` | 등록 실패 |

**수행 작업**:

1. `SDLC_INCIDENT_ENABLED` 확인 — `false`면 즉시 403 `FORBIDDEN` (fail-closed 봉인)
2. `dedupKey` 미지정 시 `sha256(title)[0:32]`로 파생
3. `sdlc_incidents` 삽입 (`ON CONFLICT DO NOTHING` — `sdlc_incidents_dedup_key_idx`)
4. `incidentNo` 발급 — `INC-YYYYMMDD-NNN`
5. `rawPayload`는 원문 저장, 로그에는 `sha256` 지문만 기록
6. `SDLC_INCIDENT_AUTO_PROMOTE=true` AND `severity >= SDLC_INCIDENT_AUTO_PROMOTE_MIN_SEVERITY`면 4절 승격 시퀀스 진입

> **멱등**: `sdlc_incidents.dedupKey`는 `sdlc_requests.dedupKey` 멱등성 패턴을 미러링한다. 동일 알람 폭주 시 SR이 중복 생성되지 않는다.

### 2.2 Test 트리거 주입 (UI + API)

운영 검증·훈련 목적으로 admin이 장애를 인위적으로 발생시킨다. UI는 10절 `/incidents/inject` 페이지, API는 아래 엔드포인트다.

**`POST /incidents/inject`** — 인증: 세션 (admin)

템플릿 또는 직접 입력으로 테스트 장애를 주입한다.

**요청 본문**:

```json
{
  "templateKey": "portal-db-timeout",
  "title": "[TEST] DB 커넥션 풀 고갈",
  "severity": "high",
  "symptomMd": "## 증상\n- 커넥션 풀 대기 타임아웃 다발",
  "targetRepoId": "9a2e...",
  "autoPromote": false
}
```

**응답** (201 Created):

```json
{
  "incidentId": "7b04...",
  "incidentNo": "INC-20260903-002",
  "status": "DETECTED",
  "promoted": false,
  "requestNo": null
}
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `title`/`severity` 누락 |
| 403 | `FORBIDDEN` | admin 아님, 또는 `SDLC_INCIDENT_ALLOW_TEST_INJECTION=false`, 또는 `SDLC_INCIDENT_ENABLED=false` |
| 404 | `NOT_FOUND` | `templateKey` 또는 `targetRepoId` 미존재 |
| 422 | `TEMPLATE_DISABLED` | 템플릿 `enabled=false` |

> **`autoPromote=true`면 항상 승격된다**: 자원 게이트·대기 큐가 없으므로 승격이 보류되는 경로가 존재하지 않는다. 승격 자체가 실패하면 `promoted:false`로 201을 반환하고 Reconcile이 재시도한다 (9.2절과 동일).

**수행 작업**:

1. `requireAdmin()` 통과 확인 + `SDLC_INCIDENT_ALLOW_TEST_INJECTION=true` 확인 (둘 중 하나라도 불충족 시 403 `FORBIDDEN`)
2. `templateKey` 지정 시 `sdlc_incident_templates` 조회 → `enabled` 검사 → 미입력 필드를 템플릿 값으로 채움
3. `source='test_injection'`, `dedupKey = 'inject:' + templateKey + ':' + Date.now()`로 항상 신규 레코드 생성 (테스트 주입은 dedup 대상 아님)
4. `autoPromote=true`면 4절 승격 시퀀스 즉시 실행
5. `audit_events` 기록 (`action: sdlc.incident_injected`, `metadata.actor = session.user.login`)

> **무엇을 미러링했는가**: `POST /incidents/inject`의 `templateKey → 필드 병합` 흐름은 [05-portal-api.md](./05-portal-api.md) 3.5절 `POST /repos`가 `files`/`envVars`를 함께 받아 파생 레코드를 만드는 패턴을 미러링한다.

### 2.3 장애 템플릿

반복 검증 시나리오를 `sdlc_incident_templates`에 등록해 재사용한다.

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `templateKey` | string | (필수) | 고유 키 (예: `portal-db-timeout`) |
| `name` | string | (필수) | 표시명 |
| `description` | string | `null` | 템플릿 용도 설명 |
| `severity` | string | `medium` | `critical` \| `high` \| `medium` \| `low` |
| `symptomMd` | string | (필수) | 증상 마크다운 본문 |
| `payloadTemplate` | object | `null` | `rawPayload` 기본 골격 |
| `targetRepoId` | uuid | `null` | 분석 대상 repo (`sdlc_github_repos`) |
| `enabled` | boolean | `true` | `false`면 주입 거부 (`TEMPLATE_DISABLED`) |

**템플릿 예시**:

```json
{
  "templateKey": "portal-db-timeout",
  "name": "Portal DB 커넥션 타임아웃",
  "description": "Drizzle 커넥션 풀 고갈 시나리오 검증용",
  "severity": "high",
  "symptomMd": "## 증상\n- `/api/v1/sdlc/requests` p99 12s\n- `pool timeout exceeded` 로그 급증\n\n## 영향\n- SR 목록·상세 조회 실패",
  "payloadTemplate": {
    "metric": "db_pool_wait_ms",
    "threshold": 5000
  },
  "enabled": true
}
```

> **무엇을 미러링했는가**: `payloadTemplate`의 `jsonb` 자유 골격은 `sdlc_requests.metadata` (`jsonb('metadata').$type<Record<string, unknown>>()`) 패턴을 미러링한다.

### 2.4 중복 억제 `dedupKey` 규칙

| 출처 (`source`) | `dedupKey` 생성 규칙 | dedup 적용 |
|-----------------|----------------------|-----------|
| `external` / `monitoring` | 호출자 제공 값 우선, 없으면 `sha256(title)[0:32]` | ✅ 윈도 내 멱등 |
| `manual` | `manual:{sha256(title)[0:16]}:{YYYYMMDD}` | ✅ 당일 1건 |
| `test_injection` | `inject:{templateKey ?? 'adhoc'}:{epochMs}` | ❌ 항상 신규 |

**dedup 윈도 판정**:

1. `dedupKey`로 `sdlc_incidents` 조회
2. 히트한 레코드의 `detectedAt`이 `now() - SDLC_INCIDENT_DEDUP_WINDOW_MINUTES` 이후면 **중복** → 200 `{duplicate:true}`
3. 윈도를 벗어났고 기존 레코드가 `RESOLVED`/`ARCHIVED`면 `dedupKey`에 `:{epochMinute}` 접미를 붙여 신규 발급
4. 윈도를 벗어났으나 기존 레코드가 미종결(`DETECTED`~`PATCH_PROPOSED`)이면 **중복 유지** — 진행 중 장애에 SR을 중복 생성하지 않는다

> **멱등**: `sdlc_incidents_dedup_key_idx`가 uniqueIndex이므로 3번 경로에서만 새 키가 생긴다. DB 레벨에서 중복이 물리적으로 차단된다.

---

## 3. incident 상태 머신

```mermaid
stateDiagram-v2
    [*] --> DETECTED: ingest / inject
    DETECTED --> SR_PROMOTED: promote 성공 (SR 생성)
    DETECTED --> ARCHIVED: 오탐 판정 (archive)
    DETECTED --> X_FAILED: promote 3회 실패
    SR_PROMOTED --> TRIAGING: Pod agent 분석 시작
    TRIAGING --> GUIDE_READY: 대응 가이드 산출
    TRIAGING --> PATCH_PROPOSED: 가이드 + 코드 수정 PR
    TRIAGING --> X_FAILED: 분석 실패 (run.failed)
    GUIDE_READY --> PATCH_PROPOSED: 후속 코드 수정
    GUIDE_READY --> RESOLVED: 사람 종결 (resolve)
    PATCH_PROPOSED --> RESOLVED: PR 리뷰·머지 후 종결
    X_FAILED --> ARCHIVED: 논리 삭제
    RESOLVED --> [*]
    ARCHIVED --> [*]
```

**상태 표**:

| 상태 | 의미 | 다음 상태 |
|------|------|-----------|
| `DETECTED` | 수집 완료, 아직 SR 없음 | `SR_PROMOTED`, `ARCHIVED`, `X_FAILED` |
| `SR_PROMOTED` | SR 생성 완료, Pod 실행 대기·진행 | `TRIAGING`, `X_FAILED` |
| `TRIAGING` | Pod agent가 원인분석 중 | `GUIDE_READY`, `PATCH_PROPOSED`, `X_FAILED` |
| `GUIDE_READY` | 대응 가이드 산출 완료 (코드 수정 없음) | `PATCH_PROPOSED`, `RESOLVED` |
| `PATCH_PROPOSED` | 코드 수정 PR 생성 완료 (머지 전) | `RESOLVED` |
| `RESOLVED` | 사람 종결 + 예방 규정 등록 | (없음 — terminal) |
| `X_FAILED` | 승격 또는 분석 실패 | `ARCHIVED` |
| `ARCHIVED` | 논리 삭제 (오탐·폐기) | (없음 — terminal) |

**전이 조건 표**:

| 현재 → 다음 | 트리거 | 수행 작업 |
|------------|--------|-----------|
| `DETECTED → SR_PROMOTED` | auto-promote 또는 `POST /incidents/{id}/promote` | SR intake 호출 + `requestId` 역참조 저장 |
| `DETECTED → X_FAILED` | `promotionAttempts >= 3` | `lastError` 기록 + dev 채널 알림 생략 (SR 없음) |
| `SR_PROMOTED → TRIAGING` | Pod agent가 `POST /incidents/{id}/status` 호출 | `sdlc_incidents.status` 갱신 |
| `TRIAGING → GUIDE_READY` | `POST /incidents/{id}/analysis` (`kind=guide`) + status 호출 | 가이드 등록 + dev 채널 알림 |
| `TRIAGING → PATCH_PROPOSED` | `kind=patch` 등록 (PR 번호 포함) | PR 링크 dev 채널 알림 |
| `GUIDE_READY → RESOLVED` | `POST /incidents/{id}/resolve` (admin) | `resolvedAt` 기록 + Memory 규정 생성 |
| `PATCH_PROPOSED → RESOLVED` | 사람이 PR 머지 후 `resolve` | 동일 |
| `* → ARCHIVED` | `POST /incidents/{id}/archive` (admin) | 논리 삭제, SR은 그대로 유지 |

> **fail-closed**: incident 상태는 SR Stage와 **독립**이다. incident가 `X_FAILED`여도 SR Stage는 `[03-state-machine.md](./03-state-machine.md) 2절`의 전이 규칙만 따른다. 두 상태 머신을 교차 검증하지 않는 것이 의도된 설계다.

> **승격 재시도 계약**: 승격 실패 시 `status`는 `DETECTED`로 **유지**되고 `promotionAttempts`가 증가하며 `updatedAt`이 갱신된다. `promoting` 같은 중간 상태값은 두지 않는다. reconcile 스윕은 `status='DETECTED' AND requestId IS NULL AND promotionAttempts > 0 AND updatedAt < now() - SDLC_INCIDENT_PROMOTE_STALE_MINUTES` 조건으로 재시도 대상을 집는다. `promotionAttempts >= 3`이면 `X_FAILED`로 전이하고 더 이상 재시도하지 않는다. 상세는 [03-state-machine.md](./03-state-machine.md) 8절 Reconcile 참조.

> **무엇을 미러링했는가**: `lastError` 오류 문구 보존은 `sdlc_repo_setup_jobs.errorMessage`(`text('error_message')`, [04-db-schema.md](./04-db-schema.md) 7.1절) 패턴을 미러링한다. 다만 **`promotionAttempts` 시도 횟수 컬럼은 미러링 대상이 없는 신규 도입이다** — `sdlc_repo_setup_jobs`는 `status`(`pending|running|completed|failed`)로 실패를 표현하고 재시도 횟수를 세지 않는다. incident 승격은 reconcile이 3회까지 재시도해야 하므로 카운터가 필요하다.

---

## 4. incident → SR 승격

### 4.1 자동 intake 페이로드

Portal이 incident를 SR로 승격할 때 기존 `POST /api/v1/sdlc/intake`를 **그대로** 호출한다. 신규 intake 엔드포인트는 만들지 않는다.

**Portal → Portal intake 호출 본문**:

```json
{
  "requestNo": "SR-20260903-004",
  "submitter": "SDLC Incident Bot",
  "submitterEmail": "sdlc-bot@example.com",
  "submitterGithubLogin": "sdlc-bot",
  "requestSite": "aiways-on.example.com",
  "devType": "hotfix",
  "requestSystem": "AIways On",
  "module": "장애 대응",
  "dedupKey": "INC-20260903-001",
  "metadata": {
    "pipelineProfile": "incident",
    "incidentId": "3f1c...",
    "incidentNo": "INC-20260903-001",
    "severity": "high",
    "requestDate": "2026-09-03",
    "problemDescription": "## 증상\n- 14:02부터 `/requests/{id}` 응답 500\n- 에러율 42%",
    "expectedEffect": "근본 원인 확정 + 대응 가이드 산출. 안전하면 코드 수정 PR까지.",
    "testScenario": "1. SR 상세 페이지 접속\n2. 500 미발생 확인",
    "targetRepoIds": ["9a2e..."],
    "members": []
  }
}
```

| 필드 | 값 | 근거 |
|------|-----|------|
| `dedupKey` | `incidentNo` 그대로 | incident 1건 = SR 1건 보장 |
| `devType` | `hotfix` | 기존 `GET /dev-types` 목록(`feature\|bugfix\|refactor\|hotfix`) 내 값 |
| `metadata.pipelineProfile` | `incident` | 파이프라인 분기 유일 스위치 |
| `metadata.incidentId` | incident UUID | Pod·n8n이 역참조에 사용 |
| `submitter*` | 봇 identity | `sdlc_requests.submitterId`는 `null` (users FK는 nullable) |

> **무엇을 미러링했는가**: 위 본문은 [05-portal-api.md](./05-portal-api.md) 2.1절 intake 페이로드를 필드 하나도 바꾸지 않고 재사용하며, `metadata`에 incident 전용 키 5개만 추가한다.

### 4.2 `pipelineProfile=incident` 파이프라인 차이

| 항목 | `feature` (기존) | `incident` (신규) |
|------|-----------------|------------------|
| 채널 생성 | `requirements` + `design` + `dev` 3개 (`sr-{no}-*`) | **`dev` 1개만** — 채널명 `inc-{no}-dev` |
| 요구사항 단계 | `2_REQUIREMENTS_IN_PROGRESS` 수행 | **스킵** |
| 설계 단계 | `3_DEV_DESIGN_IN_PROGRESS` 수행 | **스킵** |
| 최초 전이 | `1_REGISTERED → 2_REQUIREMENTS_IN_PROGRESS` | `1_REGISTERED → 4_DEV_IN_PROGRESS` |
| devSubStages | `dev → qa → code_review → security_review` | `dev`만 (agent 내부에서 검증 수행) |
| 목업 캡처 | `sdlc:capture-mockup` 실행 | 실행 안 함 |
| 전체 경로 | `1 → 2 → 3 → 4 → 9` | **`1 → 4 → 9`** |
| 종결 경로 | `4 → 9_COMPLETE` | `4 → 9_COMPLETE` — 가이드 전용이든 코드 수정이든 **동일**. PR 생성 여부는 Portal의 commit 이력 판정이 결정한다 |
| PR 자동 머지 | `autoPrMerge` 설정 준수 | **항상 금지** — `autoPrMerge=true`여도 PR만 생성하고 결과 메시지에 `수동 머지 필요(장애 대응 정책)`로 표기 |
| 실행 skill | `/sdlc:user-deep-interview` → `autopilot` | `sdlc:incident-response` |

> **설계 결정**: ChannelType enum은 불변(`requirements\|design\|dev`)이며, incident는 그 중 `dev`만 **생성하지 않는 채널을 만들지 않는** 방식으로 대응한다. enum 값 추가·제거는 없다. 채널 **이름**의 prefix만 `sr-` → `inc-`로 달라지며, 이는 Slack 채널 목록에서 장애 대응 채널을 식별하기 위한 것이다 ([02-messaging-adapter.md](./02-messaging-adapter.md) 5.2절 `srPrefix` 매핑 정본).

`improvement` 프로파일은 `incident`와 동일한 스킵·전이 규칙을 쓰되 `severity` 개념이 없고 auto-promote 대상이 아니다. 본 문서는 `incident`만 상세화한다.

### 4.3 조건부 전이 `1 → 4`

`LEGAL_TRANSITIONS`에 조건부 전이 **1개**를 추가한다. 이 전이는 `metadata.pipelineProfile !== 'feature'`일 때만 합법이다.

| 전이 | 조건 | 트리거 | 진입 작업 |
|------|------|--------|-----------|
| `1_REGISTERED → 4_DEV_IN_PROGRESS` | `pipelineProfile ∈ {incident, improvement}` | Pod health check 완료 (n8n WF-A) | dev 채널 멤버 초대 + Pod 단계 알림 + `devSubStage.current = 'dev'` |

`4_DEV_IN_PROGRESS → 9_COMPLETE`는 **조건부가 아니다**. 전 프로파일 공통 전이이므로 incident도 별도 분기 없이 정본 경로를 그대로 탄다.

> **PR 고아화 방지**: 목적지가 `9_COMPLETE` 하나로 통합되면서 "가이드 전용인가 코드 수정인가"를 상태 전이에서 판정할 필요가 없어졌다. incident가 `GUIDE_READY`에 머물렀는지 `PATCH_PROPOSED`에 도달했는지는 Portal의 `4 → 9` 진입 작업이 repo별 **commit 이력**으로 기계 판정하며, commit이 없으면 PR을 만들지 않고 issue를 닫는다 ([03-state-machine.md](./03-state-machine.md) 4.4절). 따라서 PR이 상태 전이 때문에 고아가 되는 경로가 구조적으로 사라졌다.

```typescript
// src/lib/sdlc/state-machine.ts (기존 파일에 조건부 분기 추가)
export function isLegalTransition(
  from: Stage,
  to: Stage,
  profile: PipelineProfile = 'feature',
): boolean {
  if (LEGAL_TRANSITIONS[from]?.includes(to)) return true;
  if (profile === 'feature') return false;
  // incident / improvement 전용 조건부 전이 1개
  if (from === Stage.REGISTERED && to === Stage.DEV_IN_PROGRESS) return true;
  return false;
}
```

> **설계 결정**: 이 조건부 전이 1개는 [03-state-machine.md](./03-state-machine.md) 2.1절 `LEGAL_TRANSITIONS` 표에 각주 형태로 추가된다. 정본 Stage 값 집합과 `feature` 경로는 한 글자도 바뀌지 않는다.

`POST /advance` 호출 시 `from`/`to`는 그대로 쓰고, Portal이 `sdlc_requests.metadata.pipelineProfile`을 읽어 조건부 여부를 판정한다. n8n은 프로파일을 알 필요가 없다.

**advance 호출 예시** (n8n WF-A → Portal):

```json
{
  "requestNo": "SR-20260903-004",
  "from": "1_REGISTERED",
  "to": "4_DEV_IN_PROGRESS",
  "actor": "n8n-agent-inc",
  "idempotencyKey": "SR-20260903-004->4_DEV_IN_PROGRESS"
}
```

불법 전이 시도 시 응답은 기존과 동일하다:

```json
{ "code": "INVALID_TRANSITION", "message": "Transition 1_REGISTERED → 4_DEV_IN_PROGRESS is not allowed for profile=feature" }
```

### 4.4 승격 시 자원 판정

승격은 자원 게이트를 거치지 않는다. `SDLC_INCIDENT_ENABLED`(fail-closed 봉인)만 통과하면 SR 등록 직후 채널·Pod 생성까지 단일 흐름으로 진행된다 ([03-state-machine.md](./03-state-machine.md) 1.2절).

| 판정 | 조건 | 결과 |
|------|------|------|
| 승격 | `SDLC_INCIDENT_ENABLED=true` AND `severity >= SDLC_INCIDENT_AUTO_PROMOTE_MIN_SEVERITY` | 201 — 즉시 Pod 프로비저닝, incident `SR_PROMOTED` |
| 미승격 | 위 조건 불충족 | incident는 `DETECTED` 유지 — admin이 10.5절 UI에서 수동 승격 |
| 승격 실패 | intake·프로비저닝 도중 오류 | incident `DETECTED` 유지 + `promotionAttempts += 1`. Reconcile이 재시도하고 3회 초과 시 `X_FAILED` (9.2절) |

> **대기 개념이 없다**: 슬롯·스토리지 게이트와 FIFO 대기 큐가 제거되었으므로 `critical` 장애가 자원 때문에 대기하는 경로도, 우선권으로 대기열을 앞지르는 경로도 존재하지 않는다. 승격은 즉시 성공하거나 즉시 실패한다.

---

## 5. Pod agent 실행

### 5.1 `POST /run` 페이로드

n8n Workflow B가 `4_DEV_IN_PROGRESS` 진입 후 `sdlc-{requestNo}` Pod의 기존 엔드포인트를 호출한다. 신규 엔드포인트는 없다.

**`POST http://sdlc-SR-20260903-004.bia-systems.svc.cluster.local:58001/run`** — 인증: `Bearer {POD_AUTH_TOKEN}`

incident 분석 skill을 실행한다.

**요청 본문**:

```json
{
  "prompt": "/sdlc:incident-response\n\n## 장애 정보\n- incidentNo: INC-20260903-001\n- incidentId: 3f1c...\n- severity: high\n- 대상 repo: /workspaces/session/portal (org/portal)\n\n## 증상\n## 증상\n- 14:02부터 `/requests/{id}` 응답 500\n- 에러율 42%\n\n## 관측\n- `getRequestDetail` 쿼리 타임아웃\n\n## 지시\n1. Memory MCP에서 incident_response / failure_case / prohibition 규정을 먼저 조회한다\n2. 경쟁 가설 3개 이상 수립 후 증거로 배제한다\n3. 근본 원인을 확정하고 /workspaces/session/.sdlc-reports/incident-guide.md 를 작성한다\n4. 코드 수정이 안전하면 Edit 후 POST /git/commit-push, PR 생성. 자동 머지는 절대 금지\n5. POST {portal_base_url}/api/v1/sdlc/incidents/3f1c.../analysis 로 산출물을 등록하고 status 를 갱신한다",
  "resume": true,
  "timeout_seconds": 3600,
  "system_prompt": null,
  "append_system_prompt": "이 세션은 장애 대응 세션이다. 추측을 사실로 서술하지 않는다. 증거 없는 원인 단정은 금지하며, 폐기한 가설도 반드시 기록한다. PR 자동 머지는 어떤 경우에도 수행하지 않는다.",
  "allowed_tools": "Read,Grep,Glob,Edit,Write,Bash,Task,mcp__sdlc-memory__*",
  "permission_mode": "acceptEdits",
  "mcp_servers": {
    "sdlc-memory": {
      "type": "http",
      "url": "https://sdlc-memory-mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer sdlcmem_a1b2c3d4e5f6..."
      }
    }
  },
  "output_format": "stream-json",
  "call_webhook": true,
  "stage": "4_DEV_IN_PROGRESS"
}
```

**응답** (202 Accepted — `call_webhook=true`):

```json
{ "accepted": true, "stage": "4_DEV_IN_PROGRESS" }
```

**비동기 콜백** (Pod → n8n `N8N_RUN_CALLBACK_URL`):

```json
{
  "request_id": "8c71...",
  "request_no": "SR-20260903-004",
  "event": "run.completed",
  "data": {
    "result": "근본 원인: getRequestDetail 의 N+1 쿼리 ...",
    "is_error": false,
    "exit_code": 0,
    "duration_ms": 412000,
    "claude_session_id": "sess-abc-123",
    "pod_endpoint": "http://sdlc-SR-20260903-004.bia-systems.svc.cluster.local:58001",
    "callback_token": "cb-...",
    "portal_base_url": "https://aiways-on.example.com",
    "current_stage": "4_DEV_IN_PROGRESS",
    "agent": "incident-response"
  }
}
```

**오류 응답** (Pod 실행 실패 시 콜백):

```json
{
  "request_id": "8c71...",
  "request_no": "SR-20260903-004",
  "event": "run.failed",
  "data": {
    "result": "",
    "is_error": true,
    "exit_code": 1,
    "duration_ms": 3600000,
    "error": "run timeout exceeded",
    "current_stage": "4_DEV_IN_PROGRESS",
    "agent": "incident-response"
  }
}
```

**수행 작업**:

1. n8n이 `sdlc_pod_sessions`에서 Pod endpoint·`POD_AUTH_TOKEN` 조회
2. Portal `GET /requests/{id}`로 `metadata.incidentId`·`severity`·`targetRepoIds` 확보
3. Memory MCP 토큰을 `mcp_servers.sdlc-memory.headers.Authorization`에 주입
4. `POST /run` 호출 → 202 수신 즉시 워크플로우 종료 (비동기)
5. Pod가 완료 시 `run.completed`/`run.failed` 콜백 → Workflow B 재진입

> **정정**: [06-pod-runner-api.md](./06-pod-runner-api.md) 2.4절은 콜백 `data` 키를 snake_case(`pod_endpoint`)로, 5절 예시는 camelCase(`podEndpoint`)로 적고 있으며 이벤트명도 `run.completed`와 `stage.completed`가 혼재한다. 본 문서는 이벤트명을 **`run.completed` / `run.failed`**, `data` 키를 **snake_case**로 표준화한다. 06/07의 불일치는 이 표준을 따라 정정된다.

| 필드 | 값 | 근거 |
|------|-----|------|
| `permission_mode` | `acceptEdits` | 코드 수정 허용, 단 셸 파괴 명령은 `allowed_tools`로 제한 |
| `allowed_tools` | `Read,Grep,Glob,Edit,Write,Bash,Task,mcp__sdlc-memory__*` | `--allowedTools` CSV로 직렬화됨 |
| `timeout_seconds` | `SDLC_INCIDENT_RUN_TIMEOUT_SECONDS` (3600) | Pod 기본 `RUN_TIMEOUT_SECONDS`(1800)보다 길게 요청 본문으로 오버라이드한다. Pod Deployment의 `activeDeadlineSeconds`(14400) 미만이므로 Pod 수명 안에서 종료가 보장된다 ([06-pod-runner-api.md](./06-pod-runner-api.md) 9절) |
| `resume` | `true` | 같은 Pod에서 후속 지시를 이어받기 위함 |
| `output_format` | `stream-json` | 실시간 이벤트 (`events[]`) 수집 |
| `stage` | `4_DEV_IN_PROGRESS` | Pod session의 `current_stage` 동기화 |

> **무엇을 미러링했는가**: `POST /run` 필드 구성은 [06-pod-runner-api.md](./06-pod-runner-api.md) 9절 `RunRequest` 표를 그대로 따르며, 필드를 추가하지 않는다.

### 5.2 `sdlc:incident-response` skill 동작 절차

`sdlc@mvc` 플러그인에 skill 1개를 추가한다. Pod 이미지·Dockerfile·엔드포인트 변경은 없다.

1. **규정 선조회** — `memory_search_rules(category=incident_response|failure_case|prohibition)`를 호출해 과거 동일·유사 장애와 금지 사항을 먼저 읽는다. 조회 실패 시 warn-only로 계속 진행한다
2. **후보 경로 탐색** — 증상 키워드로 Grep/Glob 수행. 에러 메시지·함수명·라우트 경로를 축으로 코드 후보를 좁힌다
3. **경쟁 가설 수립** — 최소 3개의 가설을 세우고 증거 기반으로 배제한다. 폐기한 가설은 `kind='rejected_hypothesis'`로 기록해 다음 장애의 탐색 공간을 줄인다
4. **근본 원인 확정** — `/workspaces/session/.sdlc-reports/incident-guide.md` 작성. 상세 RCA는 `incident-rca.md`로 분리한다
5. **코드 수정 (조건부)** — `SDLC_INCIDENT_ALLOW_CODE_PATCH=true` AND 수정 범위가 안전하면 Edit → `POST /git/commit-push` → `gh pr create`. **`autoPrMerge` 설정을 무시하고 자동 머지는 절대 수행하지 않는다**
6. **산출물 등록** — `POST /incidents/{id}/analysis`로 가이드·패치·폐기 가설을 등록하고, `POST /incidents/{id}/status`로 `GUIDE_READY` 또는 `PATCH_PROPOSED`로 갱신한다
7. **규정화 위임** — 사람이 `POST /incidents/{id}/resolve`를 호출하면 Portal이 `incident_response` 규정을 생성한다. skill은 규정을 직접 만들지 않는다 (단, 폐기 가설은 5절 3항대로 MCP에 직접 append)

**가설 기록 형식** (`kind='rejected_hypothesis'`의 `contentMd`):

```markdown
## 가설 2: Slack adapter 재시도 폭주로 인한 커넥션 점유

**근거**: 동시각 `sdlc_feedback_polls` 활성 건수 12건
**반증**: `audit_events`에서 해당 구간 adapter 호출 4건뿐. 커넥션 점유와 무관.
**결론**: 배제
```

> **설계 결정**: skill 추가는 Dockerfile `claude plugin install sdlc@mvc --scope user` 라인 아래에 파일이 하나 늘어나는 것뿐이다. [06-pod-runner-api.md](./06-pod-runner-api.md) 10.3절 플러그인 설치 절차는 그대로다.

### 5.3 Memory MCP 주입

`mcp_servers` dict은 Pod Runner가 `--mcp-config`로 직렬화하므로 Pod 코드 변경 없이 MCP 서버를 붙일 수 있다.

| 항목 | 내용 |
|------|------|
| 서버 이름 | `sdlc-memory` |
| 전송 방식 | `http` |
| URL | `https://sdlc-memory-mcp.example.com/mcp` — 환경 변수 `SDLC_MEMORY_MCP_URL`에서 주입. Memory MCP는 **독립 Deployment**이며 Portal 라우트가 아니다 ([13-developer-memory-agent.md](./13-developer-memory-agent.md) 6절) |
| 인증 | `Authorization: Bearer sdlcmem_*` (n8n이 주입) |
| 허용 도구 | `mcp__sdlc-memory__*` (`allowed_tools`에 포함) |
| 실패 정책 | **warn-only** — MCP 연결 실패 시 규정 없이 분석을 계속한다 |

**사용 도구**:

| 도구 | 시점 | 용도 |
|------|------|------|
| `memory_search_rules` | 1단계 | 과거 장애·금지 사항 조회 |
| `memory_append_failure_case` | 3단계 | 폐기 가설을 실패 사례로 누적 |
| `memory_get_rule` | 필요 시 | 특정 규정 전문 조회 |

> **fail-closed 예외**: MCP 실패는 fail-closed 대상이 **아니다**. [02-messaging-adapter.md](./02-messaging-adapter.md) 9절의 "adapter/messaging 실패는 warn-only이며 단계 전이를 막지 않는다" 원칙을 따른다. 규정 조회 실패가 장애 분석 자체를 막으면 안 된다.

상세한 MCP 도구 스펙과 규정 카테고리는 [13-developer-memory-agent.md](./13-developer-memory-agent.md) 참조.

### 5.4 산출물 경로·파일

| 경로 | 생성 조건 | 내용 |
|------|----------|------|
| `/workspaces/session/.sdlc-reports/incident-guide.md` | 항상 | 대응 가이드 — 즉시 조치·완화·재발 방지 |
| `/workspaces/session/.sdlc-reports/incident-rca.md` | 항상 | 근본 원인 분석 — 가설·증거·배제 근거 전문 |
| `/workspaces/session/.sdlc-reports/incident-patch-summary.md` | 코드 수정 시 | 변경 파일·diff 요약·PR 링크·리스크 |

> **무엇을 미러링했는가**: 위 3개 파일은 기존 `/workspaces/session/.sdlc-reports/{requirements,design,development,rsccb}.md` 규약을 미러링해 같은 디렉터리·같은 확장자·같은 마크다운 형식을 쓴다. 워크스페이스 루트도 `/workspaces/session` 그대로다.

---

## 6. 산출물 리포팅

### 6.1 대응 가이드

`incident-guide.md`는 사람이 즉시 실행할 수 있는 형태로 작성한다.

```markdown
# 대응 가이드 — INC-20260903-001

## 1. 근본 원인
`getRequestDetail`이 `stageHistory`를 N+1로 조회한다. SR 1건당 전이 이력 수만큼 쿼리가 발생해
전이 이력 200건 이상 SR에서 커넥션 풀을 고갈시킨다.

## 2. 즉시 조치 (5분 이내)
1. 전이 이력 200건 초과 SR 3건을 목록에서 임시 필터 → 부하 절감
2. Portal 커넥션 풀 상한을 일시 상향해 대기 타임아웃 완화

## 3. 완화 (당일)
- `getRequestDetail`에 `stageHistory` 조인 1회로 통합 (PR #128)

## 4. 재발 방지
- `sdlc_stage_transitions` 조회에 `LIMIT 50` 강제
- p99 쿼리 시간 알람 임계 3s 추가
```

### 6.2 코드 수정 PR (자동 머지 금지)

| 단계 | 동작 |
|------|------|
| 1 | Edit로 코드 수정 (`permission_mode: acceptEdits`) |
| 2 | `POST /git/commit-push` — `{message, branch, create_branch}` |
| 3 | `gh pr create`로 PR 생성 (base = repo `defaultBranch`) |
| 4 | Portal `POST /incidents/{id}/analysis` (`kind='patch'`, `prNumber`, `commitSha`) |
| 5 | incident `PATCH_PROPOSED`로 전이. **머지는 사람이 수행** |

**commit-push 요청 본문**:

```json
{
  "message": "[SDLC INC-20260903-001] getRequestDetail N+1 쿼리 제거",
  "branch": "sdlc/INC-20260903-001-fix-n1",
  "create_branch": true
}
```

**응답**:

```json
{
  "committed": true,
  "pushed": true,
  "noop": false,
  "commit_sha": "4f9a21c",
  "branch": "sdlc/INC-20260903-001-fix-n1",
  "stderr_tail": ""
}
```

> **❌ 자동 머지 금지**: `sdlc_github_repos.autoPrMerge=true`여도 incident PR은 머지하지 않는다. 장애 상황에서 검증되지 않은 수정이 자동 반영되면 2차 장애로 번진다. Portal의 `4 → 9_COMPLETE` 진입 작업(직접 Git Push·PR 생성·머지)도 `pipelineProfile=incident`에서는 머지 단계를 건너뛰고, dev 채널 결과 요약 메시지에 **`수동 머지 필요(장애 대응 정책)`** 로 표기한다 ([03-state-machine.md](./03-state-machine.md) 4.4절).

### 6.3 Slack `dev` 채널 알림

incident 프로파일은 `dev` 채널(`inc-{no}-dev`) 하나만 쓴다. 알림은 기존 `POST /channel-notification` 경로를 그대로 사용한다.

| 시점 | channelType | 내용 |
|------|-------------|------|
| SR 승격 완료 | `dev` | incident 번호·severity·증상 요약·SR 링크 |
| 분석 시작 (`TRIAGING`) | `dev` | 분석 착수 알림 (선택) |
| 가이드 산출 (`GUIDE_READY`) | `dev` | `incident-guide.md` 전문 첨부 |
| 코드 수정 (`PATCH_PROPOSED`) | `dev` | PR 링크 + `incident-patch-summary.md` |
| 종결 (`RESOLVED`) | `dev` | 예방 규정 링크 + 종결자 |

> `9_COMPLETE` 진입 시 Portal이 게시하는 **완료 결과 요약 메시지**(repo별 PR URL + 머지 상태)는 위 5종과 별개로, 상태 머신 진입 작업이 같은 `dev` 채널에 직접 게시한다 ([03-state-machine.md](./03-state-machine.md) 4.4절). incident는 그 메시지에서 항상 `수동 머지 필요(장애 대응 정책)`로 표기된다.

**`POST /channel-notification` 본문**:

```json
{
  "channelType": "dev",
  "message": "## 🔥 장애 대응 가이드 산출 — INC-20260903-001\n\n**severity**: high\n**근본 원인**: getRequestDetail N+1 쿼리\n\n### 즉시 조치\n1. stageHistory 조인 통합 배포\n2. 전이 이력 200건 초과 SR 임시 필터",
  "callbackUrl": "https://n8n.example.com/webhook/portal-feedback",
  "filePaths": ["/workspaces/session/.sdlc-reports/incident-guide.md"],
  "sendMail": true
}
```

> **무엇을 미러링했는가**: 알림 본문 구조는 [05-portal-api.md](./05-portal-api.md) 2.9절 `POST /channel-notification`을 그대로 쓴다. `channelType`에 신규 값을 만들지 않고 기존 `dev`를 재사용한다.

### 6.4 GitHub Issue comment

n8n이 Workflow B에서 기존 `Issue Comment (Stage)` 노드 패턴으로 incident 결과를 SR Issue에 남긴다.

```markdown
## 🔥 장애 대응 완료 — INC-20260903-001

**severity**: high

### 근본 원인
`getRequestDetail`의 `stageHistory` N+1 조회로 커넥션 풀 고갈.

### 배제한 가설
- Slack adapter 재시도 폭주 → audit 로그 4건뿐, 반증
- PVC I/O 병목 → netapp-nfs latency 정상, 반증

### 산출물
- 대응 가이드: `.sdlc-reports/incident-guide.md`
- RCA: `.sdlc-reports/incident-rca.md`
- 코드 수정 PR: org/portal#128 (**머지 대기 — 사람 리뷰 필수**)
```

### 6.5 `POST /incidents/{id}/analysis` 등록

**`POST /incidents/{incidentId}/analysis`** — 인증: `Bearer {SDLC_MASTER_KEY}`

Pod 또는 n8n이 분석 산출물을 등록한다.

**요청 본문**:

```json
{
  "kind": "patch",
  "contentMd": "## 변경 요약\n- src/lib/sdlc/queries.ts: stageHistory 조인 통합\n\n## 리스크\n- 조인 결과 200건 초과 시 페이지 크기 제한 필요",
  "commitSha": "4f9a21c",
  "prNumber": 128,
  "claudeSessionId": "sess-abc-123"
}
```

**응답**:

```json
{ "ok": true, "analysisId": "b2d5...", "incidentStatus": "TRIAGING" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `kind` 허용값 외 (`guide` \| `patch` \| `rejected_hypothesis`) |
| 401 | `UNAUTHORIZED` | `SDLC_MASTER_KEY` 불일치 |
| 404 | `NOT_FOUND` | incident 미존재 |
| 422 | `INCIDENT_ALREADY_RESOLVED` | incident가 `RESOLVED`/`ARCHIVED` |

**수행 작업**:

1. `SDLC_MASTER_KEY` 검증 — 라우트 핸들러 내 상수 시간 비교
2. `sdlc_incidents.requestId`로 incident ↔ SR 소속 일치 확인
3. `sdlc_incident_analyses` 삽입 (append-only, 갱신 없음)
4. `audit_events` 기록 (`action: sdlc.incident_analysis`)

> **무엇을 미러링했는가**: 토큰 검증 절차는 [05-portal-api.md](./05-portal-api.md) `POST /requests/{id}/dev-substage`의 1단계를 그대로 미러링한다. per-SR 발급 체계가 없어졌으므로 `secret_refs` 복호화 비교가 아니라 환경 변수와의 상수 시간 비교다.

---

## 7. n8n Workflow B 분기

```mermaid
flowchart TB
    FB[Feedback Webhook] --> EXT[Extract Feedback Payload]
    EXT --> IF{run.completed<br/>and feedback?}
    IF -->|true| SWP[Switch by Pipeline Profile]

    SWP -->|feature| SWSTAGE[Switch by Stage1<br/>기존 경로]

    SWP -->|incident| GETINC[GET Incident Context]
    GETINC --> INCSW{current_stage}
    INCSW -->|1_REGISTERED| ADV4[Advance to 4 incident]
    ADV4 --> RUNINC[Run Incident Response]
    INCSW -->|4_DEV_IN_PROGRESS| RESULT{코드 수정 있음?}

    RESULT -->|없음| REGGUIDE[Register Incident Guide]
    REGGUIDE --> STATG[Set Incident Status GUIDE_READY]
    STATG --> NOTIFYG[Notify Dev Channel Incident]
    NOTIFYG --> ISSUEINC[Issue Comment Incident]

    RESULT -->|있음| REGPATCH[Register Incident Patch]
    REGPATCH --> STATP[Set Incident Status PATCH_PROPOSED]
    STATP --> NOTIFYP[Notify Dev Channel Patch]
    NOTIFYP --> ISSUEINC

    ISSUEINC --> ADV9[Advance to 9]

    IF -->|run.failed| FAILINC[Set Incident Status X_FAILED]
```

**신규 노드군** (`Switch by Pipeline Profile` 이하):

| 노드 | 타입 | API/동작 |
|------|------|----------|
| `Switch by Pipeline Profile` | switch | `metadata.pipelineProfile` → `feature` / `incident` / `improvement` 분기 |
| `GET Incident Context` | httpRequest | `GET /requests/{id}` → `metadata.incidentId`·`severity`·`targetRepoIds` 추출 |
| `Advance to 4 incident` | httpRequest | `POST /advance` `{from:"1_REGISTERED", to:"4_DEV_IN_PROGRESS"}` — WF-A 전이 누락 시 멱등 재시도 (`idempotencyKey`가 동일하므로 중복 전이는 무해) |
| `Run Incident Response` | httpRequest | `POST {podEndpoint}/run` — 5.1절 페이로드 |
| `Register Incident Guide` | httpRequest | `POST /incidents/{id}/analysis` `{kind:"guide"}` |
| `Register Incident Patch` | httpRequest | `POST /incidents/{id}/analysis` `{kind:"patch"}` |
| `Set Incident Status GUIDE_READY` | httpRequest | `POST /incidents/{id}/status` |
| `Set Incident Status PATCH_PROPOSED` | httpRequest | `POST /incidents/{id}/status` |
| `Set Incident Status X_FAILED` | httpRequest | `POST /incidents/{id}/status` — `run.failed` 수신 시 |
| `Notify Dev Channel Incident` | httpRequest | `POST /channel-notification` (`channelType: dev`) |
| `Notify Dev Channel Patch` | httpRequest | `POST /channel-notification` (PR 링크 포함) |
| `Issue Comment Incident` | httpRequest | GitHub Issue comment — 6.4절 형식 |
| `Advance to 9` | httpRequest | `POST /advance` `{from:"4_DEV_IN_PROGRESS", to:"9_COMPLETE"}` — **feature·improvement 경로와 공용 단일 노드**. 가이드 전용(`GUIDE_READY`)이든 코드 수정(`PATCH_PROPOSED`)이든 목적지가 같으므로 분기하지 않는다 |

> **`Advance to 9` 단일화**: 이전 설계는 `Advance to 8 incident`(가이드 전용)와 `Advance to 5 incident`(코드 수정)를 나눴으나, 목적지가 `9_COMPLETE` 하나로 통합되면서 두 노드가 사라지고 `Issue Comment Incident` 뒤에 공용 노드 하나만 남는다 ([07-n8n-workflows.md](./07-n8n-workflows.md) 3.13절). `코드 수정 있음?` 분기는 여전히 살아 있으나 이제 **산출물 등록·상태 갱신·알림 내용**만 갈라지고 전이는 갈라지지 않는다.

> **무엇을 미러링했는가**: 노드 명명은 [07-n8n-workflows.md](./07-n8n-workflows.md) 3.1절의 기존 스타일(`Switch by Stage1`, `Advance to 9`, `Issue Comment Dev`)을 그대로 따른다. 동사+대상 영문 표기, `Advance to N` 접두, `[Portal]`/`[portal]` 접두 관례를 유지한다.

> **설계 결정**: Workflow A/B/C 개수는 3개 그대로다. Workflow B 최상단에 `Switch by Pipeline Profile` 1개를 삽입하고 `feature` 분기를 기존 `Switch by Stage1`에 그대로 연결하므로, 기존 feature 경로의 노드 구성·연결은 변경되지 않는다.

---

## 8. 데이터 모델

신규 테이블 3개를 `pgSchema('sdlc')`에 추가한다. **기존 테이블 변경은 없다.** 마이그레이션은 `drizzle-kit push`로 처리하며 마이그레이션 파일은 만들지 않는다.

> **⚠️ FK 생성 순서**: `sdlc_incidents.memoryRuleId`가 `sdlc_memory_rules`를 참조하므로 `drizzle-kit push` 시 **규정 테이블이 먼저 생성되어야 한다**. `src/db/schema/incident.ts`가 `src/db/schema/memory.ts`를 import하므로 Drizzle이 의존 순서를 해석하지만, 두 스키마 파일을 분리 배포하면 FK 생성이 실패한다. 반드시 같은 push에 포함시킨다. 스키마 파일 로딩 순서는 [04-db-schema.md](./04-db-schema.md) 12절 참조.

### 8.1 `sdlc_incidents` — 장애 레코드

```typescript
// src/db/schema/incident.ts
import { mySchema, secretRefs } from './common';
import { sdlcRequests } from './sdlc';
import { sdlcGithubRepos } from './github';
import { sdlcMemoryRules } from './memory';

export const sdlcIncidents = mySchema.table('sdlc_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentNo: varchar('incident_no', { length: 100 }).notNull(),   // INC-YYYYMMDD-NNN
  title: varchar('title', { length: 500 }).notNull(),
  severity: varchar('severity', { length: 16 }).notNull(),
  // critical | high | medium | low
  source: varchar('source', { length: 32 }).notNull().default('manual'),
  // manual | test_injection | external | monitoring
  templateId: uuid('template_id')
    .references(() => sdlcIncidentTemplates.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('DETECTED'),
  // DETECTED | TRIAGING | SR_PROMOTED | GUIDE_READY | PATCH_PROPOSED | RESOLVED | X_FAILED | ARCHIVED
  symptomMd: text('symptom_md'),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
  requestId: uuid('request_id')
    .references(() => sdlcRequests.id, { onDelete: 'set null' }),
  memoryRuleId: uuid('memory_rule_id')
    .references(() => sdlcMemoryRules.id, { onDelete: 'set null' }),
  promotionAttempts: integer('promotion_attempts').notNull().default(0),
  lastError: text('last_error'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sdlc_incidents_incident_no_idx').on(t.incidentNo),
  uniqueIndex('sdlc_incidents_dedup_key_idx').on(t.dedupKey),
  index('sdlc_incidents_status_idx').on(t.status),
  index('sdlc_incidents_request_idx').on(t.requestId),
]);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | `defaultRandom()` |
| `incident_no` | varchar(100) | `INC-YYYYMMDD-NNN` — 표시·조회 키 |
| `title` | varchar(500) | 장애 제목 |
| `severity` | varchar(16) | `critical` \| `high` \| `medium` \| `low` |
| `source` | varchar(32) | `manual` \| `test_injection` \| `external` \| `monitoring` |
| `template_id` | uuid FK | `sdlc_incident_templates` — `set null` (템플릿 삭제 시 incident 보존) |
| `status` | varchar(32) | 3절 8개 상태값 |
| `symptom_md` | text | 증상 마크다운 |
| `raw_payload` | jsonb | 모니터링 원문 페이로드 |
| `dedup_key` | varchar(255) | 중복 억제 키 (unique) |
| `request_id` | uuid FK | 승격된 SR — `set null` (SR 아카이브 시 incident 이력 보존) |
| `memory_rule_id` | uuid FK | 종결 시 생성된 예방 규정 — `set null` |
| `promotion_attempts` | integer | 승격 시도 횟수 (3회 초과 시 `X_FAILED`) |
| `last_error` | text | 마지막 승격·분석 실패 메시지 |
| `detected_at` | timestamptz | 장애 감지 시각 |
| `resolved_at` | timestamptz | 종결 시각 |
| `created_at` / `updated_at` | timestamp | `defaultNow()` |

> **무엇을 미러링했는가**: `dedupKey` uniqueIndex는 `sdlc_requests.dedupKey` 멱등성 패턴을, `lastError`는 `sdlc_repo_setup_jobs.errorMessage` 오류 보존 패턴을(`promotionAttempts`는 선례 없는 신규 컬럼 — 3절 참조), `withTimezone: true` tz 변형은 `sdlc_feedback_polls`의 tz 컬럼 관례를 미러링한다.

### 8.2 `sdlc_incident_templates` — 장애 템플릿

```typescript
export const sdlcIncidentTemplates = mySchema.table('sdlc_incident_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateKey: varchar('template_key', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 16 }).notNull().default('medium'),
  // critical | high | medium | low
  symptomMd: text('symptom_md').notNull(),
  payloadTemplate: jsonb('payload_template').$type<Record<string, unknown>>(),
  targetRepoId: uuid('target_repo_id')
    .references(() => sdlcGithubRepos.id, { onDelete: 'set null' }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sdlc_incident_templates_key_idx').on(t.templateKey),
]);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `template_key` | varchar(100) | 고유 키 (unique) |
| `name` | varchar(255) | 표시명 |
| `description` | text | 용도 설명 |
| `severity` | varchar(16) | 기본 severity |
| `symptom_md` | text | 증상 본문 (notNull) |
| `payload_template` | jsonb | `rawPayload` 기본 골격 |
| `target_repo_id` | uuid FK | 분석 대상 repo — `set null` |
| `enabled` | boolean | `false`면 주입 거부 |

> **무엇을 미러링했는가**: `templateKey` uniqueIndex + `enabled` boolean 게이트는 `sdlc_github_repos`의 `sdlc_github_repos_org_repo_idx` unique + boolean 옵션 컬럼(`runnable`/`isUi`/`playwrightEnabled`) 패턴을 미러링한다.

### 8.3 `sdlc_incident_analyses` — 분석 산출물

```typescript
export const sdlcIncidentAnalyses = mySchema.table('sdlc_incident_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').notNull()
    .references(() => sdlcIncidents.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id')
    .references(() => sdlcRequests.id, { onDelete: 'set null' }),
  kind: varchar('kind', { length: 32 }).notNull(),
  // guide | patch | rejected_hypothesis
  contentMd: text('content_md'),
  commitSha: varchar('commit_sha', { length: 64 }),
  prNumber: integer('pr_number'),
  claudeSessionId: varchar('claude_session_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('sdlc_incident_analyses_incident_idx').on(t.incidentId),
]);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `incident_id` | uuid FK notNull | 소유 incident — `cascade` |
| `request_id` | uuid FK | 산출 당시 SR — `set null` |
| `kind` | varchar(32) | `guide` \| `patch` \| `rejected_hypothesis` |
| `content_md` | text | 산출물 마크다운 |
| `commit_sha` | varchar(64) | 코드 수정 커밋 |
| `pr_number` | integer | PR 번호 |
| `claude_session_id` | varchar(255) | Pod Claude 세션 ID (재현·추적용) |
| `created_at` | timestamp | append-only 타임스탬프 (`updated_at` 없음) |

> **무엇을 미러링했는가**: `onDelete:'cascade'`를 소유 부모(`incidentId`)로, `'set null'`을 약한 참조(`requestId`)로 쓰는 정책은 [04-db-schema.md](./04-db-schema.md) 1.1절 FK cascade 정책을 미러링한다. `updated_at`을 두지 않는 append-only 형태는 `sdlc_request_images`를 미러링한다.

### 8.4 인덱스 요약

| 인덱스 | 테이블 | 종류 | 컬럼 | 용도 |
|--------|--------|------|------|------|
| `sdlc_incidents_incident_no_idx` | `sdlc_incidents` | unique | `incident_no` | 번호 조회·중복 방지 |
| `sdlc_incidents_dedup_key_idx` | `sdlc_incidents` | unique | `dedup_key` | 멱등 수집 |
| `sdlc_incidents_status_idx` | `sdlc_incidents` | index | `status` | 목록 상태 필터 |
| `sdlc_incidents_request_idx` | `sdlc_incidents` | index | `request_id` | SR ↔ incident 역참조 |
| `sdlc_incident_templates_key_idx` | `sdlc_incident_templates` | unique | `template_key` | 템플릿 키 조회 |
| `sdlc_incident_analyses_incident_idx` | `sdlc_incident_analyses` | index | `incident_id` | 상세 페이지 `analyses[]` 로딩 |

> **기존 테이블 인덱스 변경 0건**: incident 도입으로 재정의되는 기존 인덱스는 없다. 신규 테이블 3개의 인덱스 6개만 추가된다.

---

## 9. Portal API

Base는 `/api/v1/sdlc`. 오류 포맷은 기존 `{code, message}`를 그대로 쓴다. 목록 응답은 `{items,total,page,limit}`, 관리자 목록은 bare array다.

### 9.1 장애 수집·조회

**`POST /incidents/ingest`** — 인증: `Bearer {SDLC_MASTER_KEY}`

2.1절 참조.

**`POST /incidents/inject`** — 인증: 세션 (admin)

2.2절 참조.

**`GET /incidents?status=&severity=&page=&limit=`** — 인증: 세션 (user)

장애 목록을 조회한다. 오프셋 페이지네이션.

**요청 본문**: 없음 (쿼리 파라미터)

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `status` | 상태 필터 (3절 8개 값) | 전체 (`ARCHIVED` 제외) |
| `severity` | severity 필터 | 전체 |
| `page` | 페이지 | 1 |
| `limit` | 페이지 크기 | 20 |

**응답**:

```json
{
  "items": [
    {
      "incidentId": "3f1c...",
      "incidentNo": "INC-20260903-001",
      "title": "SR 상세 페이지 500 에러 급증",
      "severity": "high",
      "source": "monitoring",
      "status": "PATCH_PROPOSED",
      "requestNo": "SR-20260903-004",
      "detectedAt": "2026-09-03T14:02:00Z",
      "resolvedAt": null
    }
  ],
  "total": 17,
  "page": 1,
  "limit": 20
}
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 400 | `VALIDATION_ERROR` | `status`/`severity` 허용값 외 |

**수행 작업**:

1. `requireUser()` 통과 확인
2. `sdlc_incidents_status_idx` 활용 필터 쿼리
3. `requestId` 조인으로 `requestNo` 병합
4. `ARCHIVED`는 명시 필터 없으면 제외

---

**`GET /incidents/{incidentId}`** — 인증: 세션 (user)

장애 상세 + 분석 산출물 + 승격된 SR 정보를 조합해 반환한다.

**응답**:

```json
{
  "incidentId": "3f1c...",
  "incidentNo": "INC-20260903-001",
  "title": "SR 상세 페이지 500 에러 급증",
  "severity": "high",
  "source": "monitoring",
  "status": "PATCH_PROPOSED",
  "symptomMd": "## 증상\n- 14:02부터 ...",
  "rawPayloadFingerprint": "sha256:9c1f...",
  "dedupKey": "requests-detail-500:20260903",
  "promotionAttempts": 1,
  "lastError": null,
  "detectedAt": "2026-09-03T14:02:00Z",
  "resolvedAt": null,
  "memoryRuleId": null,
  "request": {
    "requestId": "8c71...",
    "requestNo": "SR-20260903-004",
    "status": "4_DEV_IN_PROGRESS",
    "pipelineProfile": "incident",
    "podStatus": "RUNNING"
  },
  "analyses": [
    {
      "analysisId": "b2d5...",
      "kind": "guide",
      "contentMd": "# 대응 가이드 — INC-20260903-001\n...",
      "commitSha": null,
      "prNumber": null,
      "claudeSessionId": "sess-abc-123",
      "createdAt": "2026-09-03T14:18:00Z"
    },
    {
      "analysisId": "c9f0...",
      "kind": "rejected_hypothesis",
      "contentMd": "## 가설 2: Slack adapter 재시도 폭주\n...",
      "createdAt": "2026-09-03T14:15:00Z"
    }
  ]
}
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 401 | `UNAUTHORIZED` | 세션 없음 |
| 404 | `NOT_FOUND` | incident 미존재 |

**수행 작업**:

1. `requireUser()` 통과 확인
2. `sdlc_incidents` 조회 → `rawPayload`는 전문 대신 `sha256` 지문만 반환
3. `sdlc_incident_analyses`를 `createdAt ASC`로 조회
4. `requestId`가 있으면 `sdlc_requests` + `sdlc_pod_sessions` 조인

> **⚠️ rawPayload 비노출**: 모니터링 원문에 자격증명·내부 호스트명이 섞일 수 있으므로 상세 API는 `rawPayloadFingerprint`만 반환한다. 원문은 DB에만 남는다.

### 9.2 승격·상태·종결

**`POST /incidents/{incidentId}/promote`** — 인증: 세션 (admin)

auto-promote가 꺼져 있거나 실패한 incident를 수동으로 SR 승격한다.

**요청 본문**: 없음

**응답** (201 Created — 즉시 프로비저닝):

```json
{ "requestNo": "SR-20260903-004", "status": "1_REGISTERED" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 403 | `FORBIDDEN` | admin 아님, 또는 `SDLC_INCIDENT_ENABLED=false` |
| 404 | `NOT_FOUND` | incident 미존재 |
| 422 | `INCIDENT_NOT_PROMOTABLE` | 이미 승격됨(`requestId` 존재) 또는 종결됨(`RESOLVED`/`ARCHIVED`) |

> **응답은 201 하나다**: 자원 게이트·대기 큐가 없으므로 승격이 보류되는 202 경로가 존재하지 않는다. 승격은 즉시 성공(201)하거나 오류를 반환한다 (4.4절과 동일).

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `INCIDENT_NOT_PROMOTABLE` 조건 검사
3. `generateRequestNo()`로 `SR-YYYYMMDD-NNN` 발급 (`getNextSequence(ymd)` 재사용)
4. 4.1절 페이로드로 `POST /intake` 호출 — SR 등록 직후 채널·Pod 생성까지 단일 흐름
5. 201 시 `sdlc_incidents.requestId` 저장 + `status='SR_PROMOTED'`
6. 실패 시 `status='DETECTED'` 유지 + `promotionAttempts += 1`, `lastError` 기록. 3회 초과 시 `X_FAILED`

> **멱등**: `dedupKey = incidentNo`이므로 동일 incident를 두 번 승격해도 intake의 `ON CONFLICT DO NOTHING`이 SR 중복을 막는다.

---

**`POST /incidents/{incidentId}/analysis`** — 인증: `Bearer {SDLC_MASTER_KEY}`

6.5절 참조.

---

**`POST /incidents/{incidentId}/status`** — 인증: `Bearer {SDLC_MASTER_KEY}`

Pod 또는 n8n이 incident 상태를 갱신한다.

**요청 본문**:

```json
{ "status": "PATCH_PROPOSED", "note": "PR org/portal#128 생성 완료" }
```

**응답**:

```json
{ "ok": true, "incidentNo": "INC-20260903-001", "status": "PATCH_PROPOSED" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `status`가 `TRIAGING`/`GUIDE_READY`/`PATCH_PROPOSED`/`X_FAILED` 외 |
| 401 | `UNAUTHORIZED` | `SDLC_MASTER_KEY` 불일치 |
| 404 | `NOT_FOUND` | incident 미존재 |
| 422 | `INCIDENT_ALREADY_RESOLVED` | `RESOLVED`/`ARCHIVED` 상태 |

**수행 작업**:

1. `SDLC_MASTER_KEY` 검증 (라우트 핸들러 내 상수 시간 비교)
2. 3절 전이 조건 표에 따른 합법성 검사
3. `sdlc_incidents.status` 갱신 + `X_FAILED` 시 `lastError`에 `note` 기록
4. `audit_events` 기록 (`action: sdlc.incident_status`)

> **fail-closed**: 콜백 토큰으로 `RESOLVED`/`ARCHIVED`로는 전이할 수 없다. 종결은 사람(admin 세션)만 수행한다.

---

**`POST /incidents/{incidentId}/resolve`** — 인증: 세션 (admin)

장애를 종결하고 예방 규정을 등록한다.

**요청 본문**:

```json
{
  "preventionMd": "## 예방 규정\n- `sdlc_stage_transitions` 조회는 항상 `LIMIT 50`을 강제한다\n- 신규 상세 쿼리는 N+1 여부를 코드리뷰 체크리스트에 포함한다",
  "registerMemoryRule": true
}
```

**응답**:

```json
{ "ok": true, "memoryRuleId": "d41a...", "status": "RESOLVED" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `registerMemoryRule=true`인데 `preventionMd` 누락 |
| 403 | `FORBIDDEN` | admin 아님 |
| 404 | `NOT_FOUND` | incident 미존재 |
| 422 | `INCIDENT_ALREADY_RESOLVED` | 이미 `RESOLVED`/`ARCHIVED` |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `sdlc_incidents.status='RESOLVED'`, `resolvedAt=now()` 갱신
3. `registerMemoryRule=true`면 `POST /api/internal/sdlc/memory/rules` 호출 (13절 통합 규격)
4. 반환된 규정 ID를 `sdlc_incidents.memoryRuleId`에 역참조 저장
5. dev 채널에 종결 알림 (`POST /channel-notification`) — **실패는 warn-only, 종결을 막지 않는다**
6. `audit_events` 기록 (`action: sdlc.incident_resolved`)

---

**`POST /incidents/{incidentId}/archive`** — 인증: 세션 (admin)

오탐·폐기 incident를 논리 삭제한다.

**요청 본문**:

```json
{ "reason": "모니터링 임계 오설정으로 인한 오탐" }
```

**응답**:

```json
{ "ok": true, "incidentNo": "INC-20260903-003", "status": "ARCHIVED" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 403 | `FORBIDDEN` | admin 아님 |
| 404 | `NOT_FOUND` | incident 미존재 |
| 422 | `INCIDENT_ALREADY_RESOLVED` | 이미 `RESOLVED` — 종결된 이력은 아카이브하지 않는다 |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `status='ARCHIVED'` 갱신 — **레코드는 물리 삭제하지 않는다**
3. 승격된 SR이 있으면 SR은 그대로 유지 (Stage 전이 없음)
4. `audit_events` 기록 (`action: sdlc.incident_archived`, `metadata.reason`)

> **무엇을 미러링했는가**: `archive` = 논리 삭제 관례는 [05-portal-api.md](./05-portal-api.md) 1절에 정의된 POST-only RPC 관례(`POST /{resource}/{id}/archive`)를 그대로 따른다. 물리 DELETE는 어디에도 없다.

### 9.3 템플릿 관리

**`GET /incident-templates`** — 인증: 세션 (admin)

템플릿 전체 목록을 반환한다. 관리자 목록 관례에 따라 **bare array**다.

**응답**:

```json
[
  {
    "id": "5e8b...",
    "templateKey": "portal-db-timeout",
    "name": "Portal DB 커넥션 타임아웃",
    "severity": "high",
    "targetRepoId": "9a2e...",
    "enabled": true,
    "createdAt": "2026-09-01T09:00:00Z"
  }
]
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 403 | `FORBIDDEN` | admin 아님 |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `sdlc_incident_templates` 전체 조회 (`createdAt DESC`)

---

**`POST /incident-templates`** — 인증: 세션 (admin)

템플릿을 등록한다.

**요청 본문**:

```json
{
  "templateKey": "portal-db-timeout",
  "name": "Portal DB 커넥션 타임아웃",
  "description": "Drizzle 커넥션 풀 고갈 시나리오 검증용",
  "severity": "high",
  "symptomMd": "## 증상\n- `pool timeout exceeded` 로그 급증",
  "payloadTemplate": { "metric": "db_pool_wait_ms", "threshold": 5000 },
  "targetRepoId": "9a2e...",
  "enabled": true
}
```

**응답**:

```json
{ "ok": true, "id": "5e8b...", "templateKey": "portal-db-timeout" }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | `templateKey`/`name`/`symptomMd` 누락 |
| 403 | `FORBIDDEN` | admin 아님 |
| 404 | `NOT_FOUND` | `targetRepoId` 미존재 |
| 409 | `INCIDENT_DUPLICATE` | `templateKey` 중복 (`sdlc_incident_templates_key_idx`) |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `sdlc_incident_templates` 삽입
3. `audit_events` 기록 (`action: sdlc.incident_template_created`)

---

**`POST /incident-templates/{templateId}/update`** — 인증: 세션 (admin)

템플릿을 수정한다. PUT/PATCH가 시스템 전체에 없으므로 POST-only RPC 관례를 따른다.

**요청 본문** (부분 갱신):

```json
{ "severity": "critical", "enabled": false }
```

**응답**:

```json
{ "ok": true, "id": "5e8b...", "updated": ["severity", "enabled"] }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 갱신 필드 없음 또는 허용값 외 |
| 403 | `FORBIDDEN` | admin 아님 |
| 404 | `NOT_FOUND` | 템플릿 미존재 |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. 전달된 필드만 갱신 + `updatedAt` 갱신
3. `audit_events` 기록 (`action: sdlc.incident_template_updated`)

---

**`POST /incident-templates/{templateId}/archive`** — 인증: 세션 (admin)

템플릿을 논리 삭제한다 (`enabled=false` + 목록 제외 표시).

**요청 본문**: 없음

**응답**:

```json
{ "ok": true, "id": "5e8b...", "archived": true }
```

**오류 응답**:

| HTTP | code | 설명 |
|------|------|------|
| 403 | `FORBIDDEN` | admin 아님 |
| 404 | `NOT_FOUND` | 템플릿 미존재 |

**수행 작업**:

1. `requireAdmin()` 통과 확인
2. `enabled=false` 갱신 — 이 템플릿을 참조하는 incident의 `templateId`는 유지 (`set null`은 물리 삭제 시에만)
3. `audit_events` 기록 (`action: sdlc.incident_template_archived`)

### 9.4 신규 오류 코드

| code | HTTP | 설명 |
|------|------|------|
| `INCIDENT_DUPLICATE` | 409 | dedup 윈도 내 동일 `dedupKey` / `templateKey` 중복 |
| `INCIDENT_NOT_PROMOTABLE` | 422 | 이미 승격됨 또는 종결됨 |
| `TEMPLATE_DISABLED` | 422 | 템플릿 `enabled=false` |
| `INCIDENT_ALREADY_RESOLVED` | 422 | incident가 `RESOLVED`/`ARCHIVED` |

**재사용 코드**: `VALIDATION_ERROR`(400), `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `INTERNAL_ERROR`(500).

> **무엇을 미러링했는가**: 신규 코드 4개 모두 기존 HTTP 매핑 관례(중복=409, 상태 위반=422)를 미러링한다. [05-portal-api.md](./05-portal-api.md) 7절 에러 코드 표에 4행이 추가된다.

### 9.5 엔드포인트 인증 매트릭스

| 엔드포인트 | 인증 방식 | 호출자 |
|-----------|----------|-------|
| `POST /incidents/ingest` | Bearer `SDLC_MASTER_KEY` | 외부 모니터링 |
| `POST /incidents/inject` | 세션 (admin) + `SDLC_INCIDENT_ALLOW_TEST_INJECTION=true` | UI `/incidents/inject` |
| `GET /incidents` | 세션 (user) | UI 목록 |
| `GET /incidents/{id}` | 세션 (user) | UI 상세 |
| `POST /incidents/{id}/promote` | 세션 (admin) | UI 버튼 |
| `POST /incidents/{id}/analysis` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /incidents/{id}/status` | Bearer `SDLC_MASTER_KEY` | Pod / n8n WF-B |
| `POST /incidents/{id}/resolve` | 세션 (admin) | UI 버튼 |
| `POST /incidents/{id}/archive` | 세션 (admin) | UI 버튼 |
| `GET /incident-templates` | 세션 (admin) | UI 관리 |
| `POST /incident-templates` | 세션 (admin) | UI 관리 |
| `POST /incident-templates/{id}/update` | 세션 (admin) | UI 관리 |
| `POST /incident-templates/{id}/archive` | 세션 (admin) | UI 관리 |

> **설계 결정**: **신규 인증 메커니즘은 0개다.** 서버간 호출은 전부 `SDLC_MASTER_KEY` 단일 키를, 사람 조작은 기존 세션 쿠키(`requireUser()`/`requireAdmin()`)를 재사용한다 ([05-portal-api.md](./05-portal-api.md) 1절 토큰 카탈로그 정본).
>
> **잔존 위험**: 외부 모니터링에 배포하는 ingest 키와 Portal 내부 호출 키가 같은 값이므로, 모니터링 측에서 키가 유출되면 `/analysis`·`/status` 등 다른 경로도 함께 노출된다. 회전 시 Portal·n8n·Pod·외부 모니터링을 동시에 갱신해야 한다.

---

## 10. Portal UI

### 10.1 라우트 구성

```
src/app/
├── (dashboard)/
│   ├── incidents/
│   │   ├── page.tsx                 # 장애 목록
│   │   ├── [id]/page.tsx            # 장애 상세 (상태 레일 + analyses)
│   │   ├── inject/page.tsx          # Test 트리거 주입 (admin 전용)
│   │   └── actions.ts               # 서버 액션 4개
└── (admin)/
    └── incident-templates/
        ├── page.tsx                 # 템플릿 관리
        └── actions.ts               # 템플릿 CRUD 서버 액션
```

> **무엇을 미러링했는가**: 라우트 그룹 배치는 [08-sr-registration-ui.md](./08-sr-registration-ui.md) 2.2절의 `(dashboard)` / `(admin)` 분리와 콜로케이션 `actions.ts` 관례를 미러링한다.

### 10.2 사이드바

사이드바에 **`장애 대응`** 항목을 추가한다. 상단 네비게이션은 만들지 않는다.

| 순서 | 항목 | 경로 | 권한 |
|------|------|------|------|
| 1 | 대시보드 | `/` | user |
| 2 | SR 등록 | `/register` | user |
| 3 | 내 요청 | `/requests` | user |
| 4 | **장애 대응** | `/incidents` | user |
| 5 | 관리 | `/admin/*` | admin |

> **✅ No Top Nav 유지**: 전역 컨트롤은 전부 사이드바에 통합한다. `장애 대응` 진입 후 `Test 트리거 주입`·`템플릿 관리`는 페이지 내부 버튼으로 노출하며 별도 상단 바를 만들지 않는다.

### 10.3 장애 목록 (`/incidents`)

```
┌─────────────────────────────────────────────────────────┐
│  사이드바  │  장애 대응                                   │
│            │  ───────────────────────────────────────────  │
│  • 대시보드│  [필터]                                       │
│  • SR 등록 │  상태 [전체 ▾]  등급 [전체 ▾]                │
│  • 내 요청 │                        [Test 트리거 주입]     │
│ ▎장애 대응 │                                              │
│  • 관리    │  ┌──────────────────────────────────────┐   │
│            │  │ INC-20260903-001  HIGH   PATCH_PROP  │   │
│            │  │ SR 상세 500 급증                     │   │
│            │  │ SR-20260903-004    14:02             │   │
│            │  ├──────────────────────────────────────┤   │
│            │  │ INC-20260903-002  MED    GUIDE_READY │   │
│            │  │ [TEST] DB 풀 고갈                     │   │
│            │  ├──────────────────────────────────────┤   │
│            │  │ INC-20260902-007  LOW    RESOLVED    │   │
│            │  └──────────────────────────────────────┘   │
│            │             ‹ 1 2 3 ›                        │
└─────────────────────────────────────────────────────────┘
```

| 컬럼 | 내용 | 서식 |
|------|------|------|
| 장애 번호 | `incidentNo` | `font-mono-id` |
| 등급 | `severity` 배지 | `label-tech` + severity 매핑 |
| 상태 | `status` 배지 | `label-tech` + status 매핑 |
| 제목 | `title` | `font-body` |
| SR | `requestNo` 링크 | `font-mono-id` |
| 감지 시각 | `detectedAt` | 상대 시각 |

### 10.4 Test 트리거 주입 (`/incidents/inject`)

admin 전용 페이지. 서버 컴포넌트 최상단에서 `requireAdmin()` **AND** `SDLC_INCIDENT_ALLOW_TEST_INJECTION=true`를 먼저 검사하고, 둘 중 하나라도 불충족이면 403 `FORBIDDEN`을 반환한다.

```
┌─────────────────────────────────────────────────────────┐
│  사이드바  │  Test 트리거 주입                    [ADMIN] │
│            │  ───────────────────────────────────────────  │
│ ▎장애 대응 │  템플릿      [portal-db-timeout ▾]           │
│            │  제목 *      [[TEST] DB 커넥션 풀 고갈___]   │
│            │  등급 *      [high ▾]                        │
│            │  대상 repo   [org/portal ▾]                  │
│            │  증상 (마크다운)                             │
│            │  ┌──────────────────────────────────────┐   │
│            │  │ ## 증상                              │   │
│            │  │ - 커넥션 풀 대기 타임아웃 다발        │   │
│            │  └──────────────────────────────────────┘   │
│            │  자동 SR 승격  [──● ]  OFF                   │
│            │                                              │
│            │            [장애 발생 트리거]                │
└─────────────────────────────────────────────────────────┘
```

| 컨트롤 | shadcn 컴포넌트 | 동작 |
|--------|----------------|------|
| 템플릿 | `Select` | 선택 시 나머지 필드 자동 채움 (`enabled=false`는 목록 제외) |
| 제목 | `Input` | 필수 |
| 등급 | `Select` | `critical` / `high` / `medium` / `low` |
| 대상 repo | `Select` | `GET /repos` 결과 |
| 증상 | `Textarea` | 마크다운 |
| 자동 SR 승격 | `Switch` | `autoPromote` |
| 트리거 | `Button` | `AlertDialog` 확인 후 `injectIncident` 호출 |

**AlertDialog 문구**:

```
장애를 실제로 발생시킵니다.

등급: high
자동 SR 승격: ON  → SR이 즉시 생성되고 Pod가 프로비저닝됩니다.

계속하시겠습니까?          [취소]  [트리거 실행]
```

> **⚠️ 프로덕션 봉인**: 이 페이지는 `SDLC_INCIDENT_ALLOW_TEST_INJECTION=false`(기본값)일 때 진입 버튼이 숨고 직접 접근 시 403 `FORBIDDEN`을 반환한다. `SDLC_INCIDENT_ENABLED=false`이면 `장애 대응` 자체가 사이드바에서 숨는다. 상세는 13절 참조.

### 10.5 장애 상세 (`/incidents/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│  사이드바  │  INC-20260903-001              HIGH          │
│            │  ───────────────────────────────────────────  │
│ ▎장애 대응 │  DETECTED ─ SR_PROMOTED ─▎TRIAGING─ PATCH ─  │
│            │                                     RESOLVED │
│            │  ┌─ 개요 ─────────────────────────────────┐  │
│            │  │ 출처    monitoring                     │  │
│            │  │ 감지    2026-09-03 14:02               │  │
│            │  │ SR      SR-20260903-004 →              │  │
│            │  └────────────────────────────────────────┘  │
│            │  ┌─ 증상 ─────────────────────────────────┐  │
│            │  │ ## 증상                                │  │
│            │  │ - 14:02부터 /requests/{id} 응답 500    │  │
│            │  └────────────────────────────────────────┘  │
│            │  분석 산출물                                 │
│            │  ▾ [GUIDE] 대응 가이드         14:18         │
│            │  ▸ [PATCH] PR org/portal#128   14:31         │
│            │  ▸ [배제]  Slack adapter 가설  14:15         │
│            │                                              │
│            │            [승격]        [종결]              │
└─────────────────────────────────────────────────────────┘
```

| 요소 | 컴포넌트 | 내용 |
|------|----------|------|
| 상태 레일 | 커스텀 + `Progress` | 8개 상태 중 현재 위치 강조 (사이드바 active와 동일한 cyan blade 토큰) |
| 개요 | `Card` | 출처·감지 시각·SR 링크 |
| 증상 | `Card` | `symptomMd` 마크다운 렌더 |
| 분석 산출물 | `Accordion` | `analyses[]` — `kind` 배지 + 생성 시각 + `contentMd` |
| 승격 | `Button` + `AlertDialog` | `DETECTED`일 때만 활성 (admin) |
| 종결 | `Button` + `Dialog` | `GUIDE_READY`/`PATCH_PROPOSED`일 때만 활성 (admin), `preventionMd` 입력 + `registerMemoryRule` Switch |
| 폴링 | — | **10초 간격** 재조회 — `TRIAGING` 상태에서 산출물 실시간 반영 |

### 10.6 shadcn/ui 컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| `Table` | 장애 목록, 템플릿 목록 |
| `Card` | 개요·증상·통계 섹션 |
| `Badge` | severity·status·kind 배지 |
| `Dialog` | 종결 모달, 템플릿 등록·수정 모달 |
| `AlertDialog` | 트리거 주입 확인, 승격 확인, 아카이브 확인 |
| `Select` | 템플릿·등급·시스템·repo 선택 |
| `Textarea` | 증상·예방 규정 마크다운 입력 |
| `Switch` | `autoPromote`, `registerMemoryRule`, 템플릿 `enabled` |
| `Accordion` | `analyses[]` 펼침 |
| `Progress` | 상태 레일 진행도 |
| `Button` | 트리거·승격·종결·아카이브 |
| `Toast` | 서버 액션 결과 알림 |

> **무엇을 미러링했는가**: 컴포넌트 표 형식과 `Toast` 소비 방식은 [08-sr-registration-ui.md](./08-sr-registration-ui.md) 9절을 미러링한다. 신규 컴포넌트는 `AlertDialog`·`Switch`·`Accordion`·`Progress` 4개다.

### 10.7 서버 액션

```typescript
// src/app/(dashboard)/incidents/actions.ts
'use server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth/guards';
import { env } from '@/env';

type ActionResult<T> = ({ success: true } & T) | { success: false; error: string };

export async function injectIncident(
  formData: FormData,
): Promise<ActionResult<{ incidentNo: string; promoted: boolean }>> {
  await requireAdmin();

  const payload = {
    templateKey: formData.get('templateKey') ? String(formData.get('templateKey')) : undefined,
    title: String(formData.get('title')),
    severity: String(formData.get('severity')),
    symptomMd: formData.get('symptomMd') ? String(formData.get('symptomMd')) : undefined,
    targetRepoId: formData.get('targetRepoId') ? String(formData.get('targetRepoId')) : undefined,
    autoPromote: formData.get('autoPromote') === 'on',
  };

  const res = await fetch(`${env.PORTAL_BASE_URL}/api/v1/sdlc/incidents/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies().toString() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    return { success: false, error: err.message };
  }
  const data = await res.json();
  return { success: true, incidentNo: data.incidentNo, promoted: data.promoted };
}

export async function promoteIncident(incidentId: string): Promise<ActionResult<{ requestNo: string }>> {
  await requireAdmin();
  const res = await fetch(
    `${env.PORTAL_BASE_URL}/api/v1/sdlc/incidents/${incidentId}/promote`,
    { method: 'POST', headers: { Cookie: cookies().toString() } },
  );
  if (!res.ok) return { success: false, error: (await res.json()).message };
  const data = await res.json();
  return { success: true, requestNo: data.requestNo };
}

export async function resolveIncident(
  incidentId: string,
  preventionMd: string,
  registerMemoryRule: boolean,
): Promise<ActionResult<{ memoryRuleId: string | null }>> {
  await requireAdmin();
  const res = await fetch(
    `${env.PORTAL_BASE_URL}/api/v1/sdlc/incidents/${incidentId}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies().toString() },
      body: JSON.stringify({ preventionMd, registerMemoryRule }),
    },
  );
  if (!res.ok) return { success: false, error: (await res.json()).message };
  const data = await res.json();
  return { success: true, memoryRuleId: data.memoryRuleId ?? null };
}

export async function archiveIncident(
  incidentId: string,
  reason: string,
): Promise<ActionResult<{ archived: boolean }>> {
  await requireAdmin();
  const res = await fetch(
    `${env.PORTAL_BASE_URL}/api/v1/sdlc/incidents/${incidentId}/archive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies().toString() },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) return { success: false, error: (await res.json()).message };
  return { success: true, archived: true };
}
```

| 서버 액션 | 가드 | 대상 엔드포인트 |
|-----------|------|----------------|
| `injectIncident` | `requireAdmin()` | `POST /incidents/inject` |
| `promoteIncident` | `requireAdmin()` | `POST /incidents/{id}/promote` |
| `resolveIncident` | `requireAdmin()` | `POST /incidents/{id}/resolve` |
| `archiveIncident` | `requireAdmin()` | `POST /incidents/{id}/archive` |

> **무엇을 미러링했는가**: `'use server'` + 가드 선행 + `Cookie: cookies().toString()` 전달 + 판별 유니온 `{success:true,...}|{success:false,error}` 반환은 [08-sr-registration-ui.md](./08-sr-registration-ui.md) 4.1절 `submitSdlcRequest`를 미러링한다. `Date.now()`는 서버 측에서만 호출한다.

### 10.8 배지 매핑

**severity 배지**:

| 등급 | 배지 스타일 |
|------|-----------|
| `critical` | `label-tech` error accent |
| `high` | `label-tech` warning accent |
| `medium` | `label-tech` accent |
| `low` | `label-tech` `text-on-surface-variant` |

**status 배지**:

| 상태 | 배지 스타일 |
|------|-----------|
| `DETECTED` | `label-tech` `text-on-surface-variant` (대기) |
| `SR_PROMOTED` | `label-tech` accent (진행 중) |
| `TRIAGING` | `label-tech` accent (진행 중) |
| `GUIDE_READY` | `label-tech` accent (산출 완료) |
| `PATCH_PROPOSED` | `label-tech` warning accent (사람 리뷰 대기) |
| `RESOLVED` | `label-tech` success accent |
| `X_FAILED` | `label-tech` error accent |
| `ARCHIVED` | `label-tech` `text-on-surface-variant` |

> **무엇을 미러링했는가**: 배지 매핑 표는 [08-sr-registration-ui.md](./08-sr-registration-ui.md) 7절 "상태 배지 색상 매핑"의 accent 등급 체계(진행=accent, 성공=success accent, 경고=warning accent, 실패=error accent, 대기=`text-on-surface-variant`)를 그대로 미러링한다. 신규 색 토큰은 도입하지 않는다.

---

## 11. 흐름도

```mermaid
sequenceDiagram
    autonumber
    participant MON as 모니터링
    participant U as 사용자
    participant P as Portal
    participant DB as PostgreSQL
    participant K8S as Kubernetes
    participant N as n8n
    participant POD as SDLC Pod
    participant MEM as Memory MCP
    participant GH as GitHub
    participant SL as Slack

    alt 외부 모니터링 트리거
        MON->>P: POST /incidents/ingest
        note over P: Bearer SDLC_MASTER_KEY<br/>dedupKey 멱등 검사
    else Test 트리거 주입
        U->>P: injectIncident (서버 액션)
        note over P: requireAdmin()<br/>templateKey 병합
    end

    P->>DB: sdlc_incidents 삽입 (status=DETECTED)
    note over DB: ON CONFLICT DO NOTHING<br/>sdlc_incidents_dedup_key_idx

    alt severity < AUTO_PROMOTE_MIN_SEVERITY
        P-->>MON: 201 { status: "DETECTED", promoted: false }
        note over U: admin이 UI에서 수동 승격
    else auto-promote 대상
        P->>P: generateRequestNo() → SR-YYYYMMDD-NNN
        P->>P: POST /intake (pipelineProfile=incident)

        P->>SL: dev 채널 1개만 생성
        note over SL: inc-{no}-dev<br/>requirements/design 미생성
        P->>K8S: Pod 생성 (sdlc-{requestNo})
        K8S-->>P: Pod endpoint
        P->>DB: sdlc_pod_sessions + sdlc_messaging_channels
        P->>DB: sdlc_incidents.requestId 저장 (status=SR_PROMOTED)
        P->>N: POST /webhook/sdlc-intake

        N->>POD: POST /clone
        POD->>GH: repo clone
        POD-->>N: cloned_repos
        N->>P: POST /requests/{id}/issues
        P->>GH: ensureIssueCreated
        GH-->>P: issue number
        P-->>N: issues 배열

        N->>P: POST /advance (1_REGISTERED → 4_DEV_IN_PROGRESS)
        note over P: 조건부 전이<br/>pipelineProfile=incident 검증

        N->>POD: POST /run (sdlc:incident-response)
        note over POD: permission_mode=acceptEdits<br/>mcp_servers.sdlc-memory 주입<br/>call_webhook=true
        POD-->>N: 202 { accepted: true }

        POD->>MEM: memory_search_rules(incident_response)
        MEM-->>POD: 과거 장애·금지 규정
        POD->>P: POST /incidents/{id}/status (TRIAGING)

        loop 가설 배제 (3개 이상)
            POD->>POD: Grep/Glob 후보 탐색 + 증거 수집
            POD->>P: POST /incidents/{id}/analysis (rejected_hypothesis)
            POD->>MEM: memory_append_failure_case
        end

        POD->>POD: incident-guide.md / incident-rca.md 작성
        POD->>P: POST /incidents/{id}/analysis (kind=guide)

        alt 코드 수정 안전 + ALLOW_CODE_PATCH=true
            POD->>POD: Edit 코드 수정
            POD->>POD: POST /git/commit-push
            POD->>P: POST /incidents/{id}/analysis (kind=patch)
            POD->>P: POST /incidents/{id}/status (PATCH_PROPOSED)
        else 가이드 전용
            POD->>P: POST /incidents/{id}/status (GUIDE_READY)
        end

        POD->>N: run.completed (data.agent=incident-response)
        N->>N: Switch by Pipeline Profile → incident
        N->>P: POST /channel-notification (dev)
        P->>SL: 대응 가이드 게시
        N->>GH: Issue Comment (근본 원인 + 배제 가설)

        N->>P: POST /advance (4_DEV_IN_PROGRESS → 9_COMPLETE)
        note over P: 전 프로파일 공통 전이<br/>가이드 전용·코드 수정 구분 없음

        P->>GH: repo 루프 — commit 이력 판정
        alt commit 있음
            P->>GH: git push + ensurePullRequest
            note over GH: ❌ 자동 머지 금지<br/>autoPrMerge=true여도 PR만 생성
        else commit 없음
            P->>GH: issue close + branch 삭제 (PR 미생성)
        end
        P->>SL: 완료 결과 요약 게시
        note over SL: repo별 PR URL +<br/>수동 머지 필요(장애 대응 정책)
        P->>K8S: Pod 종료 + feedback poll 비활성화

        U->>P: resolveIncident (preventionMd, registerMemoryRule)
        note over P: requireAdmin()
        P->>P: POST /api/internal/sdlc/memory/rules
        note over P: category=incident_response<br/>slug=inc-{incidentNo}-{title}
        P->>DB: sdlc_incidents.memoryRuleId 역참조 + status=RESOLVED
        P->>SL: 종결 알림 (warn-only)
        P-->>U: { ok: true, memoryRuleId }
    end
```

> **fail-closed**: 승격은 `SDLC_INCIDENT_ENABLED` 봉인을 우회하지 않는다. 플래그가 `false`면 `critical` 장애도 ingest·inject·승격 전부 403이다. 자원 여유에 따른 대기 경로는 존재하지 않는다.

> **멱등**: 같은 알람이 반복 도착해도 `sdlc_incidents_dedup_key_idx` → `dedupKey = incidentNo` → intake `ON CONFLICT DO NOTHING` 3중 게이트로 SR이 중복 생성되지 않는다.

---

## 12. K8s·환경 변수

K8s 매니페스트 신규 추가는 없다. Portal Deployment의 ConfigMap/Secret에 값만 더한다.

### 12.1 환경 변수

| 변수 | 필수 | 기본값 | 용도 |
|------|------|--------|------|
| `SDLC_INCIDENT_ENABLED` | | `true` | 장애 대응 파이프라인 **전체** on/off. `false`면 ingest·inject·승격 모두 403. 주입만 막을 때는 이 값 대신 `SDLC_INCIDENT_ALLOW_TEST_INJECTION`을 쓴다 |
| `SDLC_INCIDENT_AUTO_PROMOTE` | | `true` | ingest 시 자동 SR 승격 여부 |
| `SDLC_INCIDENT_AUTO_PROMOTE_MIN_SEVERITY` | | `high` | 자동 승격 최소 등급 (`critical` \| `high` \| `medium` \| `low`) |
| `SDLC_INCIDENT_DEDUP_WINDOW_MINUTES` | | `60` | dedup 윈도 (분). 윈도 내 동일 `dedupKey`는 중복 처리 |
| `SDLC_INCIDENT_RUN_TIMEOUT_SECONDS` | | `3600` | Pod `POST /run` `timeout_seconds` |
| `SDLC_INCIDENT_ALLOW_CODE_PATCH` | | `true` | `false`면 agent가 코드 수정 없이 가이드만 산출 |
| `SDLC_INCIDENT_PROMOTE_STALE_MINUTES` | | `30` | incident 승격 재시도 stale 임계 (분). reconcile이 이 시간을 넘긴 `DETECTED` incident를 재시도 |
| `SDLC_INCIDENT_ALLOW_TEST_INJECTION` | | `false` | `POST /incidents/inject`와 `/incidents/inject` UI **전용** 게이트. fail-closed 기본값. `SDLC_INCIDENT_ENABLED`와 독립 |

> **무엇을 미러링했는가**: 환경 변수 표 형식(`| 변수 | 필수 | 기본값 | 용도 |`, ✅ 필수 표기, `—` 무기본값)과 `SDLC_` 접두 네이밍은 [10-k8s-infrastructure.md](./10-k8s-infrastructure.md) 환경 변수 절을 미러링한다.

### 12.2 Secret 키

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sdlc-secrets
  namespace: bia-systems
type: Opaque
stringData:
  github-pat: "ghp_..."
  pod-auth-token: "sdlc-pod-auth-..."
  master-key: "sdlcmk_..."
  aws-bearer-token-bedrock: "bedrock-key..."
```

| Secret | 키 | 소비자 |
|--------|-----|-------|
| `sdlc-secrets` | `github-pat` | Portal, Pod |
| `sdlc-secrets` | `pod-auth-token` | Portal, n8n, Pod |
| `sdlc-secrets` | `master-key` | Portal (검증), n8n, Pod, 외부 모니터링 (발신) |
| `sdlc-secrets` | `aws-bearer-token-bedrock` | Pod `AWS_BEARER_TOKEN_BEDROCK` |

> **incident 전용 Secret 키는 0개다.** ingest 인증도 기존 `master-key`를 쓰므로 이 문서가 추가하는 Secret 키는 없다.

### 12.3 Portal Deployment envFrom

```yaml
        env:
          - name: SDLC_INCIDENT_ENABLED
            value: "true"
          - name: SDLC_INCIDENT_AUTO_PROMOTE
            value: "true"
          - name: SDLC_INCIDENT_AUTO_PROMOTE_MIN_SEVERITY
            value: "high"
          - name: SDLC_INCIDENT_DEDUP_WINDOW_MINUTES
            value: "60"
          - name: SDLC_INCIDENT_RUN_TIMEOUT_SECONDS
            value: "3600"
          - name: SDLC_INCIDENT_ALLOW_CODE_PATCH
            value: "true"
          - name: SDLC_INCIDENT_PROMOTE_STALE_MINUTES
            value: "30"
          - name: SDLC_INCIDENT_ALLOW_TEST_INJECTION
            value: "false"
```

> `SDLC_MASTER_KEY`는 incident 전용이 아니므로 위 목록에 없다. Portal Deployment가 이미 `sdlc-secrets`의 `master-key`를 `secretKeyRef`로 주입받는다 ([10-k8s-infrastructure.md](./10-k8s-infrastructure.md) 참조).

> **설계 결정**: 신규 K8s 오브젝트는 **0개**다. per-SR 오브젝트(`sdlc-{requestNo}` PVC / Pod / Service)와 Portal 싱글톤(`portal-sdlc-*`), CronJob `portal-sdlc-reconcile`(`*/5 * * * *`)은 모두 그대로다. incident SR도 동일한 per-SR 오브젝트 세트를 쓴다.

---

## 13. 운영·보안 고려사항

### 13.1 Test 트리거 봉인

| 항목 | 내용 |
|------|------|
| 권한 | `/incidents/inject`와 `POST /incidents/inject`는 **admin 전용** (`requireAdmin()`) |
| 주입 전용 봉인 | `SDLC_INCIDENT_ALLOW_TEST_INJECTION=false`(기본값) 시 `POST /incidents/inject`와 `/incidents/inject` UI **만** 403 `FORBIDDEN`. 실제 모니터링 ingest·승격·분석은 정상 동작한다. 프로덕션의 기본 상태이며, 훈련 시에만 일시적으로 `true`로 올린다 |
| 파이프라인 전체 봉인 | `SDLC_INCIDENT_ENABLED=false` 설정 시 ingest·inject·승격 등 **파이프라인 전체**가 403 `FORBIDDEN`이 되고 사이드바에서 `장애 대응`이 숨는다. 장애 대응 기능 자체를 끄는 스위치이므로 주입만 막을 목적으로 쓰지 않는다 |
| 확인 절차 | UI는 `AlertDialog`로 시스템·등급·자동 승격 여부를 명시하고 2단계 확인을 받는다 |
| 감사 | 모든 주입은 `audit_events`에 `action: sdlc.incident_injected` + `metadata.actor`로 남는다 |

> **fail-closed**: `SDLC_INCIDENT_ENABLED`·`SDLC_INCIDENT_ALLOW_TEST_INJECTION` 판정은 모두 라우트 핸들러 최상단에서 수행한다. 값이 없거나 파싱 불가면 `false`로 취급한다. 두 스위치는 AND 조건이며, 주입 경로는 `requireAdmin()` + `SDLC_INCIDENT_ALLOW_TEST_INJECTION` 둘 다 통과해야 한다.

### 13.2 코드 수정 정책

| 항목 | 내용 |
|------|------|
| 자동 머지 | ❌ **절대 금지**. `sdlc_github_repos.autoPrMerge=true`여도 incident PR은 머지하지 않는다. Portal의 `4 → 9_COMPLETE` 진입 작업이 dev 채널 결과 요약에 `수동 머지 필요(장애 대응 정책)`로 표기한다 |
| 사람 리뷰 | 필수. `PATCH_PROPOSED` → `RESOLVED` 전이는 admin 세션만 수행 가능 |
| 수정 봉인 | `SDLC_INCIDENT_ALLOW_CODE_PATCH=false`면 agent는 Edit를 수행하지 않고 가이드만 산출한다 |
| 브랜치 | `sdlc/INC-YYYYMMDD-NNN-{slug}` — SR 브랜치 관례와 구분 가능한 `INC-` 접두 |
| 범위 | agent는 수정 범위가 불확실하면 코드 수정을 포기하고 가이드로 대체한다 (보수적 판단) |

### 13.3 토큰 관리

| 항목 | 내용 |
|------|------|
| ingest 토큰 | 전용 토큰 없음. `SDLC_MASTER_KEY` 단일 키를 쓴다 |
| 배포 범위 | 외부 모니터링 시스템에도 **같은 키**를 배포한다 |
| 회전 | Secret `sdlc-secrets.master-key` 갱신 + Portal·n8n·Pod 롤링 재시작 + 외부 모니터링 설정 갱신을 **동시에** 수행 |
| 유출 대응 | `SDLC_INCIDENT_ENABLED=false`로 incident 경로를 즉시 봉인하되, 키 자체는 전 경로 공용이므로 Master Key 회전이 반드시 함께 필요하다 |

> **잔존 위험 — write-only 격리 소멸**: 이전 설계의 `SDLC_INCIDENT_INGEST_TOKEN`은 write-only였고 이 토큰으로는 조회·승격·종결이 불가능했다. Master Key 단일화로 **그 격리가 사라졌다**. 외부 모니터링에 배포한 키가 유출되면 incident 조회·승격·종결은 물론 `/advance`·`/dev-substage` 등 다른 서버간 경로까지 함께 노출된다. 외부 발신 주체에 내부 전권 키를 넘기는 구조이므로 모니터링 측 키 보관과 네트워크 경로 제한이 유일한 완화 수단이다.

### 13.4 민감 데이터 처리

| 항목 | 내용 |
|------|------|
| `rawPayload` 저장 | DB에는 원문 저장 (재현·감사 목적) |
| 로그 | `rawPayload`는 로그에 남기지 않고 **`sha256` 지문만** 기록 |
| API 노출 | `GET /incidents/{id}`는 `rawPayloadFingerprint`만 반환 |
| 채널 알림 | Slack 메시지에 `rawPayload`를 포함하지 않는다 |
| Secret 참조 | 비밀값이 필요한 경우 `*SecretRefId` FK로 `secret_refs`만 참조 (평문 컬럼 금지) |

> **무엇을 미러링했는가**: sha256 지문만 로깅하는 원칙은 `POST /clone`의 `fingerprint: "sha256:..."` 응답 관례와 Secret 분리 원칙([04-db-schema.md](./04-db-schema.md) 1.1절)을 따른다.

### 13.5 실패 격리

| 실패 지점 | 처리 | 파이프라인 영향 |
|-----------|------|----------------|
| Memory MCP 연결 실패 | warn-only | 없음 — 규정 없이 분석 진행 |
| Slack 알림 실패 | warn-only | 없음 — 상태 전이·종결 진행 |
| GitHub Issue comment 실패 | warn-only | 없음 |
| `POST /run` 타임아웃 | `run.failed` 콜백 → incident `X_FAILED` | SR Stage는 별도 판정 |
| 승격 실패 | `promotionAttempts += 1`, 3회 초과 시 `X_FAILED` | SR 미생성. Reconcile이 stale incident를 재시도 |
| 프로비저닝 실패 (채널·Pod) | `compensateFailedSdlc()` → SR `X_FAILED` | 채널은 아카이브하지 않고 실패 결과를 게시해 후속 논의 창구를 남긴다 ([03-state-machine.md](./03-state-machine.md) 6절) |
| 완료 결과 요약 게시 실패 | warn-only | 없음 — SR은 이미 `9_COMPLETE` 확정 |

> **fail-closed**: `SDLC_INCIDENT_ENABLED`가 유일한 fail-closed 게이트다. 그 외 메시징·MCP·GitHub 부가 연동 실패는 [02-messaging-adapter.md](./02-messaging-adapter.md) 9절 원칙에 따라 warn-only이며 상태 전이를 막지 않는다.

### 13.6 Memory Agent 통합

`resolve` 성공 시 Portal이 규정을 생성하고 incident에 역참조를 저장한다.

**`POST /api/internal/sdlc/memory/rules` 호출 본문**:

```json
{
  "category": "incident_response",
  "slug": "inc-20260903-001-sr-detail-500-surge",
  "title": "SR 상세 조회는 stageHistory를 조인 1회로 가져온다",
  "contentMd": "## 예방 규정\n- `sdlc_stage_transitions` 조회는 항상 `LIMIT 50`을 강제한다\n- 신규 상세 쿼리는 N+1 여부를 코드리뷰 체크리스트에 포함한다",
  "sourceType": "incident",
  "sourceRefId": "3f1c..."
}
```

| 필드 | 값 |
|------|-----|
| `category` | `incident_response` |
| `slug` | `inc-{incidentNo}-{slugified-title}` (소문자·하이픈) |
| `sourceType` | `incident` |
| `sourceRefId` | `sdlc_incidents.id` |

**응답**:

```json
{ "ok": true, "ruleId": "d41a...", "slug": "inc-20260903-001-sr-detail-500-surge" }
```

Portal은 반환된 `ruleId`를 `sdlc_incidents.memoryRuleId`에 저장해 incident ↔ 규정 양방향 추적을 만든다.

Pod agent가 분석 중 가설을 폐기하면 Portal을 거치지 않고 MCP `memory_append_failure_case`를 직접 호출한다. 규정(rule) 생성은 사람 종결 시점에만 발생하고, 실패 사례(failure case) 누적은 분석 중 자동으로 발생한다는 것이 두 경로의 구분점이다.

> 규정 카테고리·MCP 도구 스펙·`sdlc_memory_rules` 스키마는 [13-developer-memory-agent.md](./13-developer-memory-agent.md) 참조.

---

## 14. 설계 결정 요약

| 항목 | 설계 결정 | 비고 |
|------|----------|------|
| Pod Runner 코드·Dockerfile·엔드포인트 | `sdlc@mvc` 플러그인에 skill 1개 추가, `POST /run`만 사용 | Pod Runner 자체는 불변 |
| Stage enum | `1`~`4`, `9_COMPLETE`, `X_STOPPED`, `X_FAILED` — **불변** (`5`~`8`은 미사용 예약) | 값 추가·삭제 없음 |
| incident 경로 | **`1 → 4 → 9`** — 요구사항·설계 스킵 | 정본 `1→2→3→4→9`의 축약 |
| 상태 전이 | 조건부 전이 **1개** (`1→4`) — `pipelineProfile !== 'feature'`일 때만 합법. `4→9`는 전 프로파일 공통 | `LEGAL_TRANSITIONS`에 각주 형태 |
| 역방향 전이 | **0개** — 재개발이 필요하면 신규 SR로 처리 | 단방향 DAG |
| ChannelType | `requirements\|design\|dev` **불변** | incident는 `dev` 채널만 생성 (`inc-{no}-dev`) |
| 파이프라인 구분 | `sdlc_requests.metadata.pipelineProfile ∈ {feature, incident, improvement}` | 단일 스위치 |
| DB 테이블 | `sdlc_incidents`, `sdlc_incident_templates`, `sdlc_incident_analyses` 3개 | 신규 추가 |
| 기존 테이블 변경 | **없음** — 컬럼·인덱스 추가·재정의 0건 | — |
| Portal API | incident 엔드포인트 13개 (POST-only RPC 관례 준수) | `/api/v1/sdlc/*`에 추가 |
| 오류 코드 | `INCIDENT_DUPLICATE`(409), `INCIDENT_NOT_PROMOTABLE`(422), `TEMPLATE_DISABLED`(422), `INCIDENT_ALREADY_RESOLVED`(422) 4개 | 신규 추가 |
| 인증 메커니즘 | **신규 0종** — 서버간은 `SDLC_MASTER_KEY` 단일 키, 사람 조작은 세션 쿠키 재사용 | ingest도 같은 키 (13.3절 잔존 위험) |
| n8n 워크플로우 | **3개 유지** — Workflow B에 `Switch by Pipeline Profile` 노드군 추가 | A/B/C 구조 불변 |
| Pod 콜백 이벤트명 | **`run.completed` / `run.failed`로 표준화** | `stage.*`은 하위 호환 alias |
| Pod 콜백 `data` 키 | **snake_case로 표준화** + `agent` 키 추가 | Python(FastAPI) 기반 |
| Portal 사이드바 | **`장애 대응` 추가** (No Top Nav 유지) | 사이드바 통합 |
| Portal 라우트 | `(dashboard)/incidents/*`, `(admin)/incident-templates/*` 추가 | — |
| K8s 오브젝트 | **추가 없음** — 환경 변수 8개만 추가, Secret 키 추가 0개 | per-SR 세트 재사용 |
| PR 자동 머지 | incident PR은 **`autoPrMerge` 설정 무시, 항상 금지**. 결과 요약에 `수동 머지 필요(장애 대응 정책)` 표기 | 안전 장치 |
| 자원 게이트·대기 큐 | **없음** — 승격은 즉시 성공하거나 즉시 실패 | 우선권 개념 자체가 사라짐 |
| Test 트리거 봉인 | `SDLC_INCIDENT_ALLOW_TEST_INJECTION`(기본 `false`) — 주입 API·UI만 게이트. 파이프라인 전체 스위치 `SDLC_INCIDENT_ENABLED`와 독립 | fail-closed |
| 승격 재시도 | `SDLC_INCIDENT_PROMOTE_STALE_MINUTES`(기본 `30`) — `DETECTED` 유지 + `promotionAttempts` 기반 reconcile 재시도 | — |

> **설계 결정**: 신규 코드는 Portal 쪽 라우트·서버 액션·스키마와 Pod 쪽 skill 1개에 한정된다. Pod Runner·K8s 매니페스트·Stage enum·ChannelType enum·n8n 워크플로우 개수는 불변이다.

> **✅ 검증 포인트**: 배포 전 `pipelineProfile=feature` SR 1건을 기존 경로로 완주시켜 회귀가 없음을 확인한 뒤, `/incidents/inject`로 `autoPromote=false` 테스트 장애 1건을 만들어 수동 승격 → 분석 → 가이드 → 종결까지 통과하는지 확인한다.
