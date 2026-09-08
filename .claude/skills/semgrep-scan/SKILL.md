---
name: semgrep-scan
description: Run Semgrep Community Edition static analysis and security scanning on this project. Use when the user requests a security scan, vulnerability review, static analysis, secure code review, or when security-sensitive code should be checked.
allowed-tools: Bash(${CLAUDE_PROJECT_DIR}/.claude/tools/semgrep-venv/bin/semgrep *) Read Grep Glob
---

# Semgrep Security Scan

Use the project-local Semgrep Community Edition CLI.

Semgrep executable:

${CLAUDE_PROJECT_DIR}/.claude/tools/semgrep-venv/bin/semgrep

Do not use the Semgrep Claude plugin.
Do not use Semgrep MCP.
Do not run semgrep login.
Do not require Semgrep AppSec Platform authentication.

## Run the scan

Run this command from the project:

    "${CLAUDE_PROJECT_DIR}/.claude/tools/semgrep-venv/bin/semgrep" scan --config auto "${CLAUDE_PROJECT_DIR}"

## Analyze the results

Review every meaningful finding.

For each finding:

1. Identify the affected file and relevant code.
2. Report the Semgrep rule ID.
3. Explain the vulnerability or unsafe pattern.
4. Determine whether it is likely a true positive.
5. Classify it as Critical, High, Medium, Low, or Informational.
6. Recommend an appropriate fix.

## When fixing findings

When the user asks to fix detected issues:

1. Fix the underlying source code.
2. Do not add nosemgrep merely to silence a finding.
3. Re-run Semgrep after the change.
4. Confirm whether the finding disappeared.
5. Report any remaining findings.

If the project-local Semgrep executable does not exist, tell the user to run the project setup script first.

Do not upload the repository or scan results to Semgrep Cloud.
