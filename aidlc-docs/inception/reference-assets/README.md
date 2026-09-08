# Reference Assets Analysis

> AIways-On **타깃 애플리케이션은 Greenfield**다. 
> 기존 제품을 마이그레이션하거나 수정·확장하는 작업이 아니므로 Reverse Engineering 단계는 SKIP되었다.
>
> 본 분석은 신규 구현에서 채택할 개념·패턴과 제외할 내용을 판단하기 위한 입력자료 평가다.
> 기존 AIways-On 구현의 구조를 보존하거나 그 위에 기능을 추가하기 위한 분석이 아니다.

## 참고자산 판정 요약

| 자산 | 판정 | 신규 구축 시 활용 방식 |
|------|------|----------------------|
| `requirements/` (14문서 13,102줄) | **SSOT** | 요구사항의 단일 진실 공급원 |
| `design/` (887줄) | **SSOT** | UI/UX 요구사항의 단일 진실 공급원 |
| `n8n/` (Workflow A·B·C, 79노드) | **높은 참고가치** | 오케스트레이션 로직 참고. stage 매핑은 명세 기준으로 재정의 |
| `sdlc-pod/claude-global.md` (264줄) | **높은 참고가치** | Pod 에이전트 행동규범. 운영 시행착오가 축적된 자산 |
| `sdlc-pod/Dockerfile` + agents 4종 | **높은 참고가치** | Pod 이미지 정의 참고. 단 COPY 대상 7종 부재 |
| `mis-vibe-coding-plugin/plugins/` | **높은 참고가치** | `sdlc:user-deep-interview`, `sdlc:capture-mockup` 등 Pod 실행 스킬 |
| `devops-example/helm`·`skaffold`·`scripts`·`environment.yml` | **중간 참고가치** | 로컬 K8s 개발환경 구조 참고 |
| `devops-example/portal`·`mcp-server`·`sdlc-pod-runner` | **낮은 참고가치** | 골격만 존재. 기술스택도 불일치 |
| `mis-vibe-coding-plugin/sdl-migration-docs/` | **무관** | 별개 SDL 프로젝트 유산. 참조 금지 |

## ⚠️ 신규 구축 시 반드시 확인할 불일치 항목

참고자산과 `requirements/` 명세가 **어긋나는 지점**이다. 명세가 우선한다.

| # | 항목 | 참고자산 | `requirements/` 명세 |
|---|------|---------|---------------------|
| D-1 | **Stage 번호 체계** | n8n WF-B에 `Advance to 5`, `Advance to 7 (post-deploy)` 노드 존재. `claude-global.md`도 "PR 생성·merge (Stage 5)", "보고서 작성 (Stage 7)" 기술 | `00-overview.md`: Stage `5`~`8`은 **미사용 예약**. 정상 경로는 `1→2→3→4→9_COMPLETE` |
| D-2 | ORM | Prisma 6 | **Drizzle ORM** |
| D-3 | Framework | Next.js 15 | **Next.js 16** |
| D-4 | Pod Runner | Node.js 스텁 8줄 | **FastAPI (Python)**, 11개 엔드포인트, :58001 |
| D-5 | MCP 전송 | `SSEServerTransport` :3001 | **Streamable HTTP** :58002 + Bearer `sdlcmem_*` |
| D-6 | 메시징 | 없음 | **Slack** + Socket Mode Gateway Pod (replicas 1) |
| D-7 | Secret 관리 | `values.yaml` 평문 env | **`secret_refs` 암호화 참조** + K8s Secret `sdlc-secrets` |
| D-8 | Node 버전 | 스캐폴드 22 / Pod 이미지 20 | 명세 미고정 — **결정 필요** |

> **D-1이 가장 중요하다.** n8n 워크플로우를 참고할 때 stage 번호를 그대로 가져오면
> 명세의 상태 머신과 충돌한다. 로직 흐름만 참고하고 번호는 재매핑해야 한다.

## 문서 목록

| 문서 | 내용 |
|------|------|
| [business-overview.md](./business-overview.md) | 비즈니스 맥락·트랜잭션 6종·용어사전 |
| [architecture.md](./architecture.md) | 참고자산 구성도·데이터 흐름·통합 지점 |
| [code-structure.md](./code-structure.md) | 파일 인벤토리·설계 패턴 6종·주요 의존성 |
| [api-documentation.md](./api-documentation.md) | 명세 대비 구현 현황·에이전트 호출 계약 |
| [component-inventory.md](./component-inventory.md) | 패키지 35개 분류·신규 구축 대상 7종 |

## 참고자산에서 배울 만한 설계 패턴

신규 구축 시 채택을 검토할 가치가 있는 패턴들:

1. **Subagent 격리** — repo 전체 탐색처럼 대량 산출물을 내는 작업을 subagent에 위임해 메인 세션 컨텍스트 오염 방지
2. **SSOT 에이전트** — 절차 전문을 runner 에이전트 파일 한 곳에만 두어 문서 드리프트 방지
3. **단계 권한 단일화** — "stage 진행 권한은 n8n에만 있다. Pod는 stage를 모른다"
4. **마커 기반 판정** — Pod는 `===MOCKUP_CONFIRMED===` 같은 정확한 문자열만 출력, n8n이 판정
5. **보고서 단일 생성 지점** — 직접 Write 금지, 전용 에이전트만 생성, 지정 노드에서만 호출
6. **Stage 4의 4-substage 분리** — `dev`/`qa`/`code_review`/`security_review`를 독립 `/run`으로 분리
   (하나로 뭉쳤을 때 QA·리뷰가 조용히 스킵되는 장애 이력에서 도출된 패턴)
