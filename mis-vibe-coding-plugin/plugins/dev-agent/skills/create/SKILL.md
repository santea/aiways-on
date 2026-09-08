---
name: create
description: >
  프로젝트에 mis-dev-agent를 설치. 프로젝트당 딱 한 번만 실행.
  .claude/agents/mis-dev-pipeline.md 와 Stop 훅을 프로젝트에 생성.
  이후 Claude 응답 완료 시 변경사항 있으면 자동으로 파이프라인 실행.
---

# Create — 프로젝트 설치

이 스킬은 현재 프로젝트에 mis-dev-agent 파이프라인을 설치한다.
**프로젝트당 한 번만 실행하면 된다.**

## 실행 지침

### STEP 1 — 에이전트 파일 생성

Write 도구로 **현재 프로젝트 루트**의 `.claude/agents/mis-dev-pipeline.md` 를 생성:

```markdown
---
description: >
  변경사항 감지 시 자동 실행. 보안점검 + 품질점검 병렬 → git push → 보고서+메일.
  직접 호출 금지 — Stop 훅이 자동 트리거.
---

# MIS Dev Pipeline

## 실행 지침

### PHASE 1 — 변경사항 확인

```bash
git diff --name-only HEAD
```

변경사항 없으면 즉시 종료. 아무것도 출력하지 않음.

변경사항 있으면 PHASE 2 진행.

### PHASE 2 — 병렬 점검 (단일 메시지, 두 Agent 동시 스폰)

반드시 단일 메시지에서 두 Agent 도구를 동시 호출:

**Agent A — 보안 점검:**
변경 파일 목록을 받아 아래 항목 점검:
- OWASP Top 10 (injection, XSS, broken auth, sensitive data, CSRF 등)
- RBAC/GBAC 누락 여부
- hardcoded secrets (API key, password, token, connection string)
- package.json / requirements.txt High/Critical CVE
출력: 첫 줄 "OK" 또는 "NOT OK", 이후 `🟢🟡🔴 [ID] file:line — issue — fix` 한 줄씩

**Agent B — 품질 점검:**
package.json scripts 에서 typecheck/lint/build 키 자동 감지 후 순차 실행.
감지 방법 (Node.js, Unix 유틸 금지):
```
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));console.log(JSON.stringify(Object.keys(p.scripts||{})))"
```
출력:
```
QUALITY REPORT
typecheck : PASS | FAIL (N errors)
lint      : PASS | FAIL (N errors)
build     : PASS | FAIL | SKIPPED
```

두 결과를 security_result, quality_result 에 저장.

### PHASE 3 — 결정 게이트

typecheck 또는 build FAIL → 중단, 오류 출력.
🔴 보안 발견 → 경고 표시 후 진행, 커밋 메시지에 [SECURITY-WARNING] 추가.

### PHASE 4 — Git Push

사전 검사:
- git config user.email 확인 (없으면 중단)
- main/master 브랜치면 경고 후 사용자 확인 요청

커밋 메시지: 변경 내용 기반 Conventional Commits 형식 자동 생성.
절대 `git add -A` 또는 `git add .` 사용 금지 — 변경 파일 명시적으로 지정.

```bash
git commit -m "$(cat <<'EOF'
{커밋 메시지}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

결과를 git_result 에 저장.

### PHASE 5 — 보고서 & 메일

Agent 도구로 서브에이전트 스폰:
mcp__knox-api__DS_Knox_Mail 로 HTML 보고서 메일 발송.
- 제목: [DEV-AGENT] {project} - {hash} ({branch}) [🟢N🟡N🔴N]
- HTML 섹션: 요약 / 품질 결과 / 보안 발견 / git 통계
- 수신자: git config user.email
- MCP 불가 시 .claude/pipeline-report-{hash}.html 저장 후 종료.

### PHASE 6 — 요약 출력

```
╔══════════════════════════════════════╗
║       DEV-AGENT COMPLETE             ║
╠══════════════╦════════════╦══════════╣
║ Security     ║ OK/WARN    ║ 🟢N🟡N🔴N ║
║ Quality      ║ PASS       ║ tc/lint/build ║
║ Git Push     ║ SUCCESS    ║ {hash}→{branch} ║
║ Mail         ║ SENT       ║ {recipient} ║
╚══════════════╩════════════╩══════════╝
```
```

---

### STEP 2 — Stop 훅 등록

현재 프로젝트 루트의 `.claude/settings.json` 을 읽거나 없으면 새로 생성.
기존 내용에 아래 Stop 훅을 병합 (기존 hooks 는 유지):

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node -e \"const{execSync}=require('child_process');try{const d=execSync('git diff --name-only HEAD',{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();if(d){process.stdout.write('\\n🔄 dev-agent: 변경사항 감지됨 — mis-dev-pipeline 에이전트를 실행하여 파이프라인(보안점검→품질점검→push→메일)을 진행하세요.');}}catch(e){}\""
          }
        ]
      }
    ]
  }
}
```

---

### STEP 3 — 완료 메시지 출력

```
✅ dev-agent 설치 완료

등록된 파일:
  .claude/agents/mis-dev-pipeline.md
  .claude/settings.json (Stop 훅)

이제 Claude 응답이 끝날 때마다 변경사항을 감지합니다.
변경사항이 있으면 자동으로 파이프라인이 실행됩니다.
비활성화: .claude/settings.json 에서 Stop 훅 제거
```
