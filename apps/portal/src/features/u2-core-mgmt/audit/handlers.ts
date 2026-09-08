/** 감사 로그 라우트 — `05-portal-api.md` §2.3 (US-U2-08). */
import type { RequireMasterKey } from '@aiways/lib/auth';
import { handle, readJson, routeParam } from '../http/route-helpers';
import type { AuditService } from './audit-service';

export interface AuditHandlerDeps {
  readonly requireMasterKey: RequireMasterKey;
  readonly service: () => AuditService;
}

export function createAuditHandlers({ requireMasterKey, service }: AuditHandlerDeps) {
  return {
    POST: handle(async (request, context) => {
      requireMasterKey(request);
      const requestId = await routeParam(context, 'id');
      await service().record(requestId, (await readJson(request)) as never);
      return Response.json({ ok: true });
    }),
  };
}
