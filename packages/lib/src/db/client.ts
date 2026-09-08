/**
 * DB 연결 — U1 소유 (C-1.3).
 * 유닛은 이 `db` 를 import 해서 쓰고 자체 연결을 만들지 않는다 (연결 풀 분산 방지).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(databaseUrl = process.env['DATABASE_URL']) {
  if (cached) return cached;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 이 설정되지 않았다');
  }
  // Portal 은 stateless 이고 replicas 2+ 이므로 인스턴스당 연결 수를 제한한다 (NFR-01·02).
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}
