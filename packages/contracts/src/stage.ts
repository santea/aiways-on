/**
 * SDLC 파이프라인의 상태·채널·프로파일 타입.
 *
 * ⚠️ 불변 규약 (D-05, R-04): Stage 에 `5`·`6`·`7`·`8` 값을 추가하지 않는다.
 *    구 체계의 5·7 단계는 이 시스템에 존재하지 않으며, n8n 워크플로우도
 *    아래 값 집합만 사용한다.
 *
 * 근거: requirements/03-state-machine.md §1, requirements/04-db-schema.md §3.1
 */

/** SR 의 진행 단계. DB 에는 `sdlc_requests.status` VARCHAR(50) 으로 저장된다. */
export type Stage =
  | '1_REGISTERED'
  | '2_REQUIREMENTS_IN_PROGRESS'
  | '3_DEV_DESIGN_IN_PROGRESS'
  | '4_DEV_IN_PROGRESS'
  | '9_COMPLETE'
  | 'X_STOPPED'
  | 'X_FAILED';

/** 정상 진행 단계 (종료 상태 제외). */
export type ActiveStage = Extract<
  Stage,
  '1_REGISTERED' | '2_REQUIREMENTS_IN_PROGRESS' | '3_DEV_DESIGN_IN_PROGRESS' | '4_DEV_IN_PROGRESS'
>;

/** 더 이상 전이가 일어나지 않는 종료 상태. */
export type TerminalStage = Extract<Stage, '9_COMPLETE' | 'X_STOPPED' | 'X_FAILED'>;

/** 메시징 채널 종류. 프로파일에 따라 생성 개수가 달라진다. */
export type ChannelType = 'requirements' | 'design' | 'dev';

/** 파이프라인 프로파일. SR 이 어디서 생성됐는지에 따라 정책이 달라진다. */
export type PipelineProfile = 'feature' | 'incident' | 'improvement';

/**
 * `4_DEV_IN_PROGRESS` 내부의 서브스테이지.
 * 근거: requirements/03-state-machine.md §7.1
 */
export type DevSubStage = 'dev' | 'qa' | 'code_review' | 'security_review';

/** `sdlc_requests.metadata.devSubStage` 구조. */
export interface DevSubStageState {
  readonly current: DevSubStage;
  readonly history: readonly { readonly stage: DevSubStage; readonly completedAt: string }[];
}

/**
 * Factory 가 SR 에 각인하는 프로파일 정책 (AD-3).
 *
 * U3 의 `4→9` 전이는 이 값을 **읽기만** 하고 프로파일을 재판정하지 않는다.
 * 그래야 incident 자동머지 금지 규칙이 U3 코드의 조건문이 아니라 데이터에 각인된 값이 된다.
 */
export interface StampedPolicy {
  /** 생성할 채널 종류. feature=3종, incident/improvement=dev 1종. */
  readonly channelTypes: readonly ChannelType[];
  /** PR 자동머지 허용 여부. incident 는 repo 설정과 무관하게 항상 false. */
  readonly autoMergeAllowed: boolean;
}

/** `sdlc_requests.metadata` 의 알려진 필드. 그 외 키는 자유. */
export interface SdlcRequestMetadata extends Partial<StampedPolicy> {
  readonly devSubStage?: DevSubStageState;
  readonly [key: string]: unknown;
}
