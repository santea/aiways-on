/**
 * 관리자 API 핸들러 — `05-portal-api.md` §3 (US-U2-05).
 *
 * 전 라우트가 `requireAdmin` 을 통과한다 (C-2.4 규약). 라우트 파일은 이 팩토리를
 * 부르기만 하는 3줄짜리 어댑터이므로, 검증은 여기서 DB 없이 이뤄진다.
 */
import type { RequireAdmin } from '@aiways/lib/auth';
import { handle, readJson } from '../http/route-helpers';
import type { GithubAdminService } from './admin-service';

export interface AdminHandlerDeps {
  readonly requireAdmin: RequireAdmin;
  readonly service: () => GithubAdminService;
}

export function createOrgsHandlers({ requireAdmin, service }: AdminHandlerDeps) {
  return {
    GET: handle(async () => {
      await requireAdmin();
      return Response.json(await service().listOrgs());
    }),
    POST: handle(async (request) => {
      await requireAdmin();
      const created = await service().registerOrg((await readJson(request)) as never);
      return Response.json(created, { status: 201 });
    }),
  };
}

export function createReposHandlers({ requireAdmin, service }: AdminHandlerDeps) {
  return {
    GET: handle(async (request) => {
      await requireAdmin();
      const orgId = new URL(request.url).searchParams.get('orgId');
      return Response.json(await service().listRepos(orgId));
    }),
    POST: handle(async (request) => {
      const admin = await requireAdmin();
      const created = await service().registerRepo(
        (await readJson(request)) as never,
        admin.id,
      );
      return Response.json(created, { status: 201 });
    }),
  };
}

export function createCredentialsHandlers({ requireAdmin, service }: AdminHandlerDeps) {
  return {
    POST: handle(async (request) => {
      await requireAdmin();
      // 응답에 `pat` 이 실리지 않는 것은 서비스가 보장한다 (NFR-10).
      const created = await service().createCredential((await readJson(request)) as never);
      return Response.json(created, { status: 201 });
    }),
  };
}
