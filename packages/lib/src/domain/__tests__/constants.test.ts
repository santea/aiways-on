import { describe, expect, it } from 'vitest';
import {
  CHANNEL_TYPES,
  DEV_SUBSTAGE_ORDER,
  PROFILE_CHANNELS,
  PROFILE_CHANNEL_PREFIX,
  STAGE_VALUES,
  TERMINAL_STAGES,
  isStage,
  isTerminalStage,
} from '../constants';

describe('Stage 값 집합', () => {
  it('5·6·7·8 단계를 만들지 않는다 (D-05, R-04)', () => {
    for (const forbidden of ['5', '6', '7', '8']) {
      expect(STAGE_VALUES.some((s) => s.startsWith(`${forbidden}_`))).toBe(false);
    }
  });

  it('정상 진행 단계는 1·2·3·4·9 다섯 개다', () => {
    expect(STAGE_VALUES.filter((s) => !s.startsWith('X_'))).toEqual([
      '1_REGISTERED',
      '2_REQUIREMENTS_IN_PROGRESS',
      '3_DEV_DESIGN_IN_PROGRESS',
      '4_DEV_IN_PROGRESS',
      '9_COMPLETE',
    ]);
  });

  it('종료 상태를 정확히 판정한다', () => {
    expect(isTerminalStage('9_COMPLETE')).toBe(true);
    expect(isTerminalStage('X_FAILED')).toBe(true);
    expect(isTerminalStage('1_REGISTERED')).toBe(false);
  });

  it('알 수 없는 문자열을 Stage 로 인정하지 않는다', () => {
    expect(isStage('1_REGISTERED')).toBe(true);
    expect(isStage('5_TESTING')).toBe(false);
    expect(isStage('')).toBe(false);
  });

  it('TERMINAL_STAGES 는 STAGE_VALUES 의 부분집합이다', () => {
    for (const t of TERMINAL_STAGES) expect(STAGE_VALUES).toContain(t);
  });
});

describe('프로파일 정책 표 (AD-3 각인의 근거)', () => {
  it('feature 는 채널 3종을 만든다', () => {
    expect(PROFILE_CHANNELS.feature).toEqual(['requirements', 'design', 'dev']);
  });

  it('incident 와 improvement 는 dev 채널 1개만 만든다', () => {
    expect(PROFILE_CHANNELS.incident).toEqual(['dev']);
    expect(PROFILE_CHANNELS.improvement).toEqual(['dev']);
  });

  it('모든 채널 값이 ChannelType 집합 안에 있다', () => {
    for (const list of Object.values(PROFILE_CHANNELS)) {
      for (const c of list) expect(CHANNEL_TYPES).toContain(c);
    }
  });

  it('프로파일마다 접두가 서로 다르다', () => {
    const prefixes = Object.values(PROFILE_CHANNEL_PREFIX);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe('DevSubStage 순서', () => {
  it('dev → qa → code_review → security_review 순이다', () => {
    expect(DEV_SUBSTAGE_ORDER).toEqual(['dev', 'qa', 'code_review', 'security_review']);
  });
});
