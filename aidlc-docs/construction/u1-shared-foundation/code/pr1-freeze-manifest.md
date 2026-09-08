# PR #1 동결 목록 — U1 인터페이스 전용 PR

> **이 PR 의 머지가 나머지 5유닛의 착수 신호다** (UOW-3).
> 동결은 "수정 금지"가 아니라 **"단독 수정 금지"** 다. 변경하려면 U1 승인이 필요하고,
> 5유닛 전체에 영향을 주므로 PR 설명에 영향 범위를 적는다.

## 동결 대상

| # | 파일 | 내용 | 기다리는 유닛 |
|---|------|------|-------------|
| 1 | `packages/contracts/src/stage.ts` | `Stage`(1·2·3·4·9·X_STOPPED·X_FAILED) · `ChannelType` · `PipelineProfile` · `DevSubStage` · `StampedPolicy` | 전부 |
| 2 | `packages/contracts/src/dto.ts` | `UserRole` · `AuthenticatedUser` · SR DTO · `ChannelMessage` · `StageTransition` · `ApiError` | 전부 |
| 3 | `packages/contracts/src/ports.ts` | `GitHubPort` · `MessagingPort` · `PodPort` (AD-1) | U2(구현) · U3(소비·구현) |
| 4 | `packages/contracts/src/factory.ts` | `validateAndStampPolicy` · `createSdlcRequest` 시그니처 (UOW-6) | **U2 · U4 · U5** |
| 5 | `packages/contracts/src/state.ts` | `getSubStage` · `setSubStage` · `getTransitions` · `advance` (B-3) | U2 |
| 6 | `packages/lib/src/auth/guard.ts` | `AuthGuard` **10함수** 시그니처 + `PUBLIC_PATH_PREFIXES` | 전부 |
| 7 | `packages/lib/src/auth/schemes.ts` | 서버간 인증 스킴 레지스트리 (F-1) | U3 · U6 |
| 8 | `packages/lib/src/db/schema/*` | 6파일 + 배럴. 공유 테이블 확정 | 전부 |
| 9 | `packages/lib/src/domain/constants.ts` | `STAGE_VALUES` · `PROFILE_CHANNELS` 등 런타임 상수 | 전부 |
| 10 | `packages/lib/src/ui/tokens.css` · `theme.ts` | 디자인 토큰 · 사이드바 12항목 | UI 가진 U2·U4·U5·U6 |
| 11 | 스캐폴딩 | `pnpm-workspace.yaml` · `package.json` · `tsconfig.base.json` · `CODEOWNERS` | 전부 |

## 동결에 포함되지 않는 것 (Phase B 에서 구현)

`AuthGuard` 실제 검증 로직 · Auth.js 설정 · Drizzle 마이그레이션 실행 · 글로벌 레이아웃 ·
Helm chart · Skaffold · Secret·RBAC · CronJob · CI · Dockerfile

## 검증 결과 (실제 실행)

| 검사 | 명령 | 결과 |
|------|------|------|
| 타입 정합 | `pnpm -r typecheck` | ✅ 3/3 프로젝트 통과 (contracts · lib · portal) |
| contracts 런타임 코드 0 | `pnpm verify:contracts-runtime-free` | ✅ 검사 파일 6개, 런타임 코드 없음 |
| 검증기 반증 테스트 | contracts 에 `export const` 를 임시 추가 | ✅ exit 1 로 실패 → 검증기가 실제로 동작함을 확인 |

> 반증 테스트를 한 이유: 통과만 확인하면 "아무것도 검사하지 않는 검증기"와 구별되지 않는다.
> 위반을 심었을 때 실제로 실패하는 것까지 봐야 이 검사가 의미를 갖는다.

## 검증 중 발견해 고친 것 2건

1. **`.ts` 확장자 import 와 컴파일 검증이 충돌** — `allowImportingTsExtensions` 는 `noEmit` 을
   요구하는데, contracts 런타임 검사는 실제 emit 이 필요하다. 상대 import 에서 `.ts` 를 제거해
   양립시켰다 (Bundler 해석이 처리한다).
2. **`apps/portal` 에 소스가 없어 typecheck 가 실패** — Step 1 스캐폴딩이 불완전했다.
   최소 `layout.tsx` · `next-env.d.ts` 를 추가했다. Step 10 에서 실제 레이아웃으로 교체된다.
