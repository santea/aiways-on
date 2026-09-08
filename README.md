# AIways-On

SDLC 자동화 플랫폼. 요구사항 명세는 `requirements/`, 설계·계획 산출물은 `aidlc-docs/` 에 있다.

## 프로젝트 기준

AIways-On 타깃 애플리케이션을 Greenfield로 신규 구축한다. 
AI-DLC 실행 기록은 `aidlc-docs/audit.md`에 KST(UTC+09:00)로 기록한다.

## 구조 (UOW-9)

```
apps/portal/          SVC-1 Next.js 16 — U1~U6 공동 (유닛별 features/ 디렉토리)
apps/sdlc-pod-runner/     SVC-2 FastAPI (U3)
apps/sdlc-memory-mcp/     SVC-3 MCP (U6)
apps/sdlc-slack-gateway/  SVC-4 Socket Mode 릴레이 (U3) — 공유 패키지 의존 금지
packages/contracts/   유닛 경계 계약. 타입 전용 (런타임 코드 0)
packages/lib/         auth · db · ui · domain — U1 소유
charts/               Helm chart · values (U1)
drizzle/              마이그레이션 (U1 이 일괄 생성)
```

소유 경계는 `CODEOWNERS` 에 있다. 타 유닛 디렉토리를 건드리는 PR 은 소유자 리뷰가 강제된다.

## 로컬 기동

```bash
corepack enable && pnpm install

# 환경 변수 (예시)
export DATABASE_URL='postgres://aiways:aiways@localhost:5432/aiways_on'
export AUTH_SECRET="$(openssl rand -base64 32)"
export AUTH_GITHUB_ID=...        # GitHub OAuth App
export AUTH_GITHUB_SECRET=...
export INITIAL_ADMIN_GITHUB_LOGINS=your-login

pnpm db:push          # 스키마 적용 (또는 pnpm db:generate 후 마이그레이션 적용)
pnpm dev              # http://localhost:3000
```

### K8s 스택

```bash
conda env create -f environment.yml   # Pod Runner 용 (U3)
skaffold dev                          # Helm 차트로 전체 스택 기동
```

## 검사

```bash
pnpm typecheck                        # 전 워크스페이스 타입 검사
pnpm test                             # 단위 테스트
pnpm verify:contracts-runtime-free    # contracts 에 런타임 코드가 없는지
pnpm verify:gateway-isolation         # Slack Gateway 가 공유 패키지를 쓰지 않는지
helm lint charts/aiways-on
```

## 경계 규약

- `packages/contracts` 는 **타입만** 둔다. 실행이 필요한 값은 `packages/lib/domain` 으로.
- 인증은 `packages/lib/auth` 가 단독 소유한다. 유닛 라우트에 자체 토큰 비교를 쓰지 않는다.
- Drizzle 스키마는 유닛별 파일로 나뉘지만 **배럴·공유 테이블·FK 규약·마이그레이션 생성은 U1** 이 한다.
- Slack Gateway 는 Portal 과 코드·타입을 공유하지 않는다 (CI 가 검사한다).
