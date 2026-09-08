import { describe, expect, it } from 'vitest';
import {
  nextSequenceFrom,
  offsetOf,
  readStage,
  readStampedProfile,
  toIso,
} from '../row-mapping';

describe('toIso', () => {
  it('Date 를 ISO 문자열로 바꾼다', () => {
    expect(toIso(new Date('2026-09-01T10:00:00.000Z'))).toBe('2026-09-01T10:00:00.000Z');
  });

  it('이미 문자열이면 그대로 둔다', () => {
    expect(toIso('2026-09-01T10:00:00.000Z')).toBe('2026-09-01T10:00:00.000Z');
  });

  it('null·undefined·빈 문자열은 epoch 다 — 화면이 죽지 않게 한다', () => {
    const epoch = new Date(0).toISOString();
    expect(toIso(null)).toBe(epoch);
    expect(toIso(undefined)).toBe(epoch);
    expect(toIso('')).toBe(epoch);
  });
});

describe('readStampedProfile — 각인된 값을 읽기만 한다 (AD-3)', () => {
  it('각인된 프로파일을 그대로 돌려준다', () => {
    expect(readStampedProfile({ profile: 'incident' })).toBe('incident');
    expect(readStampedProfile({ profile: 'improvement' })).toBe('improvement');
  });

  it('각인이 없으면 feature 로 본다 (표시용 기본값)', () => {
    expect(readStampedProfile({})).toBe('feature');
  });

  it('알 수 없는 값도 feature 로 좁힌다 — 임의 문자열이 화면으로 새지 않게 한다', () => {
    expect(readStampedProfile({ profile: 'hacked' })).toBe('feature');
    expect(readStampedProfile({ profile: 42 })).toBe('feature');
  });
});

describe('readStage', () => {
  it('값이 있으면 그대로 쓴다', () => {
    expect(readStage('9_COMPLETE')).toBe('9_COMPLETE');
  });

  it('비면 기본 단계로 떨어진다', () => {
    expect(readStage(null)).toBe('1_REGISTERED');
    expect(readStage(undefined, 'X_FAILED')).toBe('X_FAILED');
  });
});

describe('offsetOf · nextSequenceFrom', () => {
  it('1페이지는 오프셋 0 이다', () => {
    expect(offsetOf(1, 20)).toBe(0);
    expect(offsetOf(3, 20)).toBe(40);
  });

  it('0·음수 페이지는 음수 오프셋을 만들지 않는다', () => {
    expect(offsetOf(0, 20)).toBe(0);
    expect(offsetOf(-5, 20)).toBe(0);
  });

  it('일련번호는 기존 개수 + 1 이다', () => {
    expect(nextSequenceFrom(0)).toBe(1);
    expect(nextSequenceFrom(3)).toBe(4);
    expect(nextSequenceFrom(-1)).toBe(1);
  });
});
