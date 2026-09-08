/**
 * 감사 로그 저장 — **append 만 있다** (NFR-18).
 * UPDATE·DELETE 함수를 여기에 추가하면 append-only 보장이 깨진다.
 */
import { getDb, schema } from '@aiways/lib/db';
import type { AuditRepository } from './audit-service';

export function createDrizzleAuditRepository(db = getDb()): AuditRepository {
  return {
    async append(event) {
      await db.insert(schema.auditEvents).values({
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        action: event.action,
        metadata: event.metadata,
      });
    },
  };
}
