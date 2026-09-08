# U2 재작업 백로그

> **코드 승인 시점**: 2026-09-08 · 승인과 함께 아래 항목을 **미완으로 남긴다**.
> U2 코드는 승인됐고 여기 있는 것들은 *결함이 아니라 아직 하지 않은 일*이다.
> 각 항목은 착수 시점과 선행 조건이 다르므로 한 번에 처리하지 않는다.

## 처리 순서 요약

| # | 항목 | 유형 | 선행 조건 | 착수 시점 |
|---|------|------|----------|----------|
| **RW-1** | 요구사항 승인 게이트 (`FR-U2-08`) | **신규 기능** | D-30 확정 ✅ | U3 T1 이후 (advance 소유권 필요) |
| **RW-2** | `CompensationPort` → contracts 승격 (F-7) | 계약 승격 | U1 승인 | U3 T1 |
| **RW-3** | 이미지 토큰 상태 코드 정합 (F-8) | 문서 정정 | 사용자 판단 | 아무 때나 |
| **RW-4** | 암호화 키 환경변수 이름 확정 | 명명 확정 | 사용자 판단 | 아무 때나 |
| **RW-5** | 웹 터미널·재개발/테스트 버튼 (F-6) | 범위 밖 | 요구사항 재검토 | 보류 |

---

## RW-1 · 요구사항 승인 게이트 (`FR-U2-08`) 🆕

**왜 U2 코드에 없는가**: U2 Part 2 생성이 끝난 **뒤에** D-30이 확정됐다. 누락이 아니라 시점 차이다.

### 해야 할 일

| 대상 | 작업 | 소유 |
|------|------|------|
| `POST /requests/{id}/confirm-requirements` | 라우트 신규. 인증은 **`requireAdmin`** — 원 명세의 "세션(로그인 사용자)"보다 좁힌다(D-30) | **U2** |
| 〃 | `metadata.requirementsConfirmedAt` 기록. 재호출 시 **멱등**(시각 덮어쓰기 금지) | **U2** |
| 〃 | `audit_events`에 승인자·시각 기록 (NFR-18) | **U2** |
| `/requests/[id]` | 요구사항 확정 버튼. `admin`에게만 노출, 상태가 `2_REQUIREMENTS_IN_PROGRESS`일 때만 활성 | **U2** |
| `advance` `2 → 3` | `metadata.requirementsConfirmedAt`이 없으면 **거부** (`FR-U3-14`) | ⚠️ **U3** |
| 승인 요청 알림 | `requirements` 채널에 알림 + Portal 딥링크 (`feedback-request` 재사용) | ⚠️ **U3** |

### 착수 전 확인할 것

- **강제 지점은 U3의 `advance`다.** U2가 버튼과 API만 만들고 U3가 거부 로직을 넣지 않으면 **게이트가 아니라 장식**이 된다. 두 쪽이 같이 들어가야 한다.
- U2의 현재 SR 상세 화면은 `advance`가 없을 때 "전이 엔드포인트가 아직 배포되지 않았다"고 표시한다(`summary.md` §6.4). 승인 버튼도 같은 방식으로 처리한다.
- 현행 명세 문언(`05-portal-api.md` §2.6)은 인증이 `"세션 (로그인 사용자)"`다. **그대로 구현하면 IDOR 구멍**이다 — D-30이 `requireAdmin`으로 좁혔다는 점을 반드시 반영할 것.

### 관련 문서

`FR-U2-08` · `FR-U3-14` · `D-30` (`requirements.md`) · `US-U2-11` · `US-U3-21` (`stories.md`) · `05-portal-api.md` §2.6

### 수용한 잔존 위험 (사용자 결정)

self-approval을 **금지하지 않는다**. 요청자와 승인자가 같아도 거부하지 않으며, `autoPrMerge`를 켠 admin이 스스로 승인할 수 있다.
게이트의 독립성은 확보되지 않고 `audit_events`로 사후 추적만 가능하다.

---

## RW-2 · `CompensationPort` → `packages/contracts/ports.ts` 승격 (F-7)

`03-state-machine.md` §6의 `compensateFailedSdlc`가 PR #1 동결 목록에 없어, U2가 `intake-service.ts` 안에
`CompensationPort`를 **임시 선언**하고 아무 동작도 하지 않는 stub을 주입한 상태다.
AD-4에 따라 U2는 `contracts`를 직접 수정하지 않았다.

- **U1 승인**을 받아 `packages/contracts/ports.ts`로 승격
- 승격 후 U2의 임시 선언 제거, `deps.ts`에서 실제 구현 주입
- **현재 동작**: intake 프로비저닝 실패 시 stub이 아무것도 하지 않고 **500을 반환한다**. 성공한 척하지 않는다

---

## RW-3 · 이미지 토큰 실패 상태 코드 (F-8)

| 출처 | 값 |
|------|---|
| `US-U2-07` 인수 조건 | **403** |
| `05-portal-api.md` §2.11 · §7 매핑 관례(auth=401) · U1 `verifyImageToken` | **401** |

3 대 1이므로 Q5=A(명세 우선)에 따라 **401로 구현**했고, 스토리와 명세 **어느 쪽도 고치지 않았다**.
문서 한 곳을 정정해 불일치를 없앨 것 — 권고는 `US-U2-07`의 403을 401로 정정.

---

## RW-4 · 암호화 키 환경변수 이름 확정

`SDLC_SECRET_ENCRYPTION_KEY` → 없으면 `AUTH_SECRET` 폴백으로 구현했다.
근거는 `SDLC_IMAGE_SIGNING_SECRET`이 "비면 `AUTH_SECRET` 재사용"으로 규정된 선례다.
다만 **`07` 환경변수 표에 이 항목 자체가 없다**. 이름을 확정해 표에 올릴 것.

---

## RW-5 · 웹 터미널 · 재개발/테스트 버튼 (F-6) — 보류

명세(`08-sr-registration-ui.md`)에는 있으나 Requirements Analysis에서 FR·스토리로 넘어오지 않았다.
U2는 "중지" 버튼만 구현했다. 되살리려면 **요구사항 재검토가 선행**되어야 한다 — 지금은 범위 밖으로 둔다.
