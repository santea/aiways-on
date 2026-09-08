#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# AIways On - Claude Code Project Environment
#
# Linux / Windows WSL / macOS
#
# Claude Code Plugins (project scope)
#   - UI/UX Pro Max
#   - Context7 (Anthropic Official)
#   - Code Review
#   - Security Guidance
#
# Project Rules
#   - ECC Coding Rules ONLY
#
# Project Security Tool
#   - Semgrep Community Edition CLI
#   - Claude Project Skill: /semgrep-scan
#
# Semgrep Claude Plugin은 사용하지 않음
# Semgrep 로그인 불필요
# ============================================================

SCOPE="project"

ECC_RULESETS=(
  common
  typescript
  python
  web
)


# ============================================================
# 출력 함수
# ============================================================

log() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$*"
}

ok() {
  printf '\033[1;32m[OK]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[WARN]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2
  exit 1
}


# ============================================================
# 0. 필수 명령 확인
# ============================================================

command -v git >/dev/null 2>&1 \
  || die "git이 설치되어 있지 않습니다."

command -v claude >/dev/null 2>&1 \
  || die "Claude Code CLI(claude)가 설치되어 있지 않습니다."

if ! claude plugin --help >/dev/null 2>&1; then
  die "현재 Claude Code가 plugin CLI를 지원하지 않습니다.
Claude Code를 최신 버전으로 업데이트하세요."
fi


# ============================================================
# 1. 프로젝트 루트 확인
# ============================================================

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "현재 위치가 Git 프로젝트가 아닙니다.

설치할 프로젝트 폴더에서 실행하세요."
fi

PROJECT_ROOT="$(git rev-parse --show-toplevel)"

cd "$PROJECT_ROOT"

log "Project root: $PROJECT_ROOT"


# ============================================================
# 2. OS 확인
# ============================================================

case "$(uname -s)" in

  Darwin)
    OS_NAME="macOS"
    ;;

  Linux)
    if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
      OS_NAME="Windows WSL"
    else
      OS_NAME="Linux"
    fi
    ;;

  *)
    die "지원하지 않는 OS입니다: $(uname -s)"
    ;;

esac

ok "Environment: $OS_NAME"


# ============================================================
# Helpers
# ============================================================

add_marketplace() {

  local source="$1"
  local marketplace_name="$2"

  if claude plugin marketplace list 2>/dev/null \
      | grep -Fq "$marketplace_name"; then

    ok "Marketplace 이미 등록됨: $marketplace_name"

  else

    log "Marketplace 등록: $marketplace_name"

    claude plugin marketplace add \
      "$source" \
      --scope "$SCOPE"

    ok "Marketplace 등록 완료: $marketplace_name"

  fi
}


install_plugin() {

  local plugin_id="$1"

  log "Plugin 설치: $plugin_id"

  if claude plugin install \
      "$plugin_id" \
      --scope "$SCOPE"; then

    ok "Plugin 설치 완료: $plugin_id"

  else

    warn "Plugin 설치 명령 실패: $plugin_id"
    warn "이미 설치되어 있다면 무시해도 됩니다."

  fi
}


# ============================================================
# .claude 준비
# ============================================================

mkdir -p "$PROJECT_ROOT/.claude"


# ============================================================
# DAY 1
# UI/UX Pro Max
# ============================================================

log "============================================"
log "DAY 1 - UI/UX Pro Max"
log "============================================"

add_marketplace \
  "nextlevelbuilder/ui-ux-pro-max-skill" \
  "ui-ux-pro-max-skill"

install_plugin \
  "ui-ux-pro-max@ui-ux-pro-max-skill"


# ============================================================
# DAY 1
# Context7 - Anthropic Official
# ============================================================

log "============================================"
log "DAY 1 - Context7"
log "============================================"

# 예전에 사용했던 Upstash marketplace 버전이
# project scope에 남아 있다면 제거
claude plugin uninstall \
  context7@context7-marketplace \
  --scope project \
  >/dev/null 2>&1 || true

install_plugin \
  "context7@claude-plugins-official"


# ============================================================
# DAY 1
# ECC Coding Rules ONLY
# ============================================================

log "============================================"
log "DAY 1 - ECC Coding Rules ONLY"
log "============================================"

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

git clone \
  --depth 1 \
  https://github.com/affaan-m/ECC.git \
  "$TMP_DIR/ECC"


ECC_DEST="$PROJECT_ROOT/.claude/rules/ecc"

mkdir -p "$ECC_DEST"


for ruleset in "${ECC_RULESETS[@]}"; do

  src="$TMP_DIR/ECC/rules/$ruleset"
  dst="$ECC_DEST/$ruleset"

  if [[ ! -d "$src" ]]; then
    warn "ECC ruleset이 존재하지 않음: $ruleset"
    continue
  fi

  rm -rf "$dst"
  cp -R "$src" "$dst"

  ok "ECC Rule 설치 완료: $ruleset"

done

ok "ECC 전체 Plugin은 설치하지 않음"
ok "ECC Rules 위치: .claude/rules/ecc/"


# ============================================================
# DAY 2
# Code Review
# ============================================================

log "============================================"
log "DAY 2 - Code Review"
log "============================================"

install_plugin \
  "code-review@claude-plugins-official"


# ============================================================
# DAY 2
# 기존 Semgrep Claude Plugin 제거
# ============================================================

log "============================================"
log "DAY 2 - Remove Semgrep Claude Plugin"
log "============================================"

claude plugin uninstall \
  semgrep@claude-plugins-official \
  --scope project \
  >/dev/null 2>&1 || true

ok "Semgrep Claude Plugin은 사용하지 않음"


# ============================================================
# DAY 2
# Semgrep CLI - Project Local
# ============================================================

log "============================================"
log "DAY 2 - Semgrep CLI"
log "============================================"

SEMGREP_VENV="$PROJECT_ROOT/.claude/tools/semgrep-venv"
SEMGREP_BIN="$SEMGREP_VENV/bin/semgrep"


# ------------------------------------------------------------
# Python 확인 / 설치
# ------------------------------------------------------------

if ! command -v python3 >/dev/null 2>&1; then

  case "$OS_NAME" in

    "macOS")

      command -v brew >/dev/null 2>&1 \
        || die "Python 3와 Homebrew가 없습니다."

      log "Python 3 설치 중..."
      brew install python
      ;;

    "Linux"|"Windows WSL")

      log "Python 3 설치 중..."

      sudo apt-get update
      sudo apt-get install -y \
        python3 \
        python3-venv \
        python3-pip
      ;;

  esac

fi


# ------------------------------------------------------------
# Project-local venv 생성
# ------------------------------------------------------------

if [[ ! -x "$SEMGREP_BIN" ]]; then

  log "Semgrep용 project-local venv 생성"

  rm -rf "$SEMGREP_VENV"

  # Ubuntu에서 python3-venv가 없는 경우 자동 처리
  if ! python3 -m venv "$SEMGREP_VENV" 2>/dev/null; then

    if [[ "$OS_NAME" == "Linux" || "$OS_NAME" == "Windows WSL" ]]; then

      log "python3-venv 설치 중..."

      sudo apt-get update
      sudo apt-get install -y python3-venv

      python3 -m venv "$SEMGREP_VENV"

    else
      die "Python venv 생성 실패"
    fi

  fi


  log "pip 업데이트 중..."

  "$SEMGREP_VENV/bin/python" \
    -m pip install \
    --upgrade pip


  log "Semgrep Community Edition 설치 중..."

  "$SEMGREP_VENV/bin/python" \
    -m pip install \
    semgrep

else

  ok "Semgrep CLI 이미 설치되어 있음"

fi


# ------------------------------------------------------------
# Semgrep 확인
# ------------------------------------------------------------

if [[ ! -x "$SEMGREP_BIN" ]]; then
  die "Semgrep CLI 설치 실패"
fi

SEMGREP_VERSION="$("$SEMGREP_BIN" --version)"

ok "Semgrep CLI: $SEMGREP_VERSION"
ok "Semgrep 위치: .claude/tools/semgrep-venv/bin/semgrep"


# ============================================================
# DAY 2
# Semgrep Project Skill
# ============================================================

log "============================================"
log "DAY 2 - Semgrep Claude Skill"
log "============================================"

SEMGREP_SKILL_DIR="$PROJECT_ROOT/.claude/skills/semgrep-scan"

# 앞에서 깨진 파일이 있다면 완전히 제거
rm -rf "$SEMGREP_SKILL_DIR"

mkdir -p "$SEMGREP_SKILL_DIR"


cat > "$SEMGREP_SKILL_DIR/SKILL.md" <<'__SEMGREP_SKILL_EOF__'
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
__SEMGREP_SKILL_EOF__


if [[ ! -f "$SEMGREP_SKILL_DIR/SKILL.md" ]]; then
  die "Semgrep Skill 생성 실패"
fi

ok "Semgrep Skill 생성 완료"
ok ".claude/skills/semgrep-scan/SKILL.md"


# ============================================================
# Semgrep 수동 실행 Script
# ============================================================

log "============================================"
log "Create Semgrep Scan Script"
log "============================================"

mkdir -p "$PROJECT_ROOT/scripts"


cat > "$PROJECT_ROOT/scripts/semgrep-scan.sh" <<'__SEMGREP_SCRIPT_EOF__'
#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"

SEMGREP="$PROJECT_ROOT/.claude/tools/semgrep-venv/bin/semgrep"

if [[ ! -x "$SEMGREP" ]]; then
  echo "[ERROR] Project-local Semgrep이 설치되어 있지 않습니다."
  echo "프로젝트 setup script를 먼저 실행하세요."
  exit 1
fi

cd "$PROJECT_ROOT"

exec "$SEMGREP" scan --config auto .
__SEMGREP_SCRIPT_EOF__


chmod +x "$PROJECT_ROOT/scripts/semgrep-scan.sh"

ok "Semgrep 수동 실행:"
ok "./scripts/semgrep-scan.sh"


# ============================================================
# .gitignore
# ============================================================

log "============================================"
log "Git Ignore"
log "============================================"

GITIGNORE="$PROJECT_ROOT/.gitignore"

touch "$GITIGNORE"


if ! grep -Fxq ".claude/tools/" "$GITIGNORE"; then

  {
    echo
    echo "# Local Claude development tools"
    echo ".claude/tools/"
  } >> "$GITIGNORE"

fi

ok ".claude/tools/ 는 Git에서 제외"


# ============================================================
# DAY 2
# Security Guidance
# ============================================================

log "============================================"
log "DAY 2 - Security Guidance"
log "============================================"

install_plugin \
  "security-guidance@claude-plugins-official"


# ============================================================
# 최종 검증
# ============================================================

log "============================================"
log "Final Verification"
log "============================================"

echo
echo "Semgrep:"
"$SEMGREP_BIN" --version

echo
echo "Semgrep Skill:"
test -f "$SEMGREP_SKILL_DIR/SKILL.md" \
  && echo "OK - .claude/skills/semgrep-scan/SKILL.md"

echo
echo "Claude Plugins:"
claude plugin list || true


# ============================================================
# 완료
# ============================================================

echo
echo "============================================================"
echo " 설치 완료"
echo "============================================================"
echo
echo "Project:"
echo "  $PROJECT_ROOT"
echo
echo "[ Claude Code Plugins / project scope ]"
echo
echo "  ✓ UI/UX Pro Max"
echo "  ✓ Context7"
echo "  ✓ Code Review"
echo "  ✓ Security Guidance"
echo
echo "[ ECC ]"
echo
echo "  ✓ Coding Rules ONLY"
echo "  ✓ .claude/rules/ecc/"
echo
echo "[ Semgrep ]"
echo
echo "  ✓ Semgrep Community Edition CLI"
echo "  ✓ 로그인 불필요"
echo "  ✓ .claude/tools/semgrep-venv/"
echo
echo "  ✓ Claude Project Skill"
echo "  ✓ .claude/skills/semgrep-scan/SKILL.md"
echo
echo "Claude Code에서 실행:"
echo
echo "  /semgrep-scan"
echo
echo "터미널에서 실행:"
echo
echo "  ./scripts/semgrep-scan.sh"
echo
echo "Git 커밋 대상:"
echo
echo "  .claude/settings.json"
echo "  .claude/rules/ecc/"
echo "  .claude/skills/semgrep-scan/"
echo "  scripts/semgrep-scan.sh"
echo
echo "Git 제외:"
echo
echo "  .claude/tools/"
echo
echo "============================================================"