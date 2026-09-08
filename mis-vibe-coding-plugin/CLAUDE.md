# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MIS Vibe Coding 은 MIS 팀원들의 AI 기반 코딩 가속화를 위한 Claude Code 플러그인 **마켓플레이스**입니다. 기능별 plugin 모음으로 구성되어 필요한 것만 선택 설치 가능합니다.

## 플러그인 구조

```
.
├── .claude-plugin/
│   └── marketplace.json            # 마켓플레이스 매니페스트 (plugin 목록)
├── plugins/
│   ├── agent-teams/            # Agent Teams 병렬 개발
│   │   ├── .claude-plugin/plugin.json
│   │   ├── agents/
│   │   ├── skills/agent-teams/
│   │   ├── hooks/hooks.json
│   │   └── settings.json
│   ├── documentation/          # 코드 문서화 도구
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/code-documentation/
│   ├── mis-mcp/                    # MCP 서버 묶음
│   │   ├── .claude-plugin/plugin.json
│   │   └── .mcp.json
│   ├── sdl/                        # SDL 도메인 가이드
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/sdl/
│   │   └── docs/
│   └── dev-agent/              # 경량 CI 파이프라인 (서브에이전트 방식)
│       ├── .claude-plugin/plugin.json
│       ├── skills/
│       └── hooks/hooks.json
└── conductor/                      # 프로젝트 컨텍스트 (marketplace 메타)
```

## 주요 명령어

### 플러그인 관리
```bash
/plugin install agent-teams      # Agent Teams plugin 설치
/plugin install documentation    # 문서화 plugin 설치
/plugin install mis-mcp              # MCP plugin 설치
/plugin install sdl                  # SDL plugin 설치
/plugin install dev-agent        # 경량 CI 파이프라인 plugin 설치
/plugin install sdlc        # sdlc 를 통한 SR 처리
/reload-plugins                      # 플러그인 리로드
```

### Conductor
```bash
/conductor:new-track                  # 새 기능 트랙 생성
/conductor:setup                      # 기존 프로젝트 분석
/conductor:status                     # 트랙 상태 확인
```

### Agent Teams (mis-agent-teams plugin 설치 후)
```bash
/agent-teams:team-spawn ds-mis-dev-team-lv1 @agents/ds-mis-dev-team-lv1.md
/agent-teams:team-spawn ds-mis-dev-team-lv2 @agents/ds-mis-dev-team-lv2.md
/agent-teams:team-spawn ds-mis-dev-team-lv3 @agents/ds-mis-dev-team-lv3.md --profile <profile-name>
/agent-teams:team-status              # 팀 상태 확인
/agent-teams:team-shutdown            # 팀 종료
```

### 문서화 (mis-documentation plugin 설치 후)
```bash
/code-documentation:doc-generate      # API, architecture, development, features 문서 생성
/c4-architecture:c4-architecture      # C4 아키텍처 문서 생성
```

### dev-agent — 경량 CI 파이프라인 (dev-agent plugin 설치 후)
```bash
/dev-agent:create                 # 전체 파이프라인 (보안+품질→push→메일)
/dev-agent:create --skip-security # 보안 점검 건너뜀
/dev-agent:create --skip-mail     # 메일 발송 건너뜀
/dev-agent:create --no-push       # push 없이 보안/품질만 점검
/dev-agent:create --hard-block    # 🔴 보안 발견 시 push 차단
/dev-agent:create "feat: 기능명"  # 커밋 메시지 직접 지정

/dev-agent:security-check         # 보안 점검만 단독 실행
/dev-agent:quality-check          # 품질 점검만 단독 실행
/dev-agent:git-push               # git push만 단독 실행
/dev-agent:report-mail            # 보고서+메일만 단독 실행
```

> **agent-teams와 차이:** 팀 스폰 불필요. 세션마다 `/team-spawn` 없이 바로 사용 가능.
> 서브에이전트는 스킬 호출 시 자동 생성/소멸. 토큰 ~89% 절감 (LV1 기준 3,300 → 360 토큰).

## Agent Team 레벨

| 레벨 | 멤버 수 | 적용 범위 |
|------|---------|-----------|
| Lv1 | 5 명 | 단일 버그픽스, 소형 기능 (파일 1~3 개) |
| Lv2 | 9 명 | 중간 규모 기능 (파일 4~10 개), 리팩토링 |
| Lv3 | 메타 4 명 + 서브 (~50 명) | 대형 기능/운영/마이그레이션/감사 |

## MCP 서버

- `knox-api`: 메일 발송 (HTTP transport)
- 설정: `plugins/mis-mcp/.mcp.json` (mis-mcp plugin 설치 시 자동 연결)

## 코딩 규약

### 크로스 플랫폼 (Linux / Windows 필수 지원)

모든 plugin/skill/script는 Linux(macOS 포함)와 Windows 양쪽에서 동작해야 한다.

| 금지 | 대체 |
|------|------|
| `find`, `head`, `grep`, `sed` 등 Unix 유틸리티 | Node.js `fs`/`path` 모듈로 대체 |
| `$(...)` bash 명령 치환 | Node.js 인라인 스크립트 (`node -e "..."`) |
| `~/.claude/...` 경로 하드코딩 | `os.homedir()` + `path.join()` |
| `2>/dev/null` 리다이렉션 | try/catch 또는 `{ stdio: 'pipe' }` |
| bash shebang (`#!/usr/bin/env bash`) | Node.js shebang (`#!/usr/bin/env node`) 또는 cross-platform 스크립트 |

**경로 처리 규칙:**
- 경로 조합: `path.join()` / `path.resolve()` — 슬래시 직접 연결 금지
- 홈 디렉토리: `os.homedir()` — `~` 사용 금지
- 파일 탐색: `fs.readdirSync()` 재귀 탐색 — `find` 명령 금지

**SKILL.md 명령 블록:**
- bash 유틸리티 의존 명령은 `node -e "..."` 인라인 스크립트로 작성
- 외부 바이너리 위치 탐색도 Node.js로 처리

### Markdown
- One H1 per file, 섹션은 H2/H3
- 코드 블록은 언어 태그 명시
- 상대 경로 링크 사용: `[Workflow](./conductor/workflow.md)`

### Shell
- Shebang: `#!/usr/bin/env bash` + `set -euo pipefail`
- 함수는 `lower_snake_case`, 상수는 `UPPER_SNAKE_CASE`
- `shellcheck` 실행 후 커밋
- Shell 스크립트는 Linux 전용 보조 도구에만 사용 (plugin 핵심 로직 금지)

### 커밋
- Conventional Commits 준수 (`feat:`, `fix:`, `docs:`, 등)
- master 브랜치 직접 푸시 금지, PR 리뷰 필수

## 사전 조건

```bash
# Agent Teams 활성화
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

## 로컬 테스트

```bash
# 개별 plugin 로드
claude --plugin-dir ./plugins/agent-teams
claude --plugin-dir ./plugins/dev-agent
claude --plugin-dir ./plugins/documentation
claude --plugin-dir ./plugins/mis-mcp
claude --plugin-dir ./plugins/sdl
claude --plugin-dir ./plugins/sdlc

# 변경사항 리로드
/reload-plugins

# JSON 유효성 검증
cat .claude-plugin/marketplace.json | jq .
cat plugins/agent-teams/.claude-plugin/plugin.json | jq .
```

## 참고 문서

- [Product Definition](./conductor/product.md)
- [Tech Stack](./conductor/tech-stack.md)
- [Workflow](./conductor/workflow.md)
- [README](./README.md)
