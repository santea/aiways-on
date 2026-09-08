# Code Structure

## Build System

| 자산 | 빌드 시스템 | 설정 파일 | 상태 |
|------|------------|----------|------|
| `devops-example/portal` | pnpm 9.15.4 + Next.js | `package.json`, `tsconfig.json`, `next.config.ts` | 동작 |
| `devops-example/mcp-server` | pnpm + tsc | `package.json`, `tsconfig.json` | 동작 |
| `devops-example/sdlc-pod-runner` | npm (의존성 0) | `package.json` | 스텁 |
| `devops-example/helm` | Helm v2 chart | `Chart.yaml`, `values.yaml`, `values-dev.yaml` | 동작 |
| 전체 | Skaffold v4beta14 | `skaffold.yaml` | 동작 |
| 개발환경 | Conda | `environment.yml` (nodejs=22, pnpm, k8s-client, helm) | 동작 |
| `sdlc-pod` | Docker (BuildKit 1.7) | `Dockerfile` | **빌드 불가 — COPY 대상 부재** |

**주요 설정**
- Node: `.nvmrc` = 22 / `engines.node >= 22` / `packageManager: pnpm@9.15.4`
- Next.js `output: "standalone"` → Docker 멀티스테이지 최적화됨
- Pod 이미지는 nodejs **20** (conda-forge) — 스캐폴드의 22와 불일치

## Existing Files Inventory

### `devops-example/portal` (Application — 재작성 대상)
- `src/lib/auth.ts` (11줄) — NextAuth v5 + PrismaAdapter + GitHub provider
- `src/lib/prisma.ts` (9줄) — PrismaClient 싱글턴 (dev HMR 대응)
- `src/lib/utils.ts` — clsx + tailwind-merge `cn()` 헬퍼
- `src/app/api/auth/[...nextauth]/route.ts` (3줄) — handlers 재수출
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` — 기본 레이아웃
- `prisma/schema.prisma` — Auth.js 표준 4모델: `User`, `Account`, `Session`, `VerificationToken`
- `next.config.ts`, `postcss.config.mjs`, `components.json`(shadcn), `commitlint.config.js`
- `.husky/pre-commit`, `.husky/commit-msg` — lint-staged + commitlint 게이트
- `.env.example` — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `N8N_URL`, `MCP_SERVER_URL`
- `Dockerfile` (3-stage: deps→builder→runner, 비루트 uid 1001), `Dockerfile.dev`

### `devops-example/mcp-server` (Application — 확장 대상)
- `src/index.ts` (39줄) — `McpServer` + `SSEServerTransport`, tool `ping`, `/health`, `/sse`, PORT 3001

### `devops-example/sdlc-pod-runner` (폐기 대상)
- `src/index.js` (8줄) — `console.log` → 5초 후 `process.exit(0)`

### `devops-example/helm/ddt` (Infrastructure — 재사용)
- `templates/app-deployment.yaml`, `app-service.yaml`
- `templates/postgres-deployment.yaml`, `postgres-service.yaml`, `postgres-pvc.yaml`, `postgres-configmap.yaml`
- `templates/n8n-deployment.yaml`, `n8n-service.yaml`
- `templates/mcp-deployment.yaml`, `mcp-service.yaml`
- `templates/minio-deployment.yaml`, `minio-service.yaml`, `minio-pvc.yaml`
- `templates/_helpers.tpl`

### `devops-example/scripts` (Tooling — 재사용)
- `setup.sh` (Mac/Linux), `setup.ps1` (Windows), `test-setup.sh`

### `sdlc-pod` (Runtime — 고가치)
- `Dockerfile` — 상세는 architecture.md 참조
- `claude-global.md` (264줄) — Pod 에이전트 전역 규범
- `.claude/agents/explorer.md` — 읽기전용 탐색, 200단어 제한, opus
- `.claude/agents/git-controller.md` — add/commit/pull/충돌해결/push, 파괴적 명령 금지, opus
- `.claude/agents/qa-agent.md` — Playwright 테스트 생성·실행 + MCP 보완검증, PASS/FAIL/NEEDS_HUMAN_REVIEW, opus
- `.claude/agents/rsccb-report.md` — 보고서 4종 생성, `COMPLETE` 마커 필수, haiku
- `.claude/settings.local.json`

### `n8n` (Orchestration — 최고가치)
- `sdlc-workflow-A-intake.json` — 37.8KB / 20 nodes
- `sdlc-workflow-B-run-callback.json` — 95.1KB / 54 nodes
- `sdlc-workflow-C-logging.json` — 5.2KB / 5 nodes
- `.wfb-server-backup-before-resume.json` — 백업본

### `mis-vibe-coding-plugin` (Plugin — 재사용)
- `.claude-plugin/marketplace.json` — marketplace `mvc`, 3 plugins
- `plugins/sdlc/skills/user-deep-interview/SKILL.md` — 소크라테스식+우로보로스 게이팅 요구사항 인터뷰
- `plugins/sdlc/skills/capture-mockup/SKILL.md` + `references/`(config-schema, divergence-checklist, examples 4, scripts 5)
- `plugins/sdlc/agents/capture-mockup-runner.md` (SSOT, opus), `agents/explore.md` (haiku)
- `plugins/dev-agent/skills/{create,git-push,quality-check,report-mail,security-check}/SKILL.md`
- `plugins/dev-agent/hooks/hooks.json` — PostToolUse(Write|Edit) → quality-check 권고
- `plugins/vibe-coding-setup/skills/setup/SKILL.md` + `agents/setup-runner.md` (sonnet)
- `sdl-migration-docs/` — SQL 48개 + 서버 마이그레이션 가이드 12편 (**AIways-On과 무관 — 별개 SDL 프로젝트 유산**)

## Design Patterns

### Subagent 격리 (Context Isolation)
- **Location**: `capture-mockup`, `vibe-coding-setup:setup`, `explorer`, `explore`
- **Purpose**: repo 전체 탐색·캡처처럼 대량 산출물을 내는 작업이 메인 세션 컨텍스트를 오염시키지 않게 함
- **Implementation**: skill은 얇은 진입점으로 두고 `Task`/`Agent`로 runner subagent를 1회 호출, 요약만 회수

### SSOT (Single Source of Truth) 에이전트
- **Location**: `capture-mockup-runner.md`, `rsccb-report.md`
- **Purpose**: 동일 절차가 여러 곳에 중복 기술되어 드리프트하는 것을 방지
- **Implementation**: 절차 전문을 runner 에이전트 파일에만 두고, skill/global 문서는 참조만

### 단계 권한 단일화 (Authority Centralization)
- **Location**: `claude-global.md` 최우선 규칙
- **Purpose**: Pod가 자의적으로 다음 단계를 시작해 파이프라인이 어긋나는 것을 차단
- **Implementation**: "stage 진행 권한은 n8n에만 있다. Pod는 stage를 모르고, 알 필요도 없다."
  Pod는 `===MOCKUP_CONFIRMED===` 같은 **마커 문자열만** 출력하고 종료

### 보고서 단일 생성 지점 (Single Write Point)
- **Location**: `claude-global.md` "SDLC 산출물 MD 파일 저장 규칙"
- **Purpose**: 보고서 중복·양식 이탈 방지
- **Implementation**: 직접 `Write` 금지 → `rsccb-report` 서브에이전트만 생성. n8n의 지정 노드에서만 호출.
  저장 위치는 repo 밖 `/workspaces/session/.sdlc-reports/` (git 미추적)

### 싱글턴 클라이언트 (dev HMR 대응)
- **Location**: `portal/src/lib/prisma.ts`
- **Purpose**: Next.js dev 핫리로드 시 커넥션 폭증 방지
- **Implementation**: `globalThis` 캐싱, production에서는 캐싱 안 함

### 멀티스테이지 + 비루트 컨테이너
- **Location**: `portal/Dockerfile`, `sdlc-pod/Dockerfile`
- **Purpose**: 이미지 크기 축소 + 보안
- **Implementation**: deps→builder→runner 분리, `USER nextjs`(1001) / `USER runner`

## Critical Dependencies

### `next` — 15.3.x
- **Usage**: Portal 전체. App Router, standalone output
- **Purpose**: 풀스택 프레임워크
- **⚠️ 명세는 Next.js 16 요구** — major 업그레이드 필요

### `next-auth` — 5.0.0-beta.25
- **Usage**: `auth.ts` GitHub provider + PrismaAdapter
- **Purpose**: 인증
- **비고**: 명세의 "Auth.js v5"와 동일 패키지. **어댑터만 Prisma→Drizzle 교체 필요**

### `@prisma/client` / `prisma` — ^6.0.0
- **Usage**: DB 전 계층
- **⚠️ 명세는 Drizzle ORM 요구** — **전면 교체**. `schema.prisma` 4모델을 Drizzle 스키마로 재작성

### `@modelcontextprotocol/sdk` — ^1.0.0
- **Usage**: `mcp-server/src/index.ts`
- **⚠️ 전송 계층 불일치**: 현재 `SSEServerTransport`, 명세는 Streamable HTTP + Bearer `sdlcmem_*` (:58002)

### `@anthropic-ai/claude-code` (Pod, npm global)
- **Usage**: Pod 내 AI 실행 엔진
- **비고**: 버전 미고정(latest) — 재현성 리스크

### `@playwright/mcp` + `playwright` (Pod, npm global)
- **Usage**: 목업 캡처, QA 검수
- **비고**: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` + apt `chromium` 사용 (air-gapped 대응)

### `continuumio/miniconda3` — 26.3.2
- **Usage**: Pod base image
- **Purpose**: per-session conda env(`conda-pack`) 프로비저닝

### `tailwindcss` — ^4.0.0 + `shadcn/ui`
- **Usage**: 스타일링. `components.json` 존재하나 실제 컴포넌트 미설치
- **비고**: 명세·디자인 문서와 **일치** — 재사용 가능
