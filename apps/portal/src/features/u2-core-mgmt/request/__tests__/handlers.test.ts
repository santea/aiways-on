import { AuthError } from '@aiways/lib/auth';
import { describe, expect, it, vi } from 'vitest';
import { createGitHubAdapter } from '../../github/adapter';
import {
  createDevTypesHandlers,
  createGithubLinksHandlers,
  createIntakeHandlers,
  createIssuesHandlers,
  createRequestDetailHandlers,
  createRequestNoHandlers,
  createRequestsHandlers,
} from '../handlers';
import { createIssueService } from '../issue-service';
import type { SdlcRequestRepository } from '../repository';

const okMasterKey = vi.fn(() => undefined);
const badMasterKey = vi.fn(() => {
  throw new AuthError(401, 'UNAUTHORIZED', '유효하지 않은 서버간 인증 토큰');
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /intake — 서버간 인증 (§8)', () => {
  const service = { intake: vi.fn(async () => ({ requestNo: 'SR-1', status: '1_REGISTERED' })) };

  it('마스터 키가 맞으면 201 이다', async () => {
    const res = await createIntakeHandlers({
      requireMasterKey: okMasterKey,
      service: () => service as never,
    }).POST(new Request('http://portal/intake', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ requestNo: 'SR-1', status: '1_REGISTERED' });
  });

  it('마스터 키가 틀리면 401 이고 서비스는 아예 불리지 않는다', async () => {
    const spy = vi.fn();
    const res = await createIntakeHandlers({
      requireMasterKey: badMasterKey,
      service: () => ({ intake: spy }) as never,
    }).POST(new Request('http://portal/intake', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('GET /requests — 목록 (§2.13)', () => {
  it('쿼리 파라미터를 서비스로 넘긴다', async () => {
    const listRequests = vi.fn(async () => ({ items: [], total: 0, page: 2, limit: 50 }));
    await createRequestsHandlers({ service: () => ({ listRequests }) as never }).GET(
      new Request('http://portal/requests?status=9_COMPLETE&search=홍&page=2&limit=50'),
    );
    expect(listRequests).toHaveBeenCalledWith({
      status: '9_COMPLETE',
      search: '홍',
      page: 2,
      limit: 50,
    });
  });

  it('말이 안 되는 page·limit 은 기본값으로 되돌린다', async () => {
    const listRequests = vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 }));
    await createRequestsHandlers({ service: () => ({ listRequests }) as never }).GET(
      new Request('http://portal/requests?page=-3&limit=9999'),
    );
    expect(listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });
});

describe('GET /requests/{id} — 상세 (§2.14)', () => {
  it('경로 파라미터를 서비스로 넘긴다', async () => {
    const getRequest = vi.fn(async () => ({ requestNo: 'SR-1' }));
    const res = await createRequestDetailHandlers({
      service: () => ({ getRequest }) as never,
    }).GET(new Request('http://portal/requests/req-1'), ctx('req-1'));
    expect(res.status).toBe(200);
    expect(getRequest).toHaveBeenCalledWith('req-1');
  });

  it('403 은 §7 포맷으로 나간다', async () => {
    const getRequest = vi.fn(async () => {
      throw new AuthError(403, 'FORBIDDEN', '본인의 리소스만 접근할 수 있다');
    });
    const res = await createRequestDetailHandlers({
      service: () => ({ getRequest }) as never,
    }).GET(new Request('http://portal/requests/req-1'), ctx('req-1'));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('github-links 도 같은 경로 파라미터를 쓴다', async () => {
    const getGithubLinks = vi.fn(async () => ({ issues: [], pullRequests: [] }));
    await createGithubLinksHandlers({ service: () => ({ getGithubLinks }) as never }).GET(
      new Request('http://portal/requests/req-2/github-links'),
      ctx('req-2'),
    );
    expect(getGithubLinks).toHaveBeenCalledWith('req-2');
  });
});

describe('등록 폼 보조 API (§4.8 · §4.9)', () => {
  it('generate-request-no', async () => {
    const res = await createRequestNoHandlers({
      service: () => ({ nextRequestNo: async () => ({ requestNo: 'SR-20260903-001' }) }) as never,
    }).GET(new Request('http://portal/generate-request-no'));
    await expect(res.json()).resolves.toEqual({ requestNo: 'SR-20260903-001' });
  });

  it('dev-types', async () => {
    const res = await createDevTypesHandlers({
      service: () => ({ devTypes: async () => ({ devTypes: ['feature'] }) }) as never,
    }).GET(new Request('http://portal/dev-types'));
    await expect(res.json()).resolves.toEqual({ devTypes: ['feature'] });
  });
});

describe('POST /requests/{id}/issues (§2.4 · US-U2-06)', () => {
  function issueDeps(failing = false) {
    const saved: unknown[] = [];
    const repository = {
      findDetail: vi.fn(async () => ({ requestNo: 'SR-20260901-001' })),
      saveIssue: vi.fn(async (row: unknown) => {
        saved.push(row);
      }),
    } as unknown as SdlcRequestRepository;

    const githubPort = createGitHubAdapter({
      client: {
        findIssueByTitle: vi.fn(async () => null),
        createIssue: vi.fn(async ({ repo, title }) => {
          if (failing) throw new Error('GitHub 500');
          return { number: 123, repo, htmlUrl: `https://github.com/${repo}/issues/123`, title };
        }),
        closeIssue: vi.fn(async () => undefined),
        deleteBranch: vi.fn(async () => undefined),
        compareCommits: vi.fn(async () => 1),
        findPullRequest: vi.fn(async () => null),
        createPullRequest: vi.fn(async () => ({
          number: 1,
          repo: 'r',
          head: 'h',
          base: 'b',
          htmlUrl: null,
        })),
        mergePullRequest: vi.fn(async () => undefined),
      },
    });

    return {
      saved,
      repository,
      handlers: createIssuesHandlers({
        requireMasterKey: okMasterKey,
        service: () => createIssueService({ githubPort, repository }),
      }),
    };
  }

  const body = (repos: unknown) =>
    new Request('http://portal/requests/req-1/issues', {
      method: 'POST',
      body: JSON.stringify({ repos, title: '[SDLC] SR-20260901-001', body: '본문' }),
    });

  it('객체형 repos 는 work branch 를 함께 저장한다', async () => {
    const { handlers, saved } = issueDeps();
    const res = await handlers.POST(
      body([{ repo: 'org/portal', branch: 'sdlc/SR-20260901-001-test' }]),
      ctx('req-1'),
    );
    expect(res.status).toBe(200);
    expect(saved[0]).toMatchObject({ workBranch: 'sdlc/SR-20260901-001-test' });
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      requestNo: 'SR-20260901-001',
      issues: [{ repo: 'org/portal', number: 123, branch: 'sdlc/SR-20260901-001-test' }],
    });
  });

  it('문자열형 repos 는 branch 없이 종전 동작이다', async () => {
    const { handlers, saved } = issueDeps();
    await handlers.POST(body(['org/portal']), ctx('req-1'));
    expect(saved[0]).toMatchObject({ workBranch: null });
  });

  it('repos 가 비면 400 이다', async () => {
    const { handlers } = issueDeps();
    const res = await handlers.POST(body([]), ctx('req-1'));
    expect(res.status).toBe(400);
  });

  it('GitHub API 가 실패하면 500 GITHUB_ISSUE_CREATION_FAILED 이고 repo 를 남긴다', async () => {
    const { handlers } = issueDeps(true);
    const res = await handlers.POST(body(['org/portal']), ctx('req-1'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'GITHUB_ISSUE_CREATION_FAILED',
      details: { repo: 'org/portal' },
    });
  });

  it('마스터 키가 없으면 401 이다', async () => {
    const res = await createIssuesHandlers({
      requireMasterKey: badMasterKey,
      service: () => ({ ensureIssues: vi.fn() }) as never,
    }).POST(body(['org/portal']), ctx('req-1'));
    expect(res.status).toBe(401);
  });
});
