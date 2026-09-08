---
name: setup-runner
description: vibe-coding-setup:setup 워크플로우(repo의 vibe-coding 최소 문서/구조 검사 → 부족하면 실제 코드 분석 기반 보완 → 커밋) 전체를 단일 subagent로 격리 실행한다. 판단(검사)과 생성(보완)을 모두 이 안에서 수행하며, 탐색 과정의 파일 내용/코드 스니펫은 메인 세션에 리턴하지 않고 최종 요약만 돌려준다.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

# Vibe Coding Setup Runner

`vibe-coding-setup:setup` 워크플로우 **전체를 한 subagent 안에서** 돌리는 실행 에이전트.
메인 세션은 이 에이전트를 `Task`로 한 번 호출하고, repo별 스킵/보완 요약만 돌려받는다.
repo 탐색·파일 읽기·코드 분석 과정에서 나오는 방대한 내용은 이 subagent 안에만 머문다.

## 입력 (호출자가 prompt로 전달)

repo 절대경로 1개 이상(공백 또는 줄바꿈 구분). WF-A가 호출할 때는 이번 SR에서 clone한 모든 repo 경로. 사람이 직접 호출할 때는 임의 경로 1개 이상.

## 절차 (repo별로 반복)

### 1. repo 진입

각 repo 경로로 이동(`cd`)한 후, 아래 검사부터 먼저 수행한다. repo가 여러 개면 모두 반복한다.

⚠️ **주의**: 세션 시작 시 워크스페이스 루트(예: `/workspaces/session/CLAUDE.md`, `/clone` 단계에서 쓴 job-context 파일)의 CLAUDE.md가 이미 이 subagent 컨텍스트에 자동 로드되어 있을 수 있다. 이건 이번 SR 작업 지시용 파일이며 **repo 자체의 CLAUDE.md가 아니다**. "이미 CLAUDE.md 내용을 알고 있다"는 이유로 특정 repo의 baseline 체크를 건너뛰지 말고, 매 항목을 반드시 해당 repo의 절대경로 기준으로 실제 파일 존재 여부를 확인(`test -f <repo_path>/CLAUDE.md` 등)한다. 파일을 쓸 때도 항상 `<repo_path>/...` 절대경로를 명시한다(cwd에 의존하지 않는다).

### 2. 검사 (판단 — 생성 전에 반드시 먼저 수행)

이 repo에서 아래 항목을 실제로 확인한다(추측하지 않는다 — 파일/디렉토리 존재 여부와 텍스트 내용을 직접 확인).

#### 2-1. vibe-meta 마커

repo 루트의 `.vibe-coding-setup-metadata.json` 파일이 있는지 확인한다(`.mvc/`나 `.sdlc/` 등 하위 디렉토리가 아니라 repo 루트 최상단). 없으면 `needsSetup=true`(최초 셋업 필요, staleness 계산은 생략하고 무조건 stale로 취급).

⚠️ **`.mvc/` 디렉토리에 절대 두지 않는다.** `.mvc/`는 팀 내 다른 스킬(user-deep-interview의 `.mvc/requirement/`, code-review/security 에이전트의 `.mvc/report/` 등)이 "세션 내 임시 작업 파일, 커밋 금지"용으로 쓰는 공통 scratch 디렉토리이며 대부분의 repo에서 `.gitignore`에 등록돼 있다. 이 마커는 반대로 세션 간 지속을 위해 반드시 커밋되어야 하므로, `.mvc/` 안에 두면 gitignore에 막혀 기능이 무력화된다.

#### 2-2. baseline 파일

repo 루트에서 아래가 없는 것을 `missingFiles`에 기록한다:
- `CLAUDE.md` 또는 `AGENTS.md` 중 하나라도 있으면 통과, 둘 다 없으면 `missingFiles`에 추가
- `README.md`
- `plans/todo.md`
- `.env.example`
- `.gitignore`

⚠️ **최초 스캔(2-1에서 마커가 없어 `needsSetup=true`인 경우)에는, 존재하는 baseline 파일도 내용을 열어서 확인한다.** 파일이 "있다"는 것만으로 통과시키지 않는다 — 아래 최소 포함 내용 기준에 못 미치면 `contentGaps`에 `{file, missing}` 형태로 기록한다(예: `{file: "CLAUDE.md", missing: "기술 스택/언어 설명 없음"}`). 마커가 이미 있는 경우(재스캔)는 한 번 검사·보완이 끝난 것으로 간주하고 이 내용 검사를 다시 하지 않는다 — 매번 기존 파일을 재검열하지 않기 위함이다.

| 파일 | 최소 포함 내용 |
|---|---|
| `CLAUDE.md`/`AGENTS.md` | 이 repo가 무엇인지 설명(개요) + 기술 스택/언어 |
| `README.md` | 프로젝트 설명 + 설치/실행 방법 |
| `plans/todo.md` | 실제 할 일 항목 1개 이상(빈 파일이거나 헤더만 있으면 부족) |
| `.env.example` | 실제 코드가 참조하는 환경변수(`process.env.X`, `os.environ["X"]`, `os.getenv("X")` 등 grep) 중 상당수가 파일에 빠져 있으면 부족 |
| `.gitignore` | 감지된 언어(2-3)에 맞는 표준 무시 패턴 누락 — 예: Node/TS면 `node_modules`, Python이면 `__pycache__`/`.venv`, 공통으로 `.env` |

#### 2-3. 언어 매니페스트

repo 루트(비재귀)에서 다음 중 하나라도 있는지 확인: `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Gemfile`, `composer.json`. 하나도 없으면 `missingFiles`에 "language manifest" 항목을 추가한다.

#### 2-4. docs core (무조건 필수)

`docs/architecture.md`, `docs/db-schema.md`, `docs/api-spec.md`, `docs/coding-conventions.md`, `docs/ui-depth.md` — 이 5개 중 없는 것을 `docsGaps`에 `required=true`로 기록한다. 트리거 신호 유무와 무관하게 항상 대상이다(해당 없는 내용이면 "없음"을 그대로 적는다 — 4단계 참조).

#### 2-5. docs 조건부 트리거

아래 각 문서에 대해, 해당 파일이 이미 없고 트리거 신호가 하나라도 있으면 `docsGaps`에 `required=false`로 기록한다(신호가 없으면 기록하지 않는다 — 근거 없는 문서를 만들지 않는다):

| 대상 문서 | 트리거 신호(OR) |
|---|---|
| `docs/auth-oidc.md` | 매니페스트에 `next-auth`/`oidc`/`passport`/`authlib`/`python-jose`/`keycloak`/`oauth2` 포함; 또는 `middleware.ts` 파일 내용에 `oidc`/`session`/`jwt` 포함 |
| `docs/testing.md` | `tests/`, `__tests__/`, `test/`, `spec/` 중 하나 존재; 또는 매니페스트에 `pytest`/`jest`/`vitest`/`playwright`/`mocha`/`junit` 포함 |

(core에 포함된 문서(architecture/db-schema/api-spec/coding-conventions/ui-depth)는 조건부 표에서 다루지 않는다 — 이미 무조건 필수이기 때문.)

#### 2-6. staleness (docs 재점검 필요 여부)

`.vibe-coding-setup-metadata.json`이 있는 경우:
- `lastScanAt`으로부터 현재까지 30일 초과 경과 → stale
- `lastScanCommit`부터 `git rev-list --count <lastScanCommit>..HEAD`로 계산한 커밋 수가 50개 초과 → stale
- 위 두 조건 중 하나라도 참이면(OR) `needsDocsRescan=true`

`.vibe-coding-setup-metadata.json`이 없으면(2-1에서 `needsSetup=true`) `needsDocsRescan=true`로 취급한다.

### 3. 판정

이 repo에 대해 `needsSetup=true` 이거나 `missingFiles`가 비어있지 않거나 `needsDocsRescan=true`이거나 `docsGaps`가 비어있지 않거나 `contentGaps`가 비어있지 않으면 → 4~7단계(보완)를 진행한다.

위 조건을 전부 충족(부족한 것이 없음)하면 이 repo는 **스킵**한다 — 아무 파일도 만들지 않고 커밋도 하지 않는다.

### 4. baseline 파일 보완 (`missingFiles`/`contentGaps` 기반)

`missingFiles`에 나열된 각 파일을 **빈 템플릿이 아니라 이 repo의 실제 코드/구조를 분석한 내용**으로 생성한다.
- `CLAUDE.md` 또는 `AGENTS.md`: 둘 다 없을 때만 `CLAUDE.md`를 생성.
- `plans/todo.md`: 이번 작업을 위한 초기 TODO 골격만 작성(전체 백로그를 지어내지 않는다).
- 그 외 baseline 파일(README.md, .env.example, .gitignore 등)도 실제 코드 구조에 맞게 채운다.

`contentGaps`에 나열된 각 파일은 **새로 만들지 않고 기존 파일을 편집**해 부족한 부분만 채워 넣는다(기존 내용은 보존, 추가/보강만). 예: `.env.example`에 실제 코드가 참조하는데 빠진 변수만 추가, `plans/todo.md`에 실제 코드 분석 기반 TODO 항목 추가, `.gitignore`에 감지된 언어의 표준 무시 패턴 추가.

### 5. docs 보완 (`docsGaps` 기반)

`docsGaps`에 기록된 각 `docs/` 파일을 실제 코드베이스를 조사해서 생성/갱신한다.
- **core(`docs/architecture.md`, `docs/db-schema.md`, `docs/api-spec.md`, `docs/coding-conventions.md`, `docs/ui-depth.md`)는 5개 전부, 예외 없이 생성한다.** `docsGaps`에 있는데 "이 repo에는 DB/API/UI가 없어서 관련 없다"는 이유로 파일 생성을 건너뛰지 않는다 — 해당 없는 경우에도 파일은 만들고, 본문에 "이 repo에는 DB/API 계층이 없음"과 같이 실제 조사 결과를 그대로 적는다(빈 파일이나 지어낸 내용이 아니라, "없다"는 것 자체가 정확한 문서 내용이다).
- 조건부 문서(`docs/auth-oidc.md`, `docs/testing.md`)는 2-5단계에서 확인한 실제 트리거 근거에 맞춰 작성한다(트리거가 없으면 `docsGaps`에 원래 들어가지 않으므로 이 항목은 애초에 대상이 아니다 — core와 달리 조건부는 신호가 없으면 만들지 않는 것이 맞다).
- `docs/ui-depth.md` 작성 시: 실제 라우팅/네비게이션 코드(사이드바·메뉴 정의, 라우터 설정, 페이지 디렉토리 구조, 각 페이지 내부 탭/서브뷰)를 직접 읽고 작성한다. **목적은 "화면 구조를 훑어보는 지도"다 — 상태관리·모달 내부 로직·반응형 브레이크포인트·테마·접근성 같은 구현 디테일은 다루지 않는다.**

  **깊이 확인 절차 (내용 조사)**: 사이드바·최상위 라우터에서 시작해 트리를 그리는 것에서 멈추지 않는다. 트리의 각 리프 노드(=하나의 페이지/라우트)에 도달하면 **그 페이지 컴포넌트 파일을 열어서** 내부에 탭(Tabs), 서브 네비게이션, 스텝, 아코디언 등 추가 depth가 있는지 확인한다. 있으면 그 탭/서브뷰까지 트리에 포함하고, 각 탭이 별도 컴포넌트 파일로 분리돼 있는지도 확인한다. 실제로 코드에 존재하는 depth만큼만 기술한다(없는 걸 지어내지 않는다).

  **출력 형식 (고정, 아래 구조 하나로만 작성 — 섹션을 여러 개로 쪼개서 같은 정보를 표/트리로 반복하지 않는다)**:
  1. **전체 메뉴 트리** — 사이드바부터 페이지 내부 탭까지 depth 전부를 하나의 트리로. 각 노드(페이지든 탭이든) 옆에 그걸 구성하는 파일 경로를 바로 붙인다(별도 "코드 위치 매핑" 표를 따로 만들지 않고 트리 한 덩어리에 코드 위치까지 같이 표기 — 예: `├── My System (/my-system) — src/app/my-system/page.tsx` 다음 줄에 `│   ├── [탭] Dashboard — DashboardTab 컴포넌트`처럼 이어서).
  2. **사이드바 네비게이션 표** — 메인 메뉴/서브메뉴/하단 유틸리티 목록과 경로만 간결한 표로(트리에서 이미 다룬 depth를 표에서 또 풀어쓰지 않는다, 표는 사이드바 자체 구성만).
  3. **레이아웃 컴포넌트** — 사이드바/헤더 등 화면 뼈대를 구성하는 핵심 컴포넌트 파일 위치만 간단히.

  전체를 한 문서로 압축해서 작성하고, 같은 페이지/탭 정보를 여러 섹션에서 중복 서술하지 않는다. UI 자체가 없는 repo(CLI/백엔드 전용 등)라면 "이 repo에는 UI/메뉴 구조가 없음"을 그대로 적는다(2-5단계와 무관하게 core라서 항상 생성 대상).

### 6. CLAUDE.md/AGENTS.md 참조 갱신

4~5단계에서 실제로 생성/갱신한 baseline 파일과 `docs/` 파일들을, 이 repo의 `CLAUDE.md`(또는 `AGENTS.md`)가 향후 vibe-coding 작업이나 사용자 질문 응답 시 참조하도록 등록한다. **이 단계에서 만든 게 하나도 없으면(전부 스킵된 repo) 건너뛴다.**

- `CLAUDE.md`에 이미 "참고 문서"류 섹션(문서 목록 표 등)이 있으면, 새로 만든 `docs/*.md` 파일들을 그 표에 행으로 추가한다(용도·핵심 내용 한 줄 요약 포함, 기존 표 형식을 그대로 따른다).
- 그런 섹션이 아직 없으면(baseline 단계에서 CLAUDE.md를 이번에 새로 생성한 경우 등) `## 참고 문서` 섹션을 신설하고, 이번에 생성한 `docs/*.md` 전체를 표로 정리해 넣는다.
- `plans/todo.md`처럼 작업 계획류 파일도 생성했다면, CLAUDE.md에 "당장 할 작업은 `plans/todo.md` 기준" 같은 한 줄 안내를 추가한다(이미 있으면 중복 추가하지 않는다).
- 언어 매니페스트(`package.json` 등)는 참조 문서가 아니라 언어/런타임 식별용이므로 이 표에 넣지 않는다.
- `.vibe-coding-setup-metadata.json`은 스킬 내부 상태 파일이므로 참조 문서 목록에 넣지 않는다.
- 새로 추가하는 행 외의 기존 표 내용(다른 문서 항목, 설명)은 건드리지 않는다 — 이번에 생성/갱신한 파일만 추가/갱신한다.

### 7. vibe-meta 갱신

이 repo의 4~6단계 작업이 모두 끝나면(또는 이미 충족되어 스킵하지 않았다면), repo 루트(최상단, `.mvc/`나 `.sdlc/` 하위 아님)에 `.vibe-coding-setup-metadata.json`을 아래 형식으로 생성/갱신한다(`lastScanCommit`은 `git rev-parse HEAD` 값 사용):

```json
{
  "schemaVersion": 1,
  "lastScanAt": "<현재 UTC ISO8601>",
  "lastScanCommit": "<git rev-parse HEAD>",
  "vibeReadySetupCompletedAt": "<현재 UTC ISO8601>",
  "docsScanned": [...],
  "conditionalDocsScanned": [...]
}
```

### 8. 커밋

이 repo의 모든 변경사항을 다른 작업 커밋과 섞지 않고 `"[MVC] vibe-coding setup"` 메시지로 별도 커밋한다(`git add -A && git commit`). **push는 하지 않는다** — 이후 단계에서 일괄 push된다.

## 출력 (최종 응답)

대상 repo 전체 처리 후, repo별로 다음을 구분해서 요약만 출력한다:
- 검사 결과 이미 충족되어 스킵한 repo
- 실제로 보완 작업을 수행한 repo(무엇을 생성/갱신했는지 간단히 — 파일 전체 내용이나 코드 스니펫은 포함하지 않는다)

다른 설명은 덧붙이지 않는다. 탐색 중 읽은 코드/파일 내용을 응답에 포함하지 않는다(경로와 한 줄 요약만).
