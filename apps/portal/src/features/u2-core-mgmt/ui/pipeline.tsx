import type { DevSubStageState, PipelineProfile, Stage } from '@aiways/contracts';
import { DEV_SUBSTAGE_ORDER } from '@aiways/lib/domain';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  flowStepState,
  stageBadgeTone,
  stageLabel,
  stageOrdinal,
  visibleStageFlow,
} from '../status-badge';

export function StatusBadge({ stage }: { stage: Stage }) {
  return (
    <Badge tone={stageBadgeTone(stage)} data-testid={`status-badge-${stage}`}>
      {stageLabel(stage)}
    </Badge>
  );
}

const STEP_CLASS = {
  done: 'bg-success-wash text-success',
  current: 'bg-accent-wash text-accent',
  pending: 'bg-surface-2 text-ink-faint',
  failed: 'bg-error-wash text-error',
} as const;

/**
 * 단계 전이 Flow — `08-sr-registration-ui.md` §6.2.
 *
 * Stage `5`·`6`·`7`·`8` 은 존재하지 않으므로 렌더링하지 않는다 (D-05, R-04).
 * incident·improvement 프로파일은 요구사항·설계를 건너뛴 `1 -> 4 -> 9` 로 그린다.
 */
export function StageFlow({ current, profile }: { current: Stage; profile: PipelineProfile }) {
  const flow = visibleStageFlow(profile);
  return (
    <ol
      className="flex flex-wrap items-stretch gap-1.5"
      data-testid="stage-flow"
      aria-label="단계 진행"
    >
      {flow.map((step) => {
        const state = flowStepState(step, current, flow);
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state}
            data-testid={`stage-flow-step-${step}`}
            className={cn(
              'flex min-w-[7.5rem] flex-1 flex-col gap-1 rounded-[var(--radius-token)] px-3 py-2.5',
              STEP_CLASS[state],
              // 현재 단계만 맥동한다 — design §6.6. 감속 설정은 globals.css 가 존중한다.
              state === 'current' && 'animate-pulse',
            )}
          >
            <span className="font-mono-id text-[10px] font-bold tracking-[0.08em]">
              {stageOrdinal(step)}
            </span>
            <span className="text-[13px] font-semibold">{stageLabel(step)}</span>
          </li>
        );
      })}
    </ol>
  );
}

const SUBSTAGE_LABEL: Record<string, string> = {
  dev: 'dev',
  qa: 'qa',
  code_review: 'code_review',
  security_review: 'security_review',
};

/** DevSubStage 진행 — Stage 4 에서만 표시한다 (`08-sr-registration-ui.md` §6.4). */
export function DevSubStageSteps({ state }: { state: DevSubStageState | null }) {
  if (!state) return null;
  const completed = new Set(state.history.map((h) => h.stage));

  return (
    <ol className="flex flex-wrap gap-1.5" data-testid="dev-substage-steps">
      {DEV_SUBSTAGE_ORDER.map((sub) => {
        const status = completed.has(sub) ? 'done' : sub === state.current ? 'current' : 'pending';
        return (
          <li
            key={sub}
            data-state={status}
            data-testid={`dev-substage-${sub}`}
            className={cn(
              'rounded-[var(--radius-token)] px-2.5 py-1.5 font-mono-id text-[11px] font-bold',
              STEP_CLASS[status],
            )}
          >
            {SUBSTAGE_LABEL[sub]}
          </li>
        );
      })}
    </ol>
  );
}
