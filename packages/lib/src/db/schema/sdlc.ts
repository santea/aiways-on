/**
 * SDLC 코어·메시징·GitHub·Pod 테이블 — 편집 U3 (UOW-8).
 *
 * ⚠️ `sdlcRequests` 는 **공유 테이블**이다. U2·U4·U5·U6 이 모두 FK 로 참조하므로
 *    컬럼 추가·변경은 U1 승인이 필요하다.
 *
 * 근거: requirements/04-db-schema.md §3~§7
 */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { SdlcRequestMetadata } from '@aiways/contracts';
import { sdlcSchema } from './_schema';
import { secretRefs, users } from './core';

/* ── 코어 ───────────────────────────────────────────────────────── */

/**
 * SR 요청. **공유 테이블 — U1 승인 대상.**
 *
 * `status` 는 VARCHAR(50) 이므로 Stage 값 집합이 바뀌어도 마이그레이션이 불필요하다.
 * `metadata` 에 Factory 가 각인한 정책(`channelTypes`·`autoMergeAllowed`)이 담긴다 (AD-3).
 */
export const sdlcRequests = sdlcSchema.table(
  'sdlc_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNo: varchar('request_no', { length: 100 }).notNull(),
    submitter: varchar('submitter', { length: 255 }).notNull(),
    submitterId: text('submitter_id').references(() => users.id),
    submitterEmail: varchar('submitter_email', { length: 255 }),
    submitterGithubLogin: varchar('submitter_github_login', { length: 255 }),
    requestSite: varchar('request_site', { length: 50 }).notNull(),
    devType: varchar('dev_type', { length: 50 }).notNull(),
    requestSystem: varchar('request_system', { length: 255 }).notNull(),
    module: varchar('module', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('1_REGISTERED'),
    dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
    metadata: jsonb('metadata').$type<SdlcRequestMetadata>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_requests_request_no_idx').on(t.requestNo),
    uniqueIndex('sdlc_requests_dedup_key_idx').on(t.dedupKey),
  ],
);

/** 상태 전이 이력. append-only. `idempotencyKey` unique 가 멱등 실행을 보장한다. */
export const sdlcStageTransitions = sdlcSchema.table(
  'sdlc_stage_transitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 50 }).notNull(),
    toStatus: varchar('to_status', { length: 50 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    actor: varchar('actor', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_stage_transitions_idem_idx').on(t.idempotencyKey)],
);

/** Conda 환경 캐시. SDLC 코어 동작에는 필수가 아니며 Pod 시작 시간 단축용. */
export const sdlcCondaCacheVersions = sdlcSchema.table(
  'sdlc_conda_cache_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cacheKey: varchar('cache_key', { length: 64 }).notNull(),
    envHash: varchar('env_hash', { length: 64 }),
    objectKey: text('object_key').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    sourceRequestId: uuid('source_request_id').references(() => sdlcRequests.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_conda_cache_key_idx').on(t.cacheKey, t.envHash)],
);

/* ── 메시징 ─────────────────────────────────────────────────────── */

/** 채널 매핑. 플랫폼 중립 컬럼 — Slack 외 어댑터로 교체 가능 (NFR-25). */
export const sdlcMessagingChannels = sdlcSchema.table(
  'sdlc_messaging_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    channelName: varchar('channel_name', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    stage: varchar('stage', { length: 50 }).notNull(),
    platform: varchar('platform', { length: 16 }).notNull().default('slack'),
    /** 보상 트랜잭션은 이 값을 세팅하지 않는다 — 실패 채널을 남긴다 (NFR-08). */
    archived: boolean('archived').notNull().default(false),
    members: jsonb('members').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_messaging_channels_channel_id_idx').on(t.channelId),
    index('sdlc_messaging_channels_req_type_idx').on(t.requestId, t.type),
  ],
);

export const sdlcRequestChannelMessages = sdlcSchema.table(
  'sdlc_request_channel_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sdlcRequestId: uuid('sdlc_request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    channelType: varchar('channel_type', { length: 50 }).notNull(),
    messageId: varchar('message_id', { length: 255 }).notNull(),
    sender: varchar('sender', { length: 255 }).notNull(),
    senderName: varchar('sender_name', { length: 255 }),
    senderId: varchar('sender_id', { length: 255 }),
    content: text('content').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_req_channel_msg_unique_idx').on(t.sdlcRequestId, t.channelId, t.messageId),
    index('sdlc_req_channel_msg_cursor_idx').on(t.sdlcRequestId, t.channelType, t.sentAt),
  ],
);

/* ── GitHub ─────────────────────────────────────────────────────── */

/** PAT 평문은 저장하지 않는다 — `secret_refs` 참조만 보관 (NFR-10). */
export const sdlcGithubCredentials = sdlcSchema.table('sdlc_github_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  patSecretRefId: uuid('pat_secret_ref_id')
    .notNull()
    .references(() => secretRefs.id),
  gitUserName: varchar('git_user_name', { length: 255 }).notNull().default('SDLC Bot'),
  gitUserEmail: varchar('git_user_email', { length: 255 })
    .notNull()
    .default('sdlc-bot@example.local'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sdlcGithubOrgs = sdlcSchema.table(
  'sdlc_github_orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgUrl: varchar('org_url', { length: 1024 }).notNull(),
    orgName: varchar('org_name', { length: 255 }).notNull(),
    credentialId: uuid('credential_id').references(() => sdlcGithubCredentials.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_github_orgs_url_idx').on(t.orgUrl)],
);

export const sdlcGithubRepos = sdlcSchema.table(
  'sdlc_github_repos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => sdlcGithubOrgs.id, { onDelete: 'cascade' }),
    repoUrl: varchar('repo_url', { length: 1024 }).notNull(),
    repoName: varchar('repo_name', { length: 255 }).notNull(),
    description: text('description'),
    defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
    autoPrMerge: boolean('auto_pr_merge').notNull().default(false),
    forcedClone: boolean('forced_clone').notNull().default(false),
    runnable: boolean('runnable').notNull().default(false),
    isUi: boolean('is_ui').notNull().default(false),
    playwrightEnabled: boolean('playwright_enabled').notNull().default(false),
    devServerUrl: varchar('dev_server_url', { length: 1024 }),
    improvementScanEnabled: boolean('improvement_scan_enabled').notNull().default(false),
    improvementScanIntervalDays: integer('improvement_scan_interval_days')
      .notNull()
      .default(14),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_github_repos_org_repo_idx').on(t.orgId, t.repoUrl)],
);

export const sdlcGithubIssues = sdlcSchema.table(
  'sdlc_github_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    issueNumber: integer('issue_number').notNull(),
    repo: varchar('repo', { length: 512 }).notNull(),
    state: varchar('state', { length: 50 }).notNull().default('open'),
    htmlUrl: varchar('html_url', { length: 1024 }),
    workBranch: varchar('work_branch', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_github_issues_repo_number_idx').on(t.repo, t.issueNumber),
    index('sdlc_github_issues_request_id_idx').on(t.requestId),
  ],
);

export const sdlcGithubPullRequests = sdlcSchema.table(
  'sdlc_github_pull_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    prNumber: integer('pr_number').notNull(),
    repo: varchar('repo', { length: 512 }).notNull(),
    state: varchar('state', { length: 50 }).notNull().default('open'),
    head: varchar('head', { length: 255 }).notNull(),
    base: varchar('base', { length: 255 }).notNull(),
    htmlUrl: varchar('html_url', { length: 1024 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_github_pull_requests_repo_number_idx').on(t.repo, t.prNumber),
    index('sdlc_github_pull_requests_request_id_idx').on(t.requestId),
  ],
);

/* ── Pod · 피드백 · 보고서 · 이미지 ─────────────────────────────── */

export const sdlcPodSessions = sdlcSchema.table(
  'sdlc_pod_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    podName: varchar('pod_name', { length: 255 }).notNull(),
    endpoint: varchar('endpoint', { length: 1024 }),
    sessionId: varchar('session_id', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('PENDING'),
    gitRepo: varchar('git_repo', { length: 1024 }),
    branch: varchar('branch', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_pod_sessions_request_id_idx').on(t.requestId)],
);

/**
 * 피드백 대기.
 * `lastMessageId` 는 폴링 커서가 아니라 **dedup 커서**다 — Slack `ts` 단조 증가에 의존해
 * `active AND (last_message_id IS NULL OR last_message_id < :ts)` CAS UPDATE 로 중복 수신을 막는다.
 */
export const sdlcFeedbackPolls = sdlcSchema.table(
  'sdlc_feedback_polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    channelType: varchar('channel_type', { length: 50 }).notNull(),
    callbackUrl: text('callback_url').notNull(),
    lastMessageId: varchar('last_message_id', { length: 255 }),
    lastMailSentAt: timestamp('last_mail_sent_at', { withTimezone: true }),
    nudgeMailSent: boolean('nudge_mail_sent').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sdlc_feedback_polls_request_idx').on(t.requestId, t.active)],
);

export const sdlcRequestReports = sdlcSchema.table(
  'sdlc_request_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    channelType: varchar('channel_type', { length: 50 }).notNull(),
    content: text('content').notNull(),
    designPrompt: text('design_prompt'),
    designPromptOptions: jsonb('design_prompt_options').$type<{
      call_webhook?: boolean;
      resume?: boolean;
      timeout_seconds?: number;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_request_reports_request_channel_idx').on(t.requestId, t.channelType)],
);

export const sdlcRequestImages = sdlcSchema.table(
  'sdlc_request_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => sdlcRequests.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    screenName: text('screen_name'),
    mimeType: text('mime_type').notNull().default('image/png'),
    objectKey: text('object_key').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('sdlc_request_images_request_id_idx').on(t.requestId)],
);

/* ── Repo 셋업 ──────────────────────────────────────────────────── */

export const sdlcRepoSetupJobs = sdlcSchema.table(
  'sdlc_repo_setup_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => sdlcGithubRepos.id, { onDelete: 'cascade' }),
    podName: varchar('pod_name', { length: 255 }).notNull(),
    namespace: varchar('namespace', { length: 255 }).notNull(),
    endpoint: varchar('endpoint', { length: 1024 }),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    errorMessage: text('error_message'),
    requestedBy: varchar('requested_by', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [uniqueIndex('sdlc_repo_setup_jobs_repo_id_idx').on(t.repoId)],
);

export const sdlcRepoFiles = sdlcSchema.table(
  'sdlc_repo_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => sdlcGithubRepos.id, { onDelete: 'cascade' }),
    relativePath: varchar('relative_path', { length: 512 }).notNull(),
    contentSecretRefId: uuid('content_secret_ref_id')
      .notNull()
      .references(() => secretRefs.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_repo_files_repo_path_idx').on(t.repoId, t.relativePath)],
);

export const sdlcRepoEnvVars = sdlcSchema.table(
  'sdlc_repo_env_vars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => sdlcGithubRepos.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 256 }).notNull(),
    valueSecretRefId: uuid('value_secret_ref_id')
      .notNull()
      .references(() => secretRefs.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_repo_env_vars_repo_key_idx').on(t.repoId, t.key)],
);
