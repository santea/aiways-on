# U1 이 제공하는 계약 — 다른 5유닛이 읽을 문서

> 이 문서가 U2~U6 담당자가 착수할 때 보는 목록이다.
> 실제 선언은 `packages/contracts/src/` 와 `packages/lib/src/` 에 있다.

## 1. 임포트 경로

```ts
import type { Stage, GitHubPort, SdlcRequestFactory } from '@aiways/contracts';
import { createServerAuth, createSessionGuards } from '@aiways/lib/auth';
import { isPublicPath } from '@aiways/lib/auth/guard';   // ⬅ Edge(미들웨어)에서는 이쪽
import { STAGE_VALUES, PROFILE_CHANNELS } from '@aiways/lib/domain';
import { getDb, schema } from '@aiways/lib/db';
import { visibleNavItems, accentTokens } from '@aiways/lib/ui';
```

**주의** — `@aiways/lib/auth` 배럴은 `node:crypto` 를 쓰는 모듈을 함께 끌어온다.
Edge 런타임(미들웨어)에서는 `@aiways/lib/auth/guard` 를 직접 가져와야 한다.
실제 `next build` 에서 이 문제로 번들이 깨지는 것을 확인하고 분리했다.

## 2. 타입 계약 (`@aiways/contracts`)

| 파일 | 제공 | 소비 유닛 |
|------|------|----------|
| `stage.ts` | `Stage` · `ChannelType` · `PipelineProfile` · `DevSubStage` · `StampedPolicy` · `SdlcRequestMetadata` | 전부 |
| `dto.ts` | `AuthenticatedUser` · `SdlcRequestSummary`/`Detail` · `CreateSdlcRequestInput` · `ChannelMessage` · `StageTransition` · `ApiError` | 전부 |
| `ports.ts` | `GitHubPort` · `MessagingPort` · `PodPort` | U2(구현) · U3(소비·구현) |
| `factory.ts` | `SdlcRequestFactory` · `ValidateAndStampResult` | U2 · U3(구현) · U4 · U5 |
| `state.ts` | `StateMachine` · `AdvanceResult` · `StaleFromError` | U2(읽기) · U3(구현) |

**이 패키지에는 런타임 코드가 없다.** 실행이 필요한 값은 `@aiways/lib/domain` 에 있다
(`STAGE_VALUES` · `PROFILE_CHANNELS` · `DEV_SUBSTAGE_ORDER` 등). 두 곳은 `satisfies` 로
묶여 있어 타입이 바뀌면 상수 쪽에서 typecheck 가 깨진다.

## 3. 인증 (`@aiways/lib/auth`)

```ts
const auth = createServerAuth(process.env);
export async function POST(req: Request) {
  auth.requireMasterKey(req);      // 실패 시 AuthError(401)
  // ...
}
```

| 함수 | 용도 |
|------|------|
| `requireUser` / `requireAdmin` / `requireOwnership` | 세션 기반. `createSessionGuards(getSessionUser)` 로 생성 |
| `requireMasterKey` | 내부 API 기본 키 |
| `requirePodToken` | Pod Runner 호출 |
| `requireMemoryToken` | MCP `sdlcmem_*` |
| `requireReconcileToken` | CronJob 정합성 복구 |
| `requireCallbackBearer` | Pod·n8n 채널 알림 |
| `requireTokenIssuer` | MCP 토큰 발급 — **master key 로 대체되지 않는다** |
| `signImageUrl` / `verifyImageToken` | 이미지 서명 URL |

**규약**: 유닛 라우트에 자체 Bearer 비교 로직을 쓰지 않는다 (AD-2 위반).
새 라우트는 위 함수 중 하나를 통과하거나 `PUBLIC_PATH_PREFIXES` 에 명시해야 한다.

## 4. DB 스키마 (`@aiways/lib/db`)

유닛별 파일: `core.ts`(U1) · `sdlc.ts`(U3) · `incident.ts`(U4) · `improvement.ts`(U5) · `memory.ts`(U6)

**U1 승인이 필요한 변경**: 배럴 `index.ts` · 공유 테이블(`users`·`sessions`·`audit_events`·
`secret_refs`·`sdlc_requests`) · FK 규약 · 마이그레이션 생성.

마이그레이션은 U1 이 일괄 생성한다 (`pnpm db:generate`). 유닛이 각자 생성하면 순서가 엉킨다.

## 5. UI (`@aiways/lib/ui`)

- `tokens.css` — 의미적 토큰. **raw hex 직접 사용 금지** (design §2.1)
- `theme.ts` — `SIDEBAR_ITEMS`(12항목) · `visibleNavItems(role)` · `accentTokens(level)`
- 레이아웃 클래스는 `apps/portal/src/app/layout.css` 에 있다 (No-Line 규칙)

## 6. 배포 경계 (UOW-7)

- **Dockerfile 은 코드 소유 유닛이 만든다.** Portal 만 U1 소유(5유닛 코드를 담으므로)
- **chart·values·Secret·RBAC·ConfigMap 은 전부 U1** — `charts/aiways-on/`
- MCP 주소는 ConfigMap `sdlc-endpoints.memoryMcpUrl` **한 키**로만 합의한다 (AD-5·B-7)
- 새 서비스를 추가하려면 `charts/aiways-on/values.yaml` 에 항목을 넣고 U1 리뷰를 받는다
