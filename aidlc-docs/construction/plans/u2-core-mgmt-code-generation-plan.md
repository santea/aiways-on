# U2 코어SDLC (관리) — Code Generation Plan

> **단계**: CONSTRUCTION / Code Generation — Part 1 (계획)
> **유닛**: U2 `코어SDLC (관리)` · 담당 D2 · 스토리 8건
> **선행**: U1 PR #1 머지 완료 (`interfaces.md` 기준) — 착수 조건 충족
> **이 문서가 U2 Code Generation의 단일 진실 공급원이다.** Part 2는 여기 적힌 단계만 실행한다.

---

## 1. 유닛 컨텍스트

| 항목 | 내용 |
|------|------|
| **목적** | SR의 접수·조회와 GitHub 연동. 사람이 보는 관리 화면 |
| **컴포넌트** | C-2.1 `RequestIntake` · C-2.2 `RequestQuery` · C-2.3 `GitHubAdapter` · C-2.4 `AdminConsole` · C-2.5 `ImageProxy` |
| **배포 서비스** | 없음 — 전부 SVC-1 Portal 안에 들어간다 |
| **스토리** | 8건 = 배치1(Must) 6 + 배치2(Should) 2 |

### 책임 / 비책임 (`unit-of-work.md` §1)

- **책임**: `POST /intake` 멱등 접수 · 대시보드·SR 목록·상세 · `GitHubPort` **구현** · 관리 화면 셸 · 목업 이미지 업로드·서명 서빙
- **비책임**:
  - 상태 전이를 **직접 하지 않는다** — `StateMachine`은 U3 소유, U2는 읽기만 (B-3)
  - SR을 **직접 INSERT 하지 않는다** — 반드시 Factory 경유 (B-1)
  - `GitHubPort` **인터페이스를 바꾸지 않는다** — 인터페이스는 U1 소유 (AD-4)

### 소유 DB 엔티티

U2는 새 테이블을 만들지 않는다. U1이 이미 선언한 아래 테이블에 **읽기·쓰기만** 한다.

| 테이블 | 용도 | 편집 소유 |
|--------|------|:--------:|
| `sdlc_github_credentials` · `sdlc_github_orgs` · `sdlc_github_repos` | Org·Repo·자격증명 관리 | U3 파일(`schema/sdlc.ts`) — 변경 불필요 |
| `sdlc_github_issues` · `sdlc_github_pull_requests` | Issue·PR 연동 | 동일 |
| `sdlc_request_images` | 목업 이미지 | 동일 |
| `sdlc_repo_files` · `sdlc_repo_env_vars` · `sdlc_repo_setup_jobs` | Repo 등록 부가 정보 | 동일 |
| `sdlc_requests` · `sdlc_stage_transitions` | 조회 전용 (쓰기는 Factory·StateMachine) | **U1 승인 대상** |
| `secret_refs` · `audit_events` | PAT 암호문 저장 · 감사 로그 | **U1만** (`schema/core.ts`) |

> **스키마 변경이 0건이므로 마이그레이션도 생성하지 않는다.** 필요해지면 U1이 일괄 생성한다.

### 경계 (`component-dependency.md` B-1~B-4)

| 경계 | 방향 | 이 유닛에서의 의미 |
|------|------|------------------|
| **B-1** | U2 → U3 | `SdlcRequestFactory` · `PodPort` — stub으로 착수, U3 T1·T2 완료 후 교체 |
| **B-2** | U3 → U2 | `GitHubPort` 구현을 U2가 제공. U3는 **인터페이스 타입으로만** 호출 |
| **B-3** | U2 → U3 | `StateMachineReader`(`getStage`·`getSubStage`·`getTransitions`) 읽기 전용 |
| **B-4** | Pod → U2 | 이미지 업로드 엔드포인트 (배치2) |

---

## 2. SATISFIED 참조 문서 충분성 검증

Workflow Planning에서 Functional·NFR·Infrastructure Design을 SATISFIED로 처리했으므로,
U2에 대해 원본 명세가 충분한지 **실제로 열어 확인했다.**

| 참조 문서 | U2 범위에 대한 판정 |
|----------|-------------------|
| `05-portal-api.md` §2.1·2.3·2.4·2.10·2.11·2.13·2.14 · §3 · §4.2·4.8·4.9 · §7·§8 | ✅ 충분 — 요청·응답 예시와 인증 매트릭스까지 구체적 |
| `04-db-schema.md` + U1 `schema/sdlc.ts` | ✅ 충분 — 필요한 테이블 전부 이미 선언됨 |
| `08-sr-registration-ui.md` §3~§6·§9·§11 | ✅ 충분 — 폼 필드·권한·컴포넌트까지 규정 |
| `01-auth-github.md` §5 + U1 `AuthGuard` 10함수 | ✅ 충분 |
| `03-state-machine.md` §1.2 | ✅ 충분 — 접수 = 등록 + 즉시 프로비저닝, 실패 시 보상 |
| `design/` §4.2·4.4·5.1·6.2 | ⚠️ **부분 부족 — F-3** (구 Stage 체계) |
| `00-overview.md` §6 기술 스택 | ⚠️ **부분 부족 — F-1** (U1 산출물과 불일치) |
| `04-db-schema.md` §8.1 암호화 | ⚠️ **부분 부족 — F-2** (구현 소유자 없음) |

---

## 3. 착수 전 해소해야 할 발견 사항

### ⚠️ F-1 — Tailwind v4 + shadcn/ui가 도입되지 않았다 (**승인 시 결정되는 항목**)

`00-overview.md` §6은 스타일링을 **Tailwind CSS v4**, 컴포넌트를 **shadcn/ui (Radix UI + Tailwind)** 로
못 박는다. `08-sr-registration-ui.md` §9와 `design/` §7은 16종 컴포넌트를 이름으로 지정한다.
그런데 U1이 만든 것은 `tokens.css` + `layout.css` 의 **순수 CSS**이고, `apps/portal/package.json`에
Tailwind·Radix 의존이 없다.

**U2가 첫 UI 유닛이므로 이 결정이 지금 내려진다.** 그리고 U2만의 문제가 아니다 —
`/incidents`(U4) · `/improvements`(U5) · `/memory`(U6) 세 유닛이 같은 컴포넌트 어휘를 쓴다.
U2가 손으로 만들면 세 유닛이 각자 또 만든다. **U1의 F-1(AuthGuard 분산)과 같은 구조의 문제다.**

| 안 | 내용 | 대가 |
|----|------|------|
| **A (권장)** | 명세대로 Tailwind v4 + shadcn/ui 도입. `@theme`을 **기존 `tokens.css` 변수에 연결**해 design §2.1 "raw hex 금지"를 유지하고 U1의 `layout.css`는 그대로 둔다 | 초기 셋업 비용. 대신 shadcn은 복사형 컴포넌트라 프레임워크 도입이 아님 |
| **B** | U1의 순수 CSS를 이어가고 프리미티브를 손으로 작성 | 명세 §6 이탈이 확정됨. Dialog·Select의 접근성을 직접 책임져야 함 |

> **권장은 A다.** 근거: ① `requirements/`가 SSOT이고 Q5=A(명세 우선)가 이미 확정됨,
> ② 뒤따르는 3개 UI 유닛의 중복을 막는 것이 U1에서 AuthGuard를 10함수로 넓힌 것과 같은 판단,
> ③ shadcn 컴포넌트는 파일 복사이므로 되돌리기 쉽다.
> **이 계획을 승인하면 A를 승인하는 것이다.** B를 원하면 승인 대신 그렇게 말해 달라.

### ⚠️ F-2 — 공유 유틸 2종에 소유자가 없다

U1이 표를 만들었지만 그 표에 쓰는 코드는 만들지 않았다. 지금 정하지 않으면 유닛마다 각자 만든다.

| 빠진 것 | 근거 | 지금 안 정하면 |
|--------|------|--------------|
| **`secret_refs` AES-256-GCM 암·복호화** | `04-db-schema.md` §8.1 · `01-auth-github.md` §6 — PAT 평문 저장 금지(NFR-10) | U2가 PAT·repo 파일·env var로, U6가 MCP 토큰으로 각각 구현 → 암호화 구현이 2벌 (SECURITY-03·11 위반 위험) |
| **`AuthError` → §7 표준 오류 응답 매퍼** | `05-portal-api.md` §7 `{code, message}` | 4개 유닛의 라우트가 각자 try/catch를 쓰며 오류 포맷이 갈라짐 |

**제안**: 둘 다 `packages/lib/`(U1 소유)에 둔다 — `src/crypto/secret-ref.ts`, `src/http/api-error.ts`.
U1의 F-1 해소와 같은 방식이며, **U1 승인 대상**임을 PR 설명에 명시한다.

### ⚠️ F-3 — `design/` §5.1·§6.2의 Stage 체계가 낡았다

`design/` §5.1 배지표는 `5_READY_FOR_DEPLOY`·`7_DEV_SERVER_TEST`·`8_COMPLETED`·`0_QUEUED`를,
§4.4·§6.2 Flow는 `① → ② → ③ → ④ → ⑤ → ⑦ → ⑧`을 쓴다. **D-05·R-04는 Stage 5·6·7·8이
존재하지 않는다고 못 박았고**, `contracts/stage.ts`에도 그 값들이 없다. `0_QUEUED`는 대기 큐
자체가 없으므로(`03-state-machine.md` §1.2) 더더욱 성립하지 않는다.

**해소**: Q5=A(명세 우선)에 따라 **`08-sr-registration-ui.md` §5.2·§6.2·§7을 따른다.**
그 문서는 이미 `1→2→3→4→9`로 갱신되어 있다. 배지 매핑은 아래로 확정한다.

| 상태 | 배지 | 근거 |
|------|------|------|
| `1_REGISTERED`~`4_DEV_IN_PROGRESS` | `accent` | design §5.1 "진행 중" 행의 의미를 현 Stage 집합에 적용 |
| `9_COMPLETE` | `success` | design §5.1 `8_COMPLETED` 행의 계승 |
| `X_STOPPED` | `warning` | design §5.1 그대로 |
| `X_FAILED` | `error` | design §5.1 그대로 |

대시보드 카드는 **진행 / 완료 / 실패 3장**이다 (`08-sr-registration-ui.md` §5.2). `design/` §4.2의
"대기" 카드는 `0_QUEUED`가 없으므로 만들지 않는다. **`design/` 문서는 수정하지 않는다** — 정리
여부는 사용자 판단이며 C-1과 함께 남긴다.

### ⚠️ F-4 — 커버리지 게이트가 `apps/`를 재지 않는다

`vitest.config.ts`의 `coverage.include`는 `packages/lib/src/**/*.ts` **한 줄뿐**이고,
CI(`ci.yml`)는 그 설정 그대로 `vitest run --coverage`를 돌린다. U2 코드는 전부
`apps/portal/src/**`에 있으므로 **커버리지 집계에 한 줄도 들어가지 않는다.**

방치하면 D-20의 "TDD + CI 커버리지 게이트"가 U2~U6 다섯 유닛에 대해 사실상 무효가 된다.
U1이 97.29%를 낸 것은 U1 코드가 `packages/`에 있었기 때문이다.

**해소**: `coverage.include`에 `apps/portal/src/features/**/*.{ts,tsx}` 와
`apps/portal/src/app/api/**/*.ts` 를 추가한다. `vitest.config.ts`는 루트 설정이므로 **U1 승인 대상**.
화면 컴포넌트(`app/**/page.tsx`)는 제외한다 — 렌더 테스트는 Build and Test 단계의 E2E가 맡는다.

### ⚠️ F-5 — 배치2 전제: S3 환경변수가 chart에 없다

`10-k8s-infrastructure.md` §7은 `S3_ENDPOINT`·`S3_BUCKET`·`S3_ACCESS_KEY`·`S3_SECRET_KEY`를
필수로 정의하지만 `charts/aiways-on/templates/portal.yaml`에는 `SDLC_IMAGE_SIGNING_SECRET`만 있다.
US-U2-07(배치2)에 필요하며 **chart는 U1 소유**이므로 Step 17에서 U1 승인 항목으로 처리한다.

### ℹ️ F-6 — 웹 터미널은 U2 범위가 아니다 (기록만)

`08-sr-registration-ui.md` §6.5와 `design/` §4.4는 SR 상세의 **웹 터미널**(`/terminal/stream` 등 5개
엔드포인트, K8s `pods/exec`)을 규정한다. 경로는 `requests/*` 아래라 U2 소유 구역이지만,
**`requirements.md`의 FR에도 `stories.md`의 어느 스토리에도 없다.** Requirements Analysis에서
이미 빠진 것으로 보이며, U2가 임의로 되살리지 않는다. `design/` §4.4의 "재개발 / 테스트 진행"
버튼도 같다 — 그 버튼들은 존재하지 않는 Stage 7에 걸려 있다.
**U2는 `08-sr-registration-ui.md` §6.3대로 "중지" 버튼 하나만 만든다.**

---

## 4. 코드 위치

**애플리케이션 코드는 워크스페이스 루트에만 쓴다. `aidlc-docs/`에는 마크다운 요약만 남긴다.**

```
apps/portal/src/
├── app/
│   ├── (dashboard)/                        ← U2 소유 (CODEOWNERS)
│   │   ├── page.tsx                        # 대시보드   US-U2-02
│   │   ├── register/page.tsx · actions.ts  # SR 등록    US-U2-01
│   │   └── requests/
│   │       ├── page.tsx                    # 내 요청    US-U2-02
│   │       └── [id]/page.tsx · actions.ts  # SR 상세    US-U2-03
│   ├── admin/orgs/page.tsx · repos/page.tsx                     US-U2-05
│   └── api/v1/sdlc/
│       ├── intake/route.ts                                      US-U2-04
│       ├── requests/route.ts · [id]/route.ts
│       ├── requests/[id]/github-links/route.ts · issues/route.ts
│       ├── requests/[id]/audit/route.ts · channel-image/route.ts  [배치2]
│       ├── images/[imageId]/route.ts                              [배치2]
│       ├── orgs/route.ts · repos/route.ts · credentials/route.ts
│       └── generate-request-no/route.ts · dev-types/route.ts
├── features/u2-core-mgmt/                  ← U2 소유
│   ├── intake/          C-2.1
│   ├── query/           C-2.2
│   ├── github/          C-2.3  (adapter · client · repository)
│   ├── images/          C-2.5  [배치2]
│   ├── audit/                  [배치2]
│   ├── request-no.ts · status-badge.ts     # 순수 함수
│   └── stubs/           B-1·B-3 테스트 더블
└── components/ui/                          ← 공유 프리미티브 (F-1 A안), CODEOWNERS 추가 대상

packages/lib/src/crypto/ · src/http/        ← F-2, U1 승인 대상
vitest.config.ts · CODEOWNERS · charts/     ← F-4·F-1·F-5, U1 승인 대상
```

> **`apps/portal/src/app/page.tsx` 이관**: U1이 만든 루트 페이지는 `/`를 차지한다. 대시보드가
> `(dashboard)/page.tsx`로 들어가면 같은 경로가 둘이 되어 빌드가 깨진다. Step 11에서 **삭제하고**
> `(dashboard)/page.tsx`로 대체한다. U1이 만든 파일이므로 PR 설명에 명시한다.

---

## 5. 생성 단계

각 단계는 **테스트 우선(RED) → 구현(GREEN) → 정리** 순서로 실행한다 (D-20, UOW-4로 완화되지 않음).

### Phase 1 — 공유 결정과 경계

- [x] **Step 1 · U1 공유 영역 변경 4건** — F-1·F-2·F-4 해소 ⭐
      - `packages/lib/src/crypto/secret-ref.ts` — AES-256-GCM 암·복호화 + `secret_refs` 저장·조회 (테스트 우선)
      - `packages/lib/src/http/api-error.ts` — `AuthError`·검증 실패 → `{code, message}` + HTTP 매핑 (§7 표 전건)
      - `vitest.config.ts` — `coverage.include`에 `apps/portal/src/features/**`·`app/api/**` 추가
      - `CODEOWNERS` — `/apps/portal/src/components/` → `@u1-owner` 추가
      - (F-1 A안 승인 시) Tailwind v4 + shadcn 기반 설정, `@theme`을 `tokens.css` 변수에 연결
      - **전부 U1 승인 대상** — PR 설명에 영향 범위 기재

- [x] **Step 2 · 경계 stub 3종** — `US-U2-03`·`US-U2-04` (B-1·B-3)
      - `SdlcRequestFactoryStub` — 고정 SR 반환. **`metadata`에 `channelTypes`·`autoMergeAllowed`를 각인해 반환** (필수 조건 ②, AD-3)
      - `PodPortStub` — `provision()` 성공 + 고정 Pod 이름, `terminate`·`getSession` 포함
      - `StateMachineStub` — `getStage`·`getSubStage`·`getTransitions` 고정값 (**Reader만**. `advance`·`setSubStage`는 구현하지 않는다 — B-3 읽기 전용)
      - 주입 지점을 한 곳(`features/u2-core-mgmt/deps.ts`)으로 모아 U3 완료 시 **한 파일만** 바꾸면 되게 한다

- [x] **Step 3 · 순수 함수 + PBT** — `US-U2-01`·`US-U2-02`
      - `request-no.ts` — `formatRequestNo(ymd, seq)` / `parseRequestNo` (`SR-YYYYMMDD-NNN`)
      - `dedup-key.ts` — 접수 멱등 키 생성
      - `status-badge.ts` — Stage → `AccentLevel` 매핑 (F-3 확정표). `@aiways/lib/ui`의 `accentTokens` 사용, raw hex 금지
      - **PBT (PBT-02)**: `parseRequestNo(formatRequestNo(x)) === x` 왕복 성질 + 매핑 전사(全射) 성질

### Phase 2 — GitHub 연동 (C-2.3)

- [x] **Step 4 · Org·Repo·Credential 리포지토리** — `US-U2-05`
      - PAT는 Step 1의 암호화 모듈을 통해 `secret_refs`에만 저장. **평문을 어떤 컬럼·로그·응답에도 남기지 않는다** (NFR-10, SECURITY-03)
      - `files`·`envVars`도 동일하게 `sdlc_repo_files`·`sdlc_repo_env_vars` + `secret_refs`

- [x] **Step 5 · `GitHubAdapter` = `GitHubPort` 구현** — `US-U2-06` ⭐
      - `implements GitHubPort` 로 선언해 계약 이탈이 typecheck에서 걸리게 한다 (U2 추가 DoD)
      - `ensureIssue`·`ensurePullRequest` **멱등** (NFR-07) — 재호출 시 기존 것 반환
      - **`ensurePullRequest`는 commit 이력이 없으면 `null`을 반환한다** (B-2 특수 케이스). 테스트로 이 경로를 고정한다
      - `mergePullRequest`는 정책을 판단하지 않는다 — 호출자가 각인된 `autoMergeAllowed`를 읽는다 (AD-3)
      - `closeIssue`·`deleteBranch` — `null` 분기의 후속 처리
      - GitHub API 호출은 주입 가능한 클라이언트로 감싸 네트워크 없이 테스트한다

- [x] **Step 6 · 관리자 API** — `US-U2-05`
      - `GET/POST /orgs` · `GET/POST /repos` · `POST /credentials` — 전부 `requireAdmin`
      - `POST /credentials` 응답에 `pat` **불포함** 검증 테스트
      - `user` 권한 호출 시 403 + `{code:'FORBIDDEN'}` 검증

### Phase 3 — 접수·조회 (C-2.1 · C-2.2)

- [x] **Step 7 · `RequestIntake` + `POST /intake`** — `US-U2-04` ⭐
      - `requireMasterKey` → 스키마 검증(실패 400 `VALIDATION_ERROR`, NFR-11) → **Factory 경유 생성**(B-1, 직접 INSERT 금지) → `PodPort.provision()`
      - 동일 `dedupKey` 재호출 시 새 SR을 만들지 않고 기존 SR 반환 (멱등)
      - 프로비저닝 실패 시 대기 상태로 남기지 않고 보상 경로로 `X_FAILED` (`03-state-machine.md` §1.2·§6). **보상 자체는 U3 소유** — U2는 실패를 U3 경로로 넘기고 대기 상태를 만들지 않는 것까지가 책임
      - 201 `{ requestNo, status: '1_REGISTERED' }`

- [x] **Step 8 · `RequestQuery` + 조회 API** — `US-U2-02`·`US-U2-03`
      - `GET /requests` — `status`·`search`·`page`·`limit`, `{items,total,page,limit}`. **`user`는 `submitterId = 본인`만, `admin`은 전체** (`requireOwnership` 규칙, NFR-12)
      - `GET /requests/{id}` — 채널·Pod·GitHub·`stageHistory`·`metadata.devSubStage` 포함. 상태·substage·이력은 **`StateMachineReader`로만** 읽는다 (B-3)
      - `GET /requests/{id}/github-links`
      - 타인 SR 접근 시 403 검증 테스트 (IDOR)

- [x] **Step 9 · 등록 폼 보조 API** — `US-U2-01`
      - `GET /generate-request-no` — 날짜별 일련번호. **서버에서만 시각 생성**
      - `GET /dev-types` — `feature`·`bugfix`·`refactor`·`hotfix`

- [x] **Step 10 · `POST /requests/{id}/issues`** — `US-U2-06`
      - `requireMasterKey`. `repos[]`가 문자열/`{repo,branch}` 양쪽 형태를 받는다
      - `work_branch` 저장 (PR 생성 시 재계산 위험 제거)
      - 실패 시 500 `GITHUB_ISSUE_CREATION_FAILED` + repo 식별자

### Phase 4 — 화면 (C-2.4)

모든 상호작용 요소에 `data-testid`를 `{component}-{element-role}` 규칙으로 붙인다.

- [x] **Step 11 · 대시보드 `/`** — `US-U2-02`
      - `app/page.tsx` 삭제 → `(dashboard)/page.tsx` 신설 (§4 이관 주의)
      - 진행/완료/실패 3카드 + SR 목록 테이블 + 상태 필터·검색·페이지네이션
      - 배지 색은 Step 3의 매핑 사용 (F-3)

- [x] **Step 12 · SR 등록 `/register` + Server Action** — `US-U2-01`
      - 폼 필드 13종 (`08-sr-registration-ui.md` §3.2), 필수 미입력 시 제출 차단 + 사유 표시
      - 제출자 정보는 **세션에서 서버가 주입**한다. 클라이언트가 보낸 `submitter*` 값을 신뢰하지 않는다 (NFR-12)
      - 실패 시 일반 오류 메시지만 노출, 내부 정보 미노출 (NFR-16)
      - 성공 시 SR 번호 표시 후 상세로 이동

- [x] **Step 13 · 내 요청 `/requests`** — `US-U2-02`

- [x] **Step 14 · SR 상세 `/requests/[id]`** — `US-U2-03` ⭐
      - 단계 Flow `① 등록 → ② 요구사항 → ③ 설계 → ④ 개발 → ⑨ 완료`. **Stage 5·6·7·8을 렌더링하지 않는다**
      - incident·improvement 프로파일은 ②·③을 건너뛴 형태로 렌더 (`1→4→9`)
      - 완료=success · 진행 중=accent 펄스 · 실패=error (design §6.6)
      - Stage 4일 때 DevSubStage 4종 진행 표시 (`metadata.devSubStage`)
      - Slack 채널·Pod·Issue·PR 링크, 단계 이력 시간순, 실패 사유
      - 액션 버튼은 **"중지" 하나뿐** (F-6)

- [x] **Step 15 · 관리 화면 `/admin/orgs` · `/admin/repos`** — `US-U2-05`
      - 전 라우트 `requireAdmin`, `user` 접근 시 403 화면
      - 자격증명 입력값은 저장 후 화면에 평문 재표시 금지 (NFR-10)

### Phase 5 — 배치2 (Should) · 범위 압박 시 절삭 후보

- [x] **Step 16 · 감사 로그 `POST /requests/{id}/audit`** — `US-U2-08`
      - `requireMasterKey`, `audit_events` 적재
      - **토큰·비밀번호 마스킹 후 저장** (NFR-14, SECURITY-03)
      - **append-only** — 애플리케이션 경로에 UPDATE·DELETE를 만들지 않는다 (NFR-18). 삭제 시도가 실패함을 테스트로 고정

- [x] **Step 17 · `ImageProxy`** — `US-U2-07` (C-2.5)
      - `POST /requests/{id}/channel-image` (multipart, `requireMasterKey`) → S3 저장 → `sdlc_request_images` → 서명 URL 반환
      - `GET /images/{imageId}?token=` — `verifyImageToken`. 토큰 없음·만료 시 **403**
      - 미들웨어 public 예외에 이미지 경로 추가 필요 여부 확인 (`middleware.ts`는 U1 소유)
      - chart에 `S3_*` 4종 추가 (F-5, U1 승인)

### 마무리

- [x] **Step 18 · 경계 검증 + 문서 요약**
      - `pnpm -r typecheck` · `pnpm vitest run --coverage`(확장된 include로) · `pnpm build` · `verify:*` 2종
      - `GitHubAdapter implements GitHubPort` typecheck 확인 · `ensure*` 멱등 확인 · `null` 반환 경로 확인 (U2 추가 DoD)
      - stub 3종이 `unit-of-work-dependency.md` §6 목록과 일치하는지 대조
      - `aidlc-docs/construction/u2-core-mgmt/code/` 에 `summary.md` · `boundary-notes.md` 작성

---

## 6. 스토리 추적

| 스토리 | 배치 | 담당 단계 | 경계 |
|--------|:----:|----------|------|
| US-U2-01 SR 신규 등록 | 1 | 3 · 9 · 12 | — |
| US-U2-02 대시보드 진행 현황 | 1 | 3 · 8 · 11 · 13 | — |
| US-U2-03 SR 상세 파이프라인 추적 | 1 | 2 · 8 · 14 | B-3 (`StateMachineStub`) |
| US-U2-04 접수와 즉시 프로비저닝 | 1 | 2 · 7 | B-1 (`Factory`·`PodPort` stub) |
| US-U2-05 Org·Repo·자격증명 관리 | 1 | 1 · 4 · 6 · 15 | — |
| US-U2-06 GitHub Issue·PR 연동 | 1 | 5 · 10 | B-2 (U3가 소비) |
| US-U2-07 목업 이미지 확인 | 2 | 17 | B-4 |
| US-U2-08 감사 로그 적재 | 2 | 16 | — |

---

## 7. 완료 정의 (DoD)

공통 (`unit-of-work.md` §3) + U2 추가분:

- [x] 배치1 6건의 인수 조건 전부 충족
- [x] TDD 준수 · 커버리지 게이트 통과 (F-4 해소 후의 확장된 집계 기준)
- [x] stub 3종이 `unit-of-work-dependency.md` §6과 일치, 주입 지점 단일화
- [x] **`GitHubAdapter`가 `GitHubPort`를 implements (typecheck)**
- [x] **`ensure*` 멱등 확인**
- [x] **commit 이력 없을 때 `null` 반환 경로 검증**
- [x] U2 라우트 전부가 `AuthGuard` 함수 중 하나를 통과 (public은 명시적 예외)
- [ ] B-1~B-4 규약을 PR 설명에 명시
- [x] SR 직접 INSERT 0건 · 상태 전이 호출 0건 (B-1·B-3 준수를 코드 검색으로 확인)

---

## 8. 확장 규칙 준수 (활성 3종)

| 확장 | U2에서의 적용 |
|------|--------------|
| **security-baseline** (전체) | SECURITY-03 비밀 마스킹(Step 4·16) · SECURITY-11 인증 단일화(전 라우트 `AuthGuard`) · IDOR 방지(Step 8) · 입력 검증(Step 7·12) · 오류 메시지 정보 누출 금지(Step 12) |
| **resiliency-baseline** | RESILIENCY: 접수 실패를 대기 상태로 남기지 않음(Step 7) · 멱등 재시도 안전(Step 5·7·10). R7=D에 따라 복원력 **테스트**는 생략(사용자 승인 예외) |
| **property-based-testing** (부분) | PBT-02 — 순수 함수 왕복 성질만 (Step 3). 상태머신 PBT 3건은 U3 소유이므로 U2에는 해당 없음 |

---

## 9. 규모

| 항목 | 예상 |
|------|------|
| 단계 | 18 (배치1 15 · 배치2 2 · 마무리 1) |
| 신규 파일 | 라우트 13 · 화면 6 · feature 모듈 ~14 · stub 3 · 공유 2 · 테스트 다수 |
| 스키마 변경 | **0건** (마이그레이션 없음) |
| U1 승인이 필요한 변경 | `packages/lib/crypto`·`http` · `vitest.config.ts` · `CODEOWNERS` · `charts/portal.yaml` · (A안 시) 스타일 설정 |
