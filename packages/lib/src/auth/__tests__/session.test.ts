import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@aiways/contracts';
import { AuthError, isPublicPath } from '../guard';
import { createSessionGuards, resolveInitialRole } from '../session';

const user: AuthenticatedUser = { id: 'u-1', role: 'user', login: 'dev-one', email: 'a@b.c' };
const admin: AuthenticatedUser = { id: 'u-9', role: 'admin', login: 'lead', email: 'l@b.c' };

describe('세션 가드', () => {
  it('세션이 없으면 401', async () => {
    const g = createSessionGuards(async () => null);
    await expect(g.requireUser()).rejects.toThrow(AuthError);
  });

  it('로그인 사용자를 통과시킨다', async () => {
    const g = createSessionGuards(async () => user);
    await expect(g.requireUser()).resolves.toEqual(user);
  });

  it('admin 이 아니면 403 — 역할은 서버측 세션에서만 읽는다', async () => {
    const g = createSessionGuards(async () => user);
    await expect(g.requireAdmin()).rejects.toThrow(AuthError);
    try {
      await g.requireAdmin();
    } catch (e) {
      expect((e as AuthError).status).toBe(403);
    }
  });

  it('admin 을 통과시킨다', async () => {
    const g = createSessionGuards(async () => admin);
    await expect(g.requireAdmin()).resolves.toEqual(admin);
  });

  it('타인의 리소스 접근을 막는다 (IDOR 방지, NFR-12)', async () => {
    const g = createSessionGuards(async () => user);
    await expect(g.requireOwnership('someone-else')).rejects.toThrow(AuthError);
    await expect(g.requireOwnership('u-1')).resolves.toEqual(user);
  });

  it('소유자가 비어 있는 리소스는 일반 사용자에게 열지 않는다', async () => {
    const g = createSessionGuards(async () => user);
    await expect(g.requireOwnership(null)).rejects.toThrow(AuthError);
  });

  it('admin 은 타인 리소스도 조회할 수 있다', async () => {
    const g = createSessionGuards(async () => admin);
    await expect(g.requireOwnership('someone-else')).resolves.toEqual(admin);
  });
});

describe('초기 역할 부여', () => {
  it('INITIAL_ADMIN_GITHUB_LOGINS 에 있으면 admin', () => {
    expect(resolveInitialRole('lead', 'suntae88-kim,lead')).toBe('admin');
  });
  it('공백이 섞여 있어도 처리한다', () => {
    expect(resolveInitialRole('lead', ' suntae88-kim , lead ')).toBe('admin');
  });
  it('그 외는 user', () => {
    expect(resolveInitialRole('someone', 'suntae88-kim,lead')).toBe('user');
    expect(resolveInitialRole('someone', undefined)).toBe('user');
  });
  it('빈 문자열 login 을 admin 으로 만들지 않는다', () => {
    expect(resolveInitialRole('', ',,')).toBe('user');
  });
});

describe('인증 예외 경로', () => {
  it('명시된 접두만 공개다', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/v1/sdlc/images/abc')).toBe(true);
  });

  it('Bearer 인증 엔드포인트는 공개가 아니다 — 라우트 내부에서 검증한다', () => {
    expect(isPublicPath('/api/v1/sdlc/intake')).toBe(false);
    expect(isPublicPath('/api/v1/sdlc/advance')).toBe(false);
    expect(isPublicPath('/api/internal/sdlc/reconcile')).toBe(false);
  });

  it('기본은 비공개다 (deny-by-default)', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/admin/orgs')).toBe(false);
  });
});
