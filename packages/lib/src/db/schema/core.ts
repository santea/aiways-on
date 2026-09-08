/**
 * 공통·인증 테이블 — **U1 단독 소유** (UOW-8).
 *
 * 이 파일의 테이블은 전 유닛이 참조하므로 U1 만 편집한다.
 * 근거: requirements/04-db-schema.md §2·§8
 */
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sdlcSchema } from './_schema';

/* ── 인증 (public 스키마 — Auth.js Adapter 호환) ─────────────────── */

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  githubId: text('github_id').unique(),
  githubLogin: text('github_login'),
  /** 'user' | 'admin' — 단순 2단계 RBAC (01-auth-github.md §5) */
  role: varchar('role', { length: 16 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ── 공통 (sdlc 스키마) ──────────────────────────────────────────── */

/**
 * 암호화 참조. **실제 비밀값(PAT·토큰·비밀번호)을 평문으로 저장하지 않는다** (NFR-10).
 * AES-256-GCM 암호문과 IV 만 보관하며, `hint` 는 로그용 종류 힌트일 뿐 실제 값이 아니다.
 */
export const secretRefs = sdlcSchema.table('secret_refs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ciphertext: text('ciphertext').notNull(),
  iv: varchar('iv', { length: 64 }).notNull(),
  hint: varchar('hint', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 감사 로그. **append-only** (NFR-18) — UPDATE·DELETE 하지 않는다.
 */
export const auditEvents = sdlcSchema.table(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    correlationId: varchar('correlation_id', { length: 100 }),
    actorId: varchar('actor_id', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId: varchar('resource_id', { length: 255 }),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_events_correlation_idx').on(t.correlationId),
    index('audit_events_action_idx').on(t.action, t.createdAt),
  ],
);
