# mis-vibe-coding (mvc)

MIS 팀원들을 위한 Claude Code 플러그인 마켓플레이스 - 기능별 plugin 모음

## 포함 Plugin

| Plugin | 명령어 | 설명 |
|--------|--------|------|
| `agent-teams` | `/agent-teams:*` | Agent Teams 병렬 개발 (Lv1/2/3) |
| `documentation` | `/code-documentation:*` | 코드 문서화 자동 생성 |
| `mis-mcp` | - | knox-api 등 MIS MCP 서버 연동 |
| `sdl` | `/sdl:*` | SDL 프레임워크 개발 표준 가이드 |
| `sdlc` | `/sdlc:*` | SDLC 를 통한 SR 처리 — deep-interview, capture-mockup(Before/After 화면 캡처) 등 |
| `dev-agent` | `/dev-agent:*` | 경량 CI 파이프라인 — 보안/품질 점검, git push, 보고서+메일 |
| `vibe-coding-setup` | `/vibe-coding-setup:*` | repo의 vibe-coding 최소 문서/구조 검사 + 자동 보완 (SDLC 파이프라인/독립 호출 모두 지원), 사내 프록시(repository-proxy) 가이드 |

## 설치

### 전체 설치

```bash
# 마켓플레이스 등록
/plugin marketplace add https://github.domain.net/BIA/mis-vibe-coding.git

# 개별 plugin 설치
/plugin install agent-teams@mvc
/plugin install documentation@mvc
/plugin install mis-mcp@mvc
/plugin install sdl@mvc
/plugin install sdlc@mvc
/plugin install dev-agent@mvc
/plugin install vibe-coding-setup@mvc

# 리로드
/reload-plugins
```

### 로컬 개발용 (개별 plugin 직접 로드)

```bash
claude --plugin-dir ./plugins/agent-teams
claude --plugin-dir ./plugins/documentation
claude --plugin-dir ./plugins/mis-mcp
claude --plugin-dir ./plugins/sdl
claude --plugin-dir ./plugins/sdlc
claude --plugin-dir ./plugins/dev-agent
claude --plugin-dir ./plugins/vibe-coding-setup
```

## 마켓플레이스 구조

```
mis-vibe-coding/                    # MARKETPLACE
├── .claude-plugin/
│   └── marketplace.json            # plugin 등록 목록
├── plugins/
│   ├── mis-agent-teams/            # Agent Teams 기능
│   ├── mis-documentation/          # 문서화 도구
│   ├── mis-mcp/                    # MCP 서버 묶음
│   ├── sdl/                        # SDL 도메인 가이드
│   ├── sdlc/                        # SDLC 를 통한 SR 처리 관련 기능
│   ├── mis-dev-agent/              # 경량 CI 파이프라인
│   └── vibe-coding-setup/          # vibe-coding 최소 문서/구조 자동 보완
└── conductor/                      # 프로젝트 컨텍스트
```

## Plugin 상세

### mis-agent-teams

Lv1/2/3 팀 스폰으로 병렬 개발. 작업 규모에 따라 선택.

```bash
/agent-teams:team-spawn ds-mis-dev-team-lv1 @agents/ds-mis-dev-team-lv1.md
/agent-teams:team-spawn ds-mis-dev-team-lv2 @agents/ds-mis-dev-team-lv2.md
/agent-teams:team-spawn ds-mis-dev-team-lv3 @agents/ds-mis-dev-team-lv3.md --profile <profile-name>
/agent-teams:team-status
/agent-teams:team-shutdown <team-name>
```

| Agent | 레벨 | 적용 범위 |
|-------|------|-----------|
| ds-mis-dev-team-lv1 | 5 명 | 소형 기능, 버그픽스 (파일 1~3개) |
| ds-mis-dev-team-lv2 | 9 명 | 중간 규모 기능, 리팩토링 (파일 4~10개) |
| ds-mis-dev-team-lv3 | 50+ 명 | 대형 기능, 마이그레이션, 감사 |

사전 조건:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### mis-documentation

```bash
/code-documentation:doc-generate      # API, 아키텍처, 개발, 기능 문서 생성
/c4-architecture:c4-architecture      # C4 아키텍처 문서화
```

### mis-mcp

설치 시 `knox-api` MCP 서버 자동 연결 (HTTP transport).

### sdl

```bash
/sdl:*                                # SDL 개발 표준 관련 스킬
```

### sdlc

SDLC 를 통한 SR 처리 관련 skill 모음.

- **deep-interview / user-deep-interview** — 소크라테스식 심층 인터뷰로 막연한 요구를 요구사항 정의서로 정리
- **capture-mockup** — 기능 개발 **전** "바뀔 화면"을 확정하는 Before/After 캡처 워크플로우. 실제 렌더된 DOM에서 목업을 파생시켜 "미리 본 스샷 ≠ 실제 개발 결과"(divergence)를 방지. 캡처는 `screen-capturer` subagent가 전담(DOM raw는 메인 세션에 유입 안 됨 → 컨텍스트 오염 0).

```bash
/sdlc:deep-interview <막연한 아이디어>       # 심층 요구사항 인터뷰
/sdlc:capture-mockup                          # Before/After 화면 캡처 (트리거: "목업 생성", "화면 캡처")
```

> `capture-mockup`은 **Playwright MCP** 등록 + dev 서버 구동이 사전 조건.
> 산출물은 `.tmp/mockups/<화면>/`에 `before.png`/`before.html`/`after.html`/`after.png` 4종 저장(gitignore 대상).

#### subagent 호출 (메인 세션 오염 없이 격리 실행)

capture-mockup은 subagent로도 등록되어 있어, `Task`로 워크플로우 전체를 격리 실행할 수 있다.
DOM/HTML raw는 메인 세션에 유입되지 않고 산출물 경로만 리턴된다.

```
# 워크플로우 전체 (Before 캡처 → After 목업 → 렌더 → 참고자료) — 기본
Task(subagent_type="sdlc:capture-mockup",
     prompt="url=https://localhost:3000/notices, screenName=notices, mockupGoal=우상단에 필터 버튼 추가")

# 화면 스샷+HTML 한 번만 필요할 때 (하위 캡처 전담)
Task(subagent_type="sdlc:screen-capturer",
     prompt="url=https://localhost:3000/notices, outDir=.tmp/mockups/notices/, prefix=before")
```

호출 체인: `sdlc:capture-mockup`(오케스트레이터) → 내부에서 `sdlc:screen-capturer`(캡처 전담)를 위임 호출.
**거의 항상 `capture-mockup`을 부른다.** `screen-capturer`는 그게 내부적으로 쓰는 하위 도구이므로 단발 스샷이 필요할 때만 직접 호출.

| 대상 | 타입 | 용도 |
|------|------|------|
| `sdlc:capture-mockup` | subagent | Before/After 목업 워크플로우 전체 (기본) |
| `sdlc:screen-capturer` | subagent | 특정 화면 스샷+HTML 1회 캡처 (하위 전담) |
| `/sdlc:capture-mockup` | skill | 메인 세션에서 직접 워크플로우 실행 |

### mis-dev-agent

보안/품질 점검 + git push + 보고서·메일을 서브에이전트로 자동 처리하는 경량 CI 파이프라인.
팀 스폰 불필요 — 설치 후 바로 사용. agent-teams 대비 토큰 **~89% 절감** (3,300 → 360 토큰).

```bash
# 전체 파이프라인 (보안+품질 병렬 → push → 메일)
/dev-agent:create
/dev-agent:create "feat: 기능명"   # 커밋 메시지 직접 지정

# 옵션
/dev-agent:create --skip-security  # 보안 점검 건너뜀
/dev-agent:create --skip-mail      # 메일 발송 건너뜀
/dev-agent:create --no-push        # 보안/품질만 점검 (push 없음)
/dev-agent:create --hard-block     # 🔴 보안 발견 시 push 차단

# 단계별 개별 실행
/dev-agent:security-check          # OWASP/RBAC/secrets/deps 점검
/dev-agent:quality-check           # typecheck + lint + build
/dev-agent:git-push                # Conventional Commits 검증 + push
/dev-agent:report-mail             # HTML 보고서 + knox-api 메일
```

| 단계 | 방식 | 설명 |
|------|------|------|
| security-check | 서브에이전트 | OWASP Top 10, RBAC/GBAC, secrets, CVE |
| quality-check | 메인 스레드 | typecheck/lint/build 자동 감지 실행 |
| git-push | 메인 스레드 | Conventional Commits 검증, 보호 브랜치 경고 |
| report-mail | 서브에이전트 | HTML 보고서 생성 + knox-api 메일 발송 |

> mis-mcp 플러그인 설치 시 메일 발송 활성화. 미설치 시 HTML 파일로 저장.

### vibe-coding-setup

repo(들)이 vibe-coding(요구사항 인터뷰→설계→개발)에 필요한 최소 문서/구조를 갖췄는지 **스스로 검사**하고, 부족하면 실제 코드 분석 기반으로 보완한다. WF-A(SDLC Intake & Stage Driver)의 `Vibe Coding Setup` 노드가 git clone 직후 clone된 repo 경로들과 함께 자동 invoke하지만, 사람이 SDLC 과정 없이 임의 repo에 직접 호출할 수도 있다.

실제 검사·생성·커밋은 `vibe-coding-setup:setup-runner` **subagent** 안에서 격리 실행된다(`sdlc:capture-mockup`이 `screen-capturer`에 캡처를 위임하는 것과 같은 패턴). 메인 세션에는 repo별 스킵/보완 요약만 남는다.

```bash
/vibe-coding-setup:setup <repo 절대경로 1개 이상>
```

```
Task(subagent_type="vibe-coding-setup:setup-runner", prompt="<repo 절대경로 1개 이상>")
```

| 단계 | 내용 |
|------|------|
| 검사 | vibe-meta 마커, baseline 파일, 언어 매니페스트, docs core(5종)/조건부, staleness(커밋 50개 초과 OR 30일 경과)를 직접 확인. 최초 스캔이면 존재하는 baseline 파일도 내용까지 확인(`contentGaps`) |
| 판정 | 부족한 게 있으면 보완, 전부 충족되면 스킵(변경 없음) |
| baseline 보완 | 없는 baseline 파일(CLAUDE.md/AGENTS.md, plans/todo.md 등) 실제 코드 분석 내용으로 생성, 있지만 내용 부실한 파일은 기존 내용 보존하며 보강 |
| docs 보완 | core 5종(architecture/db-schema/api-spec/coding-conventions/ui-depth)은 해당 없어도 무조건 생성, 조건부(auth-oidc/testing)는 실제 트리거 근거가 있을 때만 |
| CLAUDE.md 참조 갱신 | 생성/갱신한 baseline/docs 파일을 repo CLAUDE.md 참고 문서 섹션에 등록 (메타 파일·언어 매니페스트는 제외) |
| vibe-meta 갱신 | repo 루트(최상단) `.vibe-coding-setup-metadata.json` 생성/갱신 (`.mvc/` 등 팀 공통 scratch 디렉토리엔 두지 않음 — 대부분 gitignore됨) |
| 커밋 | `"[MVC] vibe-coding setup"` 별도 커밋 (push 안 함) |

### 측정 결과

**시스템 1**

| 구분 | Task 1 | Task 2 | Task 3 | 평균 |
|------|--------|--------|--------|------|
| 적용 전 | 4분 45초 | 5분 37초 | 2분 24초 | **4분 15초** |
| 적용 후 | 1분 47초 | 2분 13초 | 2분 16초 | **2분 5초** |

→ task당 평균 **4분 15초 → 2분 5초**, **약 51% 감소**

**시스템 2**

**Task 1** (반복 5회)

| 구분 | 1회차 | 2회차 | 3회차 | 4회차 | 5회차 | 평균 |
|------|-------|-------|-------|-------|-------|------|
| 적용 전 | 40초 | 46초 | 57초 | 1분 22초 | 1분 16초 | **60초** |
| 적용 후 | 39초 | 37초 | 55초 | 30초 | 33초 | **39초** |

→ **60초 → 39초**, **약 36% 감소**

**Task 2** (반복 3회)

| 구분 | 1회차 | 2회차 | 3회차 | 평균 |
|------|-------|-------|-------|------|
| 적용 전 | 49초 | 53초 | 51초 | **51초** |
| 적용 후 | 33초 | 18초 | 14초 | **22초** |

→ **51초 → 22초**, **약 57% 감소**

**합산 평균**

→ task당 평균 **56초 → 30초**, **약 46% 감소**

추가로 **repository-proxy** skill 포함 — 사내 Nexus 프록시(`repository.domain.net`) 사용 가이드. APT/YUM/Docker/Maven/NPM/PyPI/Helm/Go/Cargo/NuGet 패키지 매니저 설정, `repo.domain.net` 마이그레이션, 인증서 배포(Linux/Windows/Containerd) 안내. air-gapped·사내 프록시·nexus 키워드로 트리거.

```bash
/vibe-coding-setup:repository-proxy   # 사내 프록시 레포지토리 설정 가이드
```

## SDL 프로젝트에서 사용하기

`sdl` plugin 설치 후 SDL 기반 프로젝트의 CLAUDE.md에 아래 내용을 추가하면 Claude가 자동으로 SDL skill을 활용합니다:

```markdown
## SDL 개발 규칙

이 프로젝트는 SDL(표준개발라이브러리) 기반입니다.

- 코드 작성 전 반드시 `/sdl:search`로 SDL 표준 확인
- Controller/Service/Mapper/DTO/Vue 생성 시 `/sdl:generate` 먼저 호출
- 메뉴·권한 등록 필요 시 `/sdl:config` 호출
- SDL 규칙 모를 때 `/sdl:guide` 호출
```

## Conductor

프로젝트 컨텍스트 관리 (마켓플레이스 메타, plugin 자산 아님):

```bash
/conductor:setup                      # 기존 프로젝트 분석
/conductor:new-track feature-name     # 새 기능 트랙 생성
/conductor:status                     # 트랙 상태 확인
```

## 라이선스

MIT
