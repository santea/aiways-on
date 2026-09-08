import { defineConfig } from 'drizzle-kit';

/**
 * 마이그레이션 생성 설정 — U1 단독 소유 (UOW-8).
 *
 * 유닛은 자기 스키마 파일에 테이블을 추가하고, **마이그레이션 생성은 U1 이 일괄 수행**한다.
 * 6명이 각자 생성하면 마이그레이션 순서가 엉키기 때문이다.
 *
 * FK 의존 순서는 04-db-schema.md §11.2 를 따른다 — 특히 규정(memory) 테이블이
 * 장애(incident)·개선(improvement)보다 먼저 만들어져야 한다.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/lib/src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/aiways_on',
  },
  schemaFilter: ['public', 'sdlc'],
  verbose: true,
  strict: true,
});
