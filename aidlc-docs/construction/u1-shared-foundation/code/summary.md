# U1 공용 기반 — Code Generation 결과

> **단계**: CONSTRUCTION / Code Generation 1/6 · 2026-09-08
> 계획: `aidlc-docs/construction/plans/u1-shared-foundation-code-generation-plan.md` (17단계 전부 완료)

## 1. 생성한 것

### Phase A — PR #1 (5유닛 착수 차단 해제)

| 경로 | 내용 |
|------|------|
| `pnpm-workspace.yaml` · `package.json` · `tsconfig.base.json` · `.gitignore` | 워크스페이스 |
| `CODEOWNERS` | 유닛별 소유 경로 (UOW-5) |
| `packages/contracts/src/{stage,dto,ports,factory,state,index}.ts` | 계약 — 런타임 코드 0 |
| `packages/lib/src/db/schema/{_schema,core,sdlc,memory,incident,improvement,index}.ts` | 31 테이블 |
| `packages/lib/src/auth/{guard,schemes}.ts` | AuthGuard 10함수 계약 + 스킴 레지스트리 |
| `packages/lib/src/domain/constants.ts` | contracts 의 런타임 대응물 |
| `packages/lib/src/ui/{tokens.css,theme.ts}` | 디자인 토큰 · 사이드바 12항목 |
| `scripts/verify-contracts-runtime-free.mjs` | 경계 기계 검사 |

### Phase B — 구현

| 경로 | 내용 |
|------|------|
| `packages/lib/src/auth/{compare,server-auth,image-token,session,github-email,next-auth}.ts` | 인증 구현 |
| `packages/lib/src/db/client.ts` | DB 연결 (유닛은 자체 연결을 만들지 않는다) |
| `apps/portal/src/{auth.ts,middleware.ts}` | Auth.js 인스턴스 · deny-by-default 미들웨어 |
| `apps/portal/src/app/{layout.tsx,layout.css,page.tsx}` | 글로벌 레이아웃 |
| `apps/portal/src/app/(auth)/login/page.tsx` | GitHub OAuth 로그인 |
| `apps/portal/src/app/api/{auth/[...nextauth],health}/route.ts` | 인증 콜백 · 헬스체크 |
| `apps/portal/src/components/Sidebar.tsx` | 사이드바 (active blade) |
| `drizzle/0000_initial_schema.sql` | 31 테이블 · 46 인덱스 · 36 FK |
| `charts/aiways-on/**` | Helm chart 5서비스 + RBAC + ConfigMap + CronJob 2종 |
| `skaffold.yaml` · `environment.yml` · `README.md` | 로컬 기동 |
| `.github/workflows/ci.yml` | 품질 게이트 |
| `apps/portal/Dockerfile` | 비루트 · 멀티스테이지 |
| `scripts/verify-gateway-isolation.mjs` | SVC-4 격리 검사 |
| 테스트 7파일 55건 | `packages/lib/src/**/__tests__/` |

## 2. 실제로 실행한 검증

| 검사 | 결과 |
|------|------|
| `pnpm -r typecheck` | ✅ 3/3 프로젝트 |
| `pnpm vitest run --coverage` | ✅ **55건 통과 · 라인 97.29%** (게이트 80%) |
| `pnpm --filter @aiways/portal build` | ✅ 성공 (5 라우트 + 미들웨어) |
| `pnpm verify:contracts-runtime-free` | ✅ 6파일, 런타임 코드 없음 |
| `pnpm verify:gateway-isolation` | ✅ (대상 미생성 → SKIP) |
| `helm lint` · `helm template` | ✅ 13 매니페스트 렌더 |
| 매니페스트 불변식 9종 | ✅ 전부 통과 (아래) |
| 마이그레이션 FK 순서 | ✅ memory < incident · improvement |

### 매니페스트 불변식

Gateway replicas=1 · Portal replicas≥2 · RoleBinding 이 default SA 가 아님 ·
ConfigMap `memoryMcpUrl` 존재 · Portal 에 `SLACK_APP_TOKEN` 미주입 · Gateway 에 주입 ·
MCP 에 발급자 토큰 미주입 · 전 컨테이너 `runAsNonRoot` · 평문 시크릿 0

### 반증 테스트 (검증기가 실제로 동작하는지)

두 검증기 모두 **위반을 심어 실패를 확인**한 뒤 되돌렸다. 통과만 보면
"아무것도 검사하지 않는 검증기"와 구별되지 않는다.

| 검증기 | 심은 위반 | 결과 |
|--------|----------|------|
| contracts 런타임 검사 | `export const LEAKED_RUNTIME = [...]` | ✅ exit 1, 해당 줄 출력 |
| Gateway 격리 검사 | `@aiways/contracts` 의존 + import | ✅ exit 1, 두 위치 모두 지적 |

## 3. 생성 중 발견한 것

### F-1 (계획 단계 발견, 이번에 해소)
`AuthGuard` 7함수 → **10함수**. `components.md` C-1.2 갱신 완료.
상세: `auth-scheme-inventory.md`

### C-1 — 문서 간 모순 (신규)
`01-auth-github.md` §7 은 "서버간 인증 = master key 단일"이라는 **원칙**을 세우는데,
`05-portal-api.md` 와 `10-k8s-infrastructure.md` 는 `SDLC_RECONCILE_TOKEN`·`SDLC_CALLBACK_BEARER`
를 **구체적으로 지정**한다. 구체 지정을 따르되 callback 은 미설정 시 master key 로 물러나게 했다.
**명세는 고치지 않았다** — 어느 쪽으로 정리할지는 사용자 판단이다.

### 실제 실행이 잡은 결함 4건

| # | 무엇 | 어떻게 드러났나 |
|---|------|----------------|
| 1 | `.ts` import 확장자가 contracts 컴파일 검증과 충돌 | `pnpm typecheck` 실패 |
| 2 | `apps/portal` 에 소스가 없어 typecheck 불가 | 같은 실행 |
| 3 | **인증 배럴이 `node:crypto` 를 Edge 미들웨어로 끌어옴** | `next build` 실패 |
| 4 | 커버리지 74.57% < 80% 게이트 | `vitest --coverage` 실패 |

3번이 가장 컸다. 타입 검사만으로는 드러나지 않고 실제 빌드에서만 나타난다.
미들웨어가 배럴 대신 `@aiways/lib/auth/guard` 를 직접 가져오도록 고쳤고,
그 이유를 `interfaces.md` 와 코드 주석에 남겨 다른 유닛이 같은 함정에 빠지지 않게 했다.

4번은 `github-email.ts`·`db/client.ts` 테스트를 **추가해서** 97.29% 로 올렸다.
`next-auth.ts` 만 커버리지에서 제외했는데, 우리 로직은 `resolveInitialRole` 하나뿐이고
그것은 별도로 검사한다 — 숫자를 맞추려는 제외가 아니다.

### 명세와의 의도적 차이 1건

`10-k8s-infrastructure.md` §2.2 는 RoleBinding subject 를 **`default` ServiceAccount** 로 적는다.
그대로 두면 네임스페이스의 **모든 Pod** 가 Pod 생성·삭제·Secret 조회 권한을 갖는다.
전용 ServiceAccount(`portal-sdlc`)를 만들어 Portal 에만 바인딩했다. 권한 목록은 명세 그대로다.
(SECURITY-06 최소 권한 · NFR-19)

## 4. 다음 유닛에 넘기는 것

1. **PR #1 이 머지되면 U2~U6 이 동시에 착수 가능**하다. `interfaces.md` 가 그 진입점이다
2. **Edge 런타임 함정** — 미들웨어에서는 `@aiways/lib/auth/guard` 를 쓴다
3. **stub 필수 조건 2건** (`unit-of-work-dependency.md` §6) 은 아직 각 유닛이 지켜야 할 몫이다
4. **C-1 정리 여부**는 사용자 판단 대기
