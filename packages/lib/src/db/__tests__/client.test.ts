import { describe, expect, it } from 'vitest';
import { getDb } from '../client';

describe('DB 연결', () => {
  it('DATABASE_URL 이 없으면 조용히 넘어가지 않고 실패한다', () => {
    expect(() => getDb(undefined)).toThrow(/DATABASE_URL/);
  });

  it('빈 문자열도 미설정으로 본다', () => {
    expect(() => getDb('')).toThrow(/DATABASE_URL/);
  });
});
