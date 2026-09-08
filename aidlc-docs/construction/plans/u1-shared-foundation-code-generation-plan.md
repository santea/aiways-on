# U1 공용 기반 — Code Generation Plan

> **단계**: CONSTRUCTION / Code Generation — Part 1 (Planning) · 유닛 1/6
> **작성**: 2026-09-08
> **이 문서가 Code Generation의 단일 진실 공급원이다.** Part 2는 여기 적힌 것만 실행한다.

---

## 1. 유닛 컨텍스트

| 항목 | 내용 |
|------|------|
| **유닛** | U1 공용 기반 (Shared Foundation) · 담당 D1 |
| **왜 첫 번째인가** | **5유닛 전부를 막는 유일한 선행 유닛.** UOW-3의 PR #1 머지가 나머지 착수 신호 |
| **스토리** | 10건 — 배치1(Must) 9 · 배치2(Should) 1 |
| **컴포넌트** | C-1.1 `SharedTypes` · C-1.2 `AuthGuard` · C-1.3 `SchemaRegistry` · C-1.4 `DesignSystem` · C-1.5 `PlatformOps` |
| **배포 서비스** | 없음(SVC-1 Portal에 포함) + 전 서비스의 chart·values·Secret·RBAC 소유 |
| **다른 유닛 의존** | **없음.** stub도 필요 없다 |
| **이 유닛에 의존하는 것** | U2·U3·U4·U5·U6 전부 (컴파일 타임) |

### 소유 DB 엔티티 (UOW-8)

`packages/lib/db/schema/` 전체 파일을 **생성**하되, 편집 권한은 유닛별로 갈린다.
U1이 직접 소유·편집하는 것은 아래 공유 테이블이다.

`users` · `accounts` · `sessions` · `verification_tokens` · `secret_refs` · `audit_events` · `sdlc_requests`(공유)
그리고 배럴 `index.ts`, FK 규약, 마이그레이션 생성 권한.

### 생산하는 계약 (다른 유닛이 소비)

`Stage`·`ChannelType`·`PipelineProfile` · DTO · `GitHubPort`·`MessagingPort`·`PodPort` ·
`SdlcRequestFactory` 시그니처(UOW-6) · `StateMachine` 조회 시그니처(B-3) · `AuthGuard` 전 함수 ·
디자인 토큰 · ConfigMap `sdlc-endpoints.memoryMcpUrl` 키(B-7)

---

## 2. SATISFIED 참조 문서 충분성 검증

Workflow Planning의 조건: *"각 유닛의 Code Generation Part 1에서 참조 문서가 그 유닛에 충분한지
확인하고, 부족하면 그 유닛에 한해 해당 설계 단계를 추가 수행한다."* 실제로 문서를 열어 확인했다.

| 대상 | 참조 문서 | 확인 결과 |
|------|----------|----------|
| DB 스키마 | `04-db-schema.md` (723줄) | ✅ **충분** — 실제 Drizzle 코드(컬럼·타입·인덱스·FK)가 테이블별로 들어 있고, §11.2에 FK 의존 기준 생성 순서 13단계까지 명시 |
| 인증 | `01-auth-github.md` (330줄) | ⚠️ **부분** — Auth.js v5 설정·RBAC 2단계·미들웨어 예외는 충분. **서버간 인증은 아래 F-1 참조** |
| 디자인 토큰 | `design/` §2·§3 (887줄) | ✅ 충분 — 색·타이포·간격 토큰, 사이드바 12항목, No-Line 규칙 |
| 인프라 | `10-k8s-infrastructure.md` (1,073줄) | ✅ 충분 — 매니페스트 수준 RBAC·Secret 키·env·CronJob 2종 |
| 프로젝트 구조 | `00-overview.md` §5 + UOW-9 | ✅ 충분 — §2.2의 경로 매핑으로 이탈분 해소 |

**판정: 추가 설계 단계 불필요.** 단 아래 F-1은 생성 전에 확정해야 한다.

### ⚠️ F-1 — AuthGuard가 서버간 인증 스킴을 다 덮지 못한다

`AuthGuard`는 AD-2에 따라 **모든 인증의 단일 검증 지점**이다. 그런데 컴포넌트 정의의 7개 함수는
`서버간 인증 4종`을 전제하고 있고, 명세를 실제로 훑어보니 **활성 스킴이 그보다 많다.**

| 스킴 | 쓰이는 곳 | AuthGuard 함수 | 상태 |
|------|----------|---------------|:----:|
| `SDLC_MASTER_KEY` | 내부 API 다수 (`/intake`·`/advance` 등) | `requireMasterKey()` | ✅ |
| `POD_AUTH_TOKEN` | Pod Runner 호출 | `requirePodToken()` | ✅ |
| `sdlcmem_*` | MCP Bearer | `requireMemoryToken()` | ✅ |
| 이미지 서명 (`SDLC_IMAGE_SIGNING_SECRET`) | `GET /images/{id}` | `signImageUrl`/`verifyImageToken` | ✅ |
| **`SDLC_RECONCILE_TOKEN`** | `POST /api/internal/sdlc/reconcile` (CronJob) | **없음** | ❌ |
| **`SDLC_CALLBACK_BEARER`** | `POST /channel-notification` (Pod·n8n) | **없음** | ❌ |
| **`SDLC_MEMORY_TOKEN_ISSUER_TOKEN`** | MCP 토큰 발급 (C-6.3의 권한 분리 근거) | **없음** | ❌ |
| `SLACK_SIGNING_SECRET` | `events-api` 모드에서만 필수 (gateway 모드 미사용) | 없음 | ⚠️ 조건부 |

**왜 지금 해결해야 하는가**: 이 함수들이 U1에 없으면, 각 스킴은 그것이 필요한 유닛의 라우트에서
개별 구현된다 — U3가 reconcile 검증을, U3가 callback 검증을, U6가 발급자 토큰 검증을 각자 만든다.
**그것이 정확히 AD-2가 막으려던 상태**이고, SECURITY-11(보안 로직 격리)에도 어긋난다.
지금 U1에서 함수 3개를 더 만드는 것이 나중에 3개 유닛에 흩어진 것을 모으는 것보다 싸다.

**제안 (Step 4에 반영)** — `AuthGuard`를 **7함수 → 10함수**로 확장:
- `requireReconcileToken()` · `requireCallbackBearer()` · `requireTokenIssuer()` 추가
- `SLACK_SIGNING_SECRET`은 gateway 모드를 쓰므로 **함수를 만들지 않고**, 모드 전환 시 필요하다는
  주석만 남긴다 (쓰지 않는 검증 코드를 미리 만들지 않는다)
- `components.md`의 C-1.2 정의를 이 결과로 갱신 (Application Design 산출물 수정)

> 참고로 `SDLC_INCIDENT_INGEST_TOKEN`은 명세가 **Master Key로 통합하며 제거**했다고 명시하고
> 그로 인한 잔존 위험까지 기록해 두었다. 되살리지 않는다.

---

## 3. 코드 위치

**애플리케이션 코드는 워크스페이스 루트에 쓴다. `aidlc-docs/`에는 절대 쓰지 않는다.**

| 대상 | 경로 |
|------|------|
| 워크스페이스 설정 | `/pnpm-workspace.yaml` · `/package.json` · `/tsconfig.base.json` · `/CODEOWNERS` |
| 공유 계약 | `/packages/contracts/` |
| 공유 런타임 | `/packages/lib/{auth,db,ui}/` |
| Portal 앱 | `/apps/portal/` |
| 마이그레이션 | `/drizzle/` |
| 배포 | `/charts/` · `/skaffold.yaml` · `/environment.yml` |
| CI | `/.github/workflows/` |
| **문서 요약(마크다운만)** | `aidlc-docs/construction/u1-shared-foundation/code/` |

---

## 4. 생성 단계

**Phase A(Step 1~6) = PR #1.** 여기까지 머지되면 나머지 5유닛이 착수한다.
**Phase B(Step 7~17)** 는 U1 구현이며, 그 동안 다른 유닛은 이미 병렬로 일하고 있다.

TDD(D-20)에 따라 테스트를 먼저 쓴다. 각 단계의 "테스트" 항목이 그 단계에서 **먼저** 작성될 것이다.

### Phase A — 인터페이스 동결 (PR #1)

- [x] **Step 1 · 워크스페이스 스캐폴딩** — `US-U1-06`
  - 산출: `pnpm-workspace.yaml` · 루트 `package.json` · `tsconfig.base.json` · `.gitignore` · `CODEOWNERS`
  - 산출: `apps/portal/` Next.js 16 + Node 22 골격, `packages/contracts/` · `packages/lib/` 패키지 초기화
  - 근거: `00-overview.md` §5 + UOW-9 (`unit-of-work.md` §2.1·§2.2)
  - CODEOWNERS는 `unit-of-work.md` §2.4의 경로 표를 그대로 옮긴다
  - 테스트: 없음 (설정 파일) — 대신 `pnpm -r typecheck`가 통과해야 함

- [x] **Step 2 · 공유 타입·계약 선언** — `US-U1-04` ⭐
  - 산출: `packages/contracts/{stage,dto,ports,factory,state,index}.ts`
  - `Stage`는 `1_REGISTERED`·`2_...`·`3_...`·`4_...`·`9_COMPLETE`·`X_STOPPED`·`X_FAILED`만.
    **`5`·`6`·`7`·`8` 값을 만들지 않는다** (D-05, R-04)
  - `ports.ts` = `GitHubPort`·`MessagingPort`·`PodPort` (AD-1)
  - `factory.ts` = `validateAndStampPolicy()`·`createSdlcRequest()` 시그니처 (UOW-6)
  - `state.ts` = `getSubStage`·`setSubStage`·`getTransitions` (B-3)
  - 근거: `03-state-machine.md` §1 · `components.md` C-1.1
  - **제약: 런타임 코드 0.** 타입·인터페이스 선언만. Step 6에서 기계 검증한다

- [x] **Step 3 · Drizzle 스키마 선언** — `US-U1-03` ⭐
  - 산출: `packages/lib/db/schema/{core,sdlc,incident,improvement,memory}.ts` + `index.ts` (UOW-8)
  - `core.ts` = `users`·`accounts`·`sessions`·`verification_tokens`(public 스키마, Auth.js 호환) + `secret_refs`·`audit_events`
  - 나머지 4파일은 각 유닛 테이블. `sdlc_requests`는 `sdlc.ts`에 두되 **공유 테이블로 표시**
  - 근거: `04-db-schema.md` 전체. §11.2의 FK 의존 순서와 §11.3의 `pgSchema` 분리를 따른다
  - **정리할 것**: 명세가 `mySchema`와 `sdlcSchema`를 섞어 쓴다 → `sdlcSchema`로 통일
  - 테스트: 스키마 import가 순환 없이 해석되는지, 배럴이 전 테이블을 재수출하는지

- [x] **Step 4 · AuthGuard 계약 선언 + 인증 스킴 정합** — `US-U1-02` ⭐
  - 산출: `packages/lib/auth/guard.ts` (시그니처) · `schemes.ts` (스킴 상수)
  - **F-1 반영 — 10함수**: `requireUser` · `requireAdmin` · `requireOwnership` · `requireMasterKey` ·
    `requirePodToken` · `requireMemoryToken` · `signImageUrl`/`verifyImageToken` ·
    **`requireReconcileToken`** · **`requireCallbackBearer`** · **`requireTokenIssuer`**
  - 근거: `01-auth-github.md` §5·§7 · `05-portal-api.md` 인증 표 · `components.md` C-1.2
  - 산출: `aidlc-docs/construction/u1-shared-foundation/code/auth-scheme-inventory.md` — 스킴↔엔드포인트↔함수 대조표
  - **`components.md`의 C-1.2 정의를 10함수로 갱신** (Application Design 산출물 수정, 근거 F-1 명시)

- [x] **Step 5 · 디자인 토큰** — `US-U1-05`
  - 산출: `packages/lib/ui/tokens.css` · `theme.ts`
  - 다크·라이트 토큰 모두 정의, `prefers-color-scheme` 자동 전환 (Q14=C)
  - 근거: `design/` §2·§3 · `reference-assets/stitch-design-system.md`
  - 레이아웃 적용은 Step 10 (여기서는 토큰만 — PR #1은 선언만 담는다)

- [x] **Step 6 · PR #1 경계 검증**
  - `pnpm -r typecheck` 통과
  - `packages/contracts`에 런타임 코드가 없음을 기계 검증 (컴파일 산출 JS가 비어야 함)
  - `apps/sdlc-slack-gateway`가 아직 없으므로 SVC-4 검사는 Step 15에서
  - 산출: `aidlc-docs/construction/u1-shared-foundation/code/pr1-freeze-manifest.md` — 동결 대상 목록
  - **✋ 이 시점이 다른 5유닛의 착수 신호다**

### Phase B — U1 구현

- [x] **Step 7 · GitHub OAuth 로그인** — `US-U1-01`
  - 산출: `packages/lib/auth/index.ts`(Auth.js v5 설정) · `apps/portal/src/app/(auth)/login/page.tsx`
  - Primary email 보강 로직 포함 (`01-auth-github.md` §3.2)
  - 테스트 먼저: 세션 생성·조회, primary email 보강, 미인증 리디렉션
  - UI에 `data-testid` 부여 (`login-github-button` 등)

- [x] **Step 8 · AuthGuard 구현** — `US-U1-02`
  - 산출: Step 4에서 선언한 10함수의 구현 + `apps/portal/src/middleware.ts`
  - `requireOwnership`은 IDOR 방지 (NFR-12), `requireAdmin`은 **서버측** 역할 검증
  - deny-by-default: 인증 예외 경로는 `01-auth-github.md` §7의 목록으로 한정
  - 테스트 먼저: 함수별 성공/실패, 역할 위조 시도, 타 사용자 리소스 접근, 토큰 스킴 교차 사용 거부
  - 근거 규칙: SECURITY-08 · SECURITY-11 · SECURITY-12

- [x] **Step 9 · 마이그레이션 생성** — `US-U1-03`
  - 산출: `drizzle.config.ts` · `drizzle/` 초기 마이그레이션
  - `04-db-schema.md` §11.2의 13단계 FK 순서 준수 (규정 → 장애·개선 순서 제약 포함)
  - 테스트: 마이그레이션 적용 후 전 테이블·인덱스·FK 존재 확인

- [x] **Step 10 · 글로벌 레이아웃** — `US-U1-05`
  - 산출: `apps/portal/src/app/layout.tsx` · 사이드바(12항목) · 공통 셸
  - 근거: `design/` §3. No-Line 규칙 적용
  - 테스트: 12항목 렌더, 테마 전환, 반응형

- [x] **Step 11 · Helm chart** — `US-U1-07` (UOW-7)
  - 산출: `charts/` — 5개 서비스(Portal · Pod Runner · Memory MCP · Slack Gateway · n8n) + `values.yaml`
  - **`sdlc-endpoints` ConfigMap의 `memoryMcpUrl` 키 정의** (AD-5·B-7의 3자 합의점)
  - Portal `replicas: 2+`, Slack Gateway `replicas: 1` 고정 (NFR-02)
  - 근거: `10-k8s-infrastructure.md`

- [x] **Step 12 · 로컬 스택 기동** — `US-U1-07`
  - 산출: `skaffold.yaml` · `environment.yml`(Conda) · `README.md` 기동 절차
  - 테스트: 로컬 K8s에서 Portal이 기동하고 `/health`가 응답

- [x] **Step 13 · Secret 분리와 RBAC** — `US-U1-08`
  - 산출: `charts/templates/` Secret 정의 · ServiceAccount · Role · RoleBinding
  - 최소 권한 (NFR-19) — Pod 생성·삭제에 필요한 verb만
  - **DB에 평문 비밀 금지** — `secret_refs`에 참조만 (NFR-10)
  - 근거 규칙: SECURITY-06 · SECURITY-07 · SECURITY-12

- [x] **Step 14 · CronJob 2종** — `US-U1-09` **[배치2]**
  - 산출: `charts/templates/cronjob-reconcile.yaml` · `cronjob-improvement-scan.yaml`
  - 호출 대상 엔드포인트의 **정의 소유는 U3·U5**(B-5) — U1은 호출만 한다
  - 인증: reconcile은 `SDLC_RECONCILE_TOKEN`, 스캔은 `SDLC_MASTER_KEY` (F-1 표 참조)
  - 배치2이므로 일정 압박 시 **최우선 절삭 후보** (`unit-of-work-story-map.md` 절삭 시나리오)

- [x] **Step 15 · CI 품질 게이트** — `US-U1-10`
  - 산출: `.github/workflows/ci.yml` — typecheck · lint · 단위 테스트 · **커버리지 게이트**(D-20)
  - **SVC-4 의존 금지 검사 포함** — `apps/sdlc-slack-gateway`가 `packages/*`에 의존하면 실패
    (`unit-of-work.md` §2.5. 워크스페이스가 만든 신규 위험)
  - 근거 규칙: SECURITY-10(공급망) — lockfile 고정·의존성 감사 포함

- [x] **Step 16 · Portal Dockerfile** — `US-U1-06` (UOW-7)
  - 산출: `apps/portal/Dockerfile` — 5유닛 코드를 담으므로 U1 소유
  - 비루트 실행, 멀티스테이지 빌드

- [x] **Step 17 · 문서 요약**
  - 산출: `aidlc-docs/construction/u1-shared-foundation/code/` — `summary.md` · `interfaces.md`(다른 유닛이 읽을 계약) · `auth-scheme-inventory.md`(Step 4) · `pr1-freeze-manifest.md`(Step 6)
  - **마크다운만.** 코드는 여기에 두지 않는다

---

## 5. 스토리 추적

| 스토리 | 배치 | 단계 | 완료 |
|--------|:----:|------|:----:|
| US-U1-01 GitHub 로그인 | 1 | Step 7 | [x] |
| US-U1-02 권한 분리 ⭐ | 1 | Step 4 · 8 | [x] |
| US-U1-03 DB 스키마 ⭐ | 1 | Step 3 · 9 | [x] |
| US-U1-04 공유 타입 ⭐ | 1 | Step 2 | [x] |
| US-U1-05 디자인 토큰 | 1 | Step 5 · 10 | [x] |
| US-U1-06 스캐폴딩 ⭐ | 1 | Step 1 · 16 | [x] |
| US-U1-07 로컬 K8s | 1 | Step 11 · 12 | [x] |
| US-U1-08 Secret·RBAC | 1 | Step 13 | [x] |
| US-U1-09 CronJob | **2** | Step 14 | [x] |
| US-U1-10 CI 게이트 | 1 | Step 15 | [x] |

⭐ 4건이 Phase A(PR #1)를 구성한다 — 이 4건이 5유닛의 착수를 푼다.

---

## 6. 완료 정의 (DoD)

`unit-of-work.md` §3의 공통 DoD + U1 추가 조건:

- [ ] 배치1 9건의 인수 조건 충족
- [ ] TDD 준수 · CI 커버리지 게이트 통과 (D-20)
- [ ] `pnpm -r typecheck` 통과
- [ ] **PR #1이 머지되어 5유닛이 착수 가능** (Step 6)
- [ ] CI에 SVC-4 의존 금지 검사 포함 (§2.5)
- [ ] 인증 스킴 대조표가 명세의 활성 스킴을 빠짐없이 덮음 (F-1)
- [ ] Portal Dockerfile 빌드 + chart 기동 확인

## 7. 규모

**17단계 · 스토리 10건 · 컴포넌트 5개.** Phase A 6단계가 임계 경로이며, 나머지 11단계는
다른 유닛이 병렬로 일하는 동안 진행된다.
