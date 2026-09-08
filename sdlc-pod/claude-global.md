# SDLC Pod Agent

## 실행 환경

이 Pod는 n8n 오케스트레이터가 headless 모드(`claude -p`)로 호출하는 자동화 에이전트다.

- **사용자 입력 요청 절대 금지** — 대화 중 blocking 발생 시 n8n timeout
- **응답 언어**: 한국어 — 스킬(deep-interview 등) 실행 중에도 예외 없이 한국어로 사용자와 소통 (코드·커밋메시지·CLI 명령어는 영어 유지)
- **권한 모드**: bypassPermissions (파일 수정/삭제 자유롭게 수행)

## 패키지 설치 / 네트워크 제약

- air-gapped. 사내 Nexus(repository.domain.net, artifactory.domain.net) 프록시만 접근 가능.
- 상세 URL 규칙은 `/vibe-coding-setup:repository-proxy` 스킬 참조.
- 외부(registry.npmjs.org, services.gradle.org, pypi.org, repo1.maven.org) 직접 접근은 전부 차단됨.

## 화면 캡처 (Playwright) - 브라우저 다운로드 금지

- chromium는 **/usr/bin/chromium** (v150)에 이미 설치됨. 필요시 **심볼릭 링크 설정** 필요
- launch 시 **executablePath: /usr/bin/chromium** 지정. npx playwright install(브라우저 다운로드) 금지.

## OOM 방지

k8s 노드 자원이 부족해 Pod가 OOMKilled 되는 일이 빈번하다. 각 stage는 같은 Pod 안에서 순차 `/run`으로 실행되므로,
**이전 stage에서 띄운 백그라운드 프로세스가 다음 stage로 새어 들어가 메모리가 누적**되는 것이 주원인이다.

- **매 stage 시작 시** 메모리를 정리한다.
  - **단, dev 서버 보존 예외** — 다음 stage가 **같은 dev 서버를 재사용**하는 경우(특히 Stage 1
    `Setup Conda`에서 기동한 dev 서버를 Stage 2 `capture-mockup`이 그대로 쓰는 경우)에는 **dev 서버
    프로세스(`next dev`/`npm run dev`/`vite` 등)는 정리 대상에서 제외**한다. 서버 재기동 비용(1~2분)이
    캡처 지연의 주원인이므로, stage 경계를 넘어도 살려둬서 다음 stage가 즉시 재사용하게 한다.
  - 보존 여부 판단: 다음 stage가 같은 repo·같은 포트의 dev 서버를 필요로 하면 보존, 더 이상 쓰지 않으면
    정리. 애매하면 **메모리 여유(`free -m` ≥ 800MB)가 있으면 보존, 부족하면 정리 후 다음 stage에서 재기동**.
- **힙 상한** (빌드·런타임이 OOM 나면):
  - Java: `-Dorg.gradle.jvmargs=-Xmx4096m`
  - Node: `NODE_OPTIONS=--max-old-space-size=4096`
    - 단 실행이나 빌드 중 메모리 이슈로 실패하는경우에는 512MB씩 증가하며 테스트
  - 단, Java 빌드 + Node dev 서버 + chromium + Claude CLI가 동시에 뜨면 노드가 감당 못 한다. **메모리 집약
    프로세스는 한 번에 하나만** — 빌드 중엔 dev 서버를 끄고, 캡처 중엔 빌드를 돌리지 않는다.

## Workspace 구조

```
/workspaces/session/
  {repo_name}/          ← git clone 위치 (repo별 디렉토리)
  CLAUDE.md             ← job context (매 요청마다 동적 생성)
```

작업 시작 전 `/workspaces/session/CLAUDE.md`를 읽어 requestNo, srTitle, 대상 repo, issue 번호 등을 파악한다.

## subagent workflow

- **`explorer`:** Before editing any file, you MUST first call the `explorer` subagent to locate
  relevant code. Do not read files directly unless explorer's summary is insufficient.
  Use Read with offset/limit to fetch only the needed slice.

- **`git-controller`:** Before executing a git command, you MUST first call the `git-controller` subagent to request the operation.
  Do not perform git directly unless it has failed in the git-controller.

## Git 규칙

- **커밋 메시지 형식**: `[SDLC] {stage} 산출물` (예: `[SDLC] 요구사항 산출물`)
- PAT은 환경변수로만 사용, URL·argv·로그에 embed 금지
- push 전 반드시 `git status` 확인
- 작업 branch는 job context CLAUDE.md의 `branch` 컬럼 참조

## GitHub CLI (gh)

> ⚠️ **PR 생성·merge는 Pod가 하지 않는다.** Stage 5(READY_FOR_DEPLOY) 진입 시 Portal이 직접 GitHub API로 PR 생성·merge(squash)·branch 삭제를 수행한다.
>
> - Pod는 커밋·push까지만 담당한다. PR/merge 관련 `gh pr` 명령을 실행하지 않는다.
> - `job context CLAUDE.md`의 `work branch (head)`, `base branch (PR 대상)`, `auto PR merge` 컬럼은 Portal이 PR 생성 시 참조용으로만 사용한다.

## SDLC 단계별 Skills

> 🚫 **최우선 규칙 — 단계(stage) 진행 권한은 n8n에만 있다. Pod는 stage를 모르고, 알 필요도 없다.**
>
> - 아래 스킬 목록(user-deep-interview → deep-interview → dev → qa → code_review → security_review → PR → merge → 보고서)은 **전체 파이프라인의 지도(map)일 뿐, 한 번의 `/run` 안에서 순서대로 실행하는 스크립트가 아니다.**
> - 각 단계 스킬은 **n8n이 그 단계 전용 프롬프트를 담아 `/run`을 호출할 때만** 실행한다. 어떤 스킬을 실행할지는 매 `/run` 프롬프트가 명시적으로 지시한다.
> - **사용자 피드백만 resume로 들어온 경우**(프롬프트가 특정 스킬 실행을 지시하지 않은 경우)에는 **현재 진행 중이던 작업 맥락 안에서만 응답**한다. **절대 다음 단계 스킬을 스스로 시작하지 않는다.**
>   - 특히 **요구사항 분석(Stage 2) 중에는 `deep-interview`(설계 인터뷰)를 절대 먼저 시작하지 않는다.** 설계 인터뷰는 n8n이 `3_DEV_DESIGN_IN_PROGRESS` 단계에서 별도 `/run`으로 시작시킨다.
>   - 마찬가지로 확정/승인 답변을 받았다고 해서 개발(dev)·QA·코드리뷰·보안리뷰·PR·merge로 스스로 넘어가지 않는다. **Stage 4는 dev/qa/code_review/security_review 4개의 독립된 `/run`으로 나뉘어 있다 — 하나의 `/run` 안에서 그 다음 substage를 스스로 잇지 않는다.**
> - "다 됐으니 다음으로 넘어가라"는 신호는 사용자에게 받더라도, 실제 단계 전이는 n8n이 판정·수행한다. Pod는 **자신이 방금 한 작업의 결과와 확정 신호만 정확히 출력**하고 종료한다(아래 "단계 확정 신호 규약" 참조).
> - **⚠️ Skill과 Subagent를 혼동하지 않는다.** `/oh-my-claudecode:ralph`, `/oh-my-claudecode:ultraqa` 같은 `/`로 시작하는 이름은 **Skill**이며 `Skill` tool로 호출한다. `code-reviewer`, `security-reviewer` 같은 이름은 **Subagent**이며 `Agent(subagent_type="oh-my-claudecode:code-reviewer", ...)` 형태로 호출한다. Skill 이름을 `Agent`의 `subagent_type`에 넣거나, Subagent 이름을 Skill처럼 슬래시 명령으로 호출하지 않는다(과거 이 혼동으로 `Agent type not found` 에러 발생 및 자의적 우회 실행 이력 있음).

### 단계 확정 신호 규약 (n8n 판정용)

n8n의 판정 Agent는 **Pod가 `/run` 종료 시 출력한 텍스트만** 보고 단계 완료 여부를 판단한다(사용자 원문을 직접 보지 못한다). 따라서 확정 시점에는 아래 마커를 **정확한 문자열 그대로** 출력해야 n8n이 다음 단계로 진행할 수 있다.

- **UI 목업 확정** (요구사항 단계에서 사용자가 목업 화면을 승인한 경우): 출력에 아래 한 줄을 포함하고, 이어서 요구사항 명세서 파일의 **절대경로들**을 한 줄에 하나씩 나열한 뒤 종료한다.
  ```
  ===MOCKUP_CONFIRMED===
  /workspaces/session/.mvc/requirement/<slug>.md
  ```
- 사용자가 수정을 요청한 경우에는 마커를 출력하지 않는다(수정 반영 후 다시 확인 요청).

> ⚠️ **이 섹션의 `.mvc/**`및`.omc/**` 파일은 스킬(user-deep-interview / deep-interview / ralph / ultraqa) 내부 작업 파일(intermediate artifact)이다. RSCCB 최종 산출물이 **아니다**.**
>
> - 파일 작성/저장은 스킬 동작대로 **그대로 수행**한다 (스킬이 다음 단계 context로 활용).
> - 단, 이 파일들을 **"보고서"로 취급하거나 Issue 댓글 / OW 채널 / 메일에 첨부하지 않는다**.
> - 외부에 노출되는 공식 "보고서" 3종은 오직 `rsccb-report` 에이전트가 `/workspaces/session/.sdlc-reports/*.md` 에 생성한 것만이다 (아래 "SDLC 산출물 MD 파일 저장 규칙" 참조).

### 요구사항 분석 (Stage 2) — user-deep-interview

`/sdlc:user-deep-interview` 사용. Socratic 인터뷰로 요구사항을 명확히 함.

- 인터뷰 결과는 `/workspaces/session/.mvc/requirement/{slug}.md`에 저장됨 — **스킬 작업 파일(context용), 보고서 아님**

- 인터뷰가 끝나면 `/sdlc:capture-mockup` 으로 before/after/merged 3종을 캡처·Portal 업로드하고 사용자 확인(수정/확정)을 받는다.
  캡처 절차·산출물 경로(`/workspaces/session/.tmp/mockups/`)·curl 업로드의 상세는 `capture-mockup-runner.md`(SSOT)가 지시.
  - **수정 요청** → `===MOCKUP_CONFIRMED===` 마커를 출력**하지 말고** after를 재캡처→재업로드→재확인 요청.
  - **확정**('확정'/'좋다'/'이대로 진행') → 응답 맨 끝에 `===MOCKUP_CONFIRMED===` + 이어서 명세서 절대경로를 한 줄로 출력. 이때 merged.png의 servingUrl을 `/workspaces/session/.mvc/requirement/<slug>.md`에 한 줄에 하나씩 추가. 마커 없이 설계(deep-interview)·개발로 스스로 넘어가지 않는다.
    예시: ![공지사항 검색 입력창 Merged](https://portal.bia-dev.domain.net/api/v1/sdlc/images/4b7329b7-7f90-40c5-800e-019117965b48?token=1786621440.34ed40ffe550c7c55f0725d2ab78767d0d066b4d36422d01fdd6d14b8d18956a)
- mockup까지 인터뷰가 끝나면 최종 인터뷰 결과 내용과 파일을 전달 함.
  - 인터뷰가 끝나면 mockup/_ branch를 sldc/_ Brach와 merge한다.
  - **캡처용 프로세스 정리 (OOM 필수, 시점 = stage 종료 직전)** — 각 stage는 같은 Pod 안에서 순차 `/run`으로
    실행되므로, **남긴 백그라운드 프로세스가 다음 stage(특히 Stage 3 설계 인터뷰)로 새어 들어가 메모리가 누적되어
    OOMKilled** 된다. 단 정리 **시점**이 중요하다:
    - **capture-mockup 피드백 루프 진행 중(수정→재캡처 반복)에는 dev 서버를 유지한다.** 소스 수정은 HMR로 갱신해
      재캡처한다 — **매 수정마다 서버를 재기동하지 않는다**(재기동 = 1~2분 × N회 낭비, 캡처 지연의 주원인).
    - 사용자가 목업을 확정해 `===MOCKUP_CONFIRMED===`를 출력하고 **`/run`을 종료하기 직전**(= 다음 stage로 넘어가기
      직전)에만 dev 서버·chromium·Gradle·node를 종료한다.
    - 루프 중 메모리가 임계(가용 `free -m` < 500MB)에 도달한 경우에만 예외적으로 정리 후 서버를 재기동한다(보통은
      유지). 메모리 집약 프로세스는 한 번에 하나 — 빌드 중엔 dev 서버를 끄고, 캡처 중엔 빌드를 돌리지 않는다(위 "OOM 방지").
    ```bash
    # /run 종료 직전(stage 전환 직전) 1회만 실행 — 루프 중에는 호출 금지
    pkill -f "GradleDaemon"; pkill -f chromium; pkill -f "next dev\|npm run dev\|vite" ; pkill -f node
    ```
    (정리 후 `NO_UI` 즉시 종료 시에도 동일 적용)
    - **위 pkill은 Stage 2 `/run` 종료 직전(= Stage 2→3 전환)에만 해당** — 이때는 dev 서버를 더 이상
      쓰지 않으므로 죽인다. **Stage 1→2 전환에서는 dev 서버를 보존**한다(위 "dev 서버 보존 예외"):
      Stage 1 `Setup Conda`에서 기동한 dev 서버를 Stage 2 `capture-mockup`이 그대로 재사용해야 하므로,
      Stage 1 `/run` 종료 시엔 dev 서버 항목(`next dev`/`npm run dev`/`vite`)을 pkill에서 **빼거나
      건너뛴다** — chromium·Gradle·잔존 node만 정리하고 dev 서버는 살려둔다.

### 설계서 작성 (Stage 3) — deep-interview

`/oh-my-claudecode:deep-interview` 사용. 요구사항 spec을 바탕으로 설계 인터뷰 진행.

- `/workspaces/session/.mvc/requirement/*.md` (요구사항 단계 작업 파일) 이미 존재 시 context로 활용 — **보고서 아님**
- **github branch 참고** — 요구사항 단계의 mockup 소스 편집분은 job context의 `sdlc/SR-...` work branch에 push 된 상태다
  (브랜치 하나, merge 단계 없음). 이 frontend UI 변경분을 `Read`/`git diff`로 확인하되, **"순수 UI 골격(목업)이지 완성
  기능이 아님"** — 로직·데이터·API 연동은 비어있을 수 있으므로, 백엔드 API·DB·권한 등을 설계 인터뷰에서 보완한다.
  dev substage는 이 work branch를 그대로 이어받아 골격 위에 로직·테스트를 채운다.

### 기능 구현 (Stage 4) — dev → qa → code_review → security_review (4개 독립 substage)

> Stage 4는 **하나의 스킬로 뭉쳐서 처리하지 않는다.** n8n이 substage마다 별도 `/run`을 보내며, 각 `/run`은
> 자신의 substage 작업만 수행하고 종료한다. 이전에는 `/oh-my-claudecode:autopilot` 하나로 구현·QA·리뷰를
> 전부 시도했으나, autopilot 호출 자체가 불안정(Skill/Subagent 혼동으로 `Agent type not found` 발생)했고
> 그 결과 QA·코드리뷰·보안리뷰가 조용히 스킵되는 문제가 있었다. 이제는 n8n이 4개 substage를 명시적으로
> 하나씩 지시하며, 각 substage 완료 시 Pod는 자신이 방금 한 작업만 요약해 출력하고 종료한다.

#### substage: `dev` — 구현

**최상위 세션이 직접 구현한다.** skill이나 subagent를 호출하지 않는다. deep-interview spec을 바탕으로
**구현 + git commit + git push만** 수행하고, 작업이 완전히 끝난 뒤 프로세스가 종료한다.

- ⚠️ **`/oh-my-claudecode:ralph` 등 persistent-mode Skill을 쓰지 않는다.** ralph/ultraqa 같은
  persistent-mode skill은 headless 단발 `claude -p` 실행에서 첫 턴에 "백그라운드 실행 중, 완료 알림을
  기다리겠습니다" 같은 안내만 출력하고 프로세스를 조기 종료시킨다 → 실제 작업이 그 `/run` 안에서
  완결되지 않고, 그 안내문이 그대로 `data.result`(→ OW 채널 메시지)로 나가는 문제가 있었다. 또한
  ralph state(Stop hook)가 `active:true`로 남아 이후 substage 세션(`resume:true`)을 하이재킹했다.
  그래서 dev는 skill 없이 최상위 세션이 직접 구현한다.
- QA cycling, code-reviewer, security-reviewer는 이 substage에서 절대 호출하지 않는다(각각 별도 substage).
- 보고서(`.sdlc-reports/*.md`)는 이 substage에서 생성/수정하지 않는다.
- **최종 출력**: 구현+commit+push가 모두 끝난 뒤 핵심 구현 내역 요약 bullet만 출력한다. "백그라운드 실행 중",
  "완료 알림을 기다리겠습니다" 같은 진행상황 문구를 출력하고 끝내지 않는다.

#### substage: `qa` — 테스트 코드 수행

`Agent(subagent_type="oh-my-claudecode:test-engineer", ...)` **Subagent**를 호출(`Agent` tool로 호출,
Skill 아님). 테스트 실행 → 실패 시 진단·수정 → 재실행을 반복하며 통과할 때까지(또는 동일 실패 반복 시
중단) cycling한다. subagent가 결과를 리턴할 때까지 기다렸다가 결과를 받아 처리한다.

- `dev` substage에서 만든 코드를 대상으로만 검증. 새 기능 구현은 하지 않는다.
- ⚠️ `/oh-my-claudecode:ultraqa` 같은 persistent-mode Skill을 쓰지 않는다(위 dev와 동일한 조기 종료
  문제). 반드시 `Agent` tool로 test-engineer subagent를 호출해 blocking으로 결과를 받는다.
- **최종 출력**: 테스트 통과/실패 요약만 간단히 출력한다.

#### substage: `code_review` — 코드 리뷰

`Agent(subagent_type="oh-my-claudecode:code-reviewer", ...)` **Subagent**를 호출(`Agent` tool로 호출,
Skill 아님). 이번 요청의 git diff를 대상으로 코드 품질을 검토한다.

- 결과는 `/workspaces/session/.mvc/report/code-review.md`에 저장 — **스킬 작업 파일(최종 보고서
  context용), 그 자체가 RSCCB 보고서 아님.** 최종 보고서는 Stage 7에서 rsccb-report Agent가 이 내용을
  요약/인용하여 생성한다.

#### substage: `security_review` — 보안 리뷰

`Agent(subagent_type="oh-my-claudecode:security-reviewer", ...)` **Subagent**를 호출(`Agent` tool로
호출, Skill 아님). 이번 요청의 git diff를 대상으로 보안 취약점을 검토한다.

- 결과는 `/workspaces/session/.mvc/report/security-review.md`에 저장 — 마찬가지로 스킬 작업 파일.

4개 substage가 모두 끝나면 n8n이 Stage 5(PR 생성)로 진행시킨다.

### PR 생성·merge (Stage 5) — Portal 담당

- Stage 5 진입 시 **Portal이 GitHub API로 PR 생성·merge(squash)·branch 삭제를 직접 수행**한다.
- Pod는 `gh pr create` / `gh pr merge`를 실행하지 않는다. 커밋·push까지만 담당.
- commit 이력이 없는 repo는 Portal이 issue를 close하고 work branch를 삭제한 뒤 PR을 생성하지 않는다.

### 보고서 작성 (Stage 7)

- 최종 보고서는 **`rsccb-report` 에이전트**가 `/workspaces/session/.sdlc-reports/report.md` 에 생성한다 (아래 저장 규칙 참조).
- Stage 4의 `.mvc/report/*.md` (code-review / security-review 작업 파일)를 context로 인용하여 작성한다.

## SDLC 산출물 MD 파일 저장 규칙

### ⚠️ 절대 규칙 (위반 시 SDLC 파이프라인 전체 실패)

1. 보고서 4종(요구사항정의서/PI설계서/개발보고서/RSCCB최종보고서)은 **직접 Write 절대 금지**.
2. 반드시 `rsccb-report` 서브에이전트를 호출하여 생성/덮어쓰기 한다.
3. 기존 파일이 있어도 무조건 덮어쓴다 (RSCCB 양식 준수).
4. **각 단계별 보고서는 정확히 한 곳에서만 생성한다** (아래 표의 "생성 노드"). 인터뷰/개발 run 단계에서는 보고서를 만들지 않는다.
5. rsccb-report 에이전트가 `COMPLETE`를 출력하기 전까지 다음 단계로 진행하지 않는다.
6. **저장 위치는 repo 디렉토리 밖 session 공용 절대경로**(`/workspaces/session/.sdlc-reports/`)다. git 추적 안 함. n8n `notify-channel` 노드가 이 고정 경로를 `filePaths`로 읽어 OW/메일에 전문 첨부. 멀티 repo여도 보고서는 1세트(요청 1건 = 보고서 1세트).

### 단계별 생성 시점 (단일 생성 원칙)

각 보고서는 n8n의 지정된 "생성 노드"에서만 rsccb-report로 생성된다. 인터뷰/개발 run 노드는 보고서를 만들지 않는다.

| 단계                     | 생성 노드 (n8n)          | outputPath                                          | stage 값       |
| ------------------------ | ------------------------ | --------------------------------------------------- | -------------- |
| 요구사항 정의 (Stage 2)  | `Issue Comment (Stage)1` | `/workspaces/session/.sdlc-reports/requirements.md` | `requirements` |
| 설계 (Stage 3)           | `Issue Comment (Stage)2` | `/workspaces/session/.sdlc-reports/design.md`       | `design`       |
| 최종 - 개발 보고서 (S5)  | `Run Final Report`       | `/workspaces/session/.sdlc-reports/development.md`  | `development`  |
| 최종 - RSCCB 보고서 (S5) | `Run Final Report`       | `/workspaces/session/.sdlc-reports/rsccb.md`        | `rsccb`        |

- 요구사항/설계 **인터뷰 run 노드**(`Send Dev_Design run` 등)와 **개발 run 노드**(`Send Dev run`)는 인터뷰·개발만 수행하고 **보고서를 생성하지 않는다**.
- 개발 완료(Stage 4)의 Issue Comment는 진행 상황 요약만 단다. 전문 보고서는 Stage 5 `Run Final Report`에서 **development.md + rsccb.md 2종**을 각각 1회 생성.
- `Run Final Report`는 두 보고서 생성 후 **Issue 댓글을 개발 보고서 → RSCCB 보고서 순서로 각각 등록**한다. `Report Mail`(notify-channel)은 `filePaths`에 두 파일을 모두 넣어 한 메일에 첨부한다.

### 호출 방법

```
Task(subagent_type="rsccb-report", prompt="stage: requirements\noutputPath: /workspaces/session/.sdlc-reports/requirements.md\ncontext: {작업 내용 전체 요약}")
```

`context`에는 해당 단계에서 수집/작성된 모든 내용(인터뷰 결과, 설계 결정사항, 구현 내역 등)을 포함한다.

#### 개발 보고서 규칙 (stage: development)

- 작업 결과(git commit / pr / merge 등)
- 영향도
- DB 작업 (필요 시 Migration or schema 변경 쿼리 포함)
- code-review, security-reviewer 요약
- 상세 내용
  - 코드 작업 상세(```markdown 형태)
  - code-review 결과(```markdown 형태)
  - security-reviewer 결과(```markdown 형태)

#### RSCCB 보고서 규칙 (stage: rsccb)

- 프로젝트 개요 (의뢰번호/시스템/요청자/개발유형/완료일/PR)
- 구현 요약 (요구사항 → 설계 → 개발 흐름)
- 단계별 산출물 (요구사항정의서/PI설계서/PR)
- 주요 변경 내역
- 테스트 결과
- 특이사항 및 후속 조치

## 멀티 Repo 작업 원칙

- job context CLAUDE.md에 repo 목록 있으면 **전체 repo에 동일 작업 수행**
- repo별로 별도 commit — 하나의 commit에 여러 repo 묶지 않음
- issue comment는 각 repo의 issue에 개별 작성
