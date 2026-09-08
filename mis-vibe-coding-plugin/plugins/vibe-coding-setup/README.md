# Vibe Coding Setup Plugin

## 용도

repo(들)이 AI가 vibe-coding(요구사항 인터뷰→설계→개발)을 시작하기 전 필요한 최소 문서/구조를 갖췄는지 검사하고, 부족하면 실제 코드 분석 기반으로 보완한다. 판단(무엇이 부족한지)과 생성(내용 채우기)을 모두 이 플러그인의 `vibe-coding-setup:setup-runner` **subagent**가 수행하고, `setup` skill은 입력을 그대로 넘기는 얇은 진입점이다. 어느 경로로 호출하든 실제 검사·파일 읽기/쓰기·커밋은 subagent 안에서만 일어나므로, 방대한 탐색 내용이 메인 세션 컨텍스트에 남지 않는다.

- SDLC 파이프라인: n8n WF-A(SDLC Intake & Stage Driver)의 `Vibe Coding Setup` 노드가 git clone 직후 clone된 repo 경로들과 함께 `Task(subagent_type="vibe-coding-setup:setup-runner", ...)`를 직접 호출한다.
- 독립 호출: 사람이 SDLC 과정 없이 자기 repo에 `vibe-coding-setup@mvc` plugin만 설치하고, 직접 `/vibe-coding-setup:setup <repo 경로>`를 호출할 수도 있다. 입력 방식은 SDLC 경로와 동일 — skill이 내부적으로 같은 subagent에 위임한다.

## 설치

```bash
/plugin install vibe-coding-setup@mvc
```

로컬 개발용:

```bash
claude --plugin-dir ./plugins/vibe-coding-setup
```

## `/vibe-coding-setup:setup`

입력: repo 절대경로 1개 이상(공백 또는 줄바꿈 구분). 그 외 정보는 필요 없다.

skill은 받은 경로를 그대로 `vibe-coding-setup:setup-runner` subagent에 위임하고, 최종 요약만 돌려받아 전달한다. n8n WF-A처럼 애초에 subagent를 직접 호출하는 경로에서는 이 skill 자체를 거치지 않고 `Task(subagent_type="vibe-coding-setup:setup-runner", ...)`를 바로 쓴다.

### `setup-runner` subagent 절차

| 단계 | 내용 |
|------|------|
| 1. 검사 | vibe-meta 마커, baseline 파일(CLAUDE.md/AGENTS.md, README.md, plans/todo.md, .env.example, .gitignore), 언어 매니페스트, docs core(5종), docs 조건부 트리거(auth-oidc/testing), staleness(커밋 50개 초과 OR 30일 경과)를 repo별로 직접 확인. 최초 스캔(마커 없음)인 경우 존재하는 baseline 파일도 내용까지 열어서 최소 포함 내용 기준 미달 여부 확인(`contentGaps`) |
| 2. 판정 | 부족한 게 있으면 보완 진행, 전부 충족되면 해당 repo는 스킵(변경/커밋 없음) |
| 3. baseline 보완 | 없는 baseline 파일을 실제 코드 분석 내용으로 생성, 있지만 내용 부실한 파일(`contentGaps`)은 기존 내용 보존하며 보강 |
| 4. docs 보완 | core 5종(architecture/db-schema/api-spec/coding-conventions/ui-depth)은 해당 없어도 반드시 생성(해당 없음도 유효한 내용), 조건부(auth-oidc/testing)는 실제 트리거 근거가 있을 때만. `docs/ui-depth.md`는 메뉴 트리 상세 + 화면별 코드 위치 매핑 |
| 5. CLAUDE.md 참조 갱신 | 이번에 생성/갱신한 baseline/docs 파일을 repo의 CLAUDE.md(또는 AGENTS.md) 참고 문서 섹션에 등록 — 향후 vibe-coding 작업/질문 응답 시 참조되도록. `.vibe-coding-setup-metadata.json`과 언어 매니페스트는 등록 대상 아님 |
| 6. vibe-meta 갱신 | repo 루트(최상단) `.vibe-coding-setup-metadata.json` 생성/갱신 (`lastScanCommit=git rev-parse HEAD`) — `.mvc/`(팀 공통 스킬 scratch, 대부분 gitignore됨)에는 절대 두지 않음 |
| 7. 커밋 | `"[MVC] vibe-coding setup"` 메시지로 별도 커밋 (push는 안 함, 이후 단계에서 일괄 push) |
| 8. 출력 | repo별로 스킵/보완 여부 요약만 (탐색한 파일 내용·코드 스니펫은 리턴하지 않음) |

## 배경

기존에는 판단(어떤 파일이 없는지 등)을 pod-runner `POST /ensure-vibe-ready` 엔드포인트(순수 Python 계산)가 맡고, 생성만 이 skill이 담당했다. 이 구조는 n8n이 항상 먼저 `/ensure-vibe-ready`를 호출해 결과 JSON을 만들어줘야 skill이 동작한다는 전제가 있어, "SDLC 과정 없이 셋업만 하는" 독립 호출이 불가능했다. 판단 로직을 skill 안으로 옮겨, 입력을 repo 경로만으로 단순화했다. pod-runner의 `/ensure-vibe-ready` 엔드포인트 자체는 다른 용도로 남아 있다(WF-A는 더 이상 호출하지 않음).

이전에는 이 지침 전체가 n8n 노드의 `jsonBody` 프롬프트 문자열 안에 직접 박혀 있었다. 지침 수정 시 n8n MCP로 긴 문자열을 통째로 재작성해야 해서 오탈자/텍스트 손상 위험이 있었던 것도 이 플러그인으로 분리한 이유다.

**2026-07-10 추가 — subagent 격리**: 검사/생성/커밋 로직 전체를 skill 본문에서 `setup-runner` subagent로 옮겼다. repo가 크면 baseline·docs 검사 과정에서 수십 개 파일을 열어보게 되는데, 이걸 메인 세션에서 그대로 하면 그 내용이 메인 컨텍스트에 계속 쌓인다. `sdlc` 플러그인의 `capture-mockup`(DOM raw를 `screen-capturer` subagent 안에만 두고 메인엔 경로만 리턴하는 패턴)과 동일한 이유로, vibe-coding-setup도 이제 메인 세션엔 최종 요약만 남긴다.
