import type { Stage } from '@aiways/contracts';
import { STAGE_VALUES } from '@aiways/lib/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_BUCKETS,
  bucketOfStage,
  stageBadgeTone,
  stageLabel,
  visibleStageFlow,
} from '../status-badge';

describe('stageBadgeTone — F-3 확정표', () => {
  it.each([
    ['1_REGISTERED', 'accent'],
    ['2_REQUIREMENTS_IN_PROGRESS', 'accent'],
    ['3_DEV_DESIGN_IN_PROGRESS', 'accent'],
    ['4_DEV_IN_PROGRESS', 'accent'],
    ['9_COMPLETE', 'success'],
    ['X_STOPPED', 'warning'],
    ['X_FAILED', 'error'],
  ] as const)('%s → %s', (stage, tone) => {
    expect(stageBadgeTone(stage)).toBe(tone);
  });

  it('PBT: 모든 Stage 값이 매핑을 갖는다 — 빠진 값이 없다', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STAGE_VALUES), (stage) => {
        expect(['accent', 'success', 'warning', 'error', 'neutral']).toContain(
          stageBadgeTone(stage),
        );
        expect(stageLabel(stage).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

describe('bucketOfStage — 대시보드 3카드', () => {
  it('카드는 진행·완료·실패 3장이다 — design §4.2 의 "대기" 카드는 0_QUEUED 가 없으므로 만들지 않는다', () => {
    expect(DASHBOARD_BUCKETS.map((b) => b.key)).toEqual(['active', 'complete', 'failed']);
  });

  it('non-terminal 은 진행으로 묶인다', () => {
    expect(bucketOfStage('1_REGISTERED')).toBe('active');
    expect(bucketOfStage('4_DEV_IN_PROGRESS')).toBe('active');
  });

  it('9_COMPLETE 는 완료, X_* 는 실패다', () => {
    expect(bucketOfStage('9_COMPLETE')).toBe('complete');
    expect(bucketOfStage('X_FAILED')).toBe('failed');
    expect(bucketOfStage('X_STOPPED')).toBe('failed');
  });

  it('PBT: 모든 Stage 는 정확히 한 버킷에 속한다', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STAGE_VALUES), (stage) => {
        const bucket = bucketOfStage(stage);
        expect(DASHBOARD_BUCKETS.filter((b) => b.key === bucket)).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe('visibleStageFlow — D-05 · R-04', () => {
  it('feature 는 1→2→3→4→9 다섯 단계다', () => {
    expect(visibleStageFlow('feature')).toEqual([
      '1_REGISTERED',
      '2_REQUIREMENTS_IN_PROGRESS',
      '3_DEV_DESIGN_IN_PROGRESS',
      '4_DEV_IN_PROGRESS',
      '9_COMPLETE',
    ]);
  });

  it('incident·improvement 는 요구사항·설계를 건너뛴 1→4→9 다', () => {
    expect(visibleStageFlow('incident')).toEqual([
      '1_REGISTERED',
      '4_DEV_IN_PROGRESS',
      '9_COMPLETE',
    ]);
    expect(visibleStageFlow('improvement')).toEqual(visibleStageFlow('incident'));
  });

  it('Stage 5·6·7·8 은 어떤 프로파일에서도 나타나지 않는다', () => {
    const banned = ['5', '6', '7', '8'];
    for (const profile of ['feature', 'incident', 'improvement'] as const) {
      for (const stage of visibleStageFlow(profile)) {
        expect(banned).not.toContain((stage as Stage).charAt(0));
      }
    }
  });
});
