/**
 * 어댑터 Port 인터페이스 — AD-1.
 *
 * 인터페이스는 U1(이 파일)이 소유하고, **구현은 각 유닛에 둔다**:
 *   GitHubPort    → U2 `GitHubAdapter`   (apps/portal/src/features/u2-core-mgmt)
 *   MessagingPort → U3 `SlackAdapter`    (apps/portal/src/features/u3-core-run)
 *   PodPort       → U3 `PodOrchestrator` (apps/portal/src/features/u3-core-run)
 *
 * 이 분리가 U2↔U3 순환 의존을 끊는다. 소비자는 **인터페이스 타입으로만** 호출하고
 * 구현체를 직접 import 하지 않는다 (B-2).
 */
import type { ChannelType } from './stage';

/** ── GitHubPort — 소유 U1 / 구현 U2 (B-2) ────────────────────────── */
export interface GitHubIssueRef {
  readonly issueNumber: number;
  readonly repo: string;
  readonly htmlUrl: string | null;
  readonly workBranch: string | null;
}

export interface GitHubPullRequestRef {
  readonly prNumber: number;
  readonly repo: string;
  readonly head: string;
  readonly base: string;
  readonly htmlUrl: string | null;
}

export interface GitHubPort {
  /** 멱등. 이미 있으면 기존 Issue 를 반환한다. */
  ensureIssue(input: {
    repo: string;
    requestId: string;
    title: string;
    body: string;
  }): Promise<GitHubIssueRef>;

  /**
   * 멱등. **commit 이력이 없으면 PR 을 만들지 않고 `null` 을 반환한다** (B-2 특수 케이스).
   * 호출자는 `null` 을 받으면 Issue close + branch 삭제로 분기해야 한다.
   */
  ensurePullRequest(input: {
    repo: string;
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequestRef | null>;

  /** 자동머지 허용 여부는 호출자가 각인된 정책을 읽어 판단한다 (AD-3). */
  mergePullRequest(input: { repo: string; prNumber: number }): Promise<void>;

  closeIssue(input: { repo: string; issueNumber: number }): Promise<void>;
  deleteBranch(input: { repo: string; branch: string }): Promise<void>;
}

/** ── MessagingPort — 소유 U1 / 구현 U3 ───────────────────────────── */
export interface MessagingChannelRef {
  readonly channelId: string;
  readonly channelName: string;
  readonly type: ChannelType;
}

export interface MessagingPort {
  /** 멱등. 채널명 생성 규칙은 구현이 소유한다 (PBT 대상). */
  ensureChannel(input: {
    requestId: string;
    requestNo: string;
    type: ChannelType;
    profilePrefix: string;
  }): Promise<MessagingChannelRef>;

  postMessage(input: { channelId: string; text: string }): Promise<{ messageId: string }>;

  inviteMembers(input: { channelId: string; memberIds: readonly string[] }): Promise<void>;

  /** 실패 시에도 채널을 아카이브하지 않고 실패 결과를 게시한다 (NFR-08). */
  postFailure(input: { channelId: string; reason: string }): Promise<{ messageId: string }>;
}

/** ── PodPort — 소유 U1 / 구현 U3 ─────────────────────────────────── */
export interface PodSessionRef {
  readonly podName: string;
  readonly endpoint: string | null;
  readonly status: 'PENDING' | 'RUNNING' | 'FAILED' | 'UNKNOWN';
}

export interface PodPort {
  /** SR 당 Pod·PVC·Service 를 생성한다. 멱등. */
  provision(input: { requestId: string; requestNo: string }): Promise<PodSessionRef>;
  /** terminal 도달 시 자원을 회수한다. 멱등. */
  terminate(input: { requestId: string }): Promise<void>;
  getSession(input: { requestId: string }): Promise<PodSessionRef | null>;
}
