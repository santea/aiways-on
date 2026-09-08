---
name: quality-check
description: >
  typecheck / lint / build 명령어를 실행하고 결과를 보고. 파일 수정(Write/Edit) 후 수동 실행
  또는 /dev-agent:create 의 품질 단계에서 자동 호출.
  $ARGUMENTS 로 실행할 명령 직접 지정 가능: "pnpm typecheck" "pnpm lint"
---

# Quality Check

사용자 입력: "$ARGUMENTS"

## 실행 지침

서브에이전트 없이 메인 스레드에서 직접 실행.

### 1단계 — 실행 명령 결정

`$ARGUMENTS`가 있으면 해당 명령들을 그대로 사용.

`$ARGUMENTS`가 없으면 프로젝트 설정 파일에서 자동 감지:

**Node.js 프로젝트** — `package.json` scripts 읽기:
```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
const cmds = [];
const typecheckKey = Object.keys(scripts).find(k => /typecheck|type-check|tsc/.test(k));
const lintKey = Object.keys(scripts).find(k => /^lint/.test(k));
const buildKey = Object.keys(scripts).find(k => /^build/.test(k));
if (typecheckKey) cmds.push('npm run ' + typecheckKey);
if (lintKey) cmds.push('npm run ' + lintKey);
if (buildKey) cmds.push('npm run ' + buildKey);
console.log(cmds.join('\n'));
"
```
패키지 매니저 감지: `pnpm-lock.yaml` 존재 시 `pnpm run`, `yarn.lock` 존재 시 `yarn`, 없으면 `npm run`.

**Python 프로젝트** — `pyproject.toml` 또는 `Makefile` 확인:
- `mypy .` (typecheck), `ruff check .` 또는 `flake8` (lint), `python -m build` (build)

**감지 실패 시** — 사용자에게 명령 입력 요청: "품질 검사 명령을 찾을 수 없습니다. 예: /dev-agent:quality-check \"pnpm typecheck\" \"pnpm lint\""

### 2단계 — 명령 순차 실행

typecheck → lint → build 순서로 실행. 각 명령의 exit code + 출력 캡처.

### 3단계 — 결과 출력

```
QUALITY REPORT
━━━━━━━━━━━━━━
typecheck : PASS | FAIL (N errors)
lint      : PASS | FAIL (N warnings, N errors) | SKIPPED
build     : PASS | FAIL | SKIPPED

[FAIL 시 오류 내용 요약 — 최대 20줄]
```

typecheck 또는 build FAIL 시: "⛔ 품질 게이트 실패 — /dev-agent:create 진행 불가"
lint FAIL(warning only)이면: "⚠️ lint 경고 — push는 가능하지만 수정 권장"
