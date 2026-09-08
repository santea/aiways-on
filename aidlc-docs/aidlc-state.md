# AI-DLC State Tracking

## Project Information
- **Project Name**: AIways-On
- **Project Type**: **Greenfield target application** (사용자 확인: 2026-09-08. AIways-On 타깃은 신규 구축하며, 기존 폴더는 입력 참고자료일 뿐 수정·확장 대상인 기존 제품이 아님)
- **Start Date**: 2026-09-08T14:01:00+09:00 (KST)
- **Current Phase**: CONSTRUCTION
- **Current Stage**: CONSTRUCTION / Code Generation — U1 ✅ 완료 · **U2 착수 대기 (사용자 지시 대기)**
- **Next Stage**: Code Generation ×6 → Build and Test

## Workspace State
- **Target Application Code at Workflow Entry**: **No** — AIways-On 구현은 존재하지 않았음
- **Pre-existing Reference Code**: **Yes** — 예제·런타임·워크플로 자산이 있었으나 기존 AIways-On 제품이나 유지보수 대상은 아님
- **Current Target Code**: **Yes** — AI-DLC Code Generation에서 U1을 신규 생성함
- **Programming Languages**: TypeScript, JavaScript, Python, Java, SQL, Shell, PowerShell
- **Build System**: pnpm / npm (Next.js), Helm + Skaffold (K8s), Conda (`environment.yml`), Docker
- **Project Structure**: Multi-service (Portal + n8n + Pod Runner + MCP + Gateway) — planned
- **Reverse Engineering Needed**: **No** — 마이그레이션·수정·확장할 기존 AIways-On 시스템이 없으므로 SKIP
- **Workspace Root**: `/Users/suntae/aiways-on`

### Target Application Code — Status at Workflow Entry: ABSENT
Workspace Detection 당시 `requirements/00-overview.md` §5가 지정한 다음 타깃 경로는 존재하지 않았다. 이후 U1 Code Generation에서 일부 경로를 신규 생성했다:
`src/`, `drizzle/`, `n8n/` (as app dir), `sdlc-pod-runner/`, `sdlc-memory-mcp/`, `sdlc-slack-gateway/`, `docs/`, root `package.json`

### Reference Assets Inventory (참고자료 — 수정 대상 아님)
| Path | Kind | Contents | Role |
|------|------|----------|------|
| `requirements/` | Specification | 14 docs, 13,102 lines | **SSOT — 요구사항 단일 진실 공급원** |
| `design/` | Specification | 1 doc, 887 lines (웹화면-디자인-요구사항_v1) | UI/UX requirements |
| `devops-example/` | Working scaffold | DDT: Next.js 15 + Prisma + NextAuth v5 + Helm + Skaffold + Conda; portal / mcp-server / sdlc-pod-runner | Infra & tooling reference |
| `sdlc-pod/` | Runtime asset | Dockerfile (7.5KB), claude-global.md (21KB), 4 Claude subagents | Pod runtime reference |
| `n8n/` | Workflow asset | Workflow A (intake), B (run-callback), C (logging) JSON | n8n reference |
| `mis-vibe-coding-plugin/` | Claude Code plugin | marketplace + 3 plugins (dev-agent, sdlc, vibe-coding-setup), 9 skills, 3 agents | Vibe-coding plugin reference |
| `.aidlc-rule-details/`, `CLAUDE.md` | Process | AI-DLC v1.0.1 | Workflow rules |

### Known Divergences (참고자산 vs. 명세) — 명세가 우선
상세는 `aidlc-docs/inception/reference-assets/README.md` D-1~D-8 참조:
| Aspect | `devops-example` scaffold | `requirements/` target |
|--------|---------------------------|------------------------|
| Framework | Next.js 15 | Next.js 16 |
| ORM | Prisma | Drizzle ORM |
| Auth | NextAuth v5 (GitHub OAuth) | Auth.js v5 (GitHub OAuth) — aligned |
| Pod Runner | Node.js (`src/index.js`) | FastAPI (Python) |
| Messaging | — | Slack (+ Socket Mode gateway Pod) |
| Project name | DDT | AIways-On |

## Team & Parallelization Constraint
- **Team size**: 6 developers
- **Split**: 1 shared/common unit + 5 parallel units
- **Implication**: Units Generation stage MUST produce exactly 6 units with a dependency graph where the shared unit is the sole common prerequisite.

## Code Location Rules
- **Application Code**: Workspace root (NEVER in `aidlc-docs/`)
- **Documentation**: `aidlc-docs/` only
- **Structure patterns**: See `construction/code-generation.md` Critical Rules

## Extension Configuration
| Extension | Enabled | Decided At |
|-----------|---------|------------|
| security-baseline | **Yes (full)** — CQ4=E, OWASP Top 10 전체. SECURITY-01~15 전부 blocking | Requirements Analysis |
| resiliency-baseline | **Yes** — Q2=A. RESILIENCY-01~15. 세부 목표는 resiliency-questions.md 답변으로 확정 | Requirements Analysis |
| property-based-testing | **Partial** — Q3=B. 순수 함수 + 직렬화 왕복에만 PBT 적용 (PBT-02 중심) | Requirements Analysis |

## Stage Progress

### INCEPTION PHASE
- [x] **Workspace Detection** — COMPLETE (2026-09-08, 타깃 애플리케이션 기준 Greenfield 확인)
- [~] **Reverse Engineering** — **SKIPPED** (Greenfield target). 참고자산 평가는
      `aidlc-docs/inception/reference-assets/`에 입력자료 분석으로 기록 (기존 제품의 RE 산출물 아님)
- [x] **Requirements Analysis** — ✅ COMPLETE (depth: COMPREHENSIVE, 승인 2026-09-08)
      - [x] Step 2 Intent Analysis — New Project / Clear / Cross-system / Complex
      - [x] Step 3 Depth 결정 — Comprehensive
      - [x] Step 4 기존 요구사항 평가 — requirements/ 14문서 13,102줄 + design/ 887줄
      - [x] Step 5 완전성 분석 — 미결정 14건 도출
      - [x] Step 5.1 Extension opt-in 질문 포함 (3종)
      - [x] Step 6 질문 파일 생성 — requirement-verification-questions.md
      - [x] Step 6 답변 수신 (14/14) — 2026-09-08
      - [x] Step 6 모순·모호성 검증 — **모순 2건 · 모호성 3건 발견**
      - [x] 명확화 질문 파일 생성 — requirements-clarification-questions.md (5문항)
      - [x] 명확화 답변 수신 (5/5) — 모순 2건 해소
      - [x] Step 5.1 Extension 규칙 로드 (security 15 / resiliency 15 / PBT 10)
      - [x] Resiliency 필수 질문 8건 생성 — resiliency-questions.md
      - [x] Resiliency 답변 수신 (8/8)
      - [x] **Step 7 requirements.md 생성 완료** (391줄, D-01~D-29 / 45 FR / 27 NFR)
      - [x] ✅ **사용자 승인 완료 (2026-09-08)**

#### Resiliency 확정 (R1~R8)
| R | 답 | 결정 |
|---|---|---|
| R1 | A | RTO 4시간 / RPO 24시간, 일일 백업, 단일 리전 |
| R2 | A | GitHub PR 리뷰 + merge = 변경관리 (도그푸딩) |
| R3 | D+ | 로컬 Skaffold + **GitHub Actions CI까지만** (CD 없음) |
| R4 | B | 이전 이미지 태그 재배포 (rollout undo) |
| R5 | A | Rolling Update |
| R6 | A | 단일 클러스터 / 단일 존 |
| R7 | D | 복원력 테스트 생략 — **사용자 승인 예외 (RESILIENCY-14)** |
| R8 | D | 운영 장애대응 프로세스 v2 연기 — **사용자 승인 예외 (RESILIENCY-15)** |

> R8=D는 *팀의 운영 장애 대응 프로세스*를 미루는 것이며,
> *제품 기능인 장애대응 Agent(U4)* 는 D-01에 따라 v1 범위에 포함된다. 별개 사안.

#### 명확화 확정 (CQ1~CQ5)
| CQ | 답 | 결정 내용 |
|---|---|---|
| CQ1 | A | **"2일" = 전체 프로젝트 기간.** 근거: 6명 전원 바이브코딩 가속 |
| CQ2 | D* | **범위·깊이 모두 유지 + 2일 유지.** (D의 "기간 연장" 조항은 사용자가 명시적으로 거부) |
| CQ3 | B | 공용 = K8s + n8n 인프라 / 코어SDLC(진행) = Pod Runner + Slack Gateway |
| CQ4 | E | **OWASP Top 10 전체** 강제 → security-baseline = Enabled **Yes (full)** |
| CQ5 | (가)기존대로 (나)동의 | n8n 워크플로우 작성은 n8n 배포 후 / Dockerfile 전면 재작성 수용 |

> **기록된 가정 (재확인 완료)**: 12 person-day로 명세 13,102줄 + TDD 완주는 통상 불가능하다는
> 우려를 제기했고, 사용자가 두 차례 "바이브코딩으로 2일 내 가능"이라고 확인함.
> 사용자 결정으로 수용하여 전체 범위·전체 깊이·TDD·2일 목표로 진행한다.

#### 확정된 답변 (Q1~Q14)
| Q | 답 | 결정 내용 |
|---|---|---|
| Q4 | A | v1 범위 = 전체 (01~13) — ⚠️ 모순1로 재확인 중 |
| Q5 | A | **명세 우선.** `1→2→3→4→9_COMPLETE`. claude-global.md는 참고용 |
| Q6 | C | n8n: import 후 신규작성 — ⚠️ 모호성(가)로 재확인 중 |
| Q7 | X | 공용(기반)/코어SDLC(관리)/코어SDLC(진행)/장애대응/자체개선/개발규정 — ⚠️ 모순2로 재확인 중 |
| Q8 | C | 공용 유닛 = 스캐폴딩 + DB스키마 + 타입 + 인증 + Helm/Skaffold/Conda/setup |
| Q9 | A | **단일 repo + 디렉토리 분리** (00-overview §5 구조) |
| Q10 | A | **Next.js 16 + Node 22** (Pod 이미지 포함 통일) |
| Q11 | A | **실제 Slack 워크스페이스 사용 가능** |
| Q12 | B | 개발은 공용 레지스트리, 배포 시 사내 미러 전환 |
| Q13 | A | TDD 강제 + CI 커버리지 게이트 — ⚠️ 모순1로 재확인 중 |
| Q14 | C | `prefers-color-scheme` 자동 전환, 다크·라이트 토큰 모두 정의 |
- [x] **User Stories** — ✅ COMPLETE (승인 2026-09-08)
      - [x] Step 1 필수 평가 — 실행 판정 (High Priority 5개 해당)
      - [x] Part 1 Planning — 방법론 질문 7건 생성·답변 수신
      - [x] Step 9 답변 분석 — Q4=C 혼합의 판단 규칙 명시로 모호성 해소
      - [x] Part 2 Generation — personas.md(181줄) + stories.md(793줄)
      - [x] 실행 체크리스트 23/23 완료
      - [x] 품질 검증 — INVEST 6기준 통과, FR 45/45 커버
      - [x] ✅ **사용자 승인 완료 (2026-09-08)**

#### 스토리 방법론 확정 (Q1~Q7)
| Q | 답 | 결정 |
|---|---|---|
| Q1 | A | 유닛 정렬 (Domain-Based) — 6유닛 1:1 매핑 |
| Q2 | A | 사람 4종(P1~P4) + 시스템 액터 3종(S1~S3) |
| Q3 | A | 화면·엔드포인트 단위 → 실제 56건 |
| Q4 | **C** | 혼합 — UI는 체크리스트, API·상태머신은 Given-When-Then |
| Q5 | A | 시스템 액터 스토리 포함 (U3에 9건 집중) |
| Q6 | A | FR ID + 원본 문서 병기 |
| Q7 | A | MoSCoW → 실제 **Must 46 / Should 10** / Could 0 |

#### 산출물
- `aidlc-docs/inception/plans/user-stories-assessment.md`
- `aidlc-docs/inception/plans/story-generation-plan.md` (체크리스트 23/23)
- `aidlc-docs/inception/user-stories/personas.md`
- `aidlc-docs/inception/user-stories/stories.md`

#### Units Generation으로 넘길 발견 사항
1. **U3 집중** — 스토리 18건(32%), 명세 27%. 재분배 또는 2인 배정 검토 필요 (R-03)
2. **U1 인터페이스 우선 4건** — US-U1-02·03·04·06이 나머지 5유닛의 착수를 품 (R-02)
3. **유닛 경계 9건** (실체는 7개 인터페이스 — 2쌍이 양쪽에서 중복 기술됨)
4. **Could 0건** — 범위 압박 시 버릴 후보가 Should 10건뿐
- [x] **Workflow Planning** — ✅ COMPLETE (승인 2026-09-08, SATISFIED 처리로 수정)
      - [x] Step 1 전체 컨텍스트 로드
      - [x] Step 2 영향·리스크 분석 — **Risk Level: HIGH**
      - [x] Step 3 단계 판정 — 수행 4 / 생략 4
      - [x] Step 6 Mermaid 검증 — dangling End 노드 발견·수정 후 재검증 통과
      - [x] Step 7 execution-plan.md 생성 (278줄)
      - [x] ✅ **사용자 승인 완료 (2026-09-08)** — 4단계를 SKIP이 아닌 SATISFIED로 수정

#### 실행 계획 요약
| 단계 | 판정 | 근거 |
|------|:----:|------|
| Application Design | **수행** | 명세가 유일하게 비운 영역(컴포넌트 경계·의존성). S-1~S-5 해소 |
| Units Generation | **수행** | D-14 6유닛 분할 필수 |
| Functional Design | **✅ 충족** | `04-db-schema.md` + `03-state-machine.md`를 설계서로 사용 |
| NFR Requirements | **✅ 충족** | `requirements.md` §4(NFR 27) + D-07~D-13을 설계서로 사용 |
| NFR Design | **✅ 충족** | `03-state-machine.md` §3·§6 + `02-messaging-adapter.md`를 설계서로 사용 |
| Infrastructure Design | **✅ 충족** | `10-k8s-infrastructure.md` 1,073줄을 설계서로 사용 |
| Code Generation ×6 | **수행** | 필수 |
| Build and Test | **수행** | 필수 |

**승인 게이트: 9회** (전 단계 수행 시 32회 → 2일 일정 내 불가)

#### Application Design 입력 — 구조 문제 S-1~S-5
| # | 문제 |
|---|------|
| S-1 | **U2↔U3 순환 의존** — `/intake`(U2)→프로비저닝(U3), `4→9` 진입작업(U3)→PR 생성(U2) |
| S-2 | **서버간 인증 소유자 없음** — MASTER_KEY/POD_TOKEN/서빙토큰/sdlcmem_* 4종 |
| S-3 | **SR 생성 경로 3분기** — incident 자동머지 금지 예외가 U3 코드에 있으나 필요성은 U4에서 옴 |
| S-4 | **중복 계약 2쌍** — 경계 9건의 실체는 7개 인터페이스 |
| S-5 | **U6↔U3가 실제로는 3자** — MCP(U6) + Pod spec(U3) + Helm 배포(U1) |
- [x] **Application Design** — ✅ COMPLETE (승인 2026-09-08, Units Generation 진행 지시로 게이트 종료)
      - [x] 계획 + 질문 6건 생성·답변 수신
      - [x] Step 8 답변 분석 — Q3 안전 공백 발견 → 명확화 → A 확정
      - [x] Step 10 산출물 5종 생성 (총 1,161줄)
      - [x] 검증 — 컴포넌트 31/31 커버, Mermaid 2개 통과, 순환 없음, 인터페이스 소유자 7/7
      - [x] ✅ **사용자 승인 완료 (2026-09-08)** — "Units Generation 단계 진행해줘"

#### 설계 결정 AD-1~AD-6
| ID | 결정 | 해소 |
|----|------|------|
| AD-1 | Port 인터페이스(`GitHubPort`·`MessagingPort`·`PodPort`)를 U1로, 구현은 각 유닛 | S-1 순환 |
| AD-2 | 인증 전체(사용자 + 서버간 4종)를 U1 `AuthGuard` 단독 소유 | S-2 |
| AD-3 | **단일 validator가 프로파일 정책을 SR에 각인.** U3는 읽기만 | S-3 |
| AD-4 | 인터페이스별 소유자 1명, 타입은 U1 공유 패키지 | S-4 |
| AD-5 | ConfigMap 키 1개(`sdlc-endpoints.memoryMcpUrl`), 값은 Service DNS | S-5 |
| AD-6 | 리뷰 규약 + 경계 규약 7건(B-1~B-7) 명문화. 타입 강제는 이미 존재 | 계약 위반 |

#### 구조 확정
- **컴포넌트 31개** — U1:5 U2:5 **U3:9** U4:4 U5:4 U6:4
- **배포 서비스 5개** — Portal(23컴포넌트, replicas 2+) / Pod Runner(SR당 1) /
  Memory MCP / Slack Gateway(**replicas 1 고정**) / n8n
- **R-02 완화** — 차단 구간이 "U1 완료" → "**U1 인터페이스 선언 완료**"로 축소
- [x] **Units Generation** — ✅ COMPLETE (승인 2026-09-08)
      - [x] Step 1~4 계획 + 질문 9건 생성 — `plans/unit-of-work-plan.md`
      - [x] Step 6 답변 수신 (9/9) — 2026-09-08
      - [x] Step 7 답변 분석 — **모호성 2건 · 모순 1건 발견** (Q4 "간소화" 대상 불명 / Q9=C가 명세 §5와 충돌 / "공유" 경계 미정)
      - [x] Step 8 명확화 질문 3건 생성 — `plans/unit-of-work-clarification.md`
      - [x] 명확화 답변 수신 (3/3) — CQ1=A · CQ2=A · CQ3=B (권장안)
      - [x] Step 9 계획 승인 — "권장안대로 진행"
      - [x] Part 2 — 산출물 3종 생성 완료
      - [x] 실행 체크리스트 29/29 완료
      - [x] 검증 — 스토리 56/56 · 컴포넌트 31/31 · FR 45/45 · 순환 0 · Mermaid 통과
      - [x] HTML 요약 발행 — `inception/units-generation.html` → Artifact `146c30e6`
      - [x] ✅ **사용자 승인 완료 (2026-09-08)** — INCEPTION PHASE 종료

#### 유닛 분해 확정 (UOW-1~UOW-9)
| ID | 결정 | 출처 |
|----|------|------|
| UOW-1 | 6유닛 · 1인 1유닛. U3만 내부 3트랙(T1 상태·SR생성 / T2 Pod·Runner / T3 Slack·n8n) 순차 | Q1=A |
| UOW-2 | 배치1(Must 46) / 배치2(Should 10) 구분 — 절삭 후보 사전 지정 | Q2=A |
| UOW-3 | **U1 인터페이스 전용 PR #1 머지 = 5유닛 착수 신호** | Q3=A |
| UOW-4 | 최소 stub(고정값)으로 착수, 계약 테스트 스위트 생략. **TDD·커버리지 게이트 유지 — D-20 무수정** | CQ1=A |
| UOW-5 | CODEOWNERS + 디렉토리 경계로 소유권 강제 | Q5=A |
| UOW-6 | `SdlcRequestFactory` 시그니처 U1 / 구현 U3 — 3유닛 동시 차단 해소 | Q6=C |
| UOW-7 | Dockerfile은 코드 소유 유닛(Portal만 U1), chart·values·Secret·RBAC·ConfigMap은 U1 | Q7=C |
| UOW-8 | Drizzle 스키마 파일은 유닛별 분할, 소유권은 U1 | Q8=B |
| UOW-9 | 경량 워크스페이스 — `apps/portal` + `packages/contracts` + `packages/lib`. 공유 영역에 U1 소유물 전부 | CQ2=A, CQ3=B |

> **명세 §5 대비 변경**: `00-overview.md` §5는 루트 `src/` 단일 앱을 명시. UOW-9는 이를
> `apps/portal/src/` + `packages/*`로 바꾼다. 의도된 변경이며 `unit-of-work.md` §2.2에
> 경로 매핑과 되돌리는 방법을 기록함.

#### Code Generation으로 넘길 사항
1. **임계 경로 = U1 PR #1 → U3 T1** — T1 완료가 B-1을 풀어 U2·U4·U5 3유닛의 stub 교체를 허용
2. **stub 2건에 필수 조건** — `GitHubPortStub`의 `null` 반환 경로(B-2), `SdlcRequestFactoryStub`의 정책 각인 `metadata`(AD-3). 누락 시 각각 미구현 분기·AD-3 무력화
3. **SVC-4 타입 격리 위험(신규)** — 워크스페이스에서 Gateway가 `packages/*`를 import 하기 쉬워짐. CI 의존 검사를 US-U1-10에 포함
4. **R-03 잔존** — U3 18건 1인. 완화안 2종은 `unit-of-work.md` §4

### CONSTRUCTION PHASE
- [x] **Functional Design** — ✅ SATISFIED (기존 명세, 사용자 확정 2026-09-08)
- [x] **NFR Requirements** — ✅ SATISFIED (기존 명세)
- [x] **NFR Design** — ✅ SATISFIED (기존 명세)
- [x] **Infrastructure Design** — ✅ SATISFIED (기존 명세)
- [~] **Code Generation** — 유닛별 6회 · U1 진행 중
      - [x] **U1 공용 기반** — ✅ COMPLETE (승인 2026-09-08). **PR #1 머지 시 5유닛 착수 가능**
            - [x] Step 1 유닛 컨텍스트 분석
            - [x] **SATISFIED 참조 문서 충분성 검증** — DB·디자인·인프라·구조 충분 / **인증 부분 부족(F-1)**
            - [x] Step 2~4 계획 생성 — `construction/plans/u1-shared-foundation-code-generation-plan.md` (17단계)
            - [x] 계획 HTML 요약 발행 — `construction/u1-shared-foundation/code/u1-plan.html` → Artifact `d789420b`
            - [ ] ⛔ **GATE: 계획 승인 대기 중**
            - [~] Part 2 — 코드 생성 진행 중
                  - [x] **Phase A (Step 1~6) = PR #1 완료** — 5유닛 착수 차단 해제 지점
                        - [x] typecheck 3/3 통과 (실제 실행)
                        - [x] contracts 런타임 코드 0 검증 + **반증 테스트로 검증기 동작 확인**
                        - [x] 검증 중 실제 결함 2건 발견·수정 (`.ts` 확장자 충돌 / portal 소스 부재)
                  - [x] **Phase B (Step 7~17) 완료**
                  - [x] 실행 체크리스트 17/17 · 스토리 10/10
                  - [x] 검증 실행: typecheck 3/3 · 테스트 55건 · 커버리지 97.29% · next build · helm lint · 매니페스트 불변식 9/9
            - [x] ✅ **사용자 승인 완료 (2026-09-08)** — "승인까지만 진행해줘"

#### ⚠️ C-1 — 문서 간 모순 (U1 Part 2에서 발견, 미해소)
`01-auth-github.md` §7 은 "서버간 인증 = `SDLC_MASTER_KEY` 단일"이라는 **원칙**을 세우는데,
`05-portal-api.md` 인증 표와 `10-k8s-infrastructure.md` 의 실제 CronJob 호출은
`SDLC_RECONCILE_TOKEN`·`SDLC_CALLBACK_BEARER` 를 **구체 지정**한다.
U1 은 구체 지정을 따르되 callback 은 미설정 시 master key 로 물러나게 구현했다.
**명세는 고치지 않았다** — 어느 쪽으로 정리할지는 사용자 판단.

#### ⚠️ F-1 — AuthGuard 인증 스킴 누락 (U1 Part 1에서 발견, **해소 완료**)
AD-2는 AuthGuard를 모든 인증의 단일 검증 지점으로 정했고 C-1.2는 7함수를 선언했으나,
명세의 **활성 서버간 스킴이 그보다 많다**. `SDLC_RECONCILE_TOKEN` · `SDLC_CALLBACK_BEARER` ·
`SDLC_MEMORY_TOKEN_ISSUER_TOKEN` 3종에 대응 함수가 없다.
방치 시 각 스킴이 필요한 유닛(U3·U3·U6)에서 개별 구현되어 **AD-2가 막으려던 분산이 그대로 발생**하고
SECURITY-11에 위배된다. → Step 4에서 **7함수 → 10함수 확장** 완료 + `components.md` C-1.2 갱신 완료 (2026-09-08).
`SLACK_SIGNING_SECRET`은 gateway 모드 미사용이므로 함수를 만들지 않는다(주석만).
      - [ ] **U2 코어SDLC(관리)** — 다음 차례. 사용자가 "승인까지만"으로 범위를 끊어 착수하지 않음
      - [ ] U3 코어SDLC(진행) · [ ] U4 장애대응 · [ ] U5 자체개선 · [ ] U6 개발규정

> **U1 완료로 열린 것**: `interfaces.md` 가 U2~U6 담당자의 진입점이다.
> 미해소 항목 2건은 사용자 판단 대기 — C-1(명세 간 모순 정리 여부),
> RoleBinding 전용 SA 로의 의도적 이탈 수용 여부.
- [ ] Build and Test

> **SATISFIED 취급 규칙**: `aidlc-docs/construction/{unit}/functional-design/` 등 하위 디렉토리를
> 생성하지 않는다. Code Generation은 `execution-plan.md` §2.2 참조표의 원본 문서를 직접 설계서로 쓴다.
> 단, 각 유닛의 Code Generation Part 1에서 참조 문서가 그 유닛에 충분한지 확인하고,
> 부족하면 **그 유닛에 한해** 해당 설계 단계를 추가 수행한다.

### OPERATIONS PHASE
- [ ] Operations (placeholder)
