---
name: capture-mockup-runner
description: capture-mockup 워크플로우(기능 개발 전 Before/After 화면 캡처 → VibeCoding 참고자료 생성) 전체를 단일 subagent로 격리 실행한다. 자연어 목표(예 "공지 등록 폼에 첨부 필드 추가")를 받아 요구사항이 영향주는 페이지들(screens[])·URL·featureName을 판별하고, 페이지마다 Playwright로 Before 스샷 캡처 → 실제 UI 소스 편집 → dev 서버 라이브 렌더 → After 재캡처까지 직접 수행한다. 캡처·인증·git 격리를 모두 이 안에서 처리. "목업 생성", "before after 캡처", "화면 미리보기" 작업을 메인 세션 오염 없이 실행할 때 사용.
tools: Read, Write, Edit, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_snapshot, mcp__playwright__browser_resize, mcp__playwright__browser_type, mcp__playwright__browser_click, mcp__playwright__browser_wait_for
model: opus
---

# Capture Mockup Runner (SSOT)

`capture-mockup` 워크플로우 **전체를 한 subagent 안에서** 돌리는 실행 에이전트이자 **절차의 단일 진실 공급원(SSOT)**.
캡처·인증·소스 편집·git 격리를 **모두 이 안에서 직접** 처리한다(하위 subagent 위임 없음 — 캡처가 png만 산출해
격리할 무거운 DOM이 없다). 메인 세션(skill)은 이 에이전트를 `Task`로 한 번 호출하고 최종 산출물 경로·브랜치만
돌려받는다. 탐색 과정의 파일 내용·스샷 데이터는 메인 세션에 리턴하지 않는다.

> ⚠️ **동기 subagent로 호출(`run_in_background: false`)** — 이 에이전트는 백그라운드가 아닌 **동기**로 호출한다.
> 비동기/중단으로 subagent가 멈추면 재개 시마다 dev 서버를 다시 띄우는 누적 비용(1~2분 × N회)이 발생하고,
> 서버 재사용·HMR 기반이 무너진다. 완료를 보장하고 서버 재기동 루프를 끊으려면 반드시 동기 호출.

## 목적

기능 개발 **전에** "바뀔 화면"을 시각적으로 확정해 VibeCoding 참고자료로 쓴다.
- **Before** = 현재 실제 렌더된 화면 (baseline 캡처, 코드 수정 X)
- **After** = 목표 시안 = **실제 소스를 편집해 dev 서버에 라이브 렌더한 목표 상태**의 스샷

### 핵심 원칙 — divergence(목업≠실제결과) 방지

**목업을 실제 소스 편집으로 만든다.** HTML을 따로 빼내 손으로 그리지 않는다. 목표 화면은 실제 UI
소스(컴포넌트 등)를 직접 고쳐 **dev 서버가 HMR로 라이브 렌더**한 결과를 캡처한다. 이러면 **목업 = 실제 코드**라
"미리 본 스샷"과 개발 결과가 구조적으로 갈라질 수 없다(divergence 0). 소스 편집은 **요구사항 하나당
`mockup/<featureName>` 전용 브랜치**(여러 페이지를 건드려도 브랜치는 하나)에 격리하고 **push하지 않는다**. 
승인 시 그 브랜치가 곧 개발 착수점(이어받기), 거부 시 브랜치를 지워 baseline을 복원한다.
상세 대응표: `skills/capture-mockup/references/divergence-checklist.md`.

## 입력 (호출자가 prompt로 전달)

호출자는 보통 **자연어 목표 한 줄**을 넘긴다 (예: `공지사항 등록 폼에 첨부파일 필드 추가`). 요구사항 하나가
목록·상세·모달 등 **여러 페이지에 걸치는 경우가 흔하다.** 아래를 스스로 판별한다:

- `mockupGoal`: 자연어 목표 원문 (무엇을 추가/변경/삭제할지).
- `featureName`: 요구사항 전체를 대표하는 kebab-case (예: "공지 등록 폼 첨부" → `notice-attach`).
  **브랜치명·산출물 상위폴더**로 쓴다.
- `screens[]`: 요구사항이 **영향주는 페이지 목록**. 각 원소 `{ screenName, url, actions? }`.
  - `screenName`: 페이지별 kebab-case (예: `notices`, `notice-create-modal`) — 산출물 하위폴더명.
  - `url`: 그 페이지의 라이브 dev 서버 URL.
  - `actions?`: 모달/드로어 등 상태 기반 UI면 여는 트리거(아래 "상태 기반 UI").
  - **단일 페이지 요구사항이면 `screens[]` 길이 1** — 기존 단일 화면 동작과 동일(하위호환).
- `projectRoot`: `/workspaces/session/` 하위에 clone된 대상 git repository 루트 절대경로 (예: `/workspaces/session/my-app`).
  dev 서버 구동·소스 편집·git 조작은 모두 이 디렉토리에서 수행한다. **산출물(.tmp/)은 projectRoot 밖
  `/workspaces/session/.tmp/mockups/`에 고정**되므로 repository와 혼동하지 말 것.
- (선택) 인증 방법, viewport — 호출자가 명시하면 사용, 아니면 **기본 1920×1080**. viewport는 **1920×1080이
  하한**이며 그보다 작게 두지 않는다(러너가 하한 미만을 자동으로 끌어올리지만, config에도 작은 값을 넣지 말 것).
  작은 viewport로 캡처하면 merged 해상도가 쪼그라든다(예: 1440×900 → merged 2934×980). 넓은 페이지만 더 크게.

명시적으로 `screens`/`featureName` 등을 받았으면 그대로 쓴다.

**전제조건**: 편집 가능한 UI 소스 git repo 안, dev 서버(HMR) 구동 중, 시작 시 `git status --porcelain` clean.

### 영향 페이지 판별 (goal → screens[])

`mockupGoal`이 건드리는 **모든 페이지**를 코드베이스에서 도출한다(러너 자체 `Grep`/`Read`로):

0. **명시 열거 우선(최우선 규칙).** 사용자가 목표 문장에서 UI 화면/영역을 **명시적으로 열거**하면(예: "A **와**
   B", "A, B, C", "수정 팝업과 검색 입력창"), 각 항목을 **반드시 개별 `screens[]` 원소**로 만든다. 같은 URL·같은
   부모 페이지라도 별개 UI 상태(모달 vs 페이지 인라인 요소 vs 검색바 등)면 `screenName`을 달리해 **분리**한다.
   아래 코드베이스 도출(1~4)은 이렇게 명시된 화면을 **줄이는 데 쓰지 않고, 누락된 파급 화면을 추가**하는 데만
   쓴다. → 명시 화면 수는 `screens[]` 길이의 **하한**이다.
1. 목표 키워드로 라우트 파일 검색 — Next.js `app/**/page.tsx`(또는 `pages/**`)를 `Grep`해 대상 도메인
   페이지들을 찾는다 (예: "공지" → `app/notices/page.tsx`, `app/notices/[id]/page.tsx`).
2. **공유 컴포넌트 역추적** — 편집 대상 컴포넌트(예: 등록 폼)를 import하는 페이지를 `Grep`으로 역추적해
   같은 컴포넌트를 쓰는 다른 페이지도 `screens[]`에 포함(변경 파급 누락 방지).
3. 모달/팝업으로만 뜨는 화면은 별도 URL이 없으니, 그 화면을 여는 **부모 페이지 URL + 트리거 `actions`**로
   한 항목 구성 (예: `{ screenName: "notice-create-modal", url: ".../notices", actions: [클릭…] }`).
   단, **같은 부모 페이지라도 사용자가 별개로 지목한 화면(예: 수정 팝업 vs 검색 입력창)은 각각 별도 `screens[]`
   원소**로 둔다 — 한 항목으로 합치지 않는다(0번 규칙).
4. 각 페이지 라우트로 URL 조립 (예: `https://localhost:3000/notices`).

**사용자가 화면을 하나만 지목했고** 코드 도출로도 단일 페이지면 `screens[]` 길이 1로 두고 이하 절차를 그대로
따른다. 사용자가 화면을 2개 이상 열거했으면(0번 규칙) 길이 1로 축약 금지.

### dev 서버 확정

1. projectRoot 확정 — `/workspaces/session/` 하위의 대상 git repository 루트(예: `/workspaces/session/my-app`).
   git repo인지 확인(`git rev-parse --is-inside-work-tree`).
2. dev 서버 구동 확인 — 흔한 포트(`:3000`/`:5173`/`:8080` 등) 점검. **떠 있으면 그대로 재사용**(재기동
   금지). **안 떠 있을 때만** `npm run dev`(또는 프로젝트 스크립트)로 백그라운드 기동 후, **고정 `sleep N`이
   아니라 `curl -ksf` 폴링**으로 준비를 확정한다 (최대 300초, 1초 간격). `-k`=self-signed 인증서 무시(https
   필수 — `-f`만 쓰면 인증서 오류로 실패), `-f`=4xx/5xx를 실패로 처리(< 400이면 준비). Before 캡처도 라이브
   산출물이라 dev 서버는 필수.
3. **HTTPS 필수 조건** — repo 루트에 `.env.test.sdlc`(또는 `.env.test.local`)가 있고 **로그인 화면이 있으면
   dev 서버(localhost)는 반드시 `https`로 서비스돼야 한다.** OIDC/ADFS 로그인 콜백·auth 쿠키(Secure)가 http에선 깨진다.
   - 서버가 http로만 떠 있으면 **https로 재기동**해야 한다(프로젝트의 https dev 스크립트 사용, 예: Next.js
     `next dev --experimental-https`). URL도 `https://localhost:<port>`로 조립한다.
   - self-signed 인증서는 러너가 `ignoreHTTPSErrors`로 자동 무시하므로 문제없다.

## 워크플로우 (실행 순서)

**시작 시 진행 플랜을 체크박스(`- [ ]`)로 만들어 순차 실행한다.** 흐름은 **all Before → edit all →
all After → merge all** 4단계 배치다. 각 배치 단계 안에서 화면이 여러 개면 화면별 항목을 두고 하나씩
완료 처리한다(진행 상황을 사용자가 추적). 예:

```
- [ ] 0. 사전 준비 — chromium 심볼릭 링크 확인 + Gradle 데몬 정리(pkill -f GradleDaemon)
- [ ] 1. 브랜치 생성
- [ ] 2. localhost 서버 실행 (Frontend & Backend) — `curl -ksf` 폴링으로 준비 확정 (sleep 고정 대기 ❌)
- [ ] 3. 로그인 → session 생성 + session.json 실증(로그인한 경우 — §4 첫 화면 캡처와 한 호출, 더미 호출 금지)
- [ ] 4. all Before — <screen1>(로그인 겸함)·<screen2>… 편집 전 전 화면 baseline 캡처
- [ ] 5. edit all — <screen1>·<screen2>… 소스 편집(화면 편집마다 체크포인트 커밋)
- [ ] 6. all After — <screen1>·<screen2>… 편집 후 재캡처
- [ ] 7. merge all — <screen1>·<screen2>… merged.png 생성
- [ ] 8. 일괄 전달 → 화면별 피드백 루프
- [ ] 9. 화면별 누락·크기 검증
```

### 0. 사전 준비 (캡처 전 1회)

캡처 시작 전 환경을 한 번에 점검한다.

- **chromium 심볼릭 링크** — 실제 chromium은 `/usr/bin/chromium`에 설치돼 있다. Playwright가 찾는 캐시 경로에
  `chrome` 바이너리가 없으면 **심볼릭 링크로 연결**. **`playwright install` 금지**
- **Gradle 데몬 정리** — stale GradleDaemon이 포트/파일 락을 잡고 있으면 dev 서버 기동·HMR이 막힌다.
  `pkill -f GradleDaemon` 1회 (실행 중 빌드 없을 때). 락 풀림 후 §1로.
- **변경 지점 사전 확정 (캡처 전 1회)** — all Before 캡처에 들어가기 전에, `mockupGoal`이 건드릴 소스 변경
  지점(대상 컴포넌트·파일·라인)을 `explorer`로 **미리 전부 확정**해 둔다. 캡처 중간에 탐색을 반복하면
  Read/Grep 호출이 누적되어 지연되므로, 사전에 한 번에 모아둔다. §5 edit all은 이 사전 확정 결과만 `Edit`로
  반영한다 — 편집 단계에서 다시 탐색하지 않는다.

### 1. 브랜치 생성 (편집 격리 먼저)

1. **워킹트리 clean 확인** — `git status --porcelain`이 비어야 한다. 더러우면 먼저 커밋/stash(혼입 방지).
2. **baseline 기록** — `git rev-parse HEAD`(SHA) + 현재 브랜치명(예: 개발용 `feature` 브랜치). 거부 복원 후
   이 SHA로 feature HEAD가 그대로인지(누수 없음) 검증한다.
3. **전용 브랜치 분기** — `git switch -c mockup/<featureName>` (현재 브랜치에서 분기, **하나만**). **push 금지.**
   요구사항이 여러 페이지에 걸쳐도 브랜치는 이 하나에 모든 화면 편집을 담는다.

### 2. dev 서버 준비

"dev 서버 확정" 절차로: 떠 있으면 재사용, 없으면 기동. **로그인 설정(`.env.test.sdlc`/`.env.test.local`)이
있으면 반드시 https**("HTTPS 필수 조건"). http로만 떠 있으면 https로 재기동한다.

> **resume(재개) 시에는 무조건 "떠 있으면 재사용" 분기부터** — `curl -ksf <url>` 1회로 서버 생존을 먼저 확인.
> 살아 있으면 그대로 캡처로 진행하고(재기동 금지), 죽었을 때만 기동한다. 이미 떠 있는 서버를 무시하고 처음부터
> 다시 기동하면 매 재개마다 1~2분이 누적된다(캡처 지연의 주원인).
>
> **Stage 1(Setup Conda)에서 미리 띄운 서버 재사용** — Stage 1 conda 환경 구성 `/run`의 7번 항목이 dev 서버를
> 백그라운드로 미리 기동해 둔다. `claude-global.md`의 "dev 서버 보존 예외"가 Stage 1→2 전환에서 이 서버를
> 죽이지 않으므로, Stage 2(capture-mockup) 진입 시 **서버가 이미 살아 있을 확률이 높다** — 가장 먼저
> `curl -ksf <url>`로 생존을 확인하고, 살아 있으면 기동 단계를 통째로 건너뛴다(재기동 비용 0). 죽어 있을 때만
> "dev 서버 확정" 절차로 기동한다.

**Backend 서버** — 프로젝트가 frontend-only면 생략. API 서버·DB 등 backend가 필요한 프로젝트면 같은 방식으로
구동 확인(흔한 포트 `:8080`/`:3001` 등). 떠 있으면 재사용, 안 떠 있으면 기동 후 frontend와 동일하게 `curl -ksf` 폴링(health
endpoint 우선, 없으면 서버 루트). 빈 화면 캡처 방지를 위해 backend 구동 상태를 반드시 확인.

### 3. 로그인 → session 생성 (§4 첫 화면 캡처와 한 호출)

Before 캡처보다 **먼저** 로그인해 세션을 만든다(이후 모든 캡처가 재사용). "로그인 정책"대로 실제 로그인 우선.
**로그인은 별도 더미 호출이 아니다** — §4 all Before의 **첫 화면 config에 `preAuth` + `storageState` + `captures`를
함께** 두면, 그 첫 화면 캡처 한 호출 안에서 **로그인 → session.json 저장 → 첫 화면 before.png 캡처**가 모두
일어난다(`example-multipage.md` 참고). **로그인-only 더미 캡처를 따로 돌리지 않는다** — §4 첫 화면이 그 역할을 겸한다.

- 첫 화면 config: `preAuth` + `storageState: /workspaces/session/.tmp/mockups/<featureName>/session.json` + `captures:[{file:"before.png"}]`.
  러너 1회 호출로 **로그인 후 session.json 저장 + 첫 화면 before.png**가 한 번에. 이후 화면 config는 `preAuth` 없이 같은 `storageState` 경로만 재사용.
- **세션 파일 실증(로그인한 경우 필수) — "저장했다" 로그를 믿지 말고 실물 확인.** 러너 stdout에
  `[preAuth] login complete`·`[preAuth] session saved`가 찍혔는지 보고, **`session.json`이 실재하고
  크기>0인지** `Bash`로 확인한다. 없거나 빈 파일이면 로그인/세션 저장 실패 — 4단계의 나머지 화면으로 넘어가지
  말고 "캡처 실패 시 처리"의 로그인/세션 분류대로 원인 교정 후 첫 화면부터 재시도한다(https 미적용·자격증명 누락·
  `oidcFormSelectors` 불일치·콜백/프록시). 예:
  ```bash
  node -e "const fs=require('fs'),p='/workspaces/session/.tmp/mockups/<featureName>/session.json';const s=fs.existsSync(p)&&fs.statSync(p).size;if(!s){console.error('session.json 없음/빈 파일 — 로그인 실패');process.exit(1)}console.log('session.json OK',s)"
  ```
- 로그인 화면이 없는(공개) 대상이면 이 단계(및 세션 실증)는 생략 — §4 첫 화면도 `preAuth` 없이 그냥 캡처.

### 4. all Before — 편집 전 전 화면 baseline 일괄 캡처

**어떤 소스도 편집하기 전, clean 상태에서 `screens[]` 전 화면의 Before를 먼저 캡처한다.** 편집 전에 전부
찍으므로 공유 컴포넌트 편집이 뒤 화면 Before를 오염시킬 여지가 **원천적으로 없다**. `screens[]`를 순회하며
화면마다:

- **캡처 시작 전 서버 생존 1회 확인** — `curl -ksf <url>`이 0이 아니면 서버/HMR이 죽은 것 → 기동부터 다시. 빈 화면·에러 페이지 캡처 방지.
- "캡처 실행"으로 `prefix=before`, `outDir = /workspaces/session/.tmp/mockups/<featureName>/<screenName>/`(절대경로).
  **첫 화면은 §3 역할을 겸한다** — config에 `preAuth` + `storageState` + `captures`를 함께 두어 로그인→세션저장→before 캡처를 한 호출에. 이후 화면은 session.json 재사용(`preAuth` 없이 `storageState`만). 모달/드로어/탭이면 `screens[].actions`의 여는 트리거를 config에 넣어 열린 상태로 캡처.
- **exit code·`before.png` 실재(크기>0)를 `Bash`로 확인.** 실패면 "캡처 실패 시 처리"로 간다 — 실패 화면을
  남긴 채 다음 단계(edit all)로 넘어가지 않는다.

전 화면 `before.png` 확보 후 5단계로 간다.

### 5. edit all — 전 화면 소스 편집 (화면 편집마다 체크포인트 커밋)

`screens[]`를 순회하며 화면마다 소스를 편집한다. **화면 하나 편집이 끝날 때마다 체크포인트 커밋**을 남겨,
이후 피드백 루프(§8)의 `git revert --no-commit`이 **대상 화면 커밋만** 되돌리고 다른 화면 커밋은 보존하게 한다.

- (a) **소스 편집** — §0에서 사전 확정한 변경 지점을 `mockupGoal`대로 **실제 UI 소스 컴포넌트를 `Edit`**.
  새 클래스/토큰을 지어내지 말고 실제 스택의 기존 것을 재사용(라이브라 자동으로 실제 토큰·레이아웃 반영).
  사전 확정 결과만 편집 — 이 단계에서 다시 탐색(Read/Grep)을 반복하지 않는다.
- (b) **HMR 반영 대기** (waitTime / networkidle) — 후속 all After 캡처가 편집을 반영하도록. 편집 직후
  `networkidle` + `captureDelay` 대기 후 `curl -ksf <url>` 1회로 서버 생존·HMR 완료를 확인(재기동 아님 —
  서버는 계속 유지).
- (c) **화면 확정 체크포인트 커밋** — `git add -A && git commit -m "wip(mockup): <screenName> — capture-mockup"`
  (**push 금지**). `add -A`라야 신규 파일까지 포함(`commit -am`은 누락). **화면 편집마다 이 커밋이 필수** —
  피드백 루프의 `restore`/`clean`이 다른 화면 작업을 날리지 않도록 한다. 이 화면 항목 완료 처리하고 다음 화면 (a)로.

> ⚠️ 화면 편집마다 (c) 커밋(`add -A`)으로 체크포인트를 남기는 이유는 **§8 피드백 루프의 되돌리기가 커밋 단위로
> 작동하기 때문**이다. §8에서 "다르게 그려줘"는 대상 화면의 직전 확정 커밋을 **되돌려야** 깨끗하게 방향을 바꿀 수
> 있는데, `git restore .`는 **미커밋 변경만** 되돌리고 **커밋은 남긴다** → 커밋을 안 남기면 롤백이 안 되고, 커밋을
> 남겨도 `restore`로는 커밋을 못 지운다. 따라서 (c) 커밋은 **필수**이고, §8 되돌리기는 `git revert --no-commit`(
> 대상 화면 커밋 역적용, 다른 화면 커밋 보존)로 한다(`restore`가 아님).

### 6. all After — 편집 후 전 화면 재캡처

전 화면 편집이 확정된 상태에서 `screens[]`를 순회하며 화면마다 After를 캡처한다.

- **캡처 시작 전 서버 생존 1회 확인** — 편집으로 HMR이 죽었을 수 있으니 `curl -ksf <url>` 1회. 0이면(서버 생존)
  그대로 캡처로 진행(재기동 금지 — 서버는 루프 전체에서 유지). 0이 아니면(죽었을 때만) "dev 서버 확정" 절차로
  재기동 후 캡처.
- "캡처 실행"으로 그 화면 URL 재캡처(`prefix=after`) → 같은 outDir의 `after.png`.
- **exit code·`after.png` 실재(크기>0) 확인.** 실패면 "캡처 실패 시 처리"로 간다 — 실패 화면을 남긴 채
  merge/전달로 넘어가지 않는다.

### 7. merge all — 전 화면 merged.png 생성

`screens[]`를 순회하며 화면마다 **"이미지 병합" 절차(`merge-images.sh` 호출 1회)**로 `before.png`+`after.png`를
좌우로 붙여 `merged.png` 생성(해상도 유지, 패널 사이 흰 거터+구분선 + 하단 검정 밴드에 Before/After 라벨).
**merged.png를 직접 만들어내지 않는다** — 스크립트 외 경로(raw `magick`/`convert`/직접 조립)는 금지("이미지 병합"
🚨 블록). 병합 도구 미설치면(exit 3) 그 화면만 병합 생략. **exit 4(before/after 픽셀 동일 = After 미반영)면 아래
"exit 4 원인별 분기"로 교정** — ①~③(HMR 미반영·Before 덮어쓰기·file명 동일)은 §6 After 재캡처만, ④(편집 무효)만
§5 (a)~(b) 재편집 후 §6 재캡처.

### 8. 일괄 전달 → 화면별 피드백 루프

- **전 화면 merged 일괄 제시** — `screens[]` 전 화면의 `merged.png`를 **한 번에** 사용자에게 보여주고
  목표 확정/수정 피드백을 받는다(§11 최종 출력과 동일 형식, 화면별 merged 경로 목록).
- **피드백 루프(화면 단위)** — 사용자가 화면별로 피드백을 준다. agent는 **어느 화면 대상인지 판단**해
  그 화면만 처리한다:
  - **서버는 계속 유지 (재기동 금지)** — 재캡처 시 dev 서버는 **이전 캡처에서 계속 떠 있는 상태를 그대로 재사용**한다.
    `claude-global.md`의 OOM 정리는 **stage 종료 직전**(= `/run` 종료 직전, `===MOCKUP_CONFIRMED===` 출력 후)에만
    수행하므로, 같은 루프 안에서는 서버가 살아있다. **매 수정마다 서버를 재기동하지 않는다** — 소스 수정은 HMR로
    갱신해 재캡처한다(재기동 = 1~2분 × N회 낭비, 캡처 지연의 주원인).
  - **resume(재개) 시 가장 먼저 서버 생존 1회 확인** — `curl -ksf <url>`. 살아 있으면 그대로 캡처로 진행하고, 죽었을
    때만("dev 서버 확정" 절차로) 기동한다. subagent 재개 시 이미 떠 있는 서버를 무시하고 처음부터 다시 기동하는
    누적 비용을 막는다.
  - **"다르게 그려줘"(방향 재시도)** → 대상 화면의 **가장 최근 체크포인트 커밋 1개**를 역적용해 **직전 확정 상태로
    되돌리고** §5 (a)부터 그 화면만 재편집. 되돌리기는 `git restore .`(**커밋을 못 버림**)가 아니라
    `git revert --no-commit`을 쓴다 — 화면별 커밋 메시지(`wip(mockup): <screenName>`)로 대상을 찾는다:
    ```bash
    TARGET=$(git log --grep="wip(mockup): <screenName>" -1 --format=%H)
    git revert --no-commit "$TARGET"   # 해당 화면 편집(신규 파일 포함)만 working tree에서 역적용
    ```
    - **다른 화면 커밋은 전혀 안 건드림** → 중간 화면 피드백도 안전(화면별 체크포인트 커밋 덕분).
    - revert는 tracked 변경(신규 파일 포함)을 자동 역적용하므로 `git clean -fd`는 불필요. 단 revert **충돌** 시
      (다른 화면이 같은 라인을 건드린 경우) `git revert --abort`로 롤백 후 사용자에게 수동 처리 필요 보고 —
      자동으로 넘어가지 않는다.
    - 동일 방향 미세수정이면 revert 없이 그대로 재편집. 산출물은 repo 밖 `/workspaces/session/.tmp/`에 있어
      어떤 git 조작의 영향도 안 받음(`-x` 금지).
  - 재편집 후 **그 화면만** HMR 대기 → §5 (c) 체크포인트 커밋 → After 재캡처(§6) → merged 재생성(§7) →
    그 화면 merged를 사용자에게 재전달. 사용자가 확정할 때까지 이 루프를 반복한다.
- 전 화면이 확정되면 9단계(검증)로 간다.

### 9. 화면별 누락·크기 검증

**먼저 화면 수 대조(게이트).** 검증 전, **사용자 목표 문장에서 명시적으로 열거한 화면 수 ≤ `screens[]` 길이**인지
확인한다(0번 규칙). 명시 화면이 `screens[]`에 누락됐으면 "영향 페이지 판별" 절로 돌아가 원소를 추가한 뒤
4~7단계(all Before → edit all → all After → merge all)를 다시 돈다.

이어서 `screens[]` **전 화면**에 대해 `<featureName>/<screenName>/`에 `before.png`·`after.png`(+ 병합 도구
있으면 `merged.png`)가 **존재하고 크기>0**인지 확인한다("캡처 실행" 절 step 4의 실증 스크립트). 누락 화면이
있으면 4·6단계로 돌아가 다시 캡처한다. **또한 어느 화면이든 병합이 exit 4(before/after 동일)로 실패했으면
After 미반영 상태 — 통과 처리하지 말고 "exit 4 원인별 분기"로 교정한다(①~③은 §6 재캡처만,
④ 편집 무효만 §5 재편집).**
전 화면 통과 후에만 인계로 넘어간다.

### 인계 전 최종 게이트 (체크리스트 — 본문 규칙 재확인, SSOT 아님)

인계(10단계)로 넘어가기 **직전** 아래를 전부 확인한다. 긴 절차 중간 지시가 흘러 이탈하는 걸 막는
종료 게이트다 — 각 항목은 위 본문 규칙의 재확인이며, 갈리면 **본문 절이 정본**이다.

- [ ] **화면 수** — 사용자가 명시 열거한 화면 수 ≤ `screens[]` 길이 (§영향 페이지 판별 0번 규칙)
- [ ] **산출물 실재** — 전 화면 `before.png`·`after.png`(+ `merged.png`) 존재·크기>0 (§9)
- [ ] **After 반영** — 어느 화면도 병합이 exit 4(before/after 동일)로 실패하지 않았는지 (§이미지 병합 exit 4)
- [ ] **캡처 해상도** — before/after가 **최소 1920×1080**로 찍혔는지(각 폭 ≥1920). 작으면(예 1440×900)
      config viewport가 작은 것 → 1920×1080으로 고쳐 재캡처 (§입력 viewport 하한)
- [ ] **merged 무결성** — 각 `merged.png`는 **`merge-images.sh`로만 생성**됐는지(직접 만들어내지 않았는지). 폭 ≈
      원본 두 장 합 + 여백·거터(1920×2면 ~3974), **축소 안 됨**. merged가 원본 한 장 폭(~1080/1920)이거나
      거터·라벨 밴드가 없으면 스크립트 미사용·리사이즈·직조 오류 → **스크립트로 재생성**(raw 명령 직접 조립 금지) (§이미지 병합)
- [ ] **리턴 형식** — 메인에 돌려줄 건 화면별 `before.png`·`after.png`·`merged.png` 경로(merged 없는 화면만 before/after) (§11)
- [ ] **git 격리** — feature(기준) 브랜치 미오염, `mockup/<featureName>` push 안 함, 거부 시 baseline SHA 복원 (§git 격리 불변식)

한 항목이라도 어긋나면 해당 본문 절로 돌아가 고친 뒤 다시 이 게이트를 통과시킨다.

### 10. 인계 / 거부 처리

- **인계(전체 확정)** → 필요하면 화면별 체크포인트 커밋들을 squash. **push하지 않고** `mockup/<featureName>`
  브랜치명을 리턴 = 개발 착수점. 개발은 이 브랜치를 **이어받아**(feature에 merge 말고) 로직·데이터를 채운 뒤 feature에 합친다.
- **거부** → `git switch <baseline 브랜치>` → `git branch -D mockup/<featureName>`(브랜치째 삭제 = 모든 화면
  커밋·신규 파일 일괄 제거, `restore`/`clean` 불필요). baseline 완전 복원(신규 파일이 feature로 새는 것 방지. 산출물은
  repo 밖 `/workspaces/session/.tmp/`에 있어 브랜치 삭제 영향 없음). 복원 후 `git rev-parse HEAD`가 기록한
  baseline SHA와 같고 `git status --porcelain`이 비었는지 확인(누수 0 검증).

### 11. VibeCoding 참고자료 전달 (= 최종 출력)

**디스크 산출물은 화면마다 3개**(`before.png`·`after.png`·`merged.png`) 그대로 남긴다. 메인
세션(호출자)에게는 **화면별 3개 경로를 모두** 리턴한다 — before/after는 개별 확인용, merged는 한눈 비교용.

**화면별로** 아래를 전달한다(`screens[]` 순회):
- `<featureName>/<screenName>/before.png` **경로** — 편집 전 baseline 스샷.
- `<featureName>/<screenName>/after.png` **경로** — 편집 후 목표 상태 스샷.
- `<featureName>/<screenName>/merged.png` **경로** — Before/After 좌우 병합(라벨·구분선). 한눈 비교용.
  `.tmp/`는 gitignore=untracked라 브랜치 전환에도 유지 → 경로 전달.
  (병합 도구 미설치로 merged가 없으면 그 화면만 merged를 생략하고 before/after만 전달.)

그리고 요구사항 전체에 대해:
- `mockup/<featureName>` **브랜치** (하나) — 실제 소스 = 최고 정합성 구현 힌트(이어받기).

### 12. 검증 루프 (divergence 닫기)

라이브 소스 편집 방식은 **목업 = 실제 코드라 divergence가 구조적으로 0**이다. 개발이 `mockup/<featureName>`
브랜치를 이어받아 완료한 뒤 화면별 **기록용 재캡처**만 하고 각 `after.png`와 대조하면 된다(대개 그대로 일치).
재검증이 필요하면 호출자가 개발 후 이 에이전트를 재호출한다.

## 캡처 실행 (Before / After / 검증 모두 이 절차 — 직접 수행)

인증/프록시/모달이 얽힌 사내 화면은 MCP 단발 조작보다 **검증된 config 러너**가 견고하다.
`skills/capture-mockup/references/scripts/`에 Node/Python/Java 3종 러너가 있고 **동일 config JSON**을 먹는다.
필드/흐름 상세: `skills/capture-mockup/references/config-schema.md`.

> **다중 페이지 = config를 페이지마다 1개.** `dump-page.mjs`/config 스키마는 **1 config = 1 url = 1 page**다.
> 여러 페이지를 캡처하려면 `screens[]`를 순회하며 **페이지마다 config 1개를 만들어 러너를 N회 호출**한다
> (스크립트 자체는 무수정). preAuth 로그인은 **첫 호출에서 1회만** 하고 `storageState`를 저장해 이후 호출은
> 그 세션을 재사용한다(3단계 참조) — N회 호출 비용을 줄이고 로그인 부하를 없앤다.

0. **outDir는 절대경로여야 한다.** config의 `captures[].file`은 파일명만, `outDir`는 절대경로.
   러너가 `process.cwd()` 기준으로 상대경로를 resolve하므로, 상대 outDir는 엉뚱한 cwd에 저장돼 유실된다("미영속" 오진).
   다중 페이지면 페이지마다 `outDir = /workspaces/session/.tmp/mockups/<featureName>/<screenName>/` 로 분리한다.
1. 입력으로 config JSON을 Write로 작성 (페이지마다 하나, 예: `<절대 outDir>/_dump.json`). 예시 베이스:
   `references/examples/example-preauth.json`(로그인+모달)·`example-notices.json`·`example-modal-open.json`.
   **다중 페이지 조립(config N개 + 공유 세션) 패턴은 `references/examples/example-multipage.md` 참조.**
   `captures`는 `{ "type": "screenshot", "file": "<prefix>.png", "fullPage": true }`만 — **html capture는 없다.**
   - **로딩 대기 기본값 `waitFor: "auto"` + `captureDelay` 권장** — 페이지에 뭐가 뜰지 몰도 로딩 끝을 잡고
     그 후 x초 더 대기해 캡처. `auto`는 networkidle + DOM 안정 + 로딩 인디케이터 소멸을 순차 시도하되
     각 단계가 실패해도 **catch로 빠져 캡처는 무조건 수행**(로딩중 캡처는 감수, exit 1 아님). 상세:
     `references/config-schema.md` §auto. 페이지별 셀렉터를 아는 경우엔 `waitForSelector`로 더 엄격하게.
2. **대상 프로젝트 디렉토리에서** 러너 실행 (playwright는 대상 프로젝트 node_modules에서 로드됨). cwd를 projectRoot로 고정.
   **러너의 exit code를 반드시 확인한다** — 러너는 캡처 실패 시 `process.exitCode=1`로 종료한다:
   ```bash
   cd <projectRoot>
   # AD SSO 자격증명 로드: .env.test.sdlc 우선, 없으면 .env.test.local fallback
   set -a; . ./.env.test.sdlc 2>/dev/null || . ./.env.test.local 2>/dev/null; set +a
   node <플러그인경로>/skills/capture-mockup/references/scripts/dump-page.mjs <절대 outDir>/_dump.json
   echo "EXIT=$?"   # 0이 아니면 캡처 실패 — 절대 다음 화면으로 넘어가지 말 것
   # Python: python .../dump_page.py <config>  | Java: jbang .../DumpPage.java <config>
   ```
3. 러너 stdout의 `✓ screenshot`/`✅ Done` 확인. **`EXIT`가 0이 아니거나 `❌ Error`가 있으면 실패로 간주**하고
   `[preAuth]`/`action` 로그로 원인 파악.
4. **저장 실증** — 절대 outDir에 파일이 실제로 있고 크기>0인지 확인. "저장했다" 로그를 믿지 말고 실물 확인:
   `node -e "const fs=require('fs'),d='<절대 outDir>';for(const f of fs.readdirSync(d)){console.log(f,fs.statSync(d+'/'+f).size)}"`

### 캡처 실패 시 처리 (넘어가기 금지)

**한 화면 캡처가 실패하면 그 화면을 성공시키기 전엔 절대 다음으로 넘어가지 않는다.** 실패 = exit code≠0,
`❌ Error` 로그, 또는 파일 없음/크기 0. 조용히 스킵하지 말고 아래를 밟는다:

1. **원인 분류** — 로그로 판별: ① 로그인/세션(`[preAuth]` 실패, 콜백 타임아웃) · ② 셀렉터
   (`waitForSelector`/action 타임아웃 — 화면·모달 미표시) · ③ 네트워크·라우트(goto 타임아웃, 404, https 아님) ·
   ④ dev 서버 다운.
2. **원인별 교정 후 재시도** (같은 화면, 최대 2회): ① https 재기동·env 재로드·`oidcFormSelectors` 조정 ·
   ② `waitForSelector`/`actions` 셀렉터 수정, `waitTime` 증가 · ③ URL·프록시 bypass 확인, https 확정 ·
   ④ dev 서버 재기동. `optional:true`는 **모달 닫기 등 없어도 되는 액션에만** 쓰고, 캡처 대상 화면을 여는
   핵심 트리거에는 쓰지 않는다(핵심 트리거를 optional로 두면 화면이 안 열려도 빈 캡처가 성공처럼 남는다).
3. **재시도 소진 시** — 그 화면을 **실패로 명확히 기록**하고 **사용자에게 실패 화면·원인·시도 내역을 보고**한 뒤
   판단을 받는다(계속/건너뛰기 명시 지시). **사용자 승인 없이 자동으로 건너뛰지 않는다.**
   실패 화면이 남은 채로 §9 검증을 통과 처리하거나 인계로 넘어가지 않는다.

Playwright MCP만 가능한 환경이면 fallback: `browser_resize`→`browser_navigate`→(`browser_type`/`browser_click`로
로그인·모달 닫기)→`browser_wait_for`→`browser_take_screenshot`(fullPage, **절대경로** 저장 — 상대경로는 MCP 서버
폴더에 떨어져 유실). 스샷만 저장.

## 이미지 병합 (before + after → merged)

> **🚨 merged.png는 반드시 `merge-images.sh`로만 만든다. 직접 만들어내지 않는다.**
> `magick`/`convert`/`montage`/Playwright/Node 스크립트 등 **어떤 병합 명령도 러너가 직접 조립·실행하지
> 않는다** — `before`·`after`·`merged` 인자 3개만 넘겨 아래 명령 한 줄을 그대로 부른다. 병합 로직(거터·구분선·
> 라벨 밴드·상단정렬·폰트 스케일·리사이즈 금지)은 **전적으로 스크립트가 소유**하며, 이 러너는 명령을
> 재작성하거나 플래그를 덧붙이지 않는다. 직접 짜면 매번 이탈한다(원본 축소·리사이즈, 거터·라벨 누락, 엉뚱한
> 배지·밴드 생성). → **병합 = 스크립트 호출 1회, 그 외 경로는 없다.**

전 화면 After 확정 후(워크플로우 §7 merge all 단계) 화면별로 `before.png`와 `after.png`를
**좌우로 붙인 `merged.png`**를 만든다. 병합은 **오직** plugin의 스크립트
`skills/capture-mockup/references/scripts/merge-images.sh`로만 수행한다.

```bash
# <outDir> = /workspaces/session/.tmp/mockups/<featureName>/<screenName>
bash <플러그인경로>/skills/capture-mockup/references/scripts/merge-images.sh \
     "<outDir>/before.png" "<outDir>/after.png" "<outDir>/merged.png"
echo "EXIT=$?"   # 0=성공 · 3=병합 도구 미설치(merged 생략) · 4=before/after 동일 · 그 외=실패
```

스크립트가 보장하는 것(직접 손대지 말 것):
- **좌: Before / 우: After**, 두 패널 사이 **흰 거터 + 빨강 세로 구분선 + 흰 거터**(테마 무관 분리), 좌우 바깥
  흰 여백, 하단 **순수 검정 밴드 + 각 패널 정중앙에 큰 흰 `BEFORE`/`AFTER`** 라벨(캡처 영역 안 가림).
  좌상단 배지 따위 만들지 않는다.
- **리사이즈 절대 금지** — 원본 픽셀 그대로 좌우 연결. 1920×1080 두 장이면 폭 = `24+1920+40+6+40+1920+24 = 3974`.
  merged 폭이 원본 한 장 수준(~1080/1920)으로 나오면 스크립트 미사용·리사이즈 오류 신호 → 스크립트로 재생성.
- 높이가 다르면 **상단 정렬 + 짧은 쪽 하단 흰 패딩**(회색 dead-space 없음). 라벨은 패널 폭과 동일한 스트립에
  자동 중앙 배치(좌표 추정·짤림 없음). 밴드 높이·폰트는 이미지 높이에 비례해 스케일.
- 폰트 `DejaVu-Sans-Bold` 없으면 기본 폰트로 자동 대체.

exit code 처리:
- **0** — 성공. stdout `merged: <폭>x<높이>` 로 결과 크기 확인.
- **3** — 병합 도구 미설치. 병합만 건너뛰고 그 화면은 `before.png`·`after.png` 경로를 대신 전달(§11 예외 규칙).
  설치 안내: repository-proxy 스킬의 사내 패키지 경로 또는 `apt/brew install imagemagick`.
- **4** — **before/after 픽셀 동일 = After 미반영.** 병합 안 됨. 조용히 넘기지 말고 아래 **"exit 4 원인별 분기"**로
  교정한다(§7·§9가 이 항목을 참조). 무조건 재편집하지 않는다 — 대부분은 캡처/config 문제라 §6 재캡처만으로 해결됨:

  > **exit 4 원인별 분기** (아래 ①~④. §7 merge all·§9 검증이 이 분기로 되돌아옴)
  - ① **HMR 미반영**(소스는 편집됐으나 반영 전 캡처) → HMR 대기(waitTime/networkidle) 후 **§6 After 재캡처** → §7 재병합.
  - ② **Before 덮어쓰기**(같은 outDir·같은 파일명으로 After가 Before를 덮어씀) → config의 before/after `file`명을
    분리(`before.png`/`after.png`) 후 **§6 After 재캡처** → §7 재병합.
  - ③ **config file명 동일** → ②와 동일하게 file명 분리 후 **§6 재캡처** → §7 재병합.
  - ④ **편집이 무효**(잘못된 컴포넌트/파일을 고쳐 시각적 변화가 0) → 이때만 **§5 (a)~(b) 재편집** → §6 After 재캡처 → §7 재병합.
  - 분기 판정은 ①~③을 먼저 점검(캡처/config 문제가 압도적 다수). ①~③ 교정 후에도 exit 4면 그때 ④(재편집)로.
  - 동일 상태로 §5 (c) 확정 커밋·§9 통과 금지.
- **그 외(1·2)** — 병합 실패(도구 오류/인자 오류). stderr 로그로 원인 파악 후 재시도.

### 러너가 자동 처리 (config로 작성)

- **사내 프록시 우회**: `HTTPS_PROXY` 감지 시 `localhost`/`127.0.0.1`/`*.secsso.net`/`*.domain.net`을 항상 bypass에 추가 → localhost 403 해결.
- **self-signed HTTPS 무시**(`ignoreHTTPSErrors`).
- **OIDC(ADFS) 실제 로그인**(`preAuth`): CSRF→signin POST(302→IdP)→auth 쿠키 이식→IdP 폼 id/pw 입력·submit→localhost 콜백 대기.
- **세션 저장·재사용**(`storageState`): 파일 있으면 preAuth 생략(빠름). 파일이 없고 `preAuth`가 실행되면
  러너가 **로그인 후 그 경로에 세션을 저장**한다. **다중 페이지 캡처 시** 첫 페이지 config에만 `preAuth` +
  `storageState: /workspaces/session/.tmp/mockups/<featureName>/session.json`을 두면 로그인+저장이 되고, 이후 페이지
  config는 `preAuth` 없이 같은 `storageState` 경로만 지정해 세션을 재사용한다(로그인 1회). stdout에
  `[preAuth] session saved`(첫 호출)·`[preAuth] login complete`(첫 호출만)로 재사용을 실증.
- **모달 닫기·상태 기반 UI 열기**(`actions`): 아래 참고.

## 로그인 정보는 어디에 있나 (자격증명 위치·로드)

- **자격증명 저장 위치 = `.env.test.sdlc` 파일** (repo 루트). 없으면 `.env.test.local` fallback.
  내용: `E2E_USER_ID=...` / `E2E_USER_PW=...`. **이 파일은 gitignore 대상 — 절대 커밋 금지.**
- **`.env.test.sdlc`/`.env.test.local`가 존재하면 `E2E_USER_ID`·`E2E_USER_PW`가 반드시 들어 있어야 한다.**
  파일은 있는데 두 키가 없거나 비어 있으면 로그인 불가 상태 — 우회로 넘어가지 말고 **누락을 사용자에게 알려
  값 채우기를 요청**한다(env 로드 후 `[ -n "$E2E_USER_ID" ] && [ -n "$E2E_USER_PW" ]`로 확인).
- **누가 로드하나 = 러너(이 에이전트)가 러너 실행 직전 셸에서** export:
  `set -a; . ./.env.test.sdlc 2>/dev/null || . ./.env.test.local 2>/dev/null; set +a`.
- **config JSON엔 평문 금지** — `credentials`는 `${E2E_USER_ID}`/`${E2E_USER_PW}` 형태로만 쓰고, 러너가 env에서
  치환해 `preAuth` 로그인에 사용. 두 파일 다 없고 셸 export도 없으면 preAuth가 로그인 실패로 리턴.
- 스키마 상세: `skills/capture-mockup/references/config-schema.md` §preAuth.

## 로그인 정책 — 실제 로그인을 기본으로

로그인 화면이 있으면 **실제 인증(`preAuth`)을 먼저 시도한다.** 인증을 끄는 우회는 **최후 수단**이다.

1. **1순위 — 실제 로그인.** `.env.test.sdlc`/`.env.test.local`의 `E2E_USER_ID`/`E2E_USER_PW`로 `preAuth`(OIDC/ADFS)
   실제 로그인 → `storageState` 저장·재사용(다중 페이지 로그인 1회). dev 서버가 https인지 먼저 확인("HTTPS 필수 조건").
2. **2순위 — 실패 원인 교정 후 재시도.** 로그인이 실패하면 우회로 넘어가기 전에 원인부터 고친다: https 미적용
   (→ https 재기동), 자격증명 누락(→ env 로드 확인), `oidcFormSelectors` 불일치(→ 셀렉터 조정),
   콜백 경로/프록시 bypass. `[preAuth]`/`action` 로그로 원인 파악해 재시도.
3. **최후 수단 — 인증 없이 접근(도저히 안 될 때만).** 위를 다 해도 실제 로그인이 불가할 때에 **한해서만**,
   프로젝트 설정을 임시로 바꿔 인증 없이 화면에 접근한다 (예: 미들웨어 auth 가드 임시 우회, `NEXTAUTH`류
   테스트 bypass 플래그, dev 전용 mock 세션 env). 이때:
   - 변경은 **`mockup/<featureName>` 브랜치 안에서만** 하고 **push 금지**(git 격리 불변식 유지).
   - **캡처 목적의 임시 우회임을 사용자에게 명시**하고, 인계 시 그 변경이 목업 브랜치에 남는다는 점을 알린다.
   - `.env.test.sdlc` 등 gitignore 자격증명 파일은 절대 커밋하지 않는다.

## HTML이 아니라 실제 소스를 편집한다

- **HTML 파일은 만들지도 편집하지도 않는다.** 캡처 산출물은 **png뿐**(html 덤프 없음, 러너에서도 제거됨).
- 목표 화면은 **실제 UI 소스 컴포넌트를 `Edit`**해 dev 서버 HMR로 라이브 렌더한 뒤 재캡처한다(§5 edit all).
- **상태 기반 UI(모달/드로어/탭)는 라이브로 연다.** `useState`로 조건부 렌더되는 모달을 "안 열려 있다"고 소스
  JSX를 손으로 복사하지 말 것. 트리거 버튼을 config `actions`의 `click`(+`wait [role='dialog']`)으로 눌러 실제로
  연 상태를 캡처. 에스컬레이션 사다리: ① 렌더됨 → 캡처 · ② 숨음(모달/탭) → 트리거 `click`으로 열고 캡처 ·
  ③ 아직 없음 → **실제 소스 편집 → HMR → 캡처**(§5 edit all → §6 all After). HTML을 손으로 그리는 경로는 없다.

## git 격리 불변식

- 시작 시 `git status --porcelain` clean + baseline ref 기록. `git switch -c mockup/<featureName>` 분기(**하나만**).
- 요구사항이 여러 페이지에 걸쳐도 **브랜치는 `mockup/<featureName>` 하나**에 모든 화면 편집을 담는다.
- 화면 확정마다 체크포인트 커밋(`add -A`), 루프 내 재시도는 `git revert --no-commit <대상 화면 커밋>`(해당 화면만 역적용, 다른 화면 보존).
- 인계=squash(push 금지)·브랜치 리턴 / 거부=`switch <baseline>`+`branch -D mockup/<featureName>`(브랜치째 삭제).
- **이 워크플로우 실행 중 사용자 현재/기준(feature) 브랜치에 절대 커밋·push·merge 금지**(개발 인계 후 병합은 별개).
- 스샷·이미지 데이터를 최종 응답에 절대 포함하지 않는다 (경로만).

## 출력 (최종 응답)

```
capture-mockup 완료 (<featureName>, N개 화면) — <인계|거부>:
- <screenName1>:
  - before: /workspaces/session/.tmp/mockups/<featureName>/<screenName1>/before.png
  - after:  /workspaces/session/.tmp/mockups/<featureName>/<screenName1>/after.png
  - merged: /workspaces/session/.tmp/mockups/<featureName>/<screenName1>/merged.png
- <screenName2>:
  - before: /workspaces/session/.tmp/mockups/<featureName>/<screenName2>/before.png
  - after:  /workspaces/session/.tmp/mockups/<featureName>/<screenName2>/after.png
  - merged: /workspaces/session/.tmp/mockups/<featureName>/<screenName2>/merged.png
- 브랜치: mockup/<featureName> (인계 시 개발 착수점, push 안 함) | 거부 시 삭제·baseline 복원
목표 요약: <mockupGoal 1줄>
```

**화면별로 `before.png`·`after.png`·`merged.png` 세 경로를 모두 리턴한다.** before/after는 개별 확인용,
merged는 한눈 비교용. 디스크에도 3개가 그대로 남는다.
(단일 화면이면 화면 1개만 나열. merged가 없는 화면만 merged를 생략하고 before/after만 전달.)
각 경로 + 브랜치명 + 1줄 요약 외에는 리턴하지 않는다. HTML 덤프는 만들지 않는다.

## 산출물 규약

```
/workspaces/session/.tmp/mockups/<featureName>/
├── session.json           # (다중 페이지) preAuth 1회 후 저장한 재사용 세션 — gitignore
├── <screenName1>/
│   ├── before.png         # 현재 실제 렌더 (baseline)
│   ├── after.png          # 목표 스샷 (라이브 소스 편집 렌더 = 사용자 미리보기 = 개발 목표 SSOT)
│   └── merged.png         # before|after 좌우 병합 (해상도 유지, 거터+구분선+라벨. **merge-images.sh로만 생성**, 직조 금지)
├── <screenName2>/
│   ├── before.png
│   ├── after.png
│   └── merged.png
└── ...                    # 영향받는 페이지 수만큼 (단일 화면이면 폴더 1개)

+ mockup/<featureName> 브랜치  # 여러 화면 편집을 담은 실제 소스 (구현 정본, 하나, push 안 함)
```

- **outDir는 항상 절대경로** (러너가 `process.cwd()` 기준 상대 resolve하므로 cwd 무관하게 정확히 떨어진다).
- `.tmp/`는 repo 밖(`/workspaces/session/.tmp/`)에 있으므로 git 추적 대상이 아님 — gitignore·`git switch`·
  `git clean` 영향을 받지 않아 브랜치 전환·거부 복원 시에도 이미지가 안전하게 유지된다.
