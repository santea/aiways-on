/**
 * GitHub REST 호출 — `GitHubApiClient` 의 실제 구현.
 *
 * 어댑터(`adapter.ts`)는 이 파일을 모른다. 계약 검증은 어댑터 쪽에서 하고,
 * 여기서는 HTTP 세부만 다룬다.
 *
 * PAT 는 `secret_refs` 에서 그때그때 복호화해 쓰고 **어디에도 캐시하지 않는다** (NFR-10).
 */
import type { SecretVault } from '@aiways/lib/crypto';
import { githubIssueFailed } from '@aiways/lib/http';
import type {
  GitHubApiClient,
  GitHubIssueData,
  GitHubPullRequestData,
} from './adapter';
import { findRepoWithCredential } from './repository';

const GITHUB_API = 'https://api.github.com';

interface RestClientDeps {
  readonly vault: SecretVault;
  readonly fetchImpl?: typeof fetch;
  readonly resolveToken?: (repo: string) => Promise<string | null>;
}

/** `org/repo` 문자열에서 repo URL 을 되돌린다 — 자격증명 조회 키다. */
const repoUrlOf = (repo: string) => `https://github.com/${repo}`;

export function createRestGitHubClient({
  vault,
  fetchImpl = fetch,
  resolveToken,
}: RestClientDeps): GitHubApiClient {
  const tokenFor =
    resolveToken ??
    (async (repo: string) => {
      const row = await findRepoWithCredential(repoUrlOf(repo));
      if (!row?.patSecretRefId) return null;
      return vault.reveal(row.patSecretRefId);
    });

  async function call<T>(
    repo: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T | null> {
    const token = await tokenFor(repo);
    const response = await fetchImpl(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      // 응답 본문을 그대로 올리지 않는다 — 토큰이 에코될 수 있다 (NFR-16).
      throw githubIssueFailed(`GitHub API 실패 (${response.status})`, { repo, path });
    }
    if (response.status === 204) return null;
    return (await response.json()) as T;
  }

  return {
    async findIssueByTitle({ repo, title }) {
      const issues = await call<
        { number: number; title: string; html_url: string; pull_request?: unknown }[]
      >(repo, `/repos/${repo}/issues?state=all&per_page=100`);
      const matched = issues?.find((i) => !i.pull_request && i.title === title);
      return matched
        ? { number: matched.number, repo, htmlUrl: matched.html_url, title: matched.title }
        : null;
    },

    async createIssue({ repo, title, body }) {
      const created = await call<{ number: number; title: string; html_url: string }>(
        repo,
        `/repos/${repo}/issues`,
        { method: 'POST', body: JSON.stringify({ title, body }) },
      );
      if (!created) throw githubIssueFailed('Issue 를 만들지 못했다', { repo });
      return {
        number: created.number,
        repo,
        htmlUrl: created.html_url,
        title: created.title,
      } satisfies GitHubIssueData;
    },

    async closeIssue({ repo, issueNumber }) {
      await call(repo, `/repos/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
    },

    async deleteBranch({ repo, branch }) {
      await call(repo, `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'DELETE',
      });
    },

    async compareCommits({ repo, base, head }) {
      const compared = await call<{ ahead_by?: number; total_commits?: number }>(
        repo,
        `/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
      );
      // 비교 자체가 실패하면(브랜치 없음 등) commit 이 없다고 본다 — B-2 의 `null` 분기로 이어진다.
      return compared?.ahead_by ?? compared?.total_commits ?? 0;
    },

    async findPullRequest({ repo, head, base }) {
      const owner = repo.split('/')[0];
      const pulls = await call<
        { number: number; head: { ref: string }; base: { ref: string }; html_url: string }[]
      >(repo, `/repos/${repo}/pulls?state=open&head=${owner}:${head}&base=${base}`);
      const matched = pulls?.[0];
      return matched
        ? {
            number: matched.number,
            repo,
            head: matched.head.ref,
            base: matched.base.ref,
            htmlUrl: matched.html_url,
          }
        : null;
    },

    async createPullRequest({ repo, head, base, title, body }) {
      const created = await call<{ number: number; html_url: string }>(
        repo,
        `/repos/${repo}/pulls`,
        { method: 'POST', body: JSON.stringify({ head, base, title, body }) },
      );
      if (!created) throw githubIssueFailed('PR 을 만들지 못했다', { repo });
      return {
        number: created.number,
        repo,
        head,
        base,
        htmlUrl: created.html_url,
      } satisfies GitHubPullRequestData;
    },

    async mergePullRequest({ repo, prNumber, strategy }) {
      await call(repo, `/repos/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        body: JSON.stringify({ merge_method: strategy }),
      });
    },
  };
}
