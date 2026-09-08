---
name: security-check
description: >
  변경된 파일에 대해 OWASP Top 10, RBAC/GBAC, secrets 노출, 의존성 취약점을 점검.
  커밋 전 보안 리뷰가 필요할 때, 또는 /mis-dev-agent:create 의 보안 단계에서 자동 호출.
  $ARGUMENTS 로 특정 파일 경로 지정 가능.
---

# Security Check

사용자 입력: "$ARGUMENTS"

## 실행 지침

### 1단계 — 점검 대상 파일 수집

`$ARGUMENTS`가 비어 있으면 Bash로 변경 파일 수집:
```bash
git diff --name-only HEAD
```
결과가 없으면 `git diff --name-only HEAD~1 HEAD` 사용.
`$ARGUMENTS`가 있으면 해당 경로를 대상으로 사용.

### 2단계 — 서브에이전트 스폰

Agent 도구를 사용해 **단일 서브에이전트**를 즉시 스폰하라.
- `subagent_type`: `backend-development:backend-development-security-auditor`
- 프롬프트는 아래 템플릿 사용 (변경 파일 목록을 `{FILES}` 자리에 삽입):

```
Security scan the following changed files.

Check ALL categories:
- SEC-API: BOLA (broken object-level auth), over-exposed fields, missing rate-limit
- SEC-OWASP: Injection, broken auth, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, known vulnerable components, insufficient logging
- SEC-AUTHZ: Missing RBAC/GBAC guards on endpoints or data access
- SEC-DEPS: High/Critical CVEs in package.json / requirements.txt / pom.xml
- SEC-SECRET: Hardcoded API keys, tokens, passwords, connection strings
- SEC-CWE: SQL/command injection (CWE-89/78), use of Math.random for security (CWE-338)

Output rules:
- First line MUST be exactly "OK" or "NOT OK"
- Then one line per finding: <emoji> [ID] file:line — issue — fix
  - 🟢 = info/low, 🟡 = medium, 🔴 = high/critical
- Omit categories with no findings
- Max 300 words total

Changed files:
{FILES}
```

### 3단계 — 결과 표시

서브에이전트 결과를 받아 다음 형식으로 출력:

```
SECURITY CHECK RESULT
━━━━━━━━━━━━━━━━━━━━
Status: OK | NOT OK
Findings: 🟢N 🟡N 🔴N

[서브에이전트 출력 그대로]
```

🔴 발견 사항이 있으면 경고: "🔴 Critical/High 발견 — /dev-agent:create 시 --hard-block 옵션으로 push 차단 가능"
