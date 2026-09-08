import { AuthError } from '@aiways/lib/auth';
import { describe, expect, it, vi } from 'vitest';
import type { GithubAdminService } from '../admin-service';
import {
  createCredentialsHandlers,
  createOrgsHandlers,
  createReposHandlers,
} from '../handlers';

const admin = { id: 'u-admin', role: 'admin' as const, login: 'admin', email: null };

function deps(overrides: Partial<GithubAdminService> = {}, isAdmin = true) {
  const service = {
    listOrgs: vi.fn(async () => [{ id: 'org-1', orgName: 'org' }]),
    listRepos: vi.fn(async () => [{ id: 'repo-1', repoName: 'portal' }]),
    createCredential: vi.fn(async () => ({
      id: 'cred-1',
      gitUserName: 'sdlc',
      gitUserEmail: 'sdlc@example.com',
    })),
    registerOrg: vi.fn(async () => ({ id: 'org-1', orgName: 'org' })),
    registerRepo: vi.fn(async () => ({ id: 'repo-1', repoName: 'portal' })),
    ...overrides,
  } as unknown as GithubAdminService;

  const requireAdmin = vi.fn(async () => {
    if (!isAdmin) throw new AuthError(403, 'FORBIDDEN', '관리자 권한이 필요하다');
    return admin;
  });

  return { service, requireAdmin, handlerDeps: { requireAdmin, service: () => service } };
}

const post = (body: unknown) =>
  new Request('http://portal/api/v1/sdlc/orgs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('관리자 라우트는 전부 requireAdmin 을 통과한다 (C-2.4)', () => {
  it('GET /orgs 는 admin 만 통과한다', async () => {
    const { handlerDeps, requireAdmin } = deps();
    const res = await createOrgsHandlers(handlerDeps).GET(
      new Request('http://portal/api/v1/sdlc/orgs'),
    );
    expect(res.status).toBe(200);
    expect(requireAdmin).toHaveBeenCalled();
  });

  it('user 권한은 403 이고 §7 포맷이다', async () => {
    const { handlerDeps } = deps({}, false);
    const res = await createOrgsHandlers(handlerDeps).GET(
      new Request('http://portal/api/v1/sdlc/orgs'),
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('POST /credentials 도 admin 전용이다', async () => {
    const { handlerDeps } = deps({}, false);
    const res = await createCredentialsHandlers(handlerDeps).POST(post({ pat: 'x' }));
    expect(res.status).toBe(403);
  });

  it('POST /repos 도 admin 전용이다', async () => {
    const { handlerDeps } = deps({}, false);
    const res = await createReposHandlers(handlerDeps).POST(post({}));
    expect(res.status).toBe(403);
  });
});

describe('GET /repos', () => {
  it('orgId 쿼리를 서비스로 넘긴다', async () => {
    const { handlerDeps, service } = deps();
    await createReposHandlers(handlerDeps).GET(
      new Request('http://portal/api/v1/sdlc/repos?orgId=org-9'),
    );
    expect(service.listRepos).toHaveBeenCalledWith('org-9');
  });

  it('orgId 가 없으면 null 로 넘긴다 (전체 조회)', async () => {
    const { handlerDeps, service } = deps();
    await createReposHandlers(handlerDeps).GET(
      new Request('http://portal/api/v1/sdlc/repos'),
    );
    expect(service.listRepos).toHaveBeenCalledWith(null);
  });
});

describe('POST 라우트', () => {
  it('생성은 201 을 돌려준다', async () => {
    const { handlerDeps } = deps();
    const res = await createOrgsHandlers(handlerDeps).POST(
      post({ orgUrl: 'https://github.com/org', orgName: 'org' }),
    );
    expect(res.status).toBe(201);
  });

  it('repo 등록은 요청자 id 를 함께 넘긴다 (셋업 잡 추적용)', async () => {
    const { handlerDeps, service } = deps();
    await createReposHandlers(handlerDeps).POST(post({ orgId: 'org-1' }));
    expect(service.registerRepo).toHaveBeenCalledWith({ orgId: 'org-1' }, 'u-admin');
  });

  it('본문이 JSON 이 아니면 500 이 아니라 400 이다', async () => {
    const { handlerDeps } = deps();
    const res = await createOrgsHandlers(handlerDeps).POST(
      new Request('http://portal/api/v1/sdlc/orgs', { method: 'POST', body: '{{{' }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('서비스가 알 수 없는 오류를 던지면 내부 정보를 노출하지 않는다', async () => {
    const { handlerDeps } = deps({
      registerOrg: vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
      }) as never,
    });
    const res = await createOrgsHandlers(handlerDeps).POST(post({ orgName: 'org' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });
});
