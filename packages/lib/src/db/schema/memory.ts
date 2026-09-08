/**
 * 개발 규정 테이블 — 편집 U6 (UOW-8).
 *
 * ⚠️ 생성 순서 제약: 이 파일의 테이블은 `incident.ts`·`improvement.ts` 보다 **먼저** 만들어져야
 *    한다. `sdlc_incidents.memory_rule_id` 와 `sdlc_improvement_findings.memory_rule_id` 가
 *    `sdlc_memory_rules` 를 FK 참조하기 때문이다 (04-db-schema.md §11.2).
 *
 * 근거: requirements/13-developer-memory-agent.md §3
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
import { secretRefs, users } from './core';
import { sdlcRequests } from './sdlc';

/** 규정 5종. `version` 은 낙관적 동시성 카운터다. */
export const sdlcMemoryRules = sdlcSchema.table(
  'sdlc_memory_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** system_profile | behavior | prohibition | failure_case | incident_response */
    category: varchar('category', { length: 32 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    summary: varchar('summary', { length: 1000 }),
    contentMd: text('content_md').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    /** critical | warn | info */
    severity: varchar('severity', { length: 16 }).notNull().default('info'),
    /** manual | incident | improvement | agent */
    sourceType: varchar('source_type', { length: 16 }).notNull().default('manual'),
    /**
     * `sdlc_incidents.id` 또는 `sdlc_improvement_findings.id` 를 가리키는 **다형 참조**.
     * 두 테이블 중 하나이므로 단일 FK 로 표현할 수 없어 FK 를 걸지 않는다.
     * 대신 두 테이블이 `memory_rule_id` 로 역방향 FK 를 갖는다.
     */
    sourceRefId: uuid('source_ref_id'),
    /** active | archived */
    status: varchar('status', { length: 16 }).notNull().default('active'),
    version: integer('version').notNull().default(1),
    hitCount: integer('hit_count').notNull().default(0),
    lastReferencedAt: timestamp('last_referenced_at', { withTimezone: true }),
    createdByActor: varchar('created_by_actor', { length: 255 }),
    updatedByActor: varchar('updated_by_actor', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_memory_rules_slug_idx').on(t.category, t.slug),
    index('sdlc_memory_rules_category_idx').on(t.category, t.status),
    index('sdlc_memory_rules_status_idx').on(t.status),
    index('sdlc_memory_rules_source_idx').on(t.sourceType, t.sourceRefId),
  ],
);

/**
 * 개정 이력. **append-only** — UPDATE·DELETE 하지 않는다.
 * actor·timestamp·개정 직전 본문을 남겨 누가 언제 무엇을 바꿨는지 추적한다 (SECURITY-13).
 */
export const sdlcMemoryRuleRevisions = sdlcSchema.table(
  'sdlc_memory_rule_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => sdlcMemoryRules.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    contentMd: text('content_md').notNull(),
    title: varchar('title', { length: 500 }),
    changeSummary: varchar('change_summary', { length: 1000 }),
    actor: varchar('actor', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sdlc_memory_rule_revisions_version_idx').on(t.ruleId, t.version)],
);

/**
 * MCP 접근 토큰. **평문 토큰을 저장하지 않는다** — sha256 해시로만 조회하고
 * 암호문은 `secret_refs` 참조로 둔다 (NFR-10, SECURITY-12).
 */
export const sdlcMemoryAccessTokens = sdlcSchema.table(
  'sdlc_memory_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    tokenSecretRefId: uuid('token_secret_ref_id').references(() => secretRefs.id, {
      onDelete: 'set null',
    }),
    /** read | read_write */
    scope: varchar('scope', { length: 16 }).notNull().default('read'),
    /** developer | agent */
    subjectType: varchar('subject_type', { length: 16 }).notNull().default('developer'),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** agent 토큰만 사용 — 발급 대상 SR 에 바인딩된다. */
    requestId: uuid('request_id').references(() => sdlcRequests.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sdlc_memory_access_tokens_hash_idx').on(t.tokenHash),
    index('sdlc_memory_access_tokens_owner_idx').on(t.ownerUserId, t.revokedAt),
    index('sdlc_memory_access_tokens_request_idx').on(t.requestId),
  ],
);
