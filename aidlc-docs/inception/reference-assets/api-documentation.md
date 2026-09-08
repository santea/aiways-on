# API Documentation

> **범위**: 현존 자산이 실제로 노출/호출하는 API. 타깃 명세(`requirements/05,06`)와의 갭을 병기.

## REST APIs — 현존 구현

### GET/POST `/api/auth/[...nextauth]` (portal)
- **Method**: GET, POST
- **Purpose**: NextAuth v5 OAuth 콜백·세션 처리
- **Implementation**: `src/app/api/auth/[...nextauth]/route.ts` — `handlers` 재수출 (3줄)
- **판정**: 표준 구현. **재사용 가능**

### GET `/health` (mcp-server)
- **Purpose**: 헬스체크
- **Response**: `{"status":"ok"}`

### GET `/sse` (mcp-server)
- **Purpose**: MCP SSE 전송 연결
- **⚠️ 갭**: 명세는 Streamable HTTP 요구

## Portal API — 명세 대비 구현 현황

`requirements/05-portal-api.md` 기준. **현존 구현 0개.**

| 엔드포인트 | 용도 | 현존 |
|-----------|------|------|
| `POST /api/v1/sdlc/intake` | SR 등록 (n8n WF-A 호출) | ❌ |
| `POST /api/v1/sdlc/advance` | CAS 단계 전환 (n8n WF-B 호출) | ❌ |
| `POST /api/v1/sdlc/requests/{id}/audit` | 감사 로그 (n8n WF-C 호출) | ❌ |
| `POST /api/v1/sdlc/requests/{id}/channel-image` | 목업 이미지 업로드 (Pod 호출) | ❌ |
| `GET /api/v1/sdlc/images/{id}?token=` | 이미지 프록시 서빙 | ❌ |
| `/api/v1/sdlc/incidents/*` | 장애 수집·승격·종결 | ❌ |
| `/api/v1/sdlc/improvements/*` | 자체개선 스캔·finding | ❌ |
| `/api/v1/sdlc/memory/*` | 개발 규정·MCP 토큰 | ❌ |
| `POST /slack/events` | Slack Gateway 릴레이 수신 | ❌ |
| `/api/internal/sdlc/reconcile` | CronJob 대상 | ❌ |
| `/api/internal/sdlc/improvement-scan` | CronJob 대상 | ❌ |

## Pod Runner API — 명세 대비 구현 현황

`requirements/06-pod-runner-api.md` 기준. Base: `http://{pod}.{ns}.svc.cluster.local:58001`
**현존 구현 0개** (`sdlc-pod-runner/src/index.js`는 8줄 스텁).

| 엔드포인트 | 인증 | 용도 | n8n에서 실제 호출 | 현존 |
|-----------|------|------|------------------|------|
| `GET /health` | 없음 | K8s probe | - | ❌ |
| `POST /clone` | `POD_AUTH_TOKEN` | repo clone·세션 초기화 (멱등) | ✅ WF-A | ❌ |
| `GET /status` | `POD_AUTH_TOKEN` | 세션 상태 | - | ❌ |
| `POST /run` | `POD_AUTH_TOKEN` | Claude Code 실행 (동기/비동기/resume) | ✅ WF-A·B (다수) | ❌ |
| `POST /git/commit-push` | `POD_AUTH_TOKEN` | commit·push | - | ❌ |
| `DELETE /session` | `POD_AUTH_TOKEN` | 세션 정리 | - | ❌ |
| `POST /notify-channel` | `SDLC_MASTER_KEY` | Portal 알림 중계 (2-hop) | ✅ WF-B | ❌ |
| `POST/GET /context` | `POD_AUTH_TOKEN` | SDLC context | - | ❌ |
| `POST/GET /stage` | `POD_AUTH_TOKEN` | stage 설정/조회 | ✅ WF-B (substage) | ❌ |
| Admin Terminate | - | Pod 자가 종료 | - | ❌ |

**중요**: `Dockerfile`의 `CMD ["uvicorn", "app.main:app", "--host","0.0.0.0","--port","58001"]`과
`HEALTHCHECK`가 이미 FastAPI를 전제로 작성되어 있다. **인터페이스 계약은 확정, 구현체만 부재.**

## Webhook APIs — n8n (현존 구현)

| Webhook | Path | Method | 워크플로우 | 호출자 |
|---------|------|--------|-----------|--------|
| SDLC Intake 수신 | `sdlc-intake` | POST | A | Portal |
| Feedback Webhook | `sdlc-run-complete` | POST | B | Pod (`run.completed`/`run.failed`) |
| Stage Resume | `sdlc-stage-resume` | POST | B | Portal (고아 세션 복구) |
| Pod Event | `sdlc-pod-event` | POST | C | Pod |
| Feedback | `sdlc-feedback` | POST | C | Portal |

## Internal APIs — 에이전트 호출 계약

### `rsccb-report` 서브에이전트
```
Task(subagent_type="rsccb-report",
     prompt="stage: {requirements|design|development|rsccb}\n
             outputPath: /workspaces/session/.sdlc-reports/{name}.md\n
             context: {작업 내용 전체 요약}")
```
- **Returns**: 파일 저장 후 마지막 줄에 `COMPLETE`
- **제약**: 보고서 4종은 직접 `Write` 금지. `COMPLETE` 출력 전 다음 단계 진행 금지

### `qa-agent` 서브에이전트
- **필수 파라미터**: `repoUrl`, `outputPath`
- **호출 규칙**: 멀티 repo 세션에서는 repo 1개당 1회
- **Returns**: `PASS` / `FAIL` / `NEEDS_HUMAN_REVIEW`

### Stage 4 substage 호출 계약 (`claude-global.md`)
| substage | 호출 방식 | 산출물 |
|----------|----------|--------|
| `dev` | 최상위 세션 직접 구현 (skill/subagent 금지) | 구현 + commit + push |
| `qa` | `Agent(subagent_type="oh-my-claudecode:test-engineer")` | 테스트 통과/실패 요약 |
| `code_review` | `Agent(subagent_type="oh-my-claudecode:code-reviewer")` | `.mvc/report/code-review.md` |
| `security_review` | `Agent(subagent_type="oh-my-claudecode:security-reviewer")` | `.mvc/report/security-review.md` |

### 단계 확정 신호 규약 (n8n 판정용)
n8n 판정 Agent는 **Pod의 `/run` 종료 출력 텍스트만** 본다. 정확한 문자열 필수:
```
===MOCKUP_CONFIRMED===
/workspaces/session/.mvc/requirement/<slug>.md
```

## Data Models — 현존 (`prisma/schema.prisma`)

### `User`
- **Fields**: `id`(cuid PK), `name?`, `email?`(unique), `emailVerified?`, `image?`, `createdAt`, `updatedAt`
- **Relationships**: `accounts: Account[]`, `sessions: Session[]`

### `Account`
- **Fields**: `id`(cuid PK), `userId`, `type`, `provider`, `providerAccountId`, `refresh_token?`(Text),
  `access_token?`(Text), `expires_at?`, `token_type?`, `scope?`, `id_token?`(Text), `session_state?`
- **Relationships**: `user → User` (onDelete: Cascade)
- **Validation**: `@@unique([provider, providerAccountId])`

### `Session`
- **Fields**: `id`(cuid PK), `sessionToken`(unique), `userId`, `expires`
- **Relationships**: `user → User` (onDelete: Cascade)

### `VerificationToken`
- **Fields**: `identifier`, `token`(unique), `expires`
- **Validation**: `@@unique([identifier, token])`

**판정**: Auth.js 표준 4모델만 존재. `requirements/04-db-schema.md`(723줄)가 요구하는
SDLC 도메인 테이블(sdlc_requests, audit, incidents, improvements, memory, secret_refs 등)은 **전무**.
게다가 **Prisma → Drizzle 전면 재작성** 대상.
