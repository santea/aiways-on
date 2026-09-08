import { describe, expect, it, vi } from 'vitest';
import { createRestGitHubClient } from '../rest-client';

const vault = { store: vi.fn(async () => 'ref-1'), reveal: vi.fn(async () => 'ghp_token') };

function client(responder: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return responder(url, init);
  }) as unknown as typeof fetch;

  return {
    calls,
    fetchImpl,
    api: createRestGitHubClient({
      vault,
      fetchImpl,
      resolveToken: async () => 'ghp_token',
    }),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('인증 헤더', () => {
  it('PAT 를 Bearer 로 실어 보낸다', async () => {
    const { api, calls } = client(() => json([]));
    await api.findIssueByTitle({ repo: 'org/portal', title: 't' });
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer ghp_token');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('토큰이 없으면 Authorization 을 붙이지 않는다 — 빈 Bearer 를 보내지 않는다', async () => {
    const fetchImpl = vi.fn(async () => json([])) as unknown as typeof fetch;
    const api = createRestGitHubClient({ vault, fetchImpl, resolveToken: async () => null });
    await api.findIssueByTitle({ repo: 'org/portal', title: 't' });
    const headers = (fetchImpl as unknown as { mock: { calls: [unknown, RequestInit][] } }).mock
      .calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('findIssueByTitle', () => {
  it('제목이 같은 Issue 를 찾는다', async () => {
    const { api } = client(() =>
      json([{ number: 7, title: 'target', html_url: 'https://x/7' }]),
    );
    await expect(api.findIssueByTitle({ repo: 'org/portal', title: 'target' })).resolves.toEqual({
      number: 7,
      repo: 'org/portal',
      htmlUrl: 'https://x/7',
      title: 'target',
    });
  });

  it('PR 은 Issue 로 세지 않는다 — GitHub 은 둘을 같은 목록에 준다', async () => {
    const { api } = client(() =>
      json([{ number: 9, title: 'target', html_url: 'https://x/9', pull_request: {} }]),
    );
    await expect(
      api.findIssueByTitle({ repo: 'org/portal', title: 'target' }),
    ).resolves.toBeNull();
  });

  it('404 는 null 이다', async () => {
    const { api } = client(() => new Response(null, { status: 404 }));
    await expect(
      api.findIssueByTitle({ repo: 'org/portal', title: 't' }),
    ).resolves.toBeNull();
  });
});

describe('오류 처리', () => {
  it('실패 응답 본문을 그대로 올리지 않는다 (NFR-16)', async () => {
    const { api } = client(() => json({ message: 'Bad credentials ghp_leaked' }, 401));
    await expect(api.findIssueByTitle({ repo: 'org/portal', title: 't' })).rejects.toMatchObject({
      code: 'GITHUB_ISSUE_CREATION_FAILED',
      message: expect.not.stringContaining('ghp_leaked'),
    });
  });
});

describe('쓰기 동작', () => {
  it('createIssue 는 POST 하고 결과를 정규화한다', async () => {
    const { api, calls } = client(() =>
      json({ number: 123, title: 't', html_url: 'https://x/123' }),
    );
    await expect(
      api.createIssue({ repo: 'org/portal', title: 't', body: 'b' }),
    ).resolves.toEqual({
      number: 123,
      repo: 'org/portal',
      htmlUrl: 'https://x/123',
      title: 't',
    });
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('closeIssue 는 state=closed 로 PATCH 한다', async () => {
    const { api, calls } = client(() => new Response(null, { status: 204 }));
    await api.closeIssue({ repo: 'org/portal', issueNumber: 3 });
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(String(calls[0]?.init?.body)).toContain('closed');
  });

  it('deleteBranch 는 ref 를 DELETE 한다', async () => {
    const { api, calls } = client(() => new Response(null, { status: 204 }));
    await api.deleteBranch({ repo: 'org/portal', branch: 'sdlc/a b' });
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(calls[0]?.url).toContain('git/refs/heads/sdlc%2Fa%20b');
  });

  it('mergePullRequest 는 merge_method 를 실어 PUT 한다', async () => {
    const { api, calls } = client(() => new Response(null, { status: 204 }));
    await api.mergePullRequest({ repo: 'org/portal', prNumber: 5, strategy: 'squash' });
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(String(calls[0]?.init?.body)).toContain('squash');
  });

  it('createPullRequest 결과를 정규화한다', async () => {
    const { api } = client(() => json({ number: 45, html_url: 'https://x/45' }));
    await expect(
      api.createPullRequest({
        repo: 'org/portal',
        head: 'h',
        base: 'main',
        title: 't',
        body: 'b',
      }),
    ).resolves.toEqual({
      number: 45,
      repo: 'org/portal',
      head: 'h',
      base: 'main',
      htmlUrl: 'https://x/45',
    });
  });
});

describe('compareCommits — B-2 의 null 분기를 결정한다', () => {
  it('ahead_by 를 그대로 쓴다', async () => {
    const { api } = client(() => json({ ahead_by: 3 }));
    await expect(
      api.compareCommits({ repo: 'org/portal', base: 'main', head: 'h' }),
    ).resolves.toBe(3);
  });

  it('ahead_by 가 없으면 total_commits 를 본다', async () => {
    const { api } = client(() => json({ total_commits: 2 }));
    await expect(
      api.compareCommits({ repo: 'org/portal', base: 'main', head: 'h' }),
    ).resolves.toBe(2);
  });

  it('비교 자체가 404 면 0 이다 — 그래야 PR 을 만들지 않는 분기로 간다', async () => {
    const { api } = client(() => new Response(null, { status: 404 }));
    await expect(
      api.compareCommits({ repo: 'org/portal', base: 'main', head: 'nope' }),
    ).resolves.toBe(0);
  });
});

describe('findPullRequest', () => {
  it('열린 PR 을 찾아 정규화한다', async () => {
    const { api, calls } = client(() =>
      json([{ number: 9, head: { ref: 'h' }, base: { ref: 'main' }, html_url: 'https://x/9' }]),
    );
    await expect(
      api.findPullRequest({ repo: 'org/portal', head: 'h', base: 'main' }),
    ).resolves.toMatchObject({ number: 9, head: 'h', base: 'main' });
    expect(calls[0]?.url).toContain('head=org:h');
  });

  it('없으면 null 이다', async () => {
    const { api } = client(() => json([]));
    await expect(
      api.findPullRequest({ repo: 'org/portal', head: 'h', base: 'main' }),
    ).resolves.toBeNull();
  });
});
