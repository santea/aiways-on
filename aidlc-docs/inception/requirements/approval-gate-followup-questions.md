# 승인 게이트 — 후속 명확화 질문

**작성**: 2026-09-08 · `approval-gate-questions.md` 답변 분석 결과
**상태**: Step 9 답변 분석에서 **모순 1건 · 미결 1건** 발견 → 해소 후 requirements.md 반영

---

## 1. 수신한 답변

| Q | 답 | 결정 내용 |
|---|---|---|
| Q1 | **X** | 요구사항 게이트는 **OWNER B가 Portal에서 승인**, 설계 게이트는 **승인 없이 자동 진행** |
| Q2 | **B** | Portal UI 승인 버튼 (`/requests/[id]`), 감사 기록 확정 |
| Q3 | **A** | 무기한 대기 (fail-closed) — 승인 없이는 진행하지 않음 |
| Q4 | **X** | 승인자 = OWNER B (Q1과 동일 서술) |
| Q5 | **A** | v1 범위 포함 · 2일 일정 유지 |

### 확정으로 처리한 것 (질문하지 않음)

- **승인자가 요청자 A가 아니라 OWNER B다.** 내러티브는 A의 승인을 말했으나 사용자가 B로 지정했다. 기술 판단 주체를 승인자로 두는 결정으로 수용한다.
- **설계 게이트는 만들지 않는다** → GAP-05는 "신설 안 함"으로 종결.
- **채널 알림은 유지한다.** 승인 행위는 Portal에서 일어나지만, 기존 `feedback-request`를 재사용해 `requirements` 채널에 **승인 요청 알림 + Portal 딥링크**를 게시한다. 알림 없이 Portal만 보게 하면 승인이 무기한 지연되고(Q3=A는 fail-closed) 사용자가 파이프라인이 멈춘 사실조차 모르게 된다. 반대 지시가 없으면 이대로 진행한다.

---

## 2. 발견한 모순 — 현재 권한 모델에 "repo OWNER"가 없다

`Q1=X`·`Q4=X`는 **OWNER B**를 승인자로 지정한다. 그런데 명세의 권한 모델은 **`user` / `admin` 2종뿐**이며,
repo 소유자라는 역할도, repo와 사용자를 잇는 컬럼도 존재하지 않는다.

| 근거 | 내용 |
|------|------|
| `01-auth-github.md:149` | `role: 'user' \| 'admin'` — 두 값뿐 |
| `01-auth-github.md:188` | `admin` 권한에 **"수동 merge 승인"** 이 이미 포함됨 (승인 성격 권한은 admin 귀속) |
| `design/` §8 | `/requests/[id]` — **`user`는 본인 SR만**, `admin`은 전체 |
| `US-U1-02` 인수 조건 | *"`user` 권한으로 타인의 SR 상세를 ID로 직접 요청하면 **403**"* (IDOR 방지) |
| `04-db-schema.md` | `sdlc_github_repos`에 `ownerUserId` 계열 컬럼 **없음** |

**따라서 지금 상태로는 OWNER B가 요청자 A의 SR을 Portal에서 열 수조차 없다 — 403이다.**
`role='user'`인 OWNER는 남의 SR 상세에 접근할 수 없고, 접근하게 하려면 권한 모델을 바꿔야 한다.

## Question 1
"OWNER B의 Portal 승인"을 현재 권한 모델에서 어떻게 구현할 것인가?

A) **`admin` 역할이 승인한다** — 권한 모델 변경 없음. 승인 버튼은 `admin`에게만 노출되고, 조직에서는 각 시스템 OWNER를 `INITIAL_ADMIN_GITHUB_LOGINS`로 admin 등록해 운영한다. **추가 개발 0**, `US-U1-02`·`design/` §8 수정 불필요. 대신 OWNER가 admin 전권(Org·자격증명·토큰 관리)까지 갖게 된다

B) **repo OWNER 개념을 신설한다** — `sdlc_github_repos`에 소유자 컬럼을 추가하고, "내가 소유한 repo의 SR"에 한해 조회·승인을 허용한다. 최소 권한 원칙에 맞지만 **권한 모델 확장**이 따른다: 스키마 변경(U1), SR 조회 권한 규칙 변경(U1·U2), `US-U1-02`와 `design/` §8 권한 매트릭스 수정

C) **B + `admin` 대리 승인** — 기본은 repo OWNER, 담당자 부재 시 `admin`이 대리 승인. Q3=A(무기한 대기)에서 파이프라인이 영구히 멈추는 것을 막는 안전판

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## 3. 미결 — 무기한 대기 중 Pod 자원

`Q3=A`는 승인이 올 때까지 **무기한** 기다린다. 그동안 해당 SR의 Pod·PVC·Service가 살아 있다.
Pod는 SR이 terminal 상태(`9_COMPLETE`/`X_STOPPED`/`X_FAILED`)에 도달할 때 정리되므로,
승인 대기는 terminal이 아니라서 **자원이 계속 점유된다**. 승인이 며칠 지연되면 Pod가 그만큼 쌓인다.

## Question 2
승인 대기 중 Pod를 어떻게 다룰 것인가?

A) **Pod를 유지한다** — 승인 즉시 이어서 진행하므로 가장 단순하고 빠르다. 대기 중 클러스터 자원을 계속 점유한다

B) **Pod를 종료하고, 승인 시 재생성한다** — 자원을 회수한다. 승인 후 재생성·`resume`(clone + 세션 복원) 비용이 들고, 기존 고아 세션 재개 경로(`US-U3-16`)를 재사용해야 한다

C) **하이브리드** — 승인 대기가 지정 시간(예: 2시간)을 넘으면 Pod만 정리하고 SR은 대기 상태로 유지, 승인 시 재생성한다. 짧은 승인은 빠르고 긴 대기는 자원을 아낀다

X) Other (please describe after [Answer]: tag below)

[Answer]: 
