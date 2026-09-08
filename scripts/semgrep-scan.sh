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
