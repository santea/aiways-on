import { describe, expect, it, vi } from 'vitest';
import { emailFingerprint, fetchPrimaryEmail } from '../github-email';

const jsonRes = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response;

describe('GitHub primary email 보강', () => {
  it('primary 이면서 verified 인 주소를 고른다', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes([
        { email: 'alt@example.com', primary: false, verified: true },
        { email: 'main@example.com', primary: true, verified: true },
      ]),
    );
    await expect(fetchPrimaryEmail('tok', fetchImpl as unknown as typeof fetch)).resolves.toBe(
      'main@example.com',
    );
  });

  it('primary 가 verified 가 아니면 고르지 않는다', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes([
        { email: 'unverified@example.com', primary: true, verified: false },
        { email: 'first@example.com', primary: false, verified: true },
      ]),
    );
    // 조건을 만족하는 항목이 없으면 첫 항목으로 물러난다
    await expect(fetchPrimaryEmail('tok', fetchImpl as unknown as typeof fetch)).resolves.toBe(
      'unverified@example.com',
    );
  });

  it('목록이 비면 null 을 돌려준다', async () => {
    const fetchImpl = vi.fn(async () => jsonRes([]));
    await expect(fetchPrimaryEmail('tok', fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('API 가 실패하면 null 을 돌려준다 — 로그인을 막지 않는다', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(null, false));
    await expect(fetchPrimaryEmail('tok', fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('토큰을 Bearer 헤더로 보낸다', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes([]));
    await fetchPrimaryEmail('secret-token', fetchImpl as unknown as typeof fetch);
    const call = fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe('https://api.github.com/user/emails');
    expect(call?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });
});

describe('로그용 지문', () => {
  it('원문을 그대로 노출하지 않는다 (01-auth-github.md §6.2)', () => {
    const fp = emailFingerprint('someone@example.com');
    expect(fp).not.toContain('someone');
    expect(fp).not.toContain('@');
    expect(fp).toHaveLength(16);
  });

  it('같은 입력에는 같은 지문이 나온다', () => {
    expect(emailFingerprint('a@b.c')).toBe(emailFingerprint('a@b.c'));
    expect(emailFingerprint('a@b.c')).not.toBe(emailFingerprint('d@e.f'));
  });
});
