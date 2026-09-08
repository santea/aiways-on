/**
 * `@aiways/contracts` 의 **런타임 대응물**.
 *
 * contracts 는 타입 전용이라 값이 없다. 실행 시점에 필요한 상수는 여기 둔다.
 * `satisfies` 로 contracts 의 타입에 묶여 있으므로, 타입이 바뀌면 여기서 typecheck 가 깨진다
 * — 두 곳이 조용히 어긋나지 않는다.
 */
import type {
  ChannelType,
  DevSubStage,
  PipelineProfile,
  ProfileChannelMap,
  Stage,
  TerminalStage,
} from '@aiways/contracts';

/** ⚠️ `5`·`6`·`7`·`8` 은 존재하지 않는다 (D-05, R-04). */
export const STAGE_VALUES = [
  '1_REGISTERED',
  '2_REQUIREMENTS_IN_PROGRESS',
  '3_DEV_DESIGN_IN_PROGRESS',
  '4_DEV_IN_PROGRESS',
  '9_COMPLETE',
  'X_STOPPED',
  'X_FAILED',
] as const satisfies readonly Stage[];

export const TERMINAL_STAGES = [
  '9_COMPLETE',
  'X_STOPPED',
  'X_FAILED',
] as const satisfies readonly TerminalStage[];

export const CHANNEL_TYPES = [
  'requirements',
  'design',
  'dev',
] as const satisfies readonly ChannelType[];

export const PIPELINE_PROFILES = [
  'feature',
  'incident',
  'improvement',
] as const satisfies readonly PipelineProfile[];

/** 근거: requirements/03-state-machine.md §7.1 — 순서가 곧 실행 순서다. */
export const DEV_SUBSTAGE_ORDER = [
  'dev',
  'qa',
  'code_review',
  'security_review',
] as const satisfies readonly DevSubStage[];

/**
 * 프로파일별 채널 구성. **Factory 가 SR 에 각인할 때 참조하는 표** (AD-3).
 * incident·improvement 는 dev 채널 1개만 만든다.
 */
export const PROFILE_CHANNELS = {
  feature: ['requirements', 'design', 'dev'],
  incident: ['dev'],
  improvement: ['dev'],
} as const satisfies ProfileChannelMap;

/** 채널명 접두 — PBT 대상인 채널명 생성 규칙의 입력. */
export const PROFILE_CHANNEL_PREFIX = {
  feature: 'sr-',
  incident: 'inc-',
  improvement: 'imp-',
} as const satisfies { readonly [P in PipelineProfile]: string };

export function isTerminalStage(stage: Stage): boolean {
  return (TERMINAL_STAGES as readonly Stage[]).includes(stage);
}

export function isStage(value: string): value is Stage {
  return (STAGE_VALUES as readonly string[]).includes(value);
}
