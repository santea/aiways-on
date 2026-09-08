import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildDedupKey, formatRequestNo, isRequestNo, parseRequestNo } from '../request-no';

describe('formatRequestNo / parseRequestNo', () => {
  it('명세 형식 SR-YYYYMMDD-NNN 을 만든다', () => {
    expect(formatRequestNo('20260901', 1)).toBe('SR-20260901-001');
    expect(formatRequestNo('20260901', 35)).toBe('SR-20260901-035');
  });

  it('999 를 넘으면 자릿수가 늘어난다 — 잘라내지 않는다', () => {
    expect(formatRequestNo('20260901', 1000)).toBe('SR-20260901-1000');
  });

  it('형식에 맞지 않는 값은 파싱되지 않는다', () => {
    expect(parseRequestNo('SR-2026-001')).toBeNull();
    expect(parseRequestNo('XX-20260901-001')).toBeNull();
    expect(parseRequestNo('')).toBeNull();
    expect(isRequestNo('SR-20260901-001')).toBe(true);
  });

  // PBT-02 — 파싱/포맷 왕복 성질
  it('PBT: parse(format(x)) === x 가 모든 유효 입력에서 성립한다', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true }),
        fc.integer({ min: 1, max: 99999 }),
        (date, seq) => {
          const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
          const parsed = parseRequestNo(formatRequestNo(ymd, seq));
          expect(parsed).toEqual({ ymd, seq });
        },
      ),
      { numRuns: 300 },
    );
  });

  // PBT-03 — 불변식: 출력은 항상 자기 자신의 판별식을 통과한다
  it('PBT: 생성된 번호는 언제나 isRequestNo 를 통과한다', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^20[0-9]{6}$/),
        fc.integer({ min: 1, max: 99999 }),
        (ymd, seq) => {
          expect(isRequestNo(formatRequestNo(ymd, seq))).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('buildDedupKey', () => {
  it('같은 입력은 같은 키를 낸다 (멱등 접수의 근거)', () => {
    const a = buildDedupKey({ requestNo: 'SR-1', submitterId: 'u1', devType: 'feature' });
    const b = buildDedupKey({ requestNo: 'SR-1', submitterId: 'u1', devType: 'feature' });
    expect(a).toBe(b);
  });

  it('입력이 다르면 키가 갈린다', () => {
    const a = buildDedupKey({ requestNo: 'SR-1', submitterId: 'u1', devType: 'feature' });
    const b = buildDedupKey({ requestNo: 'SR-2', submitterId: 'u1', devType: 'feature' });
    expect(a).not.toBe(b);
  });

  it('PBT: 같은 입력이면 항상 같은 키다 — 결정적이다', () => {
    fc.assert(
      fc.property(
        fc.record({
          requestNo: fc.string({ minLength: 1, maxLength: 30 }),
          submitterId: fc.string({ minLength: 1, maxLength: 30 }),
          devType: fc.constantFrom('feature', 'bugfix', 'refactor', 'hotfix'),
        }),
        (input) => {
          expect(buildDedupKey(input)).toBe(buildDedupKey({ ...input }));
        },
      ),
      { numRuns: 200 },
    );
  });
});
