#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# Claude Code - Project Scope Setup
# Linux / Windows WSL / macOS 공용
#
# 설치:
#   - UI/UX Pro Max
#   - Context7 (Anthropic official)
#   - ECC (Coding Rules ONLY)
#   - Code Review
#   - Semgrep
#   - Security Guidance
#
# 모든 플러그인은 현재 프로젝트 scope에만 적용
# ============================================================

SCOPE="project"

# ECC에서 가져올 rule
ECC_RULESETS=(
  common
  typescript
  python
  web
)

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

설치할 프로젝트로 이동한 뒤 실행하세요.

예:
  cd ~/svc/my-project
  ./install-claude-plugins.sh"
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

    warn "설치 명령 실패: $plugin_id"
    warn "이미 설치되어 있는 경우라면 무시해도 됩니다."

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

install_plugin \
  "context7@claude-plugins-official"


# ============================================================
# DAY 1
# ECC - Coding Rules ONLY
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


# User/global:
#   ~/.claude/rules/
#
# 가 아니라 현재 Project:
#   <PROJECT>/.claude/rules/
#
ECC_DEST="$PROJECT_ROOT/.claude/rules/ecc"

mkdir -p "$ECC_DEST"


for ruleset in "${ECC_RULESETS[@]}"; do

  src="$TMP_DIR/ECC/rules/$ruleset"
  dst="$ECC_DEST/$ruleset"

  if [[ ! -d "$src" ]]; then
    warn "ECC ruleset이 존재하지 않음: $ruleset"
    continue
  fi

  # 기존 해당 ruleset 최신본으로 교체
  rm -rf "$dst"

  cp -R \
    "$src" \
    "$dst"

  ok "ECC Rule 설치 완료: $ruleset"

done


ok "ECC 전체 plugin은 설치하지 않았습니다."
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
# Semgrep
# ============================================================

log "============================================"
log "DAY 2 - Semgrep"
log "============================================"

install_plugin \
  "semgrep@claude-plugins-official"


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
# 결과 확인
# ============================================================

log "============================================"
log "설치된 Plugins"
log "============================================"

claude plugin list || true


echo
echo "============================================================"
echo " 설치 완료"
echo "============================================================"
echo
echo "Project:"
echo "  $PROJECT_ROOT"
echo
echo "Scope:"
echo "  project"
echo
echo "Plugins:"
echo "  ✓ UI/UX Pro Max"
echo "  ✓ Context7 (claude-plugins-official)"
echo "  ✓ Code Review"
echo "  ✓ Semgrep"
echo "  ✓ Security Guidance"
echo
echo "ECC:"
echo "  ✓ Coding Rules ONLY"
echo
echo "  .claude/rules/ecc/common"
echo "  .claude/rules/ecc/typescript"
echo "  .claude/rules/ecc/python"
echo "  .claude/rules/ecc/web"
echo
echo "ECC에서 설치하지 않은 것:"
echo "  ✗ Agents"
echo "  ✗ Skills"
echo "  ✗ Commands"
echo "  ✗ Hooks"
echo "  ✗ ecc@ecc plugin"
echo
echo "============================================================"