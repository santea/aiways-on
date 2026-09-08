# 인증 스킴 대조표 — F-1 산출물

> AD-2 는 `AuthGuard` 를 **모든 인증의 단일 검증 지점**으로 정했다.
> 이 표가 그 약속이 실제로 지켜지는지 확인하는 대조 기준이다.
> 구현: `packages/lib/src/auth/schemes.ts` · `guard.ts`

## 1. 스킴 → 엔드포인트 → 함수

| 스킴 (env) | 대표 엔드포인트 | AuthGuard 함수 | 비고 |
|-----------|----------------|---------------|------|
| `SDLC_MASTER_KEY` | `/intake` · `/advance` · `/requests/:id/*` · `/incidents/ingest` · `/improvement-scan` · `/memory/rules` | `requireMasterKey` | 내부 서버간 기본 키 |
| `POD_AUTH_TOKEN` | Portal → Pod Runner | `requirePodToken` | |
| `sdlcmem_*` (DB 해시) | Memory MCP :58002 | `requireMemoryToken` | env 가 아니라 `sdlc_memory_access_tokens.token_hash` 조회 |
| `SDLC_RECONCILE_TOKEN` | `POST /api/internal/sdlc/reconcile` | **`requireReconcileToken`** | **F-1 추가** |
| `SDLC_CALLBACK_BEARER` | `POST /channel-notification` | **`requireCallbackBearer`** | **F-1 추가.** 미설정 시 master key 로 검증 (C-1) |
| `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` | `POST /memory/tokens/issue-scoped` | **`requireTokenIssuer`** | **F-1 추가.** master key 로 대체 불가 |
| `SDLC_IMAGE_SIGNING_SECRET` | `GET /images/:id?token=` | `signImageUrl` / `verifyImageToken` | 미들웨어 예외, 라우트 내부 검증 |
| 세션 (Auth.js) | UI · 사용자 API | `requireUser` · `requireAdmin` · `requireOwnership` | |

## 2. ⚠️ C-1 — 문서 간 모순 (U1 생성 중 발견)

**확인된 사실만 적는다.**

| 문서 | 무엇을 말하는가 |
|------|----------------|
| `01-auth-github.md` §7 | "서버간 인증은 `SDLC_MASTER_KEY` **단일 키**" 라는 **원칙**. 예외는 토큰 발급 권한 하나 |
| `05-portal-api.md` 인증 표 | `reconcile` = `SDLC_RECONCILE_TOKEN`, `/channel-notification` = `SDLC_CALLBACK_BEARER` 로 **구체 지정** |
| `10-k8s-infrastructure.md` | CronJob 이 **실제로** `Bearer ${SDLC_RECONCILE_TOKEN}` 으로 호출. `SDLC_CALLBACK_BEARER` 는 "(선택)" 으로 표시 |

**U1 이 내린 판단** (되돌릴 수 있다):

- `SDLC_RECONCILE_TOKEN` → **전용 함수를 만든다.** 두 문서가 구체적으로 지정하고 실제 호출 코드까지
  있으므로, 일반 원칙보다 구체 지정을 따른다.
- `SDLC_CALLBACK_BEARER` → **전용 함수를 만들되 미설정 시 master key 로 검증한다.**
  "(선택)" 표시와 정합하며, 미설정 상태에서 인증이 열리는 fail-open 을 만들지 않는다.
- `SDLC_MEMORY_TOKEN_ISSUER_TOKEN` → **절대 대체하지 않는다.** 명세가 이유까지 적어두었다 —
  master key 를 가진 모든 컴포넌트(MCP 서버 포함)가 발급 권한을 얻으면, MCP 침해 시
  침해자가 전 규정을 재작성할 토큰을 스스로 발급할 수 있다.

> 이 모순은 요구사항 문서 쪽의 문제이므로 U1 이 임의로 명세를 고치지 않았다.
> 명세를 한쪽으로 정리하려면 문서 수정이 필요하며, 그 판단은 사용자 몫이다.

## 3. 의도적으로 만들지 않은 것

| 항목 | 이유 |
|------|------|
| `SLACK_SIGNING_SECRET` 검증 | `events-api` 모드 전용. 이 시스템은 gateway 모드(SVC-4, replicas 1)를 쓴다. **쓰지 않을 검증 코드를 미리 만들지 않는다.** 모드 전환 시 `slackSignature` 스킴과 함수를 추가한다 |
| `SDLC_INCIDENT_INGEST_TOKEN` | 명세가 master key 로 통합하며 제거했고 그로 인한 잔존 위험까지 기록했다. 되살리지 않는다 |

## 4. 리뷰 체크리스트

- [ ] 새 라우트를 추가할 때 이 표의 함수 중 하나를 통과하는가
- [ ] 통과하지 않는다면 `PUBLIC_PATH_PREFIXES` 에 명시적으로 등록했는가
- [ ] 유닛 코드에 자체 Bearer 비교 로직을 쓰지 않았는가 (AD-2 위반)
- [ ] 토큰 비교가 상수 시간 비교인가 (명세 §7 요구)
