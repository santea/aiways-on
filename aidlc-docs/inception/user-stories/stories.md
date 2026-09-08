# 사용자 스토리 — AIways-On

**구조**: 유닛 정렬 (Q1=A) · **크기**: 화면·엔드포인트 단위 (Q3=A) · **추적성**: FR ID + 원본 문서 (Q6=A)
**우선순위**: MoSCoW (Q7=A) — `M` Must / `S` Should / `C` Could
**v2 보강(2026-09-08)**: 비즈니스 내러티브 기반 17건 추가 → 누계 73건. 문서 하단 「📌 v2 보강」 참조.
**v2.1(2026-09-08)**: 승인 게이트 결정(**D-30**) 반영 — `US-U2-11` 신설, `US-U3-21` 인수 조건 보강, GAP-04 해소 · GAP-05 종결 → **누계 74건**.
아래 v1 본문(56건)과 v1 「품질 검증」 수치는 **v1 시점 기록**으로 보존한다. 최신 집계·추적성·GAP 목록은 v2 섹션이 정본이다.

## 인수 조건 형식 규칙 (Q4=C 혼합)

| 스토리 성격 | 형식 | 판단 기준 |
|------------|------|----------|
| **UI** | 체크리스트 | 스토리의 가치가 *사람이 화면에서 보는 것*에 있을 때 |
| **API · 상태머신 · 시스템 액터** | Given-When-Then | 스토리의 가치가 *시스템 동작*에 있을 때 |
| **UI + API 혼재** | 분리 가능하면 분리, 불가하면 **Given-When-Then** | TDD 강제(D-20) 하에서는 테스트 가능한 형식이 우선 |

## 읽는 법

```
US-U3-02  [M]  P2·S1                                    FR-U3-02 · 03-state-machine.md §3
스토리 ID  우선순위  페르소나                              요구사항 ID · 원본 명세 위치
```

`⚠️ 경계` 표시가 있는 스토리는 **유닛 경계를 넘는다** — 두 유닛 담당자가 착수 전에 인터페이스를 합의해야 한다.

---

# U1 · 공용 (기반)

> **선행 유닛.** 나머지 5개 유닛 전원이 여기에 차단된다(R-02).
> `⭐ 인터페이스 우선` 표시 스토리는 다른 유닛의 착수를 푸는 것들이며 **가장 먼저** 끝내야 한다.

### US-U1-01 [M] P1·P2·P3 — GitHub 계정으로 로그인 `FR-U1-04` · `01-auth-github.md`
> **요청자·개발자·Admin으로서** GitHub 계정으로 로그인하고 싶다.
> 그래야 별도 계정을 만들지 않고 내 GitHub 신원으로 SDLC를 쓸 수 있다.

**인수 조건** (API — GWT)
- **Given** 로그인하지 않은 사용자가 **When** 보호된 라우트에 접근하면 **Then** `/login`으로 리다이렉트된다
- **Given** `/login`에서 **When** "Sign in with GitHub"를 누르면 **Then** GitHub OAuth 동의 화면으로 이동한다
- **Given** OAuth 콜백이 성공하면 **When** 세션이 생성되면 **Then** 쿠키에 `Secure`·`HttpOnly`·`SameSite`가 설정된다 *(NFR-12, SECURITY-12)*
- **Given** 로그아웃하면 **When** 이전 세션 쿠키로 요청하면 **Then** 401이 반환된다 (세션 서버측 무효화)

---

### US-U1-02 [M] P3 — 권한(user/admin) 분리 `FR-U1-04` · `design/` §8 ⭐ 인터페이스 우선
> **Admin으로서** 관리 기능이 일반 사용자에게 노출되지 않기를 원한다.
> 그래야 자동화가 통제 밖에서 실행되지 않는다.

**인수 조건** (API — GWT)
- **Given** `user` 권한 세션으로 **When** `/admin/*` 라우트에 접근하면 **Then** 403이 반환된다 (클라이언트 숨김이 아닌 **서버측** 검증) *(NFR-12)*
- **Given** `user` 권한으로 **When** 타인의 SR 상세를 ID로 직접 요청하면 **Then** 403이 반환된다 (IDOR 방지)
- **Given** `admin` 권한으로 **When** 동일 요청을 하면 **Then** 200과 함께 데이터가 반환된다
- **Given** 인증 미들웨어가 적용되지 않은 라우트가 있으면 **When** 라우트 목록을 검사하면 **Then** 명시적 `public` 표시가 있어야 한다 (deny-by-default)

---

### US-U1-03 [M] P2 — DB 스키마와 마이그레이션 `FR-U1-02, 03` · `04-db-schema.md` ⭐ 인터페이스 우선
> **개발자로서** 모든 유닛이 같은 테이블 정의를 공유하기를 원한다.
> 그래야 6명이 병렬로 작업해도 스키마가 갈라지지 않는다.

**인수 조건** (API — GWT)
- **Given** 빈 데이터베이스에 **When** 마이그레이션을 실행하면 **Then** `04-db-schema.md` §1.3의 전 테이블이 생성된다
- **Given** 마이그레이션이 이미 적용된 DB에 **When** 재실행하면 **Then** 멱등하게 성공한다
- **Given** `secret_refs` 테이블에 **When** 값을 저장하면 **Then** 평문이 아닌 암호화 참조만 들어간다 *(NFR-10)*
- **Given** `audit_events` 테이블에 **When** 애플리케이션 역할로 DELETE·UPDATE를 시도하면 **Then** 거부된다 (append-only) *(NFR-18)*

---

### US-U1-04 [M] P2 — 공유 타입 정의 `FR-U1-05` · `03-state-machine.md` §1 ⭐ 인터페이스 우선
> **개발자로서** `Stage`·`ChannelType`·`pipelineProfile`을 한 곳에서만 정의하고 싶다.
> 그래야 유닛마다 다른 상태값을 쓰는 사고가 나지 않는다.

**인수 조건** (API — GWT)
- **Given** `Stage` enum이 **When** 값 목록을 조회하면 **Then** `1_REGISTERED`·`2_REQUIREMENTS_IN_PROGRESS`·`3_DEV_DESIGN_IN_PROGRESS`·`4_DEV_IN_PROGRESS`·`9_COMPLETE`·`X_STOPPED`·`X_FAILED` **7개만** 존재한다
- **Given** Stage 5·6·7·8은 **When** enum에서 조회하면 **Then** **값이 존재하지 않는다** *(D-05 — 참고자산의 구 체계 차단, R-04)*
- **Given** `ChannelType` enum이 **When** 조회되면 **Then** `requirements`·`design`·`dev` 3개만 존재한다
- **Given** 타입 패키지를 **When** 다른 유닛이 import하면 **Then** 순환 참조 없이 해결된다

---

### US-U1-05 [M] P1·P2·P3 — 디자인 토큰과 글로벌 레이아웃 `FR-U1-06` · `design/` §2·§3
> **모든 사용자로서** 어느 화면에서도 같은 시각 규칙을 경험하고 싶다.
> 그래야 6명이 만든 화면이 한 제품처럼 보인다.

**인수 조건** (UI — 체크리스트)
- [ ] 의미적 색 토큰이 정의되고 raw hex 직접 사용이 없다
- [ ] 다크·라이트 토큰이 모두 정의되고 `prefers-color-scheme`으로 전환된다 *(D-28)*
- [ ] 타이포 3종(Manrope·Inter·JetBrains Mono)이 적용된다
- [ ] 상단 네비게이션 바가 없고 사이드바만 존재한다
- [ ] 사이드바 항목 12개가 `design/` §3 순서대로 노출된다
- [ ] `admin` 전용 항목 6개는 `user` 권한에서 보이지 않는다
- [ ] 활성 항목에 Cyan blade + glow가 표시된다
- [ ] 카드·표가 테두리 없이 배경 명도 차이로만 구분된다 (No-Line)

---

### US-U1-06 [M] P2 — 프로젝트 스캐폴딩 `FR-U1-01` · `00-overview.md` §3·§5 ⭐ 인터페이스 우선
> **개발자로서** 첫날 아침에 `pnpm dev`가 바로 뜨기를 원한다.
> 그래야 5명이 환경 구성으로 반나절을 쓰지 않는다.

**인수 조건** (API — GWT)
- **Given** 저장소를 clone한 개발자가 **When** setup 스크립트를 실행하면 **Then** 의존성·환경변수 템플릿·Git 훅이 구성된다
- **Given** 스캐폴딩이 완료되면 **When** 디렉토리를 확인하면 **Then** `00-overview.md` §5 구조와 일치한다
- **Given** TypeScript가 **When** strict mode로 컴파일하면 **Then** 에러가 없다

---

### US-U1-07 [M] P3 — 로컬 K8s 스택 기동 `FR-U1-07` · `10-k8s-infrastructure.md`
> **Admin으로서** 명령 하나로 전체 스택을 로컬에 띄우고 싶다.
> 그래야 개발자마다 다른 환경에서 생기는 문제를 없앨 수 있다.

**인수 조건** (API — GWT)
- **Given** Docker Desktop K8s 또는 k3d가 준비된 상태에서 **When** Skaffold를 실행하면 **Then** Portal·PostgreSQL·n8n·MinIO가 기동된다
- **Given** 스택이 기동되면 **When** 각 서비스의 health 엔드포인트를 호출하면 **Then** 200이 반환된다
- **Given** 소스를 수정하면 **When** 파일이 저장되면 **Then** 해당 서비스가 자동 재빌드된다

---

### US-U1-08 [M] P3 — Secret 분리와 최소 권한 RBAC `FR-U1-08` · `10-k8s-infrastructure.md` §2·§5.2
> **Admin으로서** 자격증명이 평문으로 남지 않고, Portal이 필요 이상의 K8s 권한을 갖지 않기를 원한다.
> 그래야 유출 시 피해 범위가 제한된다.

**인수 조건** (API — GWT)
- **Given** `sdlc-secrets` Secret이 **When** 키 목록을 확인하면 **Then** `10-k8s-infrastructure.md` §5.2 목록과 일치한다
- **Given** Helm values 파일을 **When** 검사하면 **Then** 평문 자격증명이 없다
- **Given** `portal-sdlc-pod-manager` Role이 **When** 검사되면 **Then** 와일드카드 action·resource가 없다 *(NFR-19, SECURITY-06)*
- **Given** Portal ServiceAccount로 **When** Role에 없는 K8s API를 호출하면 **Then** 거부된다

---

### US-U1-09 [S] P3 — 정합성 복구·주기 스캔 CronJob 배포 `FR-U1-08, 09` · `10-k8s-infrastructure.md` §3 ⚠️ 경계(U5)
> **Admin으로서** 정합성 복구와 개선 스캔이 스케줄대로 돌기를 원한다.

**인수 조건** (API — GWT)
- **Given** `portal-sdlc-reconcile` CronJob이 **When** 스케줄에 도달하면 **Then** `/api/internal/sdlc/reconcile`을 호출한다
- **Given** `portal-sdlc-improve-scan` CronJob이 **When** 스케줄에 도달하면 **Then** `/api/internal/sdlc/improvement-scan`을 호출한다
- **Given** 내부 엔드포인트에 **When** `SDLC_MASTER_KEY` 없이 호출하면 **Then** 401이 반환된다

> ⚠️ **경계**: CronJob 배포는 U1, 호출되는 스캔 로직은 U5. 인터페이스(엔드포인트 경로·인증 방식)를 먼저 합의할 것.

---

### US-U1-10 [M] P2 — CI 품질 게이트 `FR-U1-10` · `D-20, D-26`
> **개발자로서** 테스트가 깨진 코드가 병합되지 않기를 원한다.
> 그래야 6명이 동시에 밀어넣어도 main이 살아 있다.

**인수 조건** (API — GWT)
- **Given** PR이 열리면 **When** GitHub Actions가 실행되면 **Then** typecheck·lint·test가 순서대로 수행된다
- **Given** 테스트 커버리지가 기준 미달이면 **When** CI가 완료되면 **Then** 실패로 표시된다
- **Given** 의존성 취약점 스캔이 **When** 실행되면 **Then** 결과가 CI 로그에 남는다 *(NFR-15, SECURITY-10)*
- **Given** lock 파일이 **When** 저장소에서 확인되면 **Then** 커밋되어 있다

---

# U2 · 코어SDLC (관리)

### US-U2-01 [M] P1 — SR 신규 등록 `FR-U2-01` · `08-sr-registration-ui.md` · `design/` §4.3
> **요청자로서** 개발이 필요한 일을 폼으로 제출하고 싶다.
> 그래야 개발자를 찾아다니지 않고 요청을 시작할 수 있다.

**인수 조건** (UI — 체크리스트)
- [ ] `/register`에서 요청 내용을 자연어로 입력할 수 있다
- [ ] 대상 repo를 선택하거나 자동 선택에 맡길 수 있다
- [ ] 필수 항목 미입력 시 제출 버튼이 동작하지 않고 사유가 표시된다
- [ ] 제출 성공 시 SR 번호가 표시되고 상세 화면으로 이동한다
- [ ] 제출 실패 시 일반적인 오류 메시지가 표시된다 (내부 정보 미노출) *(NFR-16)*

---

### US-U2-02 [M] P1·P2 — 대시보드에서 진행 현황 파악 `FR-U2-02` · `design/` §4.2
> **요청자·개발자로서** 내 요청들이 지금 어느 단계인지 한눈에 보고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] 진행 현황 카드가 단계별 집계를 보여준다
- [ ] SR 목록이 상태 배지와 함께 표시된다
- [ ] 상태 배지 색이 `design/` §5.1 매핑과 일치한다
- [ ] `user` 권한은 본인 SR만, `admin`은 전체가 보인다
- [ ] 목록 행을 클릭하면 해당 SR 상세로 이동한다

---

### US-U2-03 [M] P1·P2 — SR 상세에서 파이프라인 추적 `FR-U2-03` · `design/` §4.4·§6.2·§6.3 ⚠️ 경계(U3)
> **요청자·개발자로서** 내 SR이 어느 단계에 있고 무엇이 진행 중인지 보고 싶다.
> 그래야 언제 내 차례인지 알 수 있다.

**인수 조건** (UI — 체크리스트)
- [ ] 단계 전이 Flow가 현재 단계를 강조해 표시한다
- [ ] 완료 단계는 성공색, 진행 중은 accent 펄스, 실패는 error색으로 구분된다
- [ ] Stage 4일 때 DevSubStage 4종(`dev`→`qa`→`code_review`→`security_review`) 내부 진행이 표시된다
- [ ] 연결된 Slack 채널·Pod·GitHub Issue·PR 링크가 표시된다
- [ ] 단계 전이 이력이 시간순으로 표시된다
- [ ] 실패한 SR은 실패 사유가 표시된다

> ⚠️ **경계**: 화면은 U2, 표시되는 상태·substage 데이터는 U3가 생산. 조회 API 계약을 먼저 합의할 것.

---

### US-U2-04 [M] S1 — SR 접수와 즉시 프로비저닝 `FR-U2-04` · `03-state-machine.md` §1.2 ⚠️ 경계(U3)
> **n8n 오케스트레이터로서** 접수 요청 한 번으로 SR 등록부터 채널·Pod 생성까지 끝나기를 원한다.
> 그래야 대기 큐나 자원 게이트를 관리하지 않아도 된다.

**인수 조건** (API — GWT)
- **Given** 유효한 페이로드로 **When** `POST /api/v1/sdlc/intake`를 호출하면 **Then** `201`과 `{ requestNo, status: "1_REGISTERED" }`가 반환된다
- **Given** 동일한 `dedupKey`로 **When** 재호출하면 **Then** 새 SR이 생성되지 않고 기존 SR이 반환된다 (멱등)
- **Given** 접수가 성공하면 **When** 후속 상태를 확인하면 **Then** 채널 생성·Pod 생성·n8n webhook 발화가 **한 흐름으로** 완료되어 있다
- **Given** 프로비저닝 중 실패하면 **When** SR 상태를 확인하면 **Then** 대기 상태가 아니라 보상 트랜잭션을 거쳐 `X_FAILED`다
- **Given** 스키마에 맞지 않는 입력으로 **When** 호출하면 **Then** `400`이 반환된다 *(NFR-11)*

---

### US-U2-05 [M] P3 — GitHub Org·Repo·자격증명 관리 `FR-U2-05, 06` · `design/` §4.13
> **Admin으로서** 어떤 repo에 SDLC를 열어 줄지 통제하고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/admin/orgs`에서 Org와 자격증명을 등록·수정·삭제할 수 있다
- [ ] `/admin/repos`에서 repo를 등록하고 설정을 지정할 수 있다
- [ ] 자격증명 입력값은 저장 후 화면에 평문으로 다시 표시되지 않는다 *(NFR-10)*
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

### US-U2-06 [M] P2 — GitHub Issue·PR 연동 `FR-U2-06` · `05-portal-api.md`
> **개발자로서** SR이 GitHub Issue·PR과 1:1로 연결되기를 원한다.
> 그래야 평소 쓰던 GitHub 워크플로우에서 벗어나지 않는다.

**인수 조건** (API — GWT)
- **Given** SR이 접수되면 **When** Issue 생성이 실행되면 **Then** Issue가 생성되고 SR과 연결 저장된다
- **Given** 동일 SR에 대해 **When** Issue 생성을 재시도하면 **Then** 중복 생성되지 않는다 (`ensure-*` 멱등) *(NFR-07)*
- **Given** Stage 4가 완료되면 **When** PR 생성이 실행되면 **Then** Portal이 GitHub API로 **직접** PR을 만든다 (Pod가 아님)
- **Given** commit 이력이 없는 repo면 **When** PR 생성 시점이 되면 **Then** PR을 만들지 않고 Issue를 닫은 뒤 work branch를 삭제한다

---

### US-U2-07 [S] P2 — 목업 이미지 확인 `FR-U2-07` · `05-portal-api.md` ⚠️ 경계(U3)
> **개발자로서** Pod가 캡처한 목업 이미지를 채널과 웹에서 보고 싶다.

**인수 조건** (API — GWT)
- **Given** Pod가 **When** 이미지를 업로드하면 **Then** 오브젝트 스토리지에 저장되고 서빙 URL이 반환된다
- **Given** 유효한 토큰이 붙은 서빙 URL로 **When** 요청하면 **Then** 이미지가 반환된다
- **Given** 토큰이 없거나 만료된 URL로 **When** 요청하면 **Then** 403이 반환된다
- **Given** 업로드 요청에 `SDLC_MASTER_KEY`가 없으면 **When** 호출하면 **Then** 401이 반환된다

---

### US-U2-08 [S] S1·S2 — 감사 로그 적재 `FR-U2-07` · `05-portal-api.md`
> **n8n·Pod로서** 파이프라인에서 일어난 일을 감사 로그에 남기고 싶다.
> 그래야 실패했을 때 사람이 추적할 수 있다.

**인수 조건** (API — GWT)
- **Given** Pod 이벤트가 발생하면 **When** Workflow C가 `POST /requests/{id}/audit`를 호출하면 **Then** `audit_events`에 기록된다
- **Given** 감사 로그 본문에 **When** 토큰·비밀번호가 포함되어 있으면 **Then** 마스킹되어 저장된다 *(NFR-14, SECURITY-03)*
- **Given** 기록된 감사 이벤트를 **When** 애플리케이션이 삭제하려 하면 **Then** 실패한다 *(NFR-18)*

---

# U3 · 코어SDLC (진행)

> **가장 무거운 유닛** — 명세의 27%(R-03). 상태머신·Pod Runner·Slack Gateway·n8n을 모두 소유한다.
> 시스템 액터 스토리(S1·S2)가 집중되며, 이들의 인수 조건이 그대로 TDD 테스트가 된다.

### US-U3-01 [M] S1 — 합법 전이만 허용 `FR-U3-01` · `03-state-machine.md` §1·§2
> **n8n 오케스트레이터로서** 정의되지 않은 단계 전이가 거부되기를 원한다.
> 그래야 파이프라인이 예상 밖 상태로 빠지지 않는다.

**인수 조건** (상태머신 — GWT)
- **Given** `1_REGISTERED` 상태에서 **When** `2_REQUIREMENTS_IN_PROGRESS`로 전이하면 **Then** 성공한다
- **Given** `4_DEV_IN_PROGRESS` 상태에서 **When** `9_COMPLETE`로 전이하면 **Then** 성공한다 (5·6·7·8을 거치지 않음) *(D-05)*
- **Given** 임의 상태에서 **When** Stage `5`·`6`·`7`·`8`로 전이를 시도하면 **Then** **불법 전이로 거부된다** *(R-04 차단)*
- **Given** `3_DEV_DESIGN_IN_PROGRESS`에서 **When** `2_REQUIREMENTS_IN_PROGRESS`로 되돌리면 **Then** 거부된다 (역방향 전이 0개, 단방향 DAG)
- **Given** terminal 상태(`9_COMPLETE`·`X_STOPPED`·`X_FAILED`)에서 **When** 어떤 전이든 시도하면 **Then** 거부된다

---

### US-U3-02 [M] S1 — CAS 기반 원자적 상태 전이 `FR-U3-02` · `03-state-machine.md` §3
> **n8n 오케스트레이터로서** 동시에 두 번 전이 요청이 가도 한 번만 반영되기를 원한다.
> 그래야 재시도나 중복 webhook이 단계를 두 칸 밀지 않는다.

**인수 조건** (상태머신 — GWT)
- **Given** 현재 상태가 `2`인 SR에 **When** `from=2, to=3`으로 `advance()`를 호출하면 **Then** 상태가 `3`으로 바뀌고 성공을 반환한다
- **Given** 현재 상태가 이미 `3`인 SR에 **When** `from=2, to=3`으로 호출하면 **Then** `StaleFromError`와 함께 **409**가 반환되고 상태는 변하지 않는다
- **Given** 동일 SR에 **When** 두 요청이 동시에 도착하면 **Then** 정확히 하나만 성공하고 나머지는 409를 받는다
- **Given** 전이가 성공하면 **When** `sdlc_stage_transitions`를 조회하면 **Then** 이력 1건이 추가되어 있다

**PBT 대상** *(NFR-22, NFR-23)* — `advance()`는 순수 판정 로직이므로 속성 기반 테스트 적용

---

### US-U3-03 [M] S1 — 멱등 실행 `FR-U3-03` · `03-state-machine.md` §3.2
> **n8n 오케스트레이터로서** 같은 단계 작업을 재시도해도 부작용이 없기를 원한다.

**인수 조건** (상태머신 — GWT)
- **Given** `idempotency_key = request_id + step_name`으로 **When** 동일 키의 작업을 재실행하면 **Then** 외부 자원이 중복 생성되지 않는다
- **Given** 채널 생성이 이미 완료된 SR에 **When** 채널 생성을 재호출하면 **Then** 기존 채널이 반환된다 (`ensure-*`)
- **Given** Pod 생성이 이미 완료된 SR에 **When** 재호출하면 **Then** 기존 Pod가 반환된다

**PBT 대상** — 멱등키 생성 함수

---

### US-U3-04 [M] S1 — 단계 진입 작업 실행 `FR-U3-04` · `03-state-machine.md` §4·§5
> **n8n 오케스트레이터로서** 단계에 진입할 때 필요한 준비 작업이 자동으로 실행되기를 원한다.

**인수 조건** (상태머신 — GWT)
- **Given** `1→2` 전이가 일어나면 **When** 진입 작업이 실행되면 **Then** `requirements` 채널이 생성된다
- **Given** `2→3` 전이가 일어나면 **When** 진입 작업이 실행되면 **Then** `design` 채널이 생성되고 `requirements` 채널 스냅샷이 DB에 저장된다
- **Given** `3→4` 전이가 일어나면 **When** 진입 작업이 실행되면 **Then** `dev` 채널이 생성되고 `design` 채널 스냅샷이 저장된다
- **Given** `4→9` 전이가 일어나면 **When** 진입 작업이 실행되면 **Then** `dev` 채널 스냅샷이 저장된다
- **Given** `pipelineProfile`이 `incident` 또는 `improvement`면 **When** 채널을 생성하면 **Then** `dev` 채널 **1개만** 생성된다

---

### US-U3-05 [M] P3·S1 — 보상 트랜잭션 `FR-U3-05` · `03-state-machine.md` §6
> **Admin으로서** 실패한 SR이 조용히 사라지지 않고 원인을 확인할 창구가 남기를 원한다.

**인수 조건** (상태머신 — GWT)
- **Given** 파이프라인 도중 실패가 발생하면 **When** 보상 트랜잭션이 실행되면 **Then** 상태가 `X_FAILED`가 된다
- **Given** 보상이 실행되어도 **When** 채널 상태를 확인하면 **Then** **아카이브되지 않고** 실패 결과가 게시되어 있다 *(NFR-08)*
- **Given** 실패한 SR에 **When** GitHub Issue를 확인하면 **Then** 실패 코멘트가 등록되어 있다
- **Given** 보상이 부분 실패하면 **When** 상태를 확인하면 **Then** 운영자 개입 지점이 기록되어 있다

---

### US-U3-06 [M] P2·S1 — DevSubStage 추적 `FR-U3-06` · `03-state-machine.md` §7 ⚠️ 경계(U2)
> **개발자로서** Stage 4 안에서 어느 substage가 진행 중이고 어디서 실패했는지 알고 싶다.

**인수 조건** (API — GWT)
- **Given** Stage 4에 진입하면 **When** substage를 조회하면 **Then** `dev`가 반환된다
- **Given** `dev`가 완료되면 **When** substage를 갱신하면 **Then** `qa`→`code_review`→`security_review` 순으로만 전이된다
- **Given** substage를 건너뛰는 전이를 **When** 시도하면 **Then** 거부된다
- **Given** substage가 실패하면 **When** SR 상세를 조회하면 **Then** 실패한 substage가 식별 가능하다

---

### US-U3-07 [M] P3 — Pod lifecycle 관리 `FR-U3-07` · `10-k8s-infrastructure.md` §6
> **Admin으로서** SR마다 격리된 Pod가 생성되고 끝나면 정리되기를 원한다.
> 그래야 자원이 무한정 쌓이지 않는다.

**인수 조건** (API — GWT)
- **Given** SR이 접수되면 **When** 프로비저닝이 실행되면 **Then** Pod·PVC·Service가 생성된다
- **Given** Pod 생성 요청이 재시도되면 **When** 동일 SR에 대해 호출하면 **Then** 중복 생성되지 않는다
- **Given** SR이 terminal 상태에 도달하면 **When** 정리가 실행되면 **Then** Pod와 관련 자원이 삭제된다
- **Given** 생성된 Pod가 **When** 실행 사용자를 확인하면 **Then** 비루트 `runner`다 *(NFR-20)*

---

### US-U3-08 [M] S1 — Pod 세션 초기화 `FR-U3-08` · `06-pod-runner-api.md` §2.2
> **n8n 오케스트레이터로서** repo를 clone하고 작업 공간을 준비시키고 싶다.

**인수 조건** (API — GWT)
- **Given** 유효한 `POD_AUTH_TOKEN`으로 **When** `POST /clone`을 호출하면 **Then** repo가 `/workspaces/session`에 clone된다
- **Given** 동일 요청을 **When** 재호출하면 **Then** 멱등하게 성공한다
- **Given** 토큰 없이 **When** 호출하면 **Then** 401이 반환된다
- **Given** `GET /health`를 **When** 인증 없이 호출하면 **Then** 200이 반환된다 (probe용)

---

### US-U3-09 [M] S2 — Claude Code 실행 `FR-U3-08` · `06-pod-runner-api.md` §2.4
> **SDLC Pod로서** 받은 프롬프트가 지시한 작업만 수행하고, 결과와 확정 신호만 출력하고 종료하고 싶다.
> 그래야 파이프라인 제어권이 n8n에 남는다.

**인수 조건** (API — GWT)
- **Given** 유효한 프롬프트로 **When** `POST /run`을 호출하면 **Then** Claude Code가 실행되고 결과가 반환된다
- **Given** 비동기 모드로 **When** 호출하면 **Then** 즉시 응답하고 완료 시 `run.completed` webhook을 발화한다
- **Given** 실행이 실패하면 **When** 완료되면 **Then** `run.failed` webhook이 발화된다
- **Given** `resume: true`로 **When** 호출하면 **Then** 이전 세션 컨텍스트가 이어진다
- **Given** 프롬프트가 특정 스킬 실행을 지시하지 않으면 **When** 실행되면 **Then** Pod는 **다음 단계 스킬을 스스로 시작하지 않는다**
- **Given** Stage 4 substage 프롬프트를 받으면 **When** 실행되면 **Then** 해당 substage만 수행하고 다음 substage로 잇지 않는다

---

### US-U3-10 [M] S1·S2 — 목업 확정 신호 판정 `FR-U3-12, 13` · `07-n8n-workflows.md`
> **n8n 오케스트레이터로서** 사용자가 목업을 확정했는지를 Pod 출력만 보고 판정하고 싶다.
> 그래야 사용자 원문을 보지 않고도 다음 단계로 넘어갈 수 있다.

**인수 조건** (시스템 액터 — GWT)
- **Given** Pod 출력에 `===MOCKUP_CONFIRMED===`가 **정확한 문자열로** 포함되면 **When** 판정하면 **Then** 다음 단계로 전이한다
- **Given** 마커가 없으면 **When** 판정하면 **Then** 같은 단계에 머물고 피드백 루프를 재발화한다
- **Given** 마커 뒤에 명세서 절대경로가 나열되면 **When** 파싱하면 **Then** 경로들이 추출된다
- **Given** 사용자가 수정을 요청한 경우 **When** Pod가 응답하면 **Then** 마커를 출력하지 않는다

---

### US-U3-11 [M] S2 — Git commit·push `FR-U3-08` · `06-pod-runner-api.md` §2.5
> **SDLC Pod로서** 작업 결과를 work branch에 안전하게 올리고 싶다.
> 그래야 작업물이 유실되지 않는다.

**인수 조건** (API — GWT)
- **Given** 변경사항이 있으면 **When** `POST /git/commit-push`를 호출하면 **Then** commit 후 work branch에 push된다
- **Given** 변경사항이 없으면 **When** 호출하면 **Then** 성공하되 새 commit이 생기지 않는다
- **Given** Pod가 **When** PR 생성·merge를 시도하면 **Then** 수행하지 않는다 (Portal 담당)

---

### US-U3-12 [M] P1·P2 — Slack 채널 게시 `FR-U3-10` · `02-messaging-adapter.md`
> **요청자·개발자로서** 단계별 진행 내용이 Slack 채널에 올라오기를 원한다.
> 그래야 포탈을 계속 보지 않아도 흐름을 따라갈 수 있다.

**인수 조건** (API — GWT)
- **Given** 단계 작업이 완료되면 **When** 채널 게시가 실행되면 **Then** 해당 채널에 메시지가 게시된다
- **Given** `feature` 프로파일이면 **When** 채널명을 생성하면 **Then** `sr-{no}-requirements`/`-design`/`-dev` 형식이다
- **Given** `incident` 프로파일이면 **When** 채널명을 생성하면 **Then** `inc-{no}-dev` 형식이다
- **Given** `improvement` 프로파일이면 **When** 채널명을 생성하면 **Then** `imp-{no}-dev` 형식이다
- **Given** 메시징 어댑터가 **When** 인터페이스를 통해 호출되면 **Then** 구현체 교체가 코드 변경 없이 가능하다 *(NFR-25)*

**PBT 대상** — 채널명 생성 규칙

---

### US-U3-13 [M] P1·P2 — Slack 피드백 수신 `FR-U3-11` · `02-messaging-adapter.md` §6.3
> **요청자·개발자로서** 채널에 답을 쓰면 그것이 파이프라인에 전달되기를 원한다.

**인수 조건** (시스템 액터 — GWT)
- **Given** Slack Gateway Pod가 **When** Socket Mode로 이벤트를 수신하면 **Then** 원본 봉투를 가공 없이 Portal `POST /slack/events`로 릴레이한다
- **Given** Gateway Deployment가 **When** replica 수를 확인하면 **Then** **1**이다 (중복 수신 방지) *(NFR-02)*
- **Given** Portal이 이벤트를 받으면 **When** 처리하면 **Then** 해당 SR의 피드백으로 라우팅된다
- **Given** Portal이 `replicas: 2+`여도 **When** Slack 이벤트가 도착하면 **Then** 중복 처리되지 않는다

---

### US-U3-14 [M] S1 — 접수 워크플로우 (Workflow A) `FR-U3-12` · `07-n8n-workflows.md`
> **n8n 오케스트레이터로서** 접수 webhook 하나로 repo 선택부터 요구사항 인터뷰 시작까지 진행하고 싶다.

**인수 조건** (시스템 액터 — GWT)
- **Given** `sdlc-intake` webhook이 수신되면 **When** Workflow A가 실행되면 **Then** repo·branch가 선택되고 Issue가 생성된다
- **Given** repo가 준비되면 **When** Pod clone과 환경 셋업이 완료되면 **Then** `advance`로 Stage 2 전이가 요청된다
- **Given** Stage 2에 진입하면 **When** 후속 실행이 발화되면 **Then** 요구사항 인터뷰 `/run`이 호출된다
- **Given** 워크플로우 어디에도 **When** stage 번호를 확인하면 **Then** `5`·`7` 등 구 체계 번호가 없다 *(D-05, R-04)*

---

### US-U3-15 [M] S1 — 콜백 워크플로우 (Workflow B) `FR-U3-12` · `07-n8n-workflows.md`
> **n8n 오케스트레이터로서** Pod 완료 신호를 받아 다음 단계나 다음 substage를 발화하고 싶다.

**인수 조건** (시스템 액터 — GWT)
- **Given** `sdlc-run-complete` webhook이 수신되면 **When** 현재 stage로 분기하면 **Then** 해당 단계 처리 경로로 라우팅된다
- **Given** Stage 4면 **When** substage로 분기하면 **Then** `dev`→`qa`→`code_review`→`security_review`가 **각각 독립 `/run`으로** 발화된다
- **Given** 한 substage가 완료되면 **When** 다음이 발화되면 **Then** 이전 substage의 결과가 컨텍스트로 전달된다
- **Given** 사용자 피드백이 수신되면 **When** 판정하면 **Then** 같은 단계 재발화 또는 다음 단계 전이 중 하나로만 분기한다

---

### US-U3-16 [S] S1 — 고아 세션 재개 `FR-U3-12` · `07-n8n-workflows.md`
> **n8n 오케스트레이터로서** 중단된 세션을 예산 한도 안에서 재개하고 싶다.
> 그래야 일시적 장애로 SR이 영구히 멈추지 않는다.

**인수 조건** (시스템 액터 — GWT)
- **Given** `sdlc-stage-resume` webhook이 수신되면 **When** 재개 가능 여부를 판정하면 **Then** 재개 가능/불가가 분기된다
- **Given** 재개 예산이 남아 있으면 **When** 예산을 소진하면 **Then** 해당 stage의 프롬프트가 재발화된다
- **Given** 재개 예산이 소진되면 **When** 재개를 시도하면 **Then** 거부되고 사유가 응답된다
- **Given** 재개 불가한 실패면 **When** 판정하면 **Then** 재개하지 않고 hard-fail로 종료한다

---

### US-U3-17 [S] S3 — 정합성 복구 `FR-U3-07` · `10-k8s-infrastructure.md` §3.1
> **CronJob으로서** 실제 K8s 상태와 DB 상태가 어긋난 것을 찾아 회복하고 싶다.

**인수 조건** (시스템 액터 — GWT)
- **Given** DB에는 살아 있으나 실제로는 없는 Pod가 있으면 **When** reconcile이 실행되면 **Then** DB 상태가 정정된다
- **Given** DB에 기록이 없는 고아 Pod가 있으면 **When** reconcile이 실행되면 **Then** 정리 대상으로 식별된다
- **Given** reconcile이 실행되면 **When** 결과를 확인하면 **Then** 감사 로그에 기록된다

---

# U4 · 장애 대응

> `pipelineProfile='incident'`. 요구사항·설계 단계를 건너뛰고 `dev` 채널 1개만 쓴다.
> **U3 의존** — 상태머신과 Pod 실행 기반이 있어야 동작한다.

### US-U4-01 [M] P3 — 장애 트리거 수집 `FR-U4-01` · `11-incident-response-agent.md`
> **Admin으로서** 외부 장애 이벤트를 시스템이 받아들이되, 내가 스위치로 막을 수 있기를 원한다.

**인수 조건** (API — GWT)
- **Given** 유효한 장애 페이로드로 **When** `POST /incidents/ingest`를 호출하면 **Then** 장애가 등록된다
- **Given** `SDLC_INCIDENT_ENABLED`가 false면 **When** 호출하면 **Then** **접수 자체가 거부된다** (fail-closed)
- **Given** 동일 장애가 중복 수신되면 **When** 처리하면 **Then** 중복 등록되지 않는다
- **Given** 인증 없이 **When** 호출하면 **Then** 401이 반환된다

---

### US-U4-02 [M] P3 — incident SR 승격 `FR-U4-02` · `03-state-machine.md` §1.1 ⚠️ 경계(U3)
> **Admin으로서** 진짜 장애만 SR로 승격해 대응을 시작하고 싶다.

**인수 조건** (API — GWT)
- **Given** 등록된 장애를 **When** 승격하면 **Then** `metadata.pipelineProfile='incident'`인 SR이 생성된다
- **Given** incident SR이 생성되면 **When** 채널을 확인하면 **Then** `inc-{no}-dev` **1개만** 존재한다
- **Given** incident SR이 Stage 4를 완료하면 **When** merge 시점이 되면 **Then** **자동 머지되지 않는다**
- **Given** `Stage` enum을 **When** 조회하면 **Then** incident 때문에 값이 추가되지 않았다 (프로파일은 상태가 아님)

---

### US-U4-03 [M] S2 — 장애 분석 에이전트 실행 `FR-U4-03` · `06-pod-runner-api.md` §2.4
> **SDLC Pod로서** 장애 원인분석·대응가이드·코드수정을 수행하고 산출물을 남기고 싶다.

**인수 조건** (API — GWT)
- **Given** incident SR이 Stage 4에 진입하면 **When** n8n이 `sdlc:incident-response` skill 실행을 프롬프트에 담아 `POST /run`을 호출하면 **Then** 에이전트가 실행된다
- **Given** 실행이 완료되면 **When** 콜백을 확인하면 **Then** 기존 `run.completed`/`run.failed`로 회수된다 (신규 엔드포인트 없음)
- **Given** 분석이 완료되면 **When** 산출물을 확인하면 **Then** 원인분석·대응가이드가 생성되어 있다

---

### US-U4-04 [M] P2·P3 — 장애 목록 조회 `FR-U4-04` · `design/` §4.5
> **개발자·Admin으로서** 현재 장애 현황을 한눈에 보고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/incidents`에 장애 목록이 표시된다
- [ ] 상태별 집계 카드가 표시된다
- [ ] 상태 배지가 `design/` §5.2 매핑과 일치한다
- [ ] 등급(severity) 배지가 `design/` §5.3 매핑과 일치한다
- [ ] `user`는 읽기만, `admin`은 승격·종결 액션이 보인다

---

### US-U4-05 [M] P2·P3 — 장애 상세와 상태 레일 `FR-U4-04` · `design/` §4.6·§6.4
> **개발자·Admin으로서** 장애가 어느 대응 단계에 있고 무엇이 분석되었는지 보고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] 5단계 상태 레일이 현재 단계를 강조해 표시한다
- [ ] 장애 개요와 증상이 표시된다
- [ ] 분석 산출물(원인분석·대응가이드)이 표시된다
- [ ] `admin`에게만 승격·종결 버튼이 보인다
- [ ] `user`가 URL로 직접 승격 API를 호출하면 403이 반환된다 *(NFR-12)*

---

### US-U4-06 [S] P3 — Test 트리거 주입 `FR-U4-05` · `design/` §4.7
> **Admin으로서** 실제 장애 없이 파이프라인을 시험해 보고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/incidents/inject`가 `admin`에게만 노출된다
- [ ] 등록된 템플릿을 골라 가짜 장애를 주입할 수 있다
- [ ] 주입된 장애가 목록에 테스트임이 구분되어 표시된다
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

### US-U4-07 [S] P3 — 장애 템플릿 관리 `FR-U4-05` · `design/` §4.13
> **Admin으로서** 자주 쓰는 장애 유형을 템플릿으로 등록해 두고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/admin/incident-templates`에서 템플릿을 등록·수정·삭제할 수 있다
- [ ] 템플릿 삭제 시 확인 절차가 있다
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

# U5 · 자체개선

> `pipelineProfile='improvement'`. **읽기 전용 실행**이며 `dev` 채널 1개만 쓴다.

### US-U5-01 [M] S3 — 주기 repo 스캔 `FR-U5-01` · `10-k8s-infrastructure.md` §3.2 ⚠️ 경계(U1)
> **CronJob으로서** 등록된 repo를 주기적으로 훑어 개선점을 찾고 싶다.

**인수 조건** (시스템 액터 — GWT)
- **Given** 스캔 스케줄에 도달하면 **When** CronJob이 `/api/internal/sdlc/improvement-scan`을 호출하면 **Then** 스캔 회차가 생성된다
- **Given** `SDLC_IMPROVEMENT_ENABLED`가 false면 **When** 호출하면 **Then** 접수가 거부된다 (fail-closed)
- **Given** 스캔이 실행되면 **When** repo 작업을 확인하면 **Then** **쓰기 작업이 없다** (읽기 전용)
- **Given** 스캔이 완료되면 **When** 회차를 조회하면 **Then** 상태와 finding 수가 기록되어 있다

---

### US-U5-02 [M] S2 — finding 발굴 에이전트 `FR-U5-02` · `12-self-improvement-agent.md`
> **SDLC Pod로서** repo를 분석해 개선점을 finding으로 만들고 싶다.

**인수 조건** (API — GWT)
- **Given** 개선 SR이 Stage 4에 진입하면 **When** n8n이 `sdlc:repo-improvement` skill 실행을 지시하면 **Then** 에이전트가 실행된다
- **Given** 분석이 완료되면 **When** finding을 확인하면 **Then** category별로 분류되어 저장된다
- **Given** 실행 중 **When** repo에 대한 쓰기를 시도하면 **Then** 수행하지 않는다

---

### US-U5-03 [M] P2 — finding 검토 `FR-U5-03` · `12-self-improvement-agent.md` §8
> **개발자로서** 제안된 개선점을 검토하고 채택 여부를 판단하고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/improvements/[id]`에서 category 탭으로 finding이 분류되어 표시된다
- [ ] 각 finding의 내용과 근거가 표시된다
- [ ] finding 배지가 `design/` §5.4 매핑과 일치한다
- [ ] 개발자가 finding별로 검토 의견을 남길 수 있다

---

### US-U5-04 [M] P3 — finding 승격 `FR-U5-03` · `12-self-improvement-agent.md` §8 ⚠️ 경계(U6)
> **Admin으로서** 검토된 finding을 실제 SR이나 개발 규정으로 승격할지 최종 확정하고 싶다.

**인수 조건** (API — GWT)
- **Given** 검토된 finding을 **When** SR로 승격하면 **Then** `pipelineProfile='improvement'`인 SR이 생성된다
- **Given** 검토된 finding을 **When** 개발 규정으로 승격하면 **Then** 규정 항목이 생성된다
- **Given** `user` 권한으로 **When** 승격 API를 호출하면 **Then** 403이 반환된다
- **Given** 이미 승격된 finding을 **When** 재승격하면 **Then** 중복 생성되지 않는다

> ⚠️ **경계**: 승격 판정은 U5, 규정 생성은 U6. 규정 생성 인터페이스를 먼저 합의할 것.

---

### US-U5-05 [M] P2·P3 — 스캔 회차 목록 `FR-U5-04` · `design/` §4.8
> **개발자·Admin으로서** 스캔이 언제 돌았고 무엇이 나왔는지 보고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/improvements`에 스캔 회차 목록이 표시된다
- [ ] finding 집계 카드가 표시된다
- [ ] 스캔 상태 배지가 `design/` §5.5 매핑과 일치한다
- [ ] 회차를 클릭하면 상세로 이동한다

---

### US-U5-06 [S] P3 — 개선 대상 관리와 수동 트리거 `FR-U5-05` · `design/` §4.13
> **Admin으로서** 어떤 repo를 스캔할지 정하고, 필요하면 즉시 돌리고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/admin/improvement-targets`에서 repo별 스캔 설정을 관리할 수 있다
- [ ] 수동 스캔 트리거 버튼이 있다
- [ ] 수동 트리거 시 진행 중임이 표시된다
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

# U6 · 개발 규정 (Developer Memory)

> 가장 독립적인 유닛. U3에는 MCP 주입 지점으로만 약하게 묶인다.

### US-U6-01 [M] P2 — 개발 규정 등록·수정 `FR-U6-01` · `13-developer-memory-agent.md`
> **개발자로서** 우리 팀 개발 규정을 등록하고 최신으로 유지하고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/memory/[systemKey]/[category]/[slug]`에서 규정 본문이 Markdown으로 표시된다
- [ ] 개발자가 규정을 등록·수정할 수 있다
- [ ] 규정 배지가 `design/` §5.6 매핑과 일치한다
- [ ] 폐기는 `admin`에게만 노출된다

---

### US-U6-02 [M] P2 — 규정 개정 이력 `FR-U6-01` · `13-developer-memory-agent.md`
> **개발자로서** 규정이 언제 왜 바뀌었는지 추적하고 싶다.

**인수 조건** (API — GWT)
- **Given** 규정이 수정되면 **When** 이력을 조회하면 **Then** 변경 시각·작성자·변경 내용이 기록되어 있다 *(NFR-18, SECURITY-13)*
- **Given** 규정 상세 화면에서 **When** 이력을 열면 **Then** 개정 목록이 시간순으로 표시된다

---

### US-U6-03 [M] P2·P3 — 규정 탐색과 검색 `FR-U6-04` · `design/` §4.10·§4.11
> **개발자·Admin으로서** 필요한 규정을 빨리 찾고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/memory`에 시스템 Card 그리드가 표시된다
- [ ] 전역 검색으로 규정 본문을 검색할 수 있다
- [ ] `/memory/[systemKey]`에서 category Tabs 5개로 규정이 분류된다
- [ ] 규정 Table에서 항목을 클릭하면 상세로 이동한다

---

### US-U6-04 [M] P4 — 로컬 Claude Code에 규정 공급 `FR-U6-02` · `13-developer-memory-agent.md` §5
> **사내 개발자로서** 내 로컬 Claude Code가 팀 규정을 알고 있기를 원한다.
> 그래야 규정 문서를 찾아 읽지 않아도 코드가 규정에 맞는다.

**인수 조건** (API — GWT)
- **Given** 유효한 `sdlcmem_*` Bearer 토큰으로 **When** MCP 서버에 Streamable HTTP로 연결하면 **Then** 연결이 수립된다
- **Given** 연결된 클라이언트가 **When** 규정을 조회하면 **Then** 최신 규정이 반환된다
- **Given** 토큰이 없거나 폐기되었으면 **When** 연결을 시도하면 **Then** 401이 반환된다
- **Given** MCP 서버가 **When** 포트를 확인하면 **Then** `58002`다

---

### US-U6-05 [M] P3 — MCP 토큰 발급·폐기 `FR-U6-03` · `design/` §4.13
> **Admin으로서** 누가 규정에 접근할 수 있는지 통제하고 싶다.

**인수 조건** (API — GWT)
- **Given** `SDLC_MEMORY_TOKEN_ISSUER_TOKEN`을 가진 요청으로 **When** 토큰 발급을 호출하면 **Then** `sdlcmem_*` 토큰이 발급된다
- **Given** `SDLC_MASTER_KEY`만으로 **When** 토큰 발급을 시도하면 **Then** 거부된다 (발급 권한 분리)
- **Given** 발급된 토큰을 **When** 폐기하면 **Then** 이후 해당 토큰의 연결이 401을 받는다
- **Given** `/admin/memory-tokens`에서 **When** 토큰 목록을 조회하면 **Then** 토큰 값 전체가 평문으로 표시되지 않는다 *(NFR-10)*

---

### US-U6-06 [S] P3 — 규정 시스템 관리 `FR-U6-01` · `design/` §4.13
> **Admin으로서** 규정을 담을 시스템 구분을 관리하고 싶다.

**인수 조건** (UI — 체크리스트)
- [ ] `/admin/memory-systems`에서 시스템을 등록·수정·삭제할 수 있다
- [ ] 규정이 남아 있는 시스템 삭제 시 경고가 표시된다
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

### US-U6-07 [S] S2 — Pod에 MCP 주입 `FR-U6-05` · `00-overview.md` §2 ⚠️ 경계(U3)
> **SDLC Pod로서** 실행 중인 Claude Code가 개발 규정을 참조할 수 있기를 원한다.
> 그래야 AI가 만든 코드도 팀 규정을 따른다.

**인수 조건** (API — GWT)
- **Given** Pod가 생성되면 **When** Claude Code 설정을 확인하면 **Then** `mcp_servers`에 memory MCP가 주입되어 있다
- **Given** Pod 내 Claude Code가 **When** 규정을 조회하면 **Then** 최신 규정이 반환된다
- **Given** MCP 서버가 응답하지 않으면 **When** Pod가 실행되면 **Then** 실행 자체는 실패하지 않는다 (규정 참조는 보조 기능)

> ⚠️ **경계**: 주입 지점은 U3(Pod spec), 주입 대상은 U6(MCP 서버). 연결 정보 전달 방식을 합의할 것.

---

### US-U3-18 [M] P3·S2 — Pod 실행 이미지 구축 `FR-U3-09` · `D-11, D-12` · `sdlc-pod/Dockerfile`(참고)
> **Admin·SDLC Pod로서** Claude Code·Playwright·conda가 갖춰진 실행 이미지가 재현 가능하게 빌드되기를 원한다.
> 그래야 모든 SR이 동일한 실행 환경에서 돌아간다.

**인수 조건** (API — GWT)
- **Given** 이미지 빌드를 **When** 실행하면 **Then** 사내 미러가 아닌 **공용 레지스트리**에서 의존성을 받아 성공한다 *(D-11)*
- **Given** 빌드된 이미지에서 **When** Node 버전을 확인하면 **Then** **22**다 *(D-08 — 참고자산의 20이 아님)*
- **Given** 이미지에서 **When** `claude`·`playwright`·`conda`·`git`·`gh`를 실행하면 **Then** 모두 동작한다
- **Given** 컨테이너가 기동되면 **When** 실행 사용자를 확인하면 **Then** 비루트 `runner`다 *(NFR-20)*
- **Given** 컨테이너가 기동되면 **When** `GET /health`를 호출하면 **Then** 58001 포트에서 200이 반환된다
- **Given** Dockerfile을 **When** 검사하면 **Then** `latest` 태그가 없고 base 이미지가 고정되어 있다 *(NFR-15, SECURITY-10)*

> **참고자산 활용 범위**: `sdlc-pod/Dockerfile`은 **설치 대상 패키지 목록**으로만 참고한다.
> 레지스트리 설정·Node 버전·`COPY` 대상은 전부 재작성 대상이다(D-12).

---

# 품질 검증

## 스토리 분포

| 유닛 | 스토리 | Must | Should | 담당 명세 비중 | 비고 |
|------|:-----:|:----:|:-----:|:-----------:|------|
| U1 공용(기반) | 10 | 9 | 1 | 14% | ⭐ 인터페이스 우선 4건 |
| U2 코어SDLC(관리) | 8 | 6 | 2 | 17% | |
| U3 코어SDLC(진행) | 18 | 16 | 2 | **27%** | 최대 유닛(R-03) |
| U4 장애대응 | 7 | 5 | 2 | 14% | U3 의존 |
| U5 자체개선 | 6 | 5 | 1 | 11% | U3 의존 |
| U6 개발규정 | 7 | 5 | 2 | 16% | 가장 독립적 |
| **합계** | **56** | **46** | **10** | 100% | Q3 예상 범위(50~70) 내 |

## INVEST 준수

| 기준 | 검증 방식 | 결과 |
|------|----------|------|
| **Independent** | 유닛 내 스토리 간 순환 의존 없음. 유닛 간 의존은 `⚠️ 경계` 10건으로 명시 | ✅ |
| **Negotiable** | 스토리는 "무엇을·왜"만 기술하고 구현 방식을 지정하지 않음 | ✅ |
| **Valuable** | 모든 스토리에 "그래야 ~" 형태의 가치 진술 존재 | ✅ |
| **Estimable** | 화면·엔드포인트 단위로 크기가 균질 (Q3=A) | ✅ |
| **Small** | 스토리당 인수 조건 3~8개. 단일 화면 또는 단일 엔드포인트 범위 | ✅ |
| **Testable** | 전 스토리에 인수 조건 존재. GWT 형식은 테스트로 기계 전환 가능 | ✅ |

## FR 커버리지 역추적

**45개 FR 전부 커버.** 검증 과정에서 누락 1건(`FR-U3-09` Pod 이미지 재작성)을 발견해 `US-U3-18`로 보완함.

> 병기 표기(`FR-U1-02, 03` / `FR-U1-08, 09` / `FR-U3-12, 13`)는 한 스토리가 두 FR을 함께 다루는 경우다.

## 유닛 경계를 넘는 스토리 (9건) — 착수 전 인터페이스 합의 필요

| 스토리 | 경계 | 합의할 것 |
|--------|------|----------|
| US-U1-09 | U1 ↔ U5 | CronJob이 호출할 내부 엔드포인트 경로·인증 방식 |
| US-U2-03 | U2 ↔ U3 | SR 상태·substage 조회 API 계약 |
| US-U2-04 | U2 ↔ U3 | `/intake`가 호출하는 프로비저닝 인터페이스 |
| US-U2-07 | U2 ↔ U3 | 이미지 업로드 엔드포인트·토큰 발급 방식 |
| US-U3-06 | U3 ↔ U2 | substage 조회·갱신 API 계약 |
| US-U4-02 | U4 ↔ U3 | `pipelineProfile='incident'` SR 생성 인터페이스 |
| US-U5-01 | U5 ↔ U1 | 스캔 트리거 엔드포인트 |
| US-U5-04 | U5 ↔ U6 | finding → 개발규정 생성 인터페이스 |
| US-U6-07 | U6 ↔ U3 | Pod spec에 MCP 연결 정보를 전달하는 방식 |

## 권한 제약이 명시된 스토리

`NFR-12`(deny-by-default · IDOR 방지 · 서버측 역할 검증)와 정합하도록 아래 스토리에 페르소나 제약을 명시함:

US-U1-02 · US-U2-02 · US-U2-05 · US-U4-04 · US-U4-05 · US-U4-06 · US-U4-07 · US-U5-04 · US-U5-06 · US-U6-01 · US-U6-05 · US-U6-06

## PBT 적용 대상 (NFR-22, NFR-23 · Q3=B Partial)

순수 함수와 직렬화 왕복에만 적용한다는 결정에 따라, 아래 3건을 대상으로 표시함:

| 스토리 | 대상 | 성격 |
|--------|------|------|
| US-U3-02 | `advance()` 전이 판정 | 순수 함수 |
| US-U3-03 | 멱등키 생성 | 순수 함수 |
| US-U3-12 | 채널명 생성 규칙 | 순수 함수 |

---

## ⚠️ 검증에서 나온 관찰 2건

### 1. `Could` 등급이 0건이다

Q7=A로 MoSCoW 3단계를 선택했으나 실제로는 **Must 46 / Should 10 / Could 0**으로 나왔다.
D-01(전체 범위) · D-03(깊이 유지)과 정합하는 결과이지만, **2일 안에 다 못 할 때 먼저 버릴 후보가
Should 10건뿐**이라는 뜻이기도 하다. 게다가 그 10건이 유닛에 고르게 흩어져 있어(U1 1 · U2 2 · U3 2 · U4 2 · U5 1 · U6 2),
가장 무거운 U3에서 덜어낼 수 있는 것은 2건뿐이다.

리스크 R-01이 현실화되면 조정 대상은 결국 **Must 46건 안에서** 골라야 하며, 그 판단은 사용자 몫이다(D-01).
Workflow Planning에서 유닛별 착수 순서를 정할 때 이 점을 고려한다.

### 2. U3에 스토리가 18건으로 집중된다

명세 비중 27%가 스토리 수(32%)로도 그대로 나타났다. 특히 시스템 액터 스토리(S1·S2) 9건이
U3에 몰려 있다. **Units Generation에서 U3 재분배 또는 담당자 2인 배정을 검토**해야 한다(R-03).

한 가지 완화 후보: `US-U3-14`~`US-U3-16`(n8n 워크플로우 3건)은 D-18에 따라
**n8n 배포 이후에 착수**하므로 시간축에서 분리 가능하다.

---

# 📌 v2 보강 — 비즈니스 내러티브 기반 (2026-09-08)

> **보강 근거**: 사용자가 제공한 AIways-On 내러티브.
> **보강 방법**: 내러티브의 각 문장을 `requirements/` 명세와 대조해 **명세에는 있으나 v1 스토리가 놓친 것**을 스토리로 만들고,
> **내러티브에는 있으나 명세에 없는 것**은 스토리로 지어내지 않고 **GAP으로 표기**했다.
> v1 스토리 56건은 그대로 유효하며 아래 17건이 추가된다 (**누계 73건**).
>
> 표기 규칙은 v1과 동일하다. `⚠️ 경계`는 유닛을 넘는 스토리, `GAP-nn`은 명세 미비 지점이다.

---

## U2 · 코어SDLC (관리) — 추가 3건

### US-U2-09 [M] P2·P3 — PR 자동 머지 조건 판정과 완료 요약 게시 `FR-U2-06` · `03-state-machine.md` §4.4
> **시스템 OWNER로서** 사전에 허용한 조건을 만족하면 AI가 PR을 머지하고, 아니면 내가 직접 보고 머지하고 싶다.
> 그래야 안전한 변경은 사람 없이 흐르고, 위험한 변경만 내 손을 거친다.

**인수 조건** (API — GWT)
- **Given** `4 → 9_COMPLETE` 전이가 일어나면 **When** Portal이 repo 루프를 실행하면 **Then** repo별 push → PR 생성이 수행된다 (Pod·n8n은 관여하지 않는다)
- **Given** repo 설정이 `autoPrMerge=true`면 **When** PR이 생성되면 **Then** squash merge + work branch 삭제까지 수행되고 결과가 `자동 머지 완료`로 기록된다
- **Given** `autoPrMerge=false`면 **When** PR이 생성되면 **Then** 머지하지 않고 `수동 머지 필요`로 기록된다
- **Given** `pipelineProfile='incident'`면 **When** `autoPrMerge=true`여도 **Then** 머지하지 않고 `수동 머지 필요(장애 대응 정책)`로 기록된다
- **Given** commit 이력이 없는 repo면 **When** 처리하면 **Then** `변경 없음 — PR 미생성`으로 기록된다
- **Given** 전 repo 처리가 끝나면 **When** dev 채널에 게시하면 **Then** repo별 PR 링크와 4종 머지 상태가 **한 메시지에 집계**되고, 수동 머지 건이 1건 이상이면 담당자 액션 요구 문구가 붙는다
- **Given** 게시가 재시도되면 **When** `<!-- SDLC-COMPLETE:{requestNo} -->` 마커를 검사하면 **Then** 중복 게시되지 않는다
- **Given** 채널 게시가 실패하면 **When** SR 상태를 확인하면 **Then** 이미 `9_COMPLETE`이며 게시 실패가 상태를 되돌리지 않는다 (non-fatal)

> **왜 v1에 없었나**: v1 `US-U2-06`은 PR *생성*까지만 다뤘다. 내러티브의 "사전에 자동 Merge가 허용된 조건을 만족하는 경우 AI Agent가 직접 Merge"가 명세(§4.4)에 이미 있는데 스토리가 없었다.

---

### US-U2-10 [S] P3 — repo별 AI 실행 정책 설정 `FR-U2-05` · `08-sr-registration-ui.md` §
> **Admin으로서** repo마다 AI에게 어디까지 허용할지 미리 정해 두고 싶다.
> 그래야 자동 머지가 아무 repo에서나 켜지지 않는다.

**인수 조건** (UI — 체크리스트)
- [ ] `/admin/repos`에서 repo별로 `autoPrMerge`·`isUi`·`runnable`·`playwrightEnabled`를 토글로 설정할 수 있다
- [ ] `autoPrMerge` 기본값이 **꺼짐**이다 (fail-safe)
- [ ] 목록에서 각 repo의 현재 정책이 한 줄로 보인다
- [ ] 정책 변경이 감사 로그에 남는다 *(NFR-18)*
- [ ] `user` 권한으로 접근하면 403 화면이 표시된다

---

### US-U2-11 [M] P3 — 요구사항 승인 게이트 (UI·API) `FR-U2-08` · `05-portal-api.md` §2.6 · `D-30` 🆕 v2.1
> **Admin(시스템 OWNER)으로서** AI가 정리한 요구사항을 내가 확인하고 확정해야만 개발 단계로 넘어가기를 원한다.
> 그래야 자동화가 사람 확인 없이 main까지 가지 않는다.

**인수 조건** (API — GWT)
- **Given** `2_REQUIREMENTS_IN_PROGRESS` 상태의 SR에 **When** `admin`이 `POST /requests/{id}/confirm-requirements`를 호출하면 **Then** `metadata.requirementsConfirmedAt`이 기록되고 200이 반환된다
- **Given** `user` 권한 세션으로 **When** 동일 API를 호출하면 **Then** **403**이 반환된다 *(원 명세의 "세션(로그인 사용자)"에서 `requireAdmin`으로 축소 — D-30, NFR-12)*
- **Given** `2` 이외의 상태에서 **When** 호출하면 **Then** 거부된다
- **Given** 승인이 기록되면 **When** `audit_events`를 조회하면 **Then** 승인자·시각이 남아 있다 *(NFR-18)*
- **Given** 이미 승인된 SR에 **When** 재호출하면 **Then** 멱등하게 성공하고 승인 시각이 덮어써지지 않는다
- **Given** `/requests/[id]`를 **When** `admin`이 열면 **Then** 요구사항 확정 버튼이 노출되고, `user`에게는 노출되지 않는다

> **self-approval 허용** — 요청자와 승인자가 같아도 거부하지 않는다(D-30, 사용자 결정). 감사 기록으로만 추적한다.

---

## U3 · 코어SDLC (진행) — 추가 7건

### US-U3-19 [M] S2 — 작업 공간 컨텍스트 구성 `FR-U3-12` · `07-n8n-workflows.md` §2.5·§2.6·§2.7
> **SDLC Pod로서** 코드를 만지기 전에 이 요청이 어떤 repo·브랜치·실행 환경 위에서 도는지 먼저 알고 싶다.
> 그래야 인터뷰와 개발이 실제 코드베이스 위에서 이뤄진다.

**인수 조건** (API — GWT)
- **Given** repo·branch가 선택되면 **When** 워크스페이스 `CLAUDE.md`를 구성하면 **Then** 대상 repo 목록·local path·work branch·base branch·auto PR merge 여부가 채워진다
- **Given** clone이 완료되면 **When** `vibe-coding-setup`이 실행되면 **Then** conda 환경이 캐시에서 복원되거나 새로 생성된다
- **Given** Issue가 생성되면 **When** `CLAUDE.md`가 갱신되면 **Then** repo별 Issue 링크가 반영된다
- **Given** 요청과 관련 가능성이 있는 repo가 여러 개면 **When** repo를 선택하면 **Then** 1~N개가 선택되고 0개 선택은 지양된다
- **Given** 컨텍스트 구성이 끝나면 **When** 요구사항 인터뷰가 시작되면 **Then** Pod는 이 컨텍스트를 전제로 응답한다

> ⚠️ **GAP-01**: 내러티브의 *"기존 소스코드의 구조와 동작 방식을 분석한다"* 는 **분석 산출물**을 뜻하지만,
> 현재 명세는 `CLAUDE.md` 컨텍스트 구성 + conda 셋업까지만 규정한다. 구조 분석 리포트를 별도 산출물로 남길지는 미결이다.

---

### US-U3-20 [M] P1·S2 — 비전문가 요구사항을 개발 가능한 수준으로 구체화 `FR-U3-12, 13` · `07-n8n-workflows.md` §3.4·§3.5
> **요청자로서** "엑셀로 일괄 다운로드하게 해 주세요" 정도만 말해도 AI가 되물어 나머지를 채워 주기를 원한다.
> 그래야 개발자와 며칠에 걸쳐 미팅하지 않아도 된다.

**인수 조건** (API — GWT)
- **Given** 추상적인 요청으로 Stage 2에 진입하면 **When** 인터뷰가 실행되면 **Then** 대상 화면·배치 위치·Sheet 구성·Column 목록·데이터 기간/범위·검색조건 반영 방식이 확인된다 *(persona P1 「구체화 6축」)*
- **Given** 사용자가 답변하면 **When** 종료 판정 Agent가 검사하면 **Then** `end`(요구사항 텍스트 정의 완료)가 판정된다
- **Given** `is_ui=true` repo가 있으면 **When** 목업 단계로 진입하면 **Then** Before/After 이미지가 캡처되어 채널에 게시된다
- **Given** `is_ui` repo가 하나도 없으면 **When** 목업 단계에 도달하면 **Then** `NO_UI`만 출력하고 즉시 종료한다
- **Given** 사용자가 목업 수정을 요청하면 **When** 판정하면 **Then** `mockupConfirmed=false`로 재캡처 루프가 반복된다
- **Given** 사용자가 확정하면 **When** 판정하면 **Then** `mockupConfirmed=true`로 다음 단계로 진행한다

> **관계**: v1 `US-U3-10`은 확정 신호 **판정 메커니즘**을, 이 스토리는 **인터뷰 내용의 충분성**을 다룬다. 중복이 아니다.

---

### US-U3-21 [M] P1·P2 — 요구사항 정의서 생성과 확인 창구 `FR-U3-12` · `07-n8n-workflows.md` §3.6·§3.7
> **요청자로서** AI가 정리한 요구사항을 문서로 받아 내가 말한 것과 같은지 확인하고 싶다.
> **시스템 OWNER로서** 그 문서가 GitHub Issue에 남아 나중에도 근거로 남기를 원한다.

**인수 조건** (API — GWT)
- **Given** 목업이 확정되면 **When** 정의서 생성이 실행되면 **Then** `/workspaces/session/.sdlc-reports/requirements.md`가 생성된다
- **Given** 정의서를 생성할 때 **When** 입력 컨텍스트를 확인하면 **Then** 인터뷰 전체 내용 + 확정된 UI 목업 변경점이 모두 반영된다
- **Given** 정의서가 생성되면 **When** Issue comment가 등록되면 **Then** 핵심 요약 bullet + 전문(`<details>`)이 **대상 repo 각각에** 게시된다
- **Given** 정의서 등록이 끝나면 **When** 전이가 요청되면 **Then** 멱등키 `{requestNo}->3_DEV_DESIGN_IN_PROGRESS`로 `2 → 3` 전이가 1회만 발생한다
- **Given** `metadata.requirementsConfirmedAt`이 없으면 **When** `2 → 3` advance가 요청되면 **Then** **거부된다** (fail-closed 승인 게이트) *(D-30, FR-U3-14)* 🆕 v2.1
- **Given** 정의서가 게시되면 **When** 승인 요청이 발송되면 **Then** `requirements` 채널에 알림과 Portal 딥링크가 게시된다 (`feedback-request` 재사용) 🆕 v2.1
- **Given** 승인이 오지 않으면 **When** 시간이 지나면 **Then** 자동 진행하지 않고 무기한 대기한다. Pod는 `SDLC_POD_DEADLINE_SECONDS`(4h)로 종료되고 워크스페이스 PVC는 `SDLC_PVC_RETENTION_DAYS`(7일) 보존된다 🆕 v2.1
- **Given** 대기 후 승인이 오면 **When** 재개하면 **Then** 기존 resume 경로(`US-U3-16`)로 Pod가 재생성되어 이어진다 🆕 v2.1

> ✅ **GAP-04 해소 (D-30)** — 승인 게이트를 신설했다. 판정 주체는 **admin**이며 `2 → 3` 전이가 승인 없이는 일어나지 않는다.
> 승인자는 내러티브의 요청자 A가 아니라 **시스템 OWNER(admin)** 다(사용자 결정).
> **정정**: 이 GAP의 v2 초판은 "승인 액션이 정의되어 있지 않다"고 기술했으나, `05-portal-api.md` §2.6에
> `POST /requests/{id}/confirm-requirements`("요구사항 확정" UI 버튼)가 **이미 존재했다**. 다만 그것은 게이트가 아니라
> n8n 재발화 **트리거**였고(진행 판정은 여전히 `end`), FR·스토리·구현 어디에도 반영되지 않은 상태였다.
> D-30은 이 엔드포인트를 **게이트로 승격하고 권한을 `requireAdmin`으로 확정**한 것이다.

---

### US-U3-22 [M] P2·S2 — 시스템 OWNER 기술 설계 인터뷰 `FR-U3-12` · `07-n8n-workflows.md` §3.8
> **시스템 OWNER로서** AI가 코드를 만지기 전에 어디를 어떻게 고칠지 나와 합의하기를 원한다.
> 그래야 소유권 없는 모듈을 건드리거나 기존 기능을 깨뜨리지 않는다.

**인수 조건** (API — GWT)
- **Given** Stage 3에 진입하면 **When** 설계 인터뷰가 실행되면 **Then** 확정된 요구사항 정의서(`.mvc/requirement/*.md`)를 입력으로 사용한다
- **Given** 인터뷰가 진행되면 **When** 결정 항목을 확인하면 **Then** ① 수정 대상 파일·모듈 ② 아키텍처·개발 표준 준수 방법 ③ 데이터 조회·가공 방식 ④ 데이터 노출 권한 범위 ⑤ 기존 기능 회귀 차단 방법 ⑥ 테스트·검증 방식이 다뤄진다 *(persona P2 「기술 결정 6항목」)*
- **Given** 설계 인터뷰 단계면 **When** Pod가 실행되면 **Then** 설계서(`design.md`)를 **이 단계에서 생성하지 않는다** (보고서 생성은 별도 노드)
- **Given** OWNER가 설계 수정을 요청하면 **When** 판정하면 **Then** 같은 단계에 머물고 인터뷰가 재발화된다
- **Given** 설계 결정이 팀 규정과 충돌하면 **When** MCP를 조회하면 **Then** `behavior`·`prohibition` 규정이 근거로 인용된다 *(⚠️ 경계 U6)*

---

### US-U3-23 [M] P2 — 상세 설계서 생성과 게시 `FR-U3-12` · `07-n8n-workflows.md` §3.9
> **시스템 OWNER로서** 합의한 설계가 문서로 남고 Issue에서 언제든 다시 읽히기를 원한다.

**인수 조건** (API — GWT)
- **Given** 설계 인터뷰가 끝나면 **When** 보고서 생성이 실행되면 **Then** `/workspaces/session/.sdlc-reports/design.md`가 생성된다
- **Given** 설계서가 생성되면 **When** Issue comment가 등록되면 **Then** 핵심 설계 결정사항 요약 + 전문(`<details>`)이 게시된다
- **Given** 설계서 게시가 끝나면 **When** 다음 단계가 발화되면 **Then** `3 → 4` 전이 후 개발 substage(`dev`)가 시작된다

> ✅ **GAP-05 종결 (D-30)** — 설계 게이트는 **신설하지 않는다**(사용자 결정). 설계서 게시 후 곧바로 개발로 진행한다.
> 근거: OWNER는 `design` 채널에서 상시 개입할 수 있고, 입구(요구사항)에 게이트가 생겼으므로 사람 승인 0회 경로는 사라진다.

---

### US-U3-24 [S] P2 — 개발·RSCCB 최종 보고서 `FR-U3-12` · `07-n8n-workflows.md` §3.11·§3.12
> **시스템 OWNER로서** PR을 통째로 읽지 않고도 무엇이 왜 바뀌었는지 요약으로 파악하고 싶다.

**인수 조건** (API — GWT)
- **Given** `security_review` substage가 완료되면 **When** 최종 보고서가 실행되면 **Then** `development.md`와 `rsccb.md` 2종이 생성된다
- **Given** 보고서가 생성되면 **When** Issue comment가 등록되면 **Then** 2건이 각각 게시된다
- **Given** 개발 완료 comment면 **When** 내용을 확인하면 **Then** commit 내역까지만 적고 PR·머지는 **예정 사항으로만** 언급한다 (확정 PR 링크는 Portal 완료 요약이 담당)
- **Given** 최종 보고서가 끝나면 **When** `Advance to 9`가 호출되면 **Then** 전이가 1회만 일어난다

---

### US-U3-25 [S] P1·P2 — 메신저만으로 SDLC에 참여 `FR-U3-10, 11` · `02-messaging-adapter.md`
> **요청자·시스템 OWNER로서** 포탈이나 개발 도구를 열지 않고 메신저 대화만으로 개발과 운영에 참여하고 싶다.
> 그래야 언제 어디서나 자연어로 참여할 수 있다.

**인수 조건** (API — GWT)
- **Given** 각 단계가 끝나면 **When** 채널 게시가 실행되면 **Then** 요구사항 인터뷰·목업 확인·설계 협의·진행 상태·테스트 결과·완료 요약이 채널에서 확인된다
- **Given** 사용자가 채널에 답하면 **When** Gateway가 이벤트를 릴레이하면 **Then** 해당 SR의 피드백으로 라우팅된다
- **Given** 장애 분석 결과·개선 finding 리포트가 생성되면 **When** 게시되면 **Then** 해당 SR의 `dev` 채널에서 확인된다
- **Given** PR 검토가 필요하면 **When** 완료 요약이 게시되면 **Then** PR 링크와 머지 상태가 제공된다 — **승인·머지 행위 자체는 GitHub에서 수행한다**
- **Given** 메신저 구현체를 교체하면 **When** `MessageChannelAdapter` 인터페이스만 구현하면 **Then** 상위 로직 변경 없이 동작한다 *(NFR-25 — 사내 메신저 전환 경로)*

> ⚠️ **GAP-02**: 내러티브의 메신저 작업 목록 중 *"Pull Request 검토 및 승인"* 은 메신저 안에서 완결되지 않는다.
> ⚠️ **GAP-03**: 사내 메신저 어댑터 **구현체**는 v1 범위 밖이다. v1은 Slack 구현체 + 교체 가능한 추상화까지다.

---

## U4 · 장애 대응 — 추가 3건

### US-U4-08 [M] S2 — MCP 컨텍스트 기반 원인 추적 `FR-U4-03` · `11-incident-response-agent.md` §5
> **SDLC Pod로서** 코드만 보고 추측하는 것이 아니라, 이 시스템의 금지사항·과거 장애·실패 사례를 먼저 읽고 원인을 좁히고 싶다.
> 그래야 같은 원인을 매번 처음부터 찾지 않는다.

**인수 조건** (API — GWT)
- **Given** 장애 분석이 시작되면 **When** 에이전트가 실행되면 **Then** Memory MCP에서 `incident_response`·`failure_case`·`prohibition` 규정을 **먼저** 조회한다
- **Given** 원인을 추정할 때 **When** 가설을 세우면 **Then** 경쟁 가설을 **3개 이상** 세우고 증거로 배제한다
- **Given** 증거가 없으면 **When** 보고하면 **Then** 원인을 단정하지 않고, 폐기한 가설도 기록한다
- **Given** MCP가 응답하지 않으면 **When** 분석이 진행되면 **Then** 분석 자체는 중단되지 않는다 (warn-only)
- **Given** 실행 모드를 확인하면 **When** `permission_mode`를 검사하면 **Then** 코드 수정이 허용되더라도 PR 자동 머지는 금지되어 있다

> ⚠️ **경계(U6)**: 조회 대상 규정은 U6 소유. 조회 실패 시 warn-only 정책을 두 유닛이 같이 지켜야 한다.

---

### US-U4-09 [M] P2·P3 — 장애 분석 리포트 4요소 `FR-U4-03, 04` · `11-incident-response-agent.md` §6
> **개발자·Admin으로서** 장애 리포트를 받으면 바로 판단하고 움직일 수 있기를 원한다.

**인수 조건** (API — GWT)
- **Given** 분석이 완료되면 **When** 리포트를 확인하면 **Then** ① 예상 원인 ② 관련 소스코드 위치 ③ 영향 범위 ④ 대응 방향이 포함되어 있다
- **Given** `SDLC_INCIDENT_ALLOW_CODE_PATCH=true`이고 수정 범위가 안전하면 **When** 수정이 수행되면 **Then** commit·push·PR 생성까지 진행된다
- **Given** 그렇게 만들어진 PR이면 **When** 머지 시점이 되면 **Then** `autoPrMerge` 설정과 무관하게 자동 머지되지 않는다
- **Given** 분석 산출물이 나오면 **When** 등록 API가 호출되면 **Then** 장애 상태가 갱신되고 `/incidents/[id]`에서 조회된다

---

### US-U4-10 [S] S2 — 장애 지식 축적 `FR-U4-03` · `13-developer-memory-agent.md` §1.2 ⚠️ 경계(U6)
> **SDLC Pod로서** 이번에 알아낸 원인을 다음 장애 때 쓸 수 있게 남기고 싶다.
> 그래야 같은 장애가 반복될 때 분석 시간이 짧아진다.

**인수 조건** (API — GWT)
- **Given** 장애가 종결되면 **When** `memory_append_incident_lesson`이 호출되면 **Then** `incident_response` 규정이 생성된다 (slug 형식 `inc-*`)
- **Given** 그 규정을 **When** 물리 삭제하려 하면 **Then** 거부되고 `status='archived'`만 허용된다
- **Given** 다음 장애 분석이 시작되면 **When** 유사 사례를 검색하면 **Then** 축적된 규정이 **높은 우선순위**로 검색된다
- **Given** MCP 쓰기 경로를 **When** 확인하면 **Then** Portal 내부 API를 경유해 감사 로그가 한 곳에만 남는다

---

## U5 · 자체개선 — 추가 2건

### US-U5-07 [M] S2 — finding 탐색 범위 커버리지 `FR-U5-02` · `12-self-improvement-agent.md`
> **SDLC Pod로서** repo를 훑을 때 무엇을 찾아야 하는지 기준이 고정되어 있기를 원한다.
> 그래야 회차마다 다른 것만 나오는 일이 없다.

**인수 조건** (API — GWT)
- **Given** 스캔이 실행되면 **When** finding을 분류하면 **Then** ① 코드 품질 ② 중복·불필요한 복잡성 ③ 잠재적 장애 가능성 ④ 성능 ⑤ 유지보수가 어려운 구조 ⑥ 과거 장애 이력과 유사한 위험 ⑦ 운영 안정성 개선 범주가 다뤄진다
- **Given** ⑥번 범주를 판정할 때 **When** MCP를 조회하면 **Then** `failure_case`·`incident_response`가 근거로 인용된다 *(⚠️ 경계 U6)*
- **Given** finding이 생성되면 **When** 내용을 확인하면 **Then** 근거(파일 경로·규정 참조)가 함께 기록된다
- **Given** 실행 중 **When** repo에 쓰기를 시도하면 **Then** 수행되지 않는다 (`permission_mode=plan`, `Write`/`Edit` 미포함)

---

### US-U5-08 [S] P3 — finding의 규정 승격에 admin 승인 `FR-U5-03` · `13-developer-memory-agent.md` §2.1 ⚠️ 경계(U6)
> **Admin으로서** AI가 찾아낸 것이 곧바로 팀 규정이 되는 일은 막고 싶다.

**인수 조건** (API — GWT)
- **Given** finding을 `behavior` 또는 `prohibition` 규정으로 승격하면 **When** 확정하면 **Then** **admin 승인이 요구된다**
- **Given** `user` 권한으로 **When** 승격을 시도하면 **Then** 403이 반환된다
- **Given** 승격이 확정되면 **When** 규정을 조회하면 **Then** `sourceType`에 finding 출처가 기록되어 있다
- **Given** 이미 승격된 finding을 **When** 재승격하면 **Then** 중복 생성되지 않는다

---

## U6 · 개발 규정 — 추가 3건

### US-U6-08 [M] P2 — 규정 5종 체계와 불변 이력 `FR-U6-01` · `13-developer-memory-agent.md` §1.2·§2.1·§2.2
> **개발자로서** MCP가 AI에게 넘기는 지식이 종류별로 정리되어 있기를 원한다.
> 그래야 "하지 말아야 할 것"과 "시스템 배경 지식"이 뒤섞이지 않는다.

**인수 조건** (API — GWT)
- **Given** 규정을 등록하면 **When** category를 선택하면 **Then** `system_profile`·`behavior`·`prohibition`·`failure_case`·`incident_response` **5종만** 허용된다
- **Given** category를 선택하면 **When** 편집기가 열리면 **Then** 해당 category의 고정 H2 골격이 초기값으로 제시된다
- **Given** `failure_case`·`incident_response`를 **When** 삭제하려 하면 **Then** 물리 삭제가 거부되고 archive만 가능하다
- **Given** 동일 `(category, slug)`로 재등록하면 **When** upsert하면 **Then** 신규 생성이 아니라 `expectedVersion` CAS 갱신으로 처리되고, 불일치 시 409가 반환된다
- **Given** 내러티브의 지식 유형(금지사항·비즈니스 흐름·DB 구조·장애 이력·개발 규칙)을 **When** 매핑하면 **Then** 5종 category 안에 모두 수용된다

**내러티브 지식 유형 ↔ category 매핑**

| 내러티브가 요구한 컨텍스트 | category |
|--------------------------|----------|
| 하지 말아야 할 행동 및 금지 사항 | `prohibition` |
| 비즈니스 흐름 및 개발 시 주의사항 | `system_profile` (+ `behavior`) |
| DB 구조 및 관련 정보 | `system_profile` |
| 과거 장애 이력 및 원인 | `incident_response` |
| 시스템별 개발 규칙 및 운영 정책 | `behavior` |
| 오류 수정 중의 잘못된 접근 누적 | `failure_case` |

---

### US-U6-09 [M] S2 — Pod agent 토큰 주입과 범위 제한 `FR-U6-03, 05` · `13-developer-memory-agent.md` §1.3·§8.1 ⚠️ 경계(U3)
> **SDLC Pod로서** 내가 받은 MCP 권한이 이 SR에만 유효하고 곧 만료되기를 원한다.
> 그래야 Pod 하나가 뚫려도 규정 저장소 전체가 노출되지 않는다.

**인수 조건** (API — GWT)
- **Given** Pod에 MCP를 주입할 때 **When** 토큰을 발급하면 **Then** `sdlcmem_agent_*`가 **SR마다** 발급되고 `requestId`에 바인딩된다
- **Given** 그 토큰을 **When** 수명을 확인하면 **Then** 분 단위 TTL(`SDLC_MEMORY_AGENT_TOKEN_TTL_MINUTES`)로 만료된다
- **Given** Pod 이미지를 **When** 검사하면 **Then** MCP 토큰이 이미지에 구워져 있지 않다 (`POST /run`의 `mcp_servers`로 요청마다 주입)
- **Given** 사내 개발자 토큰(`sdlcmem_live_*`)을 **When** scope를 확인하면 **Then** 기본값이 `read`다

> ⚠️ **경계**: 토큰 발급·검증은 U6, `mcp_servers` 주입 지점은 U3(Pod spec). v1 `US-U6-07`과 함께 합의할 것.

---

### US-U6-10 [S] S2 — 실패사례 자동 축적 `FR-U6-01` · `13-developer-memory-agent.md` §1.2
> **SDLC Pod로서** 잘못된 접근으로 실패한 경험을 남겨 다음 에이전트가 같은 길로 가지 않기를 원한다.

**인수 조건** (API — GWT)
- **Given** 에이전트가 잘못된 접근으로 실패하면 **When** `memory_append_failure_case`가 호출되면 **Then** `failure_case` 규정이 생성된다
- **Given** 동일 유형의 실패를 **When** 다음 세션이 검색하면 **Then** 기존 사례가 **높은 우선순위**로 검색된다
- **Given** 그 규정을 **When** 삭제하려 하면 **Then** archive만 가능하다
- **Given** 규정 축적이 실패하면 **When** SR 진행을 확인하면 **Then** 전이가 차단되지 않는다 (warn-only)

---

# v2 품질 검증

## 보강 후 스토리 분포

| 유닛 | v1 | v2 추가 | 누계 | Must | Should | 비고 |
|------|:--:|:------:|:---:|:----:|:-----:|------|
| U1 공용(기반) | 10 | 0 | 10 | 9 | 1 | 내러티브가 인프라를 다루지 않음 |
| U2 코어SDLC(관리) | 8 | **3** | 11 | 8 | 3 | 자동 머지 판정·정책 설정 · **승인 게이트(v2.1)** |
| U3 코어SDLC(진행) | 18 | **7** | **25** | 21 | 4 | ⚠️ 집중 심화 — 아래 관찰 참조 |
| U4 장애대응 | 7 | **3** | 10 | 7 | 3 | MCP 연계·리포트 구성 |
| U5 자체개선 | 6 | **2** | 8 | 6 | 2 | 탐색 범위·승격 통제 |
| U6 개발규정 | 7 | **3** | 10 | 7 | 3 | category 체계·토큰 범위 |
| **합계** | **56** | **18** | **74** | **58** | **16** | v2.1 승인 게이트 반영 |

## 내러티브 문단 ↔ 스토리 추적성

| 내러티브 문단 | 커버하는 스토리 | 상태 |
|--------------|----------------|------|
| 요청 접수 후 Repo Clone·코드 분석 | US-U3-08, **US-U3-19** | ⚠️ 부분 (GAP-01) |
| A와의 요구사항 인터뷰 (6축 구체화) | **US-U3-20**, US-U3-10 | ✅ |
| 요구사항 정의서 작성 + 확인·승인 | **US-U3-21** · **US-U2-11** | ✅ (D-30 · 승인자는 A→admin) |
| B와의 기술 인터뷰 (6항목 결정) | **US-U3-22** | ✅ |
| 상세 설계서 작성 | **US-U3-23** | ✅ (게이트 미신설로 종결) |
| 바이브 코딩 개발 + 테스트 | US-U3-09, US-U3-06 | ✅ |
| Git Commit/Push + PR 생성 | US-U3-11, US-U2-06 | ✅ |
| B의 PR Merge / 조건부 자동 Merge | **US-U2-09**, **US-U2-10** | ✅ |
| MCP로 금지사항·비즈니스 흐름·DB·장애 이력 공급 | **US-U6-08**, US-U6-04, US-U6-07, **US-U6-09** | ✅ |
| 장애 분석 (MCP 참조 원인 추적) | **US-U4-08**, US-U4-03 | ✅ |
| 장애 리포트 (원인·소스·영향·대응) | **US-U4-09** | ✅ |
| 장애 분석 → 수정 개발 연결 | US-U4-09 (조건부 패치) | ⚠️ 부분 (GAP-06) |
| 주기 스캔으로 개선점 능동 발굴 | US-U5-01, **US-U5-07** | ✅ |
| OWNER 리포팅 → SDLC 과제 전환 | US-U5-03, US-U5-04, **US-U5-08** | ✅ |
| 메신저 중심 개발·운영 (12개 작업) | **US-U3-25**, US-U3-12, US-U3-13 | ⚠️ 부분 (GAP-02) |
| 사내 메신저 전환 | US-U3-25 (추상화만) | ⚠️ 부분 (GAP-03) |
| 사람 노력 최소화 / 생산성 극대화 | — | ❌ 미커버 (GAP-07) |

## 내러티브 ↔ 명세 GAP 목록

> **원칙**: 명세에 근거가 없는 것은 스토리로 지어내지 않았다. 아래는 **요구사항 단계로 되돌려 결정해야 할 항목**이다.

| GAP | 내용 | 현재 명세 | 권고 |
|-----|------|----------|------|
| **GAP-01** | 기존 소스코드 **구조·동작 분석 산출물** | `CLAUDE.md` 컨텍스트 구성 + conda 셋업까지만 | `system_profile` 규정 자동 생성으로 대체 가능한지 검토 (U6 재사용) |
| **GAP-02** | **메신저 안에서 PR 승인·머지** | 완료 요약에 PR 링크 제공, 승인은 GitHub | v1 범위 유지 권고. 메신저 승인은 GitHub 권한 위임 문제가 딸림 |
| **GAP-03** | **사내 메신저 어댑터 구현체** | `MessageChannelAdapter` 추상화 + Slack 구현체 | v1은 추상화까지. 사내 전환은 v2 과제 (NFR-25가 경로를 보장) |
| ~~GAP-04~~ | 요구사항 정의서에 대한 명시적 승인 | ~~AI의 `end` 판정~~ → **admin 승인 게이트 (fail-closed)** | ✅ **해소 — D-30.** `confirm-requirements`를 게이트로 승격, `requireAdmin`으로 축소. `FR-U2-08`·`FR-U3-14`·`US-U2-11` |
| **GAP-05** | 상세 설계서에 대한 **OWNER의 명시적 승인** | 게시 후 곧바로 개발 진행 | GAP-04와 동일 판단 필요. 자동 머지 repo에서는 특히 중요 |
| **GAP-06** | 장애 분석 → **수정 개발로의 자동 연결** | `SDLC_INCIDENT_ALLOW_CODE_PATCH` 조건부 패치까지 | 내러티브도 "향후 확장"으로 명시 — v1 범위 밖으로 확정 권고 |
| **GAP-07** | **리드타임 성과 지표 계측·리포트** (20건/월, 1주/건) | FR·NFR 없음 | 효과 입증 수단이 없다. `audit_events`로 산출 가능한지 검토 후 FR 신설 |

> ~~**GAP-04/05가 가장 중요하다.**~~ → ✅ **해소됨 (D-30, 2026-09-08)**
> 내러티브는 두 번의 인간 승인 게이트를 전제했고, 당시 명세의 게이트는 목업 확정 1회뿐이라
> `autoPrMerge=true` repo에서 **승인 0회 경로**가 성립했다.
> D-30으로 **요구사항 단계에 admin 승인 게이트(fail-closed)** 를 신설해 그 경로를 차단했다. 설계 게이트는 신설하지 않는다.
>
> **남은 위험 (사용자가 수용함)**: self-approval을 금지하지 않기로 했으므로,
> `autoPrMerge`를 켜는 사람(admin)과 승인하는 사람(admin)이 같을 수 있다 — 게이트의 독립성은 확보되지 않는다.
> 감사 기록(`audit_events`)으로 사후 추적만 가능하다.

## v2 관찰 — U3 집중이 더 심해졌다

v1에서 이미 U3가 18건(32%)으로 최대였는데, 내러티브의 SDLC 진행 서사가 대부분 U3에 떨어져 **25건(34%)** 이 됐다.
v1 관찰 2의 완화안(n8n 워크플로우 3건을 시간축에서 분리)에 더해, **Stage 2·3 서사 스토리(US-U3-20~23) 4건을 U2로 옮기는 안**을 검토할 수 있다 —
이 4건은 산출물(정의서·설계서)의 **게시·확인 창구**가 성격상 관리(U2)에 가깝다. 판단은 Units Generation에서 한다.
