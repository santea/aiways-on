/**
 * GitHub Issue 생성 위임 — `05-portal-api.md` §2.4 (US-U2-06).
 *
 * n8n 이 Issue 생성을 Portal 에 위임한다. Portal 은 `GitHubPort` 구현(C-2.3)을 통해
 * 멱등하게 만들고 `sdlc_github_issues` 에 저장한다.
 *
 * `work_branch` 를 여기서 함께 저장하는 이유: `4 -> 9` PR 생성 시점에 브랜치명을
 * 다시 계산하면 규칙이 두 곳에 생기고 어긋난다.
 *
 * 오류 포맷 참고 — §2.4 예시는 `{ "error": ... }` 지만 §7 은 모든 오류가
 * `{ code, message }` 를 따른다고 정한다. 더 일반적인 §7 을 따르고 repo 는 `details` 에 싣는다.
 */
import { githubIssueFailed, notFound, validationFailed } from '@aiways/lib/http';
import { z } from 'zod';
import type { GitHubAdapter } from '../github/adapter';
import type { SdlcRequestRepository } from './repository';

/** `repos` 원소는 문자열이거나 `{ repo, branch }` 다 (§2.4). */
const repoEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({ repo: z.string().trim().min(1), branch: z.string().trim().min(1).optional() }),
]);

const issuesSchema = z.object({
  repos: z.array(repoEntrySchema).min(1, 'repos 는 최소 하나가 필요하다'),
  title: z.string().trim().min(1, 'title 은 필수다'),
  body: z.string().default(''),
});

export type EnsureIssuesInput = z.input<typeof issuesSchema>;

export interface IssueResultItem {
  readonly repo: string;
  readonly number: number;
  readonly html_url: string | null;
  readonly branch: string | null;
}

export interface IssueServiceDeps {
  readonly githubPort: GitHubAdapter;
  readonly repository: SdlcRequestRepository;
}

/** 문자열·객체 두 형태를 하나로 정규화한다. */
function normalizeEntry(entry: string | { repo: string; branch?: string }) {
  return typeof entry === 'string'
    ? { repo: entry, branch: null }
    : { repo: entry.repo, branch: entry.branch ?? null };
}

export function createIssueService({ githubPort, repository }: IssueServiceDeps) {
  return {
    async ensureIssues(requestId: string, input: EnsureIssuesInput) {
      const parsed = issuesSchema.safeParse(input);
      if (!parsed.success) {
        throw validationFailed(parsed.error.issues[0]?.message ?? '입력이 올바르지 않다');
      }

      const request = await repository.findDetail(requestId);
      if (!request) throw notFound('요청을 찾을 수 없다');

      const issues: IssueResultItem[] = [];
      for (const entry of parsed.data.repos) {
        const { repo, branch } = normalizeEntry(entry);
        try {
          const ref = await githubPort.ensureIssue({
            repo,
            requestId,
            title: parsed.data.title,
            body: parsed.data.body,
            workBranch: branch,
          });
          await repository.saveIssue({
            requestId,
            repo: ref.repo,
            issueNumber: ref.issueNumber,
            htmlUrl: ref.htmlUrl,
            workBranch: ref.workBranch,
          });
          issues.push({
            repo: ref.repo,
            number: ref.issueNumber,
            html_url: ref.htmlUrl,
            branch: ref.workBranch,
          });
        } catch (cause) {
          // §2.4 — GitHub API 실패 시 즉시 중단한다. 어느 repo 에서 멈췄는지는 남긴다.
          if (cause && typeof cause === 'object' && 'code' in cause) throw cause;
          throw githubIssueFailed('GitHub Issue 생성에 실패했다', { repo });
        }
      }

      return {
        ok: true as const,
        requestId,
        requestNo: request.requestNo,
        issues,
      };
    },
  };
}

export type IssueService = ReturnType<typeof createIssueService>;
