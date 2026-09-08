/**
 * StateMachine 조회·갱신 계약 — B-3.
 *
 * **소유는 U3 단독.** U2 의 `RequestQuery` 는 이 계약을 **읽기 전용**으로 소비하며
 * `setSubStage` 를 호출하지 않는다.
 *
 * 근거: requirements/03-state-machine.md §1~§3, §7
 */
import type { StageTransition } from './dto';
import type { DevSubStage, DevSubStageState, Stage } from './stage';

/** CAS 실패. 현재 상태가 기대와 다르면 전이는 일어나지 않는다. */
export interface StaleFromError {
  readonly code: 'STALE_FROM';
  readonly expected: Stage;
  readonly actual: Stage;
}

export type AdvanceResult =
  | { readonly ok: true; readonly from: Stage; readonly to: Stage }
  | { readonly ok: false; readonly error: StaleFromError }
  | { readonly ok: false; readonly error: { readonly code: 'ILLEGAL_TRANSITION' } };

export interface StateMachineReader {
  getStage(requestId: string): Promise<Stage | null>;
  getSubStage(requestId: string): Promise<DevSubStageState | null>;
  getTransitions(requestId: string): Promise<readonly StageTransition[]>;
}

export interface StateMachineWriter {
  /** Compare-And-Swap. `from` 이 현재 상태와 다르면 전이하지 않는다. */
  advance(input: {
    requestId: string;
    from: Stage;
    to: Stage;
    idempotencyKey: string;
    actor: string;
  }): Promise<AdvanceResult>;

  setSubStage(input: { requestId: string; subStage: DevSubStage }): Promise<void>;
}

export interface StateMachine extends StateMachineReader, StateMachineWriter {}

/** 전이 합법성 판정 — 순수 함수. PBT 대상 (NFR-23, US-U3-02). */
export type IsLegalTransition = (from: Stage, to: Stage) => boolean;
