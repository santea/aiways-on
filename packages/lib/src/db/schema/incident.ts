/**
 * 장애 대응 테이블 — 편집 U4 (UOW-8).
 * 근거: requirements/11-incident-response-agent.md §8
 */
import {
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
import { sdlcSchema } from './_schema';
import { sdlcGithubRepos, sdlcRequests } from './sdlc';
import { sdlcMemoryRules } from './memory';

/** 장애 템플릿. `enabled=false` 면 주입을 거부한다. */
export const sdlcIncidentTemplates = sdlcSchema.table(
  'sdlc_incident_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateKey: varchar('template_key', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    symptomMd: text('symptom_md').notNull(),
    payloadTemplate: jsonb('payload_template').$type<Record<string, unknown>>(),
    targetRepoId: uuid('target_repo_id').references(() => sdlcGithubRepos.id, {
      onDelete: 'set null',
    }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_incident_templates_key_idx').on(t.templateKey)],
);

/**
 * 장애.
 *
 * ⚠️ 자동머지 금지·채널 1개 규칙은 **이 테이블이나 U4 코드에 있지 않다.**
 *    incident SR 로 승격할 때 Factory 가 `sdlc_requests.metadata` 에 각인한다 (AD-3).
 */
export const sdlcIncidents = sdlcSchema.table(
  'sdlc_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentNo: varchar('incident_no', { length: 100 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    /** critical | high | medium | low */
    severity: varchar('severity', { length: 16 }).notNull(),
    /** manual | test_injection | external | monitoring */
    source: varchar('source', { length: 32 }).notNull().default('manual'),
    templateId: uuid('template_id').references(() => sdlcIncidentTemplates.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 32 }).notNull().default('DETECTED'),
    symptomMd: text('symptom_md'),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
    requestId: uuid('request_id').references(() => sdlcRequests.id, { onDelete: 'set null' }),
    memoryRuleId: uuid('memory_rule_id').references(() => sdlcMemoryRules.id, {
      onDelete: 'set null',
    }),
    /** 3회 초과 시 X_FAILED */
    promotionAttempts: integer('promotion_attempts').notNull().default(0),
    lastError: text('last_error'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_incidents_incident_no_idx').on(t.incidentNo),
    uniqueIndex('sdlc_incidents_dedup_key_idx').on(t.dedupKey),
    index('sdlc_incidents_status_idx').on(t.status),
    index('sdlc_incidents_request_idx').on(t.requestId),
  ],
);

/** 분석 산출물. append-only (`updated_at` 없음). */
export const sdlcIncidentAnalyses = sdlcSchema.table(
  'sdlc_incident_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => sdlcIncidents.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id').references(() => sdlcRequests.id, { onDelete: 'set null' }),
    /** guide | patch | rejected_hypothesis */
    kind: varchar('kind', { length: 32 }).notNull(),
    contentMd: text('content_md'),
    commitSha: varchar('commit_sha', { length: 64 }),
    prNumber: integer('pr_number'),
    claudeSessionId: varchar('claude_session_id', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('sdlc_incident_analyses_incident_idx').on(t.incidentId)],
);
