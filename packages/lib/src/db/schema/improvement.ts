/**
 * 자체개선 테이블 — 편집 U5 (UOW-8).
 * 근거: requirements/12-self-improvement-agent.md §7
 */
import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sdlcSchema } from './_schema';
import { sdlcGithubRepos, sdlcRequests } from './sdlc';
import { sdlcMemoryRules } from './memory';

/** 스캔 회차. 스캔은 **읽기 전용**이며 repo 에 쓰지 않는다. */
export const sdlcImprovementScans = sdlcSchema.table(
  'sdlc_improvement_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanNo: varchar('scan_no', { length: 100 }).notNull(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => sdlcGithubRepos.id, { onDelete: 'cascade' }),
    /** pending | promoting | running | completed | failed */
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    requestId: uuid('request_id').references(() => sdlcRequests.id, { onDelete: 'set null' }),
    baseCommitSha: varchar('base_commit_sha', { length: 64 }),
    findingCount: integer('finding_count').notNull().default(0),
    summaryMd: text('summary_md'),
    /** cron | manual */
    triggeredBy: varchar('triggered_by', { length: 32 }).notNull().default('cron'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_improvement_scans_scan_no_idx').on(t.scanNo),
    index('sdlc_improvement_scans_repo_idx').on(t.repoId),
    index('sdlc_improvement_scans_status_idx').on(t.status),
    index('sdlc_improvement_scans_repo_completed_idx').on(t.repoId, t.completedAt),
  ],
);

/** 발굴 항목. `fingerprint` 로 재검출을 판정한다. */
export const sdlcImprovementFindings = sdlcSchema.table(
  'sdlc_improvement_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => sdlcImprovementScans.id, { onDelete: 'cascade' }),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    /** code_smell | architecture | security | dependency | test_coverage | dx | performance */
    category: varchar('category', { length: 32 }).notNull(),
    /** critical | high | medium | low */
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    title: varchar('title', { length: 500 }).notNull(),
    descriptionMd: text('description_md').notNull(),
    filePaths: jsonb('file_paths').$type<string[]>().notNull().default([]),
    recommendationMd: text('recommendation_md'),
    /** S | M | L */
    estimatedEffort: varchar('estimated_effort', { length: 16 }),
    /** proposed | accepted | promoted_sr | promoted_memory | rejected */
    status: varchar('status', { length: 32 }).notNull().default('proposed'),
    promotedRequestId: uuid('promoted_request_id').references(() => sdlcRequests.id, {
      onDelete: 'set null',
    }),
    memoryRuleId: uuid('memory_rule_id').references(() => sdlcMemoryRules.id, {
      onDelete: 'set null',
    }),
    recurrenceCount: integer('recurrence_count').notNull().default(1),
    rejectReason: text('reject_reason'),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('sdlc_improvement_findings_scan_idx').on(t.scanId),
    index('sdlc_improvement_findings_fingerprint_idx').on(t.fingerprint),
    index('sdlc_improvement_findings_status_idx').on(t.status),
    index('sdlc_improvement_findings_category_severity_idx').on(t.category, t.severity),
    uniqueIndex('sdlc_improvement_findings_scan_fingerprint_idx').on(t.scanId, t.fingerprint),
  ],
);
