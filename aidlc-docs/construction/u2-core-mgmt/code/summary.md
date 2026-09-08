# U2 코어SDLC (관리) — Code Generation 요약

> **단계**: CONSTRUCTION / Code Generation — Part 2 완료
> **계획**: `aidlc-docs/construction/plans/u2-core-mgmt-code-generation-plan.md` (18/18 완료)
> **선행**: U1 PR #1 (`u1-shared-foundation/code/interfaces.md`)

---

## 1. 검증 결과 (실제 실행)

| 항목 | 명령 | 결과 |
|------|------|------|
| 타입 검사 | `pnpm -r typecheck` | **3/3 통과** |
| 테스트 | `pnpm vitest run --coverage` | **247건 통과** (U1 시점 55건 → +192) |
| 커버리지 | line 85.59 / branch 87.5 / func 87.8 | **게이트 80·75·80 통과** |
| 프로덕션 빌드 | `pnpm build` | **성공 · 라우트 23개** |
| Helm | `helm lint` · `helm template` | 통과 · 매니페스트 15개 |
| 경계 검증기 | `verify:contracts-runtime-free` | 통과 (파일 6개) |
| | `verify:gateway-isolation` | SKIP (U3 가 gateway 를 아직 안 만듦) |

### 경계 준수 — 코드 검색으로 확인

| 검사 | 결과 |
|------|------|
| U2 안의 `sdlc_requests` 직접 INSERT (B-1 위반) | **0건** |
| U2 안의 `advance` · `setSubStage` 호출 (B-3 위반) | **0건** |
| U2 안의 자체 Bearer 비교 (AD-2 위반) | **0건** |
| Stage `5`·`6`·`7`·`8` 등장 (D-05·R-04 위반) | **0건** |
| U2 라우트 13개의 AuthGuard 통과 | **13/13** (세션 라우트는 서비스 내부 가드) |

---

## 2. 만든 것

### 애플리케이션 코드 (워크스페이스 루트)

| 영역 | 경로 | 내용 |
|------|------|------|
| 공유 (U1 승인) | `packages/lib/src/crypto/` | `secret_refs` AES-256-GCM 암·복호화 + vault |
| 공유 (U1 승인) | `packages/lib/src/http/` | `AuthError` → §7 표준 오류 매퍼 |
| 공유 프리미티브 | `apps/portal/src/components/ui/` | Button · Field · Surface · Badge · Table · Dialog |
| 공유 유틸 | `apps/portal/src/lib/utils.ts` | `cn()` |
| 스타일 | `apps/portal/src/app/globals.css` · `postcss.config.mjs` | Tailwind v4 → `tokens.css` 연결 |
| C-2.1 | `features/u2-core-mgmt/request/intake-service.ts` | `/intake` 접수 + 프로비저닝 |
| C-2.2 | `features/u2-core-mgmt/request/query-service.ts` · `repository.ts` · `row-mapping.ts` | 목록·상세·GitHub 링크 |
| C-2.3 | `features/u2-core-mgmt/github/` | `GitHubPort` 구현 · REST 클라이언트 · 관리 서비스 |
| C-2.4 | `app/(dashboard)/` · `app/admin/` | 대시보드 · 등록 · 목록 · 상세 · 관리 6화면 |
| C-2.5 | `features/u2-core-mgmt/images/` | 업로드 · S3 SigV4 · 서명 URL 서빙 |
| 배치2 | `features/u2-core-mgmt/audit/` | 감사 로그 + 마스킹 |
| 경계 | `features/u2-core-mgmt/stubs/` · `deps.ts` | stub 3종 + 단일 교체 지점 |
| 인프라 (U1 승인) | `charts/aiways-on/` | `S3_*` 4종 · `SDLC_SECRET_ENCRYPTION_KEY` |
| 게이트 (U1 승인) | `vitest.config.ts` · `CODEOWNERS` | 커버리지 범위 확장 · 공유 경로 소유자 |

### 라우트 13개 (전부 §8 인증 매트릭스대로)

`POST /intake` · `GET /requests` · `GET /requests/{id}` · `GET /requests/{id}/github-links` ·
`POST /requests/{id}/issues` · `POST /requests/{id}/audit` · `POST /requests/{id}/channel-image` ·
`GET /images/{imageId}` · `GET|POST /orgs` · `GET|POST /repos` · `POST /credentials` ·
`GET /generate-request-no` · `GET /dev-types`

**스키마 변경 0건 · 마이그레이션 0건** — 필요한 테이블은 U1 이 전부 선언해 뒀다.

---

## 3. TDD 가 실제로 잡아낸 것

주장이 아니라 실행 기록이다.

1. **PBT 가 암호화 결함을 찾았다.** `decrypt(encrypt(x)) === x` 왕복 성질이 **빈 문자열**에서 깨졌다.
   인증 태그가 정확히 16바이트라 빈 평문의 암호문 길이가 정확히 16인데, 길이 검사를 `<= 16` 으로
   써서 유효한 값을 거부하고 있었다. `< TAG_BYTES` 로 고쳤다. 예시 기반 테스트만 있었으면
   빈 값을 시험할 이유가 없어 통과했을 결함이다.
2. **`next build` 가 타입 검사가 못 잡는 것을 잡았다.** (U1 의 Edge 번들 문제와 같은 부류)
   `Uint8Array` 를 `Response` 본문으로 넘기면 `lib.dom` 의 `BodyInit` 과 어긋난다. Blob 으로 감쌌다.
3. **커버리지 게이트가 F-4 해소 직후 60.01% 로 실제로 실패했다.** 임계값을 낮추지 않고,
   주입 가능한 어댑터(REST 클라이언트 · S3 · 이미지 핸들러)에 **테스트를 써서** 85.59% 로 올렸다.
   Drizzle 쿼리 파일만 제외했고, 제외를 정당화하기 위해 **판단이 들어간 코드를 밖으로 뺐다**
   (`request/row-mapping.ts`) — 제외된 파일에는 우리 로직이 남아 있지 않다.

---

## 4. 발견 사항 처리 결과

| ID | 상태 | 처리 |
|----|------|------|
| **F-1** Tailwind·shadcn 미도입 | ✅ 해소 | A안 채택. `@theme inline` 이 `tokens.css` 변수를 가리켜 다크·라이트 전환과 "raw hex 금지"가 U1 규칙 그대로 유지된다. `layout.css` 무수정 |
| **F-2** 공유 유틸 소유자 없음 | ✅ 해소 | `packages/lib/src/crypto` · `src/http` 신설 (U1 승인 대상) |
| **F-3** `design/` 구 Stage 체계 | ✅ 해소 | `08-sr-registration-ui.md` 를 따름. 매핑을 `status-badge.ts` 에 명시. **`design/` 문서 미수정** |
| **F-4** 커버리지가 `apps/` 미포함 | ✅ 해소 | include 확장. 실제로 실패시킨 뒤 테스트로 통과시킴 |
| **F-5** chart 에 `S3_*` 없음 | ✅ 해소 | `portal.yaml` + `values.yaml`. 키는 Secret, 접속 정보는 values |
| **F-6** 웹 터미널 | ⏸ 범위 밖 | 만들지 않음. "중지" 버튼만 구현 |
| **F-7** 보상 진입점 계약 부재 | ⚠️ **신규 · 미해소** | 아래 참조 |
| **F-8** 이미지 토큰 상태 코드 모순 | ⚠️ **신규 · 기록만** | 아래 참조 |

### ⚠️ F-7 — `contracts` 에 보상 트랜잭션 진입점이 없다 (신규)

`03-state-machine.md` §1.2 는 접수 실패를 대기 상태로 남기지 말고 보상 트랜잭션으로
`X_FAILED` 처리하라고 정하고, §6 이 `compensateFailedSdlc(requestNo)` 를 그 진입점으로 규정한다.
구현은 U3 `CompensationHandler`(C-3.4) 소유다.

그런데 **PR #1 동결 목록(`contracts/factory.ts`·`ports.ts`·`state.ts`)에 이 계약이 없다.**
U2 는 `/intake` 실패 시 그것을 불러야 하므로 `request/intake-service.ts` 안에
`CompensationPort` 를 **임시로** 선언했고, `deps.ts` 는 아무것도 하지 않는 stub 을 주입한다.
접수 실패는 성공을 가장하지 않고 500 을 돌려준다.

**필요한 조치**: U3 T1 구현 시 이 인터페이스를 `packages/contracts/ports.ts` 로 옮기고
U2 의 임시 선언을 지운다. 인터페이스 소유자는 U1 이므로(AD-4) **U1 승인 대상**이다.
지금 contracts 를 직접 고치지 않은 이유가 그것이다.

### ⚠️ F-8 — 이미지 토큰 실패 상태 코드가 스토리와 명세에서 다르다 (신규)

| 출처 | 값 |
|------|-----|
| US-U2-07 인수 조건 | 토큰 없음·만료 → **403** |
| `05-portal-api.md` §2.11 오류 표 | **401** |
| `05-portal-api.md` §7 매핑 관례 | 인증 실패 = 401 / 권한 부족 = 403 |
| U1 `verifyImageToken` 구현 | **401** |

세 근거가 401 을 가리키고 스토리 하나만 403 이다. Q5=A(명세 우선)에 따라 **401 을 구현했다.**
스토리 문서도 API 명세도 고치지 않았다 — 어느 쪽을 정정할지는 사용자 판단이다.

---

## 5. 명세에서 의도적으로 벗어난 것

| 항목 | 명세 | 구현 | 이유 |
|------|------|------|------|
| 등록 실패 알림 | `Toast` (§9 컴포넌트 목록) | 인라인 `Alert` | 성공은 상세로 리다이렉트하므로 화면에 남는 메시지는 오류뿐이다. 오류를 폼 옆에 붙이는 편이 낫고 컴포넌트도 하나 줄었다 |
| Issue 생성 오류 키 | §2.4 예시는 `{ "error": ... }` | `{ code, message, details }` | §7 이 "모든 에러는 표준 포맷"이라고 정한다. 더 일반적인 §7 을 따르고 repo 는 `details` 에 실었다 |
| 암호화 키 환경변수 | **없음** — §7 표에 항목이 없다 | `SDLC_SECRET_ENCRYPTION_KEY` → `AUTH_SECRET` 폴백 | `SDLC_IMAGE_SIGNING_SECRET` 이 "비면 AUTH_SECRET 재사용"으로 규정된 것과 같은 방식. 이름 확정은 사용자 판단 |

---

## 6. U3 로 넘기는 것

1. **B-1 · B-3 교체 지점은 `features/u2-core-mgmt/deps.ts` 세 줄**이다.
   `factory` · `podPort` · `stateReader` 를 실제 구현으로 바꾸면 U2 코드는 손대지 않아도 된다.
2. **stub 2건의 필수 조건이 코드에 박혀 있다.** `SdlcRequestFactoryStub` 은 각인된
   `metadata` 를 반환하고(테스트가 고정), `StateMachineReaderStub` 은 Reader 만 구현한다
   (`advance` 가 없으므로 U2 코드가 그것을 부를 수조차 없다).
3. **`GitHubPort` 구현이 준비됐다** — U3 는 `4 -> 9` 진입 작업에서 이것을 타입으로만 호출하면 된다.
   `ensurePullRequest` 의 `null` 반환 경로가 테스트로 고정돼 있다.
4. **`POST /api/v1/sdlc/advance` 는 U3 소유다.** SR 상세의 "중지" 버튼이 그 엔드포인트를
   호출하며, 없는 동안에는 화면에 "전이 엔드포인트가 아직 배포되지 않았다"고 표시한다.
5. **F-7 을 contracts 로 승격해야 한다** (위 참조).
