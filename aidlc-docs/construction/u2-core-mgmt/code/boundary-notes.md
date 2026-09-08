# U2 경계 노트 — B-1 · B-2 · B-3 · B-4

> U3·U4·U5 담당자가 U2 와 연결할 때 읽는 문서.
> 계약 원본은 `packages/contracts/`, U1 계약 안내는 `../../u1-shared-foundation/code/interfaces.md`.

## 1. U2 가 **제공**하는 것 — B-2

```ts
import type { GitHubPort } from '@aiways/contracts';
// 구현체를 직접 import 하지 않는다. 주입받은 GitHubPort 타입으로만 호출한다.
```

| 메서드 | 계약 |
|--------|------|
| `ensureIssue` | 멱등. 같은 제목의 Issue 가 있으면 만들지 않고 그것을 돌려준다 |
| `ensurePullRequest` | 멱등. **commit 이력이 없으면 `null`** — 예외가 아니다 |
| `mergePullRequest` | 정책을 따지지 않는다. 각인된 `autoMergeAllowed` 는 **호출자**가 읽는다 (AD-3) |
| `closeIssue` · `deleteBranch` | `null` 분기의 후속 처리 |

`null` 을 받으면 Issue 를 닫고 work branch 를 지운다 — 그 분기를 구현하지 않으면
commit 없는 repo 에서 `4 -> 9` 가 조용히 멈춘다.

## 2. U2 가 **기다리는** 것 — B-1 · B-3

교체 지점은 `apps/portal/src/features/u2-core-mgmt/deps.ts` **세 줄**이다.

| 이름 | 현재 | 교체 시점 | 교체 후 확인할 것 |
|------|------|----------|------------------|
| `factory` | `createSdlcRequestFactoryStub()` | U3 T1 | 각인된 `metadata.channelTypes`·`autoMergeAllowed` 가 실제로 실려 오는가 |
| `podPort` | `createPodPortStub()` | U3 T2 | `provision` 이 멱등인가 |
| `stateReader` | `createStateMachineReaderStub()` | U3 T1 | **Reader 만 주입한다.** 전체 `StateMachine` 을 넣으면 U2 가 전이를 부를 수 있게 되어 B-3 이 풀린다 |

### stub 이 지키고 있는 두 가지 (교체해도 유지돼야 한다)

1. `SdlcRequestFactoryStub` 은 **각인된 metadata 를 반환한다.**
   반환하지 않으면 소비 유닛이 프로파일을 스스로 재판정하는 코드를 쓰게 되고 AD-3 이 무력화된다.
   `stubs/__tests__/stubs.test.ts` 가 profile 3종 각각에 대해 고정하고 있다.
2. `StateMachineReaderStub` 은 **`advance`·`setSubStage` 를 갖지 않는다.**
   테스트가 `Object.keys` 를 정확히 `['getStage','getSubStage','getTransitions']` 로 고정한다.

## 3. U2 가 **호출하지 않는** 것

- **`sdlc_requests` 직접 INSERT** — 없다. 생성은 Factory 단독 (검색으로 0건 확인)
- **상태 전이** — 없다. `advance`·`setSubStage` 호출 0건
- **자체 Bearer 비교** — 없다. 전부 `AuthGuard` 경유 (AD-2)

## 4. U3 가 만들어야 U2 화면이 완성되는 것

| 대상 | 소유 | 없을 때 U2 의 동작 |
|------|:----:|------------------|
| `POST /api/v1/sdlc/advance` | U3 | SR 상세의 "중지" 버튼이 404 를 받아 "전이 엔드포인트가 아직 배포되지 않았다"를 표시한다 |
| 보상 트랜잭션 (F-7) | U3 | 접수 실패 시 보상 stub 이 아무것도 하지 않는다. 접수는 성공을 가장하지 않고 500 이다 |
| 채널 생성 (`MessagingPort`) | U3 | SR 상세의 Slack 채널 목록이 비어 "생성된 채널이 없다"를 표시한다 |

## 5. 라우트 소유 확인표

`unit-of-work.md` §2.3 대비 실제 구현.

| 경로 | 소유 | 인증 | 구현 |
|------|:----:|------|:----:|
| `POST /intake` | U2 | master key | ✅ |
| `GET /requests` · `/requests/{id}` · `/github-links` | U2 | 세션 | ✅ |
| `POST /requests/{id}/issues` | U2 | master key | ✅ |
| `POST /requests/{id}/audit` | U2 | master key | ✅ |
| `POST /requests/{id}/channel-image` · `GET /images/{id}` | U2 | master key / 서명 토큰 | ✅ |
| `GET|POST /orgs` · `/repos` · `POST /credentials` | U2 | 세션 admin | ✅ |
| `GET /generate-request-no` · `/dev-types` | U2 | 세션 | ✅ |
| `POST /requests/{id}/dev-substage` | 라우트 U2 / **계약 U3** | master key | ⏸ U3 T1 이후 |
| `POST /advance` · `/channel-notification` · `/slack/events` | **U3** | — | ⏸ |

> `dev-substage` 는 경로가 U2 구역이지만 계약은 U3 다 (B-3). U3 T1 이 `setSubStage` 를
> 구현한 뒤 U2 가 라우트 파일을 두고 그것을 호출한다. **지금 만들지 않았다** — 지금 만들면
> U2 안에 상태 쓰기 코드가 생겨 B-3 이 깨진다.
