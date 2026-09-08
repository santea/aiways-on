# Component Inventory

## Application Packages
- `devops-example/portal` — Next.js 15 스캐폴드. GitHub OAuth + Prisma 골격 (소스 7파일). **재작성 대상**
- `devops-example/mcp-server` — MCP SDK + SSE, `ping` tool 1개 (39줄). **전송계층 교체 후 확장**
- `devops-example/sdlc-pod-runner` — console.log 스텁 (8줄). **폐기 대상**

## Infrastructure Packages
- `devops-example/helm/ddt` — Helm umbrella chart. 13 templates / 5 서비스(app·postgres·n8n·mcp·minio). **재사용**
- `devops-example/skaffold.yaml` — Skaffold v4beta14. 3 build artifacts + file sync + 6 portForward. **재사용**
- `devops-example/environment.yml` — Conda env `ddt` (nodejs=22, pnpm, kubernetes-client, helm). **재사용**
- `devops-example/scripts` — `setup.sh` / `setup.ps1` / `test-setup.sh` 크로스플랫폼 부트스트랩. **재사용**
- `sdlc-pod/Dockerfile` — Pod 런타임 이미지 (miniconda3 + CC CLI + Playwright + OMC/MVC). **재사용, 단 COPY 대상 7종 부재**

## Shared Packages
- (없음) — 현존 자산에 공유 타입/유틸 패키지는 존재하지 않는다.
  명세상 `sdlc-slack-gateway`는 의도적으로 Portal과 타입을 공유하지 않는 독립 서비스다.

## Configuration / Governance Packages
- `sdlc-pod/claude-global.md` — Pod 에이전트 전역 행동규범 264줄. **최고가치, 그대로 재사용**
- `sdlc-pod/.claude/agents/` — 서브에이전트 4종
  - `explorer` (opus, Read/Grep/Glob, ≤200단어)
  - `git-controller` (opus, 파괴적 명령 금지, 충돌 자동해결)
  - `qa-agent` (opus, Playwright + MCP, PASS/FAIL/NEEDS_HUMAN_REVIEW)
  - `rsccb-report` (haiku, 보고서 4종, `COMPLETE` 마커)

## Orchestration Packages
- `n8n/sdlc-workflow-A-intake.json` — 20 nodes / 37.8KB. **재사용, stage 매핑 조정 필요**
- `n8n/sdlc-workflow-B-run-callback.json` — 54 nodes / 95.1KB. **최고가치, stage 매핑 조정 필요**
- `n8n/sdlc-workflow-C-logging.json` — 5 nodes / 5.2KB. **재사용**

## Plugin Packages (`mis-vibe-coding-plugin`, marketplace `mvc`)
- `plugins/sdlc` — skills 2 (`user-deep-interview`, `capture-mockup`) + agents 2 (`capture-mockup-runner`, `explore`). **핵심 재사용**
- `plugins/dev-agent` — skills 5 (`create`, `git-push`, `quality-check`, `report-mail`, `security-check`) + PostToolUse hook. **선택 재사용**
- `plugins/vibe-coding-setup` — skill 1 (`setup`) + agent 1 (`setup-runner`). **재사용**

## Specification Packages (코드 아님, SSOT)
- `requirements/` — 14 문서 / 13,102줄. **요구사항 SSOT**
- `design/웹화면-디자인-요구사항_v1.md` — 887줄. 13개 화면 + 디자인시스템 + 파이프라인 애니메이션. **UI SSOT**

## Legacy / Out-of-Scope Packages
- `mis-vibe-coding-plugin/sdl-migration-docs/` — SQL 48개 + 서버 마이그레이션 가이드 12편.
  **별개 SDL 프로젝트 유산. AIways-On과 무관 — 참조하지 말 것.**

## Test Packages
- **없음.** 전체 워크스페이스에 테스트 파일이 단 하나도 존재하지 않는다.

## Total Count

| 분류 | 개수 | 비고 |
|------|------|------|
| **Application** | 3 | 재작성 1, 확장 1, 폐기 1 |
| **Infrastructure** | 5 | 전부 재사용 |
| **Shared** | 0 | - |
| **Configuration/Governance** | 5 | claude-global.md + 서브에이전트 4 |
| **Orchestration** | 3 | n8n 워크플로우 |
| **Plugin** | 3 | mvc marketplace |
| **Specification** | 15 | requirements 14 + design 1 |
| **Legacy/Out-of-scope** | 1 | sdl-migration-docs |
| **Test** | **0** | ⚠️ |
| **총 패키지** | **35** | |

## 신규 구축 필요 컴포넌트 (부재)

| 컴포넌트 | 명세 출처 | 규모 추정 |
|---------|----------|----------|
| `src/` Portal 본체 (API + UI 13화면) | `05-portal-api.md`(1,146줄), `08`(686줄), `design/`(887줄) | 대 |
| `drizzle/` 스키마 + 마이그레이션 | `04-db-schema.md`(723줄) | 중 |
| `sdlc-pod-runner/app/` FastAPI | `06-pod-runner-api.md`(962줄) | 중 |
| `sdlc-memory-mcp/` | `13-developer-memory-agent.md`(2,394줄) | 중 |
| `sdlc-slack-gateway/` | `02-messaging-adapter.md`(683줄) 6.3절 | 소 |
| K8s Secret / RBAC / CronJob 2종 / Ingress | `10-k8s-infrastructure.md`(1,073줄) | 중 |
| Pod 이미지 부속 파일 7종 | `sdlc-pod/Dockerfile` COPY 대상 | 소 |
