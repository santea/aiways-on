import { describe, expect, it, vi } from 'vitest';
import { createGitHubAdapter, type GitHubApiClient } from '../adapter';

const NO_COMMITS_REPO = 'org/empty';

function fakeClient(overrides: Partial<GitHubApiClient> = {}): GitHubApiClient {
  return {
    findIssueByTitle: vi.fn(async () => null),
    createIssue: vi.fn(async ({ repo, title }) => ({
      number: 123,
      repo,
      htmlUrl: `https://github.com/${repo}/issues/123`,
      title,
    })),
    closeIssue: vi.fn(async () => undefined),
    deleteBranch: vi.fn(async () => undefined),
    compareCommits: vi.fn(async ({ repo }) => (repo === NO_COMMITS_REPO ? 0 : 3)),
    findPullRequest: vi.fn(async () => null),
    createPullRequest: vi.fn(async ({ repo, head, base }) => ({
      number: 45,
      repo,
      head,
      base,
      htmlUrl: `https://github.com/${repo}/pull/45`,
    })),
    mergePullRequest: vi.fn(async () => undefined),
    ...overrides,
  };
}

const issueInput = {
  repo: 'org/portal',
  requestId: 'req-1',
  title: '[SDLC] SR-20260901-001',
  body: 'body',
};

const prInput = {
  repo: 'org/portal',
  head: 'sdlc/SR-20260901-001',
  base: 'main',
  title: 'PR',
  body: 'body',
};

describe('GitHubAdapter — ensureIssue (US-U2-06)', () => {
  it('Issue 를 만들고 work branch 를 함께 돌려준다', async () => {
    const adapter = createGitHubAdapter({ client: fakeClient() });
    const ref = await adapter.ensureIssue({ ...issueInput, workBranch: 'sdlc/SR-1' });
    expect(ref.issueNumber).toBe(123);
    expect(ref.repo).toBe('org/portal');
    expect(ref.workBranch).toBe('sdlc/SR-1');
  });

  it('이미 있으면 새로 만들지 않는다 — ensure* 는 멱등이다 (NFR-07)', async () => {
    const client = fakeClient({
      findIssueByTitle: vi.fn(async () => ({
        number: 7,
        repo: 'org/portal',
        htmlUrl: 'https://github.com/org/portal/issues/7',
        title: issueInput.title,
      })),
    });
    const adapter = createGitHubAdapter({ client });
    const ref = await adapter.ensureIssue(issueInput);
    expect(ref.issueNumber).toBe(7);
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  it('두 번 불러도 결과가 같다 (멱등)', async () => {
    const adapter = createGitHubAdapter({ client: fakeClient() });
    const a = await adapter.ensureIssue(issueInput);
    const b = await adapter.ensureIssue(issueInput);
    expect(b).toEqual(a);
  });
});

describe('GitHubAdapter — ensurePullRequest (B-2)', () => {
  it('commit 이 있으면 PR 을 만든다', async () => {
    const adapter = createGitHubAdapter({ client: fakeClient() });
    const pr = await adapter.ensurePullRequest(prInput);
    expect(pr).not.toBeNull();
    expect(pr?.prNumber).toBe(45);
  });

  it('commit 이력이 없으면 PR 을 만들지 않고 null 을 돌려준다 — B-2 특수 케이스', async () => {
    const client = fakeClient();
    const adapter = createGitHubAdapter({ client });
    const pr = await adapter.ensurePullRequest({ ...prInput, repo: NO_COMMITS_REPO });
    expect(pr).toBeNull();
    expect(client.createPullRequest).not.toHaveBeenCalled();
  });

  it('이미 열린 PR 이 있으면 재사용한다 (멱등)', async () => {
    const client = fakeClient({
      findPullRequest: vi.fn(async () => ({
        number: 9,
        repo: 'org/portal',
        head: prInput.head,
        base: 'main',
        htmlUrl: 'https://github.com/org/portal/pull/9',
      })),
    });
    const adapter = createGitHubAdapter({ client });
    expect((await adapter.ensurePullRequest(prInput))?.prNumber).toBe(9);
    expect(client.createPullRequest).not.toHaveBeenCalled();
  });
});

describe('GitHubAdapter — 정책 판단을 하지 않는다 (AD-3)', () => {
  it('mergePullRequest 는 자동머지 허용 여부를 스스로 따지지 않고 그대로 merge 한다', async () => {
    const client = fakeClient();
    const adapter = createGitHubAdapter({ client });
    await adapter.mergePullRequest({ repo: 'org/portal', prNumber: 45 });
    expect(client.mergePullRequest).toHaveBeenCalledWith({
      repo: 'org/portal',
      prNumber: 45,
      strategy: 'squash',
    });
  });

  it('closeIssue · deleteBranch 는 null 분기의 후속 처리다', async () => {
    const client = fakeClient();
    const adapter = createGitHubAdapter({ client });
    await adapter.closeIssue({ repo: 'org/portal', issueNumber: 123 });
    await adapter.deleteBranch({ repo: 'org/portal', branch: 'sdlc/x' });
    expect(client.closeIssue).toHaveBeenCalled();
    expect(client.deleteBranch).toHaveBeenCalled();
  });
});
