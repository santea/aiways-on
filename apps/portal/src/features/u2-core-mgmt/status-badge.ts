/**
 * 상태 표시 매핑 — F-3 해소 지점.
 *
 * `design/` §5.1 배지표와 §6.2 Flow 는 `5_READY_FOR_DEPLOY`·`7_DEV_SERVER_TEST`·
 * `8_COMPLETED`·`0_QUEUED` 를 쓰는 **구 Stage 체계**다. D-05·R-04 가 그 값들을 없앴고
 * `contracts/stage.ts` 에도 없다. Q5=A(명세 우선)에 따라 이미 `1-2-3-4-9` 로 갱신된
 * `08-sr-registration-ui.md` §5.2·§6.2 를 따르며, 아래 표가 그 적용 결과다.
 * `design/` 문서 자체는 고치지 않았다 — 정리 여부는 사용자 판단이다.
 */
import type { PipelineProfile, Stage } from '@aiways/contracts';
import type { BadgeTone } from '@/components/ui/badge';

const STAGE_TONE: Record<Stage, BadgeTone> = {
  '1_REGISTERED': 'accent',
  '2_REQUIREMENTS_IN_PROGRESS': 'accent',
  '3_DEV_DESIGN_IN_PROGRESS': 'accent',
  '4_DEV_IN_PROGRESS': 'accent',
  '9_COMPLETE': 'success',
  X_STOPPED: 'warning',
  X_FAILED: 'error',
};

const STAGE_LABEL: Record<Stage, string> = {
  '1_REGISTERED': '등록',
  '2_REQUIREMENTS_IN_PROGRESS': '요구사항',
  '3_DEV_DESIGN_IN_PROGRESS': '설계',
  '4_DEV_IN_PROGRESS': '개발',
  '9_COMPLETE': '완료',
  X_STOPPED: '중지',
  X_FAILED: '실패',
};

/** Flow 에서 단계 앞에 붙는 순번 표기 — `08-sr-registration-ui.md` §6.2 */
const STAGE_ORDINAL: Partial<Record<Stage, string>> = {
  '1_REGISTERED': '1',
  '2_REQUIREMENTS_IN_PROGRESS': '2',
  '3_DEV_DESIGN_IN_PROGRESS': '3',
  '4_DEV_IN_PROGRESS': '4',
  '9_COMPLETE': '9',
};

export function stageBadgeTone(stage: Stage): BadgeTone {
  return STAGE_TONE[stage] ?? 'neutral';
}

export function stageLabel(stage: Stage): string {
  return STAGE_LABEL[stage] ?? stage;
}

export function stageOrdinal(stage: Stage): string {
  return STAGE_ORDINAL[stage] ?? '';
}

export type DashboardBucket = 'active' | 'complete' | 'failed';

/**
 * 대시보드 진행 현황 카드 — **3장**.
 * `design/` §4.2 의 "대기" 카드는 `0_QUEUED` 가 없고 대기 큐 자체가 제거됐으므로
 * (`03-state-machine.md` §1.2) 만들지 않는다. `08-sr-registration-ui.md` §5.2 와 일치한다.
 */
export const DASHBOARD_BUCKETS = [
  { key: 'active', label: '진행', tone: 'accent' },
  { key: 'complete', label: '완료', tone: 'success' },
  { key: 'failed', label: '실패', tone: 'error' },
] as const satisfies readonly { key: DashboardBucket; label: string; tone: BadgeTone }[];

export function bucketOfStage(stage: Stage): DashboardBucket {
  if (stage === '9_COMPLETE') return 'complete';
  if (stage === 'X_FAILED' || stage === 'X_STOPPED') return 'failed';
  return 'active';
}

const FEATURE_FLOW = [
  '1_REGISTERED',
  '2_REQUIREMENTS_IN_PROGRESS',
  '3_DEV_DESIGN_IN_PROGRESS',
  '4_DEV_IN_PROGRESS',
  '9_COMPLETE',
] as const satisfies readonly Stage[];

/** incident·improvement 는 요구사항·설계를 건너뛴다 (`08-sr-registration-ui.md` §6.2). */
const SHORT_FLOW = [
  '1_REGISTERED',
  '4_DEV_IN_PROGRESS',
  '9_COMPLETE',
] as const satisfies readonly Stage[];

/** Stage `5`·`6`·`7`·`8` 은 어떤 프로파일에서도 렌더링되지 않는다 (D-05, R-04). */
export function visibleStageFlow(profile: PipelineProfile): readonly Stage[] {
  return profile === 'feature' ? FEATURE_FLOW : SHORT_FLOW;
}

export type FlowStepState = 'done' | 'current' | 'pending' | 'failed';

/** 현재 상태를 기준으로 각 단계의 표시 상태를 정한다 (design §6.6). */
export function flowStepState(step: Stage, current: Stage, flow: readonly Stage[]): FlowStepState {
  if (current === 'X_FAILED' || current === 'X_STOPPED') {
    // 실패·중지는 어디서 멈췄는지 모르므로 완료 표시를 만들지 않는다.
    return step === flow[0] ? 'done' : 'failed';
  }
  const currentIndex = flow.indexOf(current);
  const stepIndex = flow.indexOf(step);
  if (currentIndex < 0 || stepIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  return stepIndex === currentIndex ? 'current' : 'pending';
}
