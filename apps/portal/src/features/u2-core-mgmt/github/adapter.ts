/**
 * `GitHubAdapter` — `GitHubPort` 구현 (C-2.3, AD-1).
 *
 * **인터페이스 소유는 U1, 구현 소유는 U2다.** U3 의 `4 -> 9` 진입 작업은 이 파일을
 * import 하지 않고 `GitHubPort` 타입으로만 호출한다 (B-2). 그래서 U2-U3 순환이 없다.
 *
 * 계약 두 가지를 여기서 지킨다:
 *  - `ensure*` 는 멱등이다 (NFR-07). 이미 있으면 만들지 않고 기존 것을 돌려준다.
 *  - `ensurePullRequest` 는 **commit 이력이 없으면 PR 을 만들지 않고 `null`** 이다 (B-2).
 *    호출자는 `null` 을 받으면 Issue close + branch 삭제로 분기한다.
 *
 * 정책 판단은 하지 않는다 — 자동머지 허용 여부는 SR 에 각인된 값을 호출자가 읽는다 (AD-3).
 */
import type { GitHubIssueRef, GitHubPort, GitHubPullRequestRef } from '@aiways/contracts';

export interface GitHubIssueData {
  readonly number: number;
  readonly repo: string;
  readonly htmlUrl: string | null;
  readonly title: string;
}

export interface GitHubPullRequestData {
  readonly number: number;
  readonly repo: string;
  readonly head: string;
  readonly base: string;
  readonly htmlUrl: string | null;
}

/**
 * GitHub REST 호출 표면. 어댑터가 이 인터페이스에만 의존하므로
 * 네트워크 없이 계약(멱등·`null` 분기)을 그대로 검증할 수 있다.
 */
export interface GitHubApiClient {
  findIssueByTitle(input: { repo: string; title: string }): Promise<GitHubIssueData | null>;
  createIssue(input: {
    repo: string;
    title: string;
    body: string;
  }): Promise<GitHubIssueData>;
  closeIssue(input: { repo: string; issueNumber: number }): Promise<void>;
  deleteBranch(input: { repo: string; branch: string }): Promise<void>;
  /** `base...head` 사이 commit 수. 0 이면 PR 을 만들 수 없다. */
  compareCommits(input: { repo: string; base: string; head: string }): Promise<number>;
  findPullRequest(input: {
    repo: string;
    head: string;
    base: string;
  }): Promise<GitHubPullRequestData | null>;
  createPullRequest(input: {
    repo: string;
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequestData>;
  mergePullRequest(input: {
    repo: string;
    prNumber: number;
    strategy: 'squash';
  }): Promise<void>;
}

export interface EnsureIssueInput {
  readonly repo: string;
  readonly requestId: string;
  readonly title: string;
  readonly body: string;
  /** repo 별 work branch. `4 -> 9` PR 생성 시 재계산하지 않도록 여기서 함께 보관한다. */
  readonly workBranch?: string | null;
}

export interface GitHubAdapterDeps {
  readonly client: GitHubApiClient;
}

export interface GitHubAdapter extends GitHubPort {
  ensureIssue(input: EnsureIssueInput): Promise<GitHubIssueRef>;
}

export function createGitHubAdapter({ client }: GitHubAdapterDeps): GitHubAdapter {
  const toIssueRef = (data: GitHubIssueData, workBranch: string | null): GitHubIssueRef => ({
    issueNumber: data.number,
    repo: data.repo,
    htmlUrl: data.htmlUrl,
    workBranch,
  });

  const toPrRef = (data: GitHubPullRequestData): GitHubPullRequestRef => ({
    prNumber: data.number,
    repo: data.repo,
    head: data.head,
    base: data.base,
    htmlUrl: data.htmlUrl,
  });

  return {
    async ensureIssue(input) {
      const workBranch = input.workBranch ?? null;
      const existing = await client.findIssueByTitle({ repo: input.repo, title: input.title });
      if (existing) return toIssueRef(existing, workBranch);
      const created = await client.createIssue({
        repo: input.repo,
        title: input.title,
        body: input.body,
      });
      return toIssueRef(created, workBranch);
    },

    async ensurePullRequest(input) {
      const existing = await client.findPullRequest({
        repo: input.repo,
        head: input.head,
        base: input.base,
      });
      if (existing) return toPrRef(existing);

      // B-2 특수 케이스: commit 이 하나도 없으면 GitHub 은 PR 을 만들 수 없다.
      // 여기서 조용히 예외를 던지면 호출자가 Issue close + branch 삭제 분기를
      // 실행하지 못한다. 그래서 예외가 아니라 `null` 이다.
      const commits = await client.compareCommits({
        repo: input.repo,
        base: input.base,
        head: input.head,
      });
      if (commits === 0) return null;

      return toPrRef(
        await client.createPullRequest({
          repo: input.repo,
          head: input.head,
          base: input.base,
          title: input.title,
          body: input.body,
        }),
      );
    },

    async mergePullRequest(input) {
      // 자동머지 허용 여부를 여기서 따지지 않는다 — 각인된 정책은 호출자가 읽는다 (AD-3).
      await client.mergePullRequest({ ...input, strategy: 'squash' });
    },

    async closeIssue(input) {
      await client.closeIssue(input);
    },

    async deleteBranch(input) {
      await client.deleteBranch(input);
    },
  };
}
