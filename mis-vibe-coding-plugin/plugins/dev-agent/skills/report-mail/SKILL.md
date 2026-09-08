---
name: report-mail
description: >
  보안/품질/git 결과를 HTML 보고서로 정리하고 knox-api MCP 도구로 메일 발송.
  mis-mcp 플러그인 필요 (없으면 HTML 파일로 저장).
  /dev-agent:create 완료 후 자동 호출 또는 수동 실행.
  $ARGUMENTS: "recipient@email.com" 형태로 수신자 지정 가능 (기본: git config user.email)
---

# Report & Mail

사용자 입력: "$ARGUMENTS"

## 실행 지침

### 1단계 — 수신자 결정

`$ARGUMENTS`에 이메일 주소가 있으면 해당 주소 사용.
없으면:
```bash
git config user.email
```

### 2단계 — 서브에이전트 스폰

Agent 도구를 사용해 **단일 서브에이전트**를 즉시 스폰하라.
아래 데이터를 프롬프트에 삽입해 전달:
- `project_name`: 현재 디렉토리명
- `branch`: git push 결과의 branch
- `commit_hash`: git push 결과의 short hash
- `commit_message`: 커밋 메시지 subject
- `security_result`: security-check 결과 전체
- `quality_result`: quality-check 결과 전체
- `git_result`: git-push 결과 전체
- `recipient`: 결정된 수신자 이메일

프롬프트:

```
You are a report sender. Compose and send a pipeline report email using mcp__knox-api__DS_Knox_Mail.

Build HTML body with these sections:
1. Summary table: project | branch | commit | message (4 columns, 1 row)
2. Quality results: typecheck / lint / build rows with PASS/FAIL badges
3. Security findings: table with columns ID | item | level (🟢🟡🔴) | finding | fix
   - If "OK" with no findings, show single row "보안 이슈 없음"
4. Git commit info: hash, branch, push status

Subject: [DEV-AGENT] {project_name} - {commit_hash} ({branch}) [{security_emoji_counts}]

MCP tool call:
{
  "subject": "<subject>",
  "contents": "<html>...</html>",
  "contentType": "HTML",
  "docSecuType": "PERSONAL",
  "sender": { "emailAddress": "{recipient}" },
  "recipients": [{ "emailAddress": "{recipient}", "recipientType": "TO" }]
}

Input data:
project_name: {project_name}
branch: {branch}
commit_hash: {commit_hash}
commit_message: {commit_message}
recipient: {recipient}

security_result:
{security_result}

quality_result:
{quality_result}

git_result:
{git_result}

If mcp__knox-api__DS_Knox_Mail is unavailable, respond with "MAIL_UNAVAILABLE" on the first line and the HTML content after.
```

### 3단계 — 결과 처리

서브에이전트 응답이 `MAIL_UNAVAILABLE`로 시작하면:
- HTML을 `plans/mis-dev-agent-report-{commit_hash}.html`에 저장 (Write 도구 사용)
- 출력: "📄 메일 발송 불가 — 보고서 저장됨: plans/mis-dev-agent-report-{commit_hash}.html"

성공 시:
```
REPORT & MAIL RESULT
━━━━━━━━━━━━━━━━━━━━
status   : SENT | SAVED
recipient: {email}
subject  : {subject}
```
