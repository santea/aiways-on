/**
 * SR 조회 데이터 접근 (C-2.2).
 *
 * **읽기 위주다.** `sdlc_requests` 에 INSERT 하는 경로는 여기에 없다 — SR 생성은
 * Factory 단독이다 (B-1). 상태 컬럼도 쓰지 않는다 — 전이는 U3 소유다 (B-3).
 * 유일한 쓰기는 `sdlc_github_issues` 로, GitHub 연동은 U2 책임이다 (US-U2-06).
 */
import type { PipelineProfile, SdlcRequestSummary, Stage } from '@aiways/contracts';
import { getDb, schema } from '@aiways/lib/db';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  nextSequenceFrom,
  offsetOf,
  readStage,
  readStampedProfile,
  toIso,
} from './row-mapping';

export interface RequestChannelView {
  readonly type: 'requirements' | 'design' | 'dev';
  readonly channelId: string;
  readonly channelName: string;
  readonly archived: boolean;
}

export interface RequestPodView {
  readonly podName: string;
  readonly status: string;
  readonly endpoint: string | null;
}

export interface RequestGithubLinks {
  readonly issues: readonly {
    repo: string;
    number: number;
    htmlUrl: string | null;
    state: string;
  }[];
  readonly pullRequests: readonly {
    repo: string;
    prNumber: number;
    state: string;
    head: string;
    base: string;
    htmlUrl: string | null;
  }[];
}

export interface RequestDetailRow extends SdlcRequestSummary {
  readonly requestSite: string;
  readonly module: string | null;
  readonly submitterEmail: string | null;
  readonly submitterGithubLogin: string | null;
  readonly dedupKey: string;
  readonly metadata: Record<string, unknown>;
  readonly profile: PipelineProfile;
}

export interface ListQuery {
  readonly submitterId: string | null;
  readonly status: string | null;
  readonly search: string | null;
  readonly page: number;
  readonly limit: number;
}

export interface SdlcRequestRepository {
  list(query: ListQuery): Promise<{ items: readonly SdlcRequestSummary[]; total: number }>;
  findDetail(requestId: string): Promise<RequestDetailRow | null>;
  findChannels(requestId: string): Promise<readonly RequestChannelView[]>;
  findPod(requestId: string): Promise<RequestPodView | null>;
  findGithubLinks(requestId: string): Promise<RequestGithubLinks>;
  /** 그날의 다음 일련번호. 서버 시각으로 만든 `ymd` 를 받는다. */
  nextSequence(ymd: string): Promise<number>;
  saveIssue(input: {
    requestId: string;
    repo: string;
    issueNumber: number;
    htmlUrl: string | null;
    workBranch: string | null;
  }): Promise<void>;
}

const {
  sdlcRequests,
  sdlcMessagingChannels,
  sdlcPodSessions,
  sdlcGithubIssues,
  sdlcGithubPullRequests,
} = schema;


export function createDrizzleRequestRepository(db = getDb()): SdlcRequestRepository {
  return {
    async list(query) {
      const conditions = [
        query.submitterId ? eq(sdlcRequests.submitterId, query.submitterId) : undefined,
        query.status ? eq(sdlcRequests.status, query.status) : undefined,
        query.search
          ? or(
              ilike(sdlcRequests.requestNo, `%${query.search}%`),
              ilike(sdlcRequests.submitter, `%${query.search}%`),
            )
          : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: sdlcRequests.id,
          requestNo: sdlcRequests.requestNo,
          submitter: sdlcRequests.submitter,
          submitterId: sdlcRequests.submitterId,
          requestSystem: sdlcRequests.requestSystem,
          devType: sdlcRequests.devType,
          status: sdlcRequests.status,
          createdAt: sdlcRequests.createdAt,
          updatedAt: sdlcRequests.updatedAt,
        })
        .from(sdlcRequests)
        .where(where)
        .orderBy(desc(sdlcRequests.createdAt))
        .limit(query.limit)
        .offset(offsetOf(query.page, query.limit));

      const [totalRow] = await db
        .select({ value: count() })
        .from(sdlcRequests)
        .where(where);

      return {
        items: rows.map((r) => ({
          ...r,
          status: readStage(r.status),
          createdAt: toIso(r.createdAt),
          updatedAt: toIso(r.updatedAt),
        })),
        total: totalRow?.value ?? 0,
      };
    },

    async findDetail(requestId) {
      const rows = await db
        .select()
        .from(sdlcRequests)
        .where(eq(sdlcRequests.id, requestId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;

      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        requestNo: row.requestNo,
        submitter: row.submitter,
        submitterId: row.submitterId,
        submitterEmail: row.submitterEmail ?? null,
        submitterGithubLogin: row.submitterGithubLogin ?? null,
        requestSystem: row.requestSystem,
        requestSite: row.requestSite,
        devType: row.devType,
        module: row.module ?? null,
        dedupKey: row.dedupKey,
        status: readStage(row.status),
        metadata,
        // 각인된 프로파일은 **읽기만** 한다 — 재판정하지 않는다 (AD-3).
        profile: readStampedProfile(metadata),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      };
    },

    async findChannels(requestId) {
      const rows = await db
        .select({
          type: sdlcMessagingChannels.type,
          channelId: sdlcMessagingChannels.channelId,
          channelName: sdlcMessagingChannels.channelName,
          archived: sdlcMessagingChannels.archived,
        })
        .from(sdlcMessagingChannels)
        .where(eq(sdlcMessagingChannels.requestId, requestId));
      return rows.map((r) => ({
        type: r.type as RequestChannelView['type'],
        channelId: r.channelId,
        channelName: r.channelName,
        archived: Boolean(r.archived),
      }));
    },

    async findPod(requestId) {
      const rows = await db
        .select({
          podName: sdlcPodSessions.podName,
          status: sdlcPodSessions.status,
          endpoint: sdlcPodSessions.endpoint,
        })
        .from(sdlcPodSessions)
        .where(eq(sdlcPodSessions.requestId, requestId))
        .orderBy(desc(sdlcPodSessions.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async findGithubLinks(requestId) {
      const [issues, pullRequests] = await Promise.all([
        db
          .select({
            repo: sdlcGithubIssues.repo,
            number: sdlcGithubIssues.issueNumber,
            htmlUrl: sdlcGithubIssues.htmlUrl,
            state: sdlcGithubIssues.state,
          })
          .from(sdlcGithubIssues)
          .where(eq(sdlcGithubIssues.requestId, requestId)),
        db
          .select({
            repo: sdlcGithubPullRequests.repo,
            prNumber: sdlcGithubPullRequests.prNumber,
            state: sdlcGithubPullRequests.state,
            head: sdlcGithubPullRequests.head,
            base: sdlcGithubPullRequests.base,
            htmlUrl: sdlcGithubPullRequests.htmlUrl,
          })
          .from(sdlcGithubPullRequests)
          .where(eq(sdlcGithubPullRequests.requestId, requestId)),
      ]);
      return { issues, pullRequests };
    },

    async nextSequence(ymd) {
      const [row] = await db
        .select({ value: count() })
        .from(sdlcRequests)
        .where(sql`${sdlcRequests.requestNo} LIKE ${`SR-${ymd}-%`}`);
      return nextSequenceFrom(row?.value ?? 0);
    },

    async saveIssue({ requestId, repo, issueNumber, htmlUrl, workBranch }) {
      // ensure* 의 멱등을 DB 쪽에서도 지킨다 — 같은 (repo, number) 는 갱신만 한다.
      await db
        .insert(sdlcGithubIssues)
        .values({ requestId, repo, issueNumber, htmlUrl, workBranch })
        .onConflictDoUpdate({
          target: [sdlcGithubIssues.repo, sdlcGithubIssues.issueNumber],
          set: { htmlUrl, workBranch, updatedAt: new Date() },
        });
    },
  };
}
