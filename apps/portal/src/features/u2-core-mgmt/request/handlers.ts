/**
 * SR 라우트 핸들러 — `05-portal-api.md` §2.1·§2.4·§2.13·§2.14·§4.2·§4.8·§4.9.
 *
 * 인증 배분은 §8 인증 매트릭스를 그대로 따른다:
 *  - 서버 간 호출(`/intake`, `/issues`) → `requireMasterKey`
 *  - UI 조회(`/requests*`, `/generate-request-no`, `/dev-types`) → 세션 (서비스 내부에서 가드)
 *
 * 자체 Bearer 비교 로직을 여기에 쓰지 않는다 — AuthGuard 를 통과한다 (AD-2).
 */
import type { RequireMasterKey } from '@aiways/lib/auth';
import { handle, intParam, readJson, routeParam } from '../http/route-helpers';
import type { IntakeService } from './intake-service';
import type { IssueService } from './issue-service';
import type { QueryService } from './query-service';

export interface IntakeHandlerDeps {
  readonly requireMasterKey: RequireMasterKey;
  readonly service: () => IntakeService;
}

export function createIntakeHandlers({ requireMasterKey, service }: IntakeHandlerDeps) {
  return {
    POST: handle(async (request) => {
      requireMasterKey(request);
      const result = await service().intake((await readJson(request)) as never);
      return Response.json(result, { status: 201 });
    }),
  };
}

export interface QueryHandlerDeps {
  readonly service: () => QueryService;
}

export function createRequestsHandlers({ service }: QueryHandlerDeps) {
  return {
    GET: handle(async (request) => {
      const url = new URL(request.url);
      return Response.json(
        await service().listRequests({
          status: url.searchParams.get('status'),
          search: url.searchParams.get('search'),
          page: intParam(url, 'page', 1, { min: 1, max: 100000 }),
          limit: intParam(url, 'limit', 20, { min: 1, max: 100 }),
        }),
      );
    }),
  };
}

export function createRequestDetailHandlers({ service }: QueryHandlerDeps) {
  return {
    GET: handle(async (_request, context) =>
      Response.json(await service().getRequest(await routeParam(context, 'id'))),
    ),
  };
}

export function createGithubLinksHandlers({ service }: QueryHandlerDeps) {
  return {
    GET: handle(async (_request, context) =>
      Response.json(await service().getGithubLinks(await routeParam(context, 'id'))),
    ),
  };
}

export function createRequestNoHandlers({ service }: QueryHandlerDeps) {
  return {
    GET: handle(async () => Response.json(await service().nextRequestNo())),
  };
}

export function createDevTypesHandlers({ service }: QueryHandlerDeps) {
  return {
    GET: handle(async () => Response.json(await service().devTypes())),
  };
}

export interface IssueHandlerDeps {
  readonly requireMasterKey: RequireMasterKey;
  readonly service: () => IssueService;
}

export function createIssuesHandlers({ requireMasterKey, service }: IssueHandlerDeps) {
  return {
    POST: handle(async (request, context) => {
      requireMasterKey(request);
      const requestId = await routeParam(context, 'id');
      const result = await service().ensureIssues(requestId, (await readJson(request)) as never);
      return Response.json(result);
    }),
  };
}
