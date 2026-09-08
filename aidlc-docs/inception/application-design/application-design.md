# Application Design — AIways-On (통합본)

**작성**: 2026-09-08 | **단계**: INCEPTION / Application Design | **깊이**: Standard

> 본 문서는 아래 4개 문서의 통합본이다. 상세는 각 원본을 참조한다.
>
> | 문서 | 내용 |
> |------|------|
> | [components.md](./components.md) | 컴포넌트 31개 정의·책임·인터페이스 |
> | [component-methods.md](./component-methods.md) | 메서드 시그니처·입출력 |
> | [services.md](./services.md) | 배포 서비스 5개·오케스트레이션 |
> | [component-dependency.md](./component-dependency.md) | 의존 매트릭스·경계 규약 7건·데이터 흐름 |

---

## 1. 이 단계가 푼 문제

Application Design은 `requirements/` 15,033줄이 **유일하게 비워 둔 영역**을 다뤘다:
**컴포넌트 경계와 의존성**. 비즈니스 규칙·DB 컬럼·K8s 매니페스트는 이미 존재하며
SATISFIED로 확정되었다(execution-plan §2.2).

입력은 User Stories 검증에서 나온 구조 문제 5건이었다.

| # | 문제 | 해소 | 결정 |
|---|------|------|------|
| **S-1** | U2↔U3 순환 의존 | ✅ | **AD-1** — Port 인터페이스를 U1로, 구현은 각 유닛 |
| **S-2** | 서버간 인증 4종의 소유자 부재 | ✅ | **AD-2** — 인증 전체를 U1 단독 소유 |
| **S-3** | SR 생성 3분기 + incident 자동머지 예외 | ✅ | **AD-3** — 단일 validator가 정책을 SR에 각인 |
| **S-4** | 중복 계약 2쌍 | ✅ | **AD-4** — 인터페이스별 소유자 1명, 타입은 U1에 |
| **S-5** | MCP 3자 조율 | ✅ | **AD-5** — ConfigMap 키 1개로 합의점 단일화 |
| — | 계약 위반 방지 | ✅ | **AD-6** — 리뷰 규약 + 경계 규약 명문화 |

---

## 2. 설계 결정 요약 (AD-1 ~ AD-6)

### AD-1 · Port 인터페이스를 U1로 승격 → 순환 제거

```
[해소 전]  U3.StageEntryActions ──구현 의존──> U2.GitHubAdapter    ← 순환
[해소 후]  U3.StageEntryActions ──타입 의존──> U1.GitHubPort
                                                    ^ implements
                                                U2.GitHubAdapter (런타임 주입)
```

`GitHubPort` · `MessagingPort` · `PodPort` 3종. **U3 담당자는 U2 구현을 기다리지 않고 착수한다.**

### AD-2 · 인증 단일 소유 (U1)

사용자 인증(GitHub OAuth) + 서버간 인증 4종(`SDLC_MASTER_KEY` · `POD_AUTH_TOKEN` ·
이미지 서명 토큰 · `sdlcmem_*`)을 `AuthGuard` 하나가 제공하고 나머지 5개 유닛은 **소비만** 한다.
OWASP 전체 강제(D-21) 하에서 6명이 각자 인증을 구현하면 유닛마다 강도가 달라지는 문제를 막는다.
SECURITY-08(deny-by-default) 준수를 **한 곳에서** 검증할 수 있다.

### AD-3 · 정책 각인 (Policy Stamping) — 가장 중요한 결정

```
createSdlcRequest(input, profile)          유닛별로 존재 (U2/U4/U5)
         |
         v
validateAndStampPolicy(input, profile)     ★ 시스템에 단 하나 (U3 소유)
         |
         +-- 입력 검증
         +-- 정책 결정 후 SR에 각인:
               channelTypes     : feature→3개 / incident·improvement→[dev]
               autoMergeAllowed : incident→false (repo 설정 무시) / 그 외→repo 설정
         v
   sdlc_requests.metadata
         |
         | (읽기만, 재판정 없음)
         v
   StageEntryActions (4→9) → merge 여부·채널 개수 결정
```

**해결한 위험**: `03-state-machine.md` §4.4의 "incident는 `autoPrMerge=true`여도 자동 머지 금지"
규칙이 U3 코드의 조건문으로만 존재하면, **U4 담당자가 그 조항을 모르는 순간
장애 패치가 사람 확인 없이 머지된다.** 정책을 데이터에 각인하면 U4가 몰라도 규칙이 지켜진다.

### AD-4 · 인터페이스 소유권

경계 9건의 실체는 **7개 인터페이스**다(2쌍이 양쪽에서 중복 기술됨). 각 인터페이스에 소유자 1명을
지정하고, 타입 선언은 U1 공유 패키지에 두되 **수정 권한은 소유자만** 갖는다.

### AD-5 · MCP 3자 조율

```
U1: ConfigMap sdlc-endpoints.memoryMcpUrl = "sdlc-memory-mcp.{ns}.svc.cluster.local:58002"
         |                                        |
U3: Pod spec에서 참조 → mcp_servers 주입     U6: 이 Service DNS로 서빙
```
3자가 합의할 것은 **키 이름 하나**. 값은 K8s Service DNS가 흡수한다.

### AD-6 · 계약 위반 방지

- **타입으로 표현되는 계약** — Q4=A + NFR-27(strict) + US-U1-10(CI typecheck)으로 **이미 자동 강제**됨
- **타입으로 표현 안 되는 규약**(호출 순서, 멱등성 책임, 금지 사항) — `component-dependency.md` §3에
  **경계 규약 7건(B-1~B-7)** 으로 명문화. 경계 파일 수정 PR은 리뷰에서 이 표와 대조한다

---

## 3. 컴포넌트 배치

**컴포넌트 31개 → 서비스 5개**

| 서비스 | 런타임 | replicas | 컴포넌트 |
|--------|--------|:--------:|---------|
| **Portal** | Next.js 16 / Node 22 | 2+ | 23개 (U1·U2·U4·U5·U6 + U3 일부) |
| **Pod Runner** | FastAPI / Python | SR당 1개 | C-3.8 |
| **Memory MCP** | Node 22 + MCP SDK | 1+ | C-6.2 |
| **Slack Gateway** | Node 22 + Socket Mode | **1 고정** | C-3.7 |
| **n8n** | 공식 이미지 | 1 | C-3.9 (후행, D-18) |

**주목할 점**: 6명 중 5명이 **Portal 하나에 코드를 넣는다.** 유닛별 디렉토리 경계와
공유 타입 U1 단독 소유(NFR-27)가 중요한 이유다(R-05).

**Slack Gateway를 분리한 이유**: Portal이 `replicas: 2+`이므로 Socket Mode를 내장하면
replica 수만큼 중복 수신된다. 장수명 연결을 단일 replica 전용 Pod로 분리해 Stateless 원칙(NFR-01)을 지킨다.

---

## 4. 유닛 의존 그래프

```
              U1 공용 기반 (타입·인증·스키마·인프라·Port 인터페이스)
                 |    |    |    |    |
        +--------+    |    |    |    +--------+
        |             |    |    |             |
       U2 <--------> U3 <--+    +--> U5 --> U6
      관리    (타입)  진행       개선        규정
                      ^                       |
                      +--- U4 장애            |
                      +-----------------------+
```

- **U2 ↔ U3 양방향은 순환이 아니다** — U3→U2는 `GitHubPort` **타입** 의존이므로
  컴파일 시점 의존은 `U3 → U1`뿐
- **U6는 가장 독립적** — U3에는 ConfigMap 경유로만 약하게 연결
- **B-6(U5→U6)은 가장 늦게 필요한 경계** — 양쪽이 각자 완성 후 마지막에 연결 가능

---

## 5. 경계 규약 7건 (요약)

| ID | 경계 | 소유자 | 핵심 규약 |
|----|------|--------|----------|
| B-1 | U2 → U3 SR 접수 | U3 | 멱등 책임은 **호출자**(dedupKey 생성). Factory 우회 INSERT 금지 |
| B-2 | U3 → U2 PR 생성 | 인터페이스 **U1** / 구현 U2 | 인터페이스 타입으로만 호출. **U3는 정책을 읽기만** |
| B-3 | U2 ↔ U3 상태 조회 | **U3 단독** | U2는 읽기 전용. `setSubStage` 호출 금지 |
| B-4 | U2 ↔ U3 이미지 | U2 | 업로드=MASTER_KEY / 서빙=서명 검증 |
| B-5 | U1 ↔ U5 스캔 트리거 | **U5 단독** | U1은 CronJob에서 호출만. fail-closed |
| B-6 | U5 → U6 규정 승격 | U6 | 가장 늦게 필요. 재승격 시 중복 금지 |
| B-7 | U1+U3+U6 MCP 주입 | 3자 | ConfigMap 키 1개로 합의. **MCP 미응답 시에도 Pod 실행은 성공** |

---

## 6. 검증 결과

| 검증 항목 | 결과 |
|----------|------|
| S-1~S-5 해소 | ✅ 5/5 — AD-1~AD-5로 각각 대응 |
| 컴포넌트 순환 의존 | ✅ 없음 — U2↔U3는 타입 의존으로 분리 |
| 스토리 귀속 | ✅ 56/56 — 전 스토리가 컴포넌트에 매핑됨 |
| 인터페이스 소유자 | ✅ 7/7 — 각 1명 지정 (B-1~B-7) |
| 인증·보안 격리 | ✅ SECURITY-11 준수 — `AuthGuard` 단일 모듈로 격리 |
| Mermaid 문법 | ✅ 2개 다이어그램 검증 통과 (dangling 0, unstyled 0) |

### 착수 순서에 미치는 영향

| 시점 | 필요한 것 |
|------|----------|
| **U3 착수** | `SharedTypes`의 Port 인터페이스 **선언만** (구현 불필요) |
| U4·U5 착수 | `SdlcRequestFactory` **시그니처만** 확정 (구현 진행 중이어도 됨) |
| U2·U3 통합 | `GitHubAdapter`가 `GitHubPort`를 implements 하는지 typecheck |
| B-6 연결 | 가장 늦어도 됨 |

→ **U1의 인터페이스 선언 4건이 끝나는 즉시 5명 전원이 병렬 착수 가능**하다.
R-02(U1 지연이 전원 차단)의 위험 구간이 "U1 완료"에서 "U1 인터페이스 선언 완료"로 줄었다.

---

## 7. Units Generation으로 넘길 사항

| # | 사항 |
|---|------|
| 1 | **U3 부하** — 컴포넌트 9개(31개 중 29%) + 독립 배포 3개. 재분배 또는 2인 배정 검토 (R-03) |
| 2 | **U1 인터페이스 우선 산출** — Port 3종 + `SdlcRequestFactory` 시그니처 + `AuthGuard` 시그니처를 다른 U1 작업보다 먼저 |
| 3 | **n8n 후행** — C-3.9는 n8n 배포 이후 착수(D-18). U3 부하를 시간축에서 분산 |
| 4 | **Portal 단일 서비스에 5개 유닛 공존** — 디렉토리 경계 규약 필요 (R-05) |
