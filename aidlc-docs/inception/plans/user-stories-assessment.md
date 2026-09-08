# User Stories Assessment

## Request Analysis

- **Original Request**: AIways-On — AI 기반 SDLC 워크플로우 자동화 포탈을 6명(공용 1 + 병렬 5)이 2일 안에 신규 구축
- **User Impact**: **Direct** — 사용자 대면 라우트 18개, 사용자가 채널에서 단계별로 검토·승인하는 것이 파이프라인의 핵심 동작
- **Complexity Level**: **Complex** — 분산 상태머신 + CAS 전이 + 보상 트랜잭션 + AI 에이전트 오케스트레이션
- **Stakeholders**: 요청자(현업/기획), 개발자, 운영자/Admin, 사내 개발자(MCP 소비자), 그리고 시스템 액터(n8n·Pod·CronJob)

## Assessment Criteria Met

### High Priority (ALWAYS Execute) — 5개 해당
- [x] **New User Features** — 전 기능이 신규. 사용자가 직접 상호작용하는 라우트 18개
- [x] **Multi-Persona Systems** — user / admin 권한 분리가 `design/` §8 권한 매트릭스로 명문화되어 있고,
      요청자·개발자·운영자의 관심사가 서로 다름
- [x] **Complex Business Logic** — 파이프라인 프로파일 3종(`feature`/`incident`/`improvement`)이
      같은 상태머신 위에서 서로 다르게 동작. 단계별 시나리오 다수
- [x] **Cross-Team Projects** — 6명이 6개 유닛으로 병렬 작업. 공통 이해 없이는 경계에서 어긋남
- [x] **Customer-Facing APIs** — MCP 서버가 사내 개발자의 로컬 Claude Code에 소비됨

### Medium Priority — 2개 해당
- [x] **Security Enhancements** — 권한 매트릭스(user/admin)가 화면별로 다르게 적용
- [x] **Backend User Impact** — 상태머신·보상 트랜잭션이 사용자에게 "실패 채널에 원인이 게시되는" 형태로 노출

### Benefits — 이 프로젝트에서 스토리가 실제로 하는 일
1. **유닛 경계 검증** — 6개 유닛 분할이 실제 사용자 흐름을 자르지 않는지 확인.
   Units Generation 이전에 경계 오류를 잡을 마지막 기회
2. **테스트 명세 공급** — TDD 강제(D-20) 상태에서 인수 조건이 곧 테스트 케이스가 됨.
   스토리 없이 TDD를 시작하면 각 개발자가 서로 다른 기준으로 테스트를 씀
3. **2일 병렬 작업의 공통 어휘** — 6명이 동시에 다른 유닛을 만들 때 "SR 상세에서 무엇이 보여야 하는가"에 대한
   합의를 문서 한 곳에 고정

## Decision

**Execute User Stories**: **Yes**

**Reasoning**:
High Priority 지표 5개가 해당하므로 AI-DLC 판정상 무조건 실행 대상이다.
다만 이 프로젝트는 특수한 조건이 둘 있고, 그것이 스토리의 *형태*를 바꾼다.

1. **요구사항이 이미 확정되어 있다.** `requirements/` 15,033줄이 API 시그니처·DB 컬럼·화면별 표시 정보까지
   정의했다. 따라서 스토리는 요구사항을 *발견*하는 도구가 아니라, 확정된 요구사항을
   **유닛별 실행 가능 단위 + 인수 조건**으로 재편하는 도구다.
2. **2일 제약(D-02).** 스토리 자체가 목적이 될 수 없다. 산출물은 곧바로
   Units Generation과 TDD 테스트 작성에 투입 가능한 형태여야 한다.

따라서 **유닛 정렬(Unit-aligned) 스토리 구조**를 기본 제안으로 삼는다 —
스토리가 6개 유닛에 1:1로 매핑되어 Units Generation의 직접 입력이 되도록 한다.

## Expected Outcomes

- 6개 유닛 각각에 대해 담당 개발자가 첫날 아침에 바로 착수할 수 있는 스토리 집합
- 각 스토리의 인수 조건이 TDD의 첫 테스트로 그대로 전환 가능
- 유닛 경계에 걸친 스토리를 조기 식별 (특히 U2↔U3 상호 의존, U4·U5→U3 의존)
- 페르소나별 권한 요구사항이 `design/` §8 권한 매트릭스와 일치하는지 교차 검증
